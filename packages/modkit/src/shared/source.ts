import { MOD_ID_RULE, RESERVED_MOD_IDS, parseManifest, type Manifest } from './manifest'
import { parseVersion } from './range'

export const SOURCE_SCHEMA = 1
export const MAX_SOURCE_SCREENSHOTS = 8
const MAX_SCREENSHOT_CAPTION_LENGTH = 200

/** A release's approval record. Only the host's approved source can confer trust. */
export interface SourceApproval {
  readonly by: string
  readonly pr: number
  readonly at: string
}

/** A discoverable release; repo sources have no pinned hash. */
export interface SourceRelease {
  readonly version: string
  readonly zip: string
  readonly size: number
  readonly sha256?: string
  readonly manifest: Manifest
  readonly approved?: SourceApproval
}

/** Every list release has a pinned hash, unlike a GitHub repo release. */
export interface ListedRelease extends SourceRelease {
  readonly sha256: string
}

export interface SourceScreenshot {
  readonly url: string
  readonly caption?: string
}

export interface SourceMod<R extends SourceRelease = SourceRelease> {
  readonly id: string
  readonly repo: string
  readonly releases: readonly R[]
  readonly bundledIn?: string
  readonly withdrawn?: readonly { readonly version: string; readonly reason: string }[]
  readonly cover?: string
  readonly screenshots?: readonly SourceScreenshot[]
}

export interface ModSource<R extends SourceRelease = SourceRelease> {
  readonly source: 1
  readonly name: string
  readonly mods: readonly SourceMod<R>[]
}

export type ParsedSource =
  | { readonly ok: true; readonly source: ModSource<ListedRelease> }
  | { readonly ok: false; readonly error: string }

type Fields = Record<string, unknown>
/** Whether the source value is a plain JSON object. */
const object = (value: unknown): value is Fields => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
/** Whether the value contains nonblank text. */
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
/** Whether the value is an HTTPS address without credentials. */
const https = (value: unknown): value is string => {
  if (!text(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}
class Refusal {
  constructor(readonly error: string) {}
}
/** Stops parsing with the field that could not be read. */
function refuse(error: string): never {
  throw new Refusal(error)
}
/** Checks an object against the allowed fields at this position. */
function fields(value: unknown, allowed: readonly string[], where: string): Fields {
  if (!object(value)) refuse(`${where} is not an object`)
  const extra = Object.keys(value).find((key) => !allowed.includes(key))
  if (extra !== undefined) refuse(`${where} has unknown field ${JSON.stringify(extra)}`)
  return value
}
/** Reads a strict release version. */
function version(value: unknown, where: string): string {
  if (!text(value) || !parseVersion(value)) refuse(`${where} is not major.minor.patch`)
  return value
}
/** Reads a credential-free HTTPS address. */
function address(value: unknown, where: string): string {
  if (!https(value)) refuse(`${where} must be an https URL without credentials`)
  return value
}
/** Reads a list at the named source position. */
function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) refuse(`${where} is not a list`)
  return value
}

/** Reads a release approval's reviewer, PR and calendar date. */
function readApproval(value: unknown, where: string): SourceApproval | undefined {
  if (value === undefined) return undefined
  const approval = fields(value, ['by', 'pr', 'at'], `${where}.approved`)
  if (!text(approval.by)) refuse(`${where}.approved.by is missing or empty`)
  if (!Number.isSafeInteger(approval.pr) || (approval.pr as number) <= 0) {
    refuse(`${where}.approved.pr must be a positive safe integer`)
  }
  const date = approval.at
  if (
    typeof date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  ) {
    refuse(`${where}.approved.at is not a calendar date`)
  }
  return { by: approval.by, pr: approval.pr as number, at: date }
}

/** Reads a pinned release and checks its manifest against its listing. */
function readRelease(value: unknown, id: string, versions: Set<string>): ListedRelease {
  const release = fields(
    value,
    ['version', 'zip', 'sha256', 'size', 'manifest', 'approved'],
    `${id} release`
  )
  const v = version(release.version, `${id}.version`)
  if (versions.has(v)) refuse(`${id} version ${v} is listed twice`)
  versions.add(v)
  const where = `${id}@${v}`
  const zip = address(release.zip, `${where}.zip`)
  if (typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(release.sha256)) {
    refuse(`${where}.sha256 must be a SHA-256 hash`)
  }
  if (!Number.isSafeInteger(release.size) || (release.size as number) <= 0) {
    refuse(`${where}.size must be a positive safe integer`)
  }
  const parsed = parseManifest(release.manifest, { id, version: v })
  if (!parsed.ok) refuse(`${where}.manifest: ${parsed.error}`)
  const approved = readApproval(release.approved, where)
  return {
    version: v,
    zip,
    sha256: release.sha256,
    size: release.size as number,
    manifest: parsed.manifest,
    ...(approved ? { approved } : {})
  }
}

/** Reads one withdrawal, refusing duplicate versions within the mod. */
function readWithdrawal(
  value: unknown,
  id: string,
  versions: Set<string>
): { version: string; reason: string } {
  const withdrawal = fields(value, ['version', 'reason'], `${id} withdrawal`)
  const v = version(withdrawal.version, `${id}.withdrawn.version`)
  if (versions.has(v)) refuse(`${id} withdrawn version ${v} is listed twice`)
  versions.add(v)
  if (!text(withdrawal.reason)) refuse(`${id}.withdrawn.reason is missing or empty`)
  return { version: v, reason: withdrawal.reason }
}

function readScreenshots(value: unknown, id: string): SourceScreenshot[] {
  const where = `${id}.screenshots`
  const screenshots = list(value, where)
  if (screenshots.length > MAX_SOURCE_SCREENSHOTS) {
    refuse(`${where} may contain at most ${MAX_SOURCE_SCREENSHOTS} entries`)
  }
  return screenshots.map((item, index) => {
    const entry = `${where}[${index}]`
    const { url, caption } = fields(item, ['url', 'caption'], entry)
    const httpsUrl = address(url, `${entry}.url`)
    if (caption === undefined) return { url: httpsUrl }
    if (!text(caption) || caption.length > MAX_SCREENSHOT_CAPTION_LENGTH) {
      refuse(`${entry}.caption must be nonblank text of at most ${MAX_SCREENSHOT_CAPTION_LENGTH} characters`)
    }
    return { url: httpsUrl, caption }
  })
}

/** Reads one mod's releases, withdrawal metadata and artwork. */
function readMod(value: unknown, ids: Set<string>): SourceMod<ListedRelease> {
  const mod = fields(
    value,
    ['id', 'repo', 'releases', 'withdrawn', 'bundledIn', 'cover', 'screenshots'],
    'mod entry'
  )
  if (!text(mod.id) || !MOD_ID_RULE.test(mod.id) || RESERVED_MOD_IDS.includes(mod.id)) {
    refuse('mod entry has an invalid or reserved id')
  }
  const id = mod.id
  if (ids.has(id)) refuse(`mod id ${id} is listed twice`)
  ids.add(id)
  const repo = address(mod.repo, `${id}.repo`)
  const versions = new Set<string>()
  const releases = list(mod.releases, `${id}.releases`).map((release) =>
    readRelease(release, id, versions)
  )
  const withdrawnVersions = new Set<string>()
  const withdrawn =
    mod.withdrawn === undefined
      ? undefined
      : list(mod.withdrawn, `${id}.withdrawn`).map((withdrawal) =>
          readWithdrawal(withdrawal, id, withdrawnVersions)
        )
  return {
    id,
    repo,
    releases,
    ...(mod.bundledIn !== undefined
      ? { bundledIn: version(mod.bundledIn, `${id}.bundledIn`) }
      : {}),
    ...(withdrawn !== undefined ? { withdrawn } : {}),
    ...(mod.cover !== undefined ? { cover: address(mod.cover, `${id}.cover`) } : {}),
    ...(mod.screenshots !== undefined ? { screenshots: readScreenshots(mod.screenshots, id) } : {})
  }
}

/** The parsed source and its nested JSON values are all fresh copies. */
function freezeSource<T>(value: T): T {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freezeSource(child)
    Object.freeze(value)
  }
  return value
}

/** Reads and freezes a whole vxsource.json. */
export function parseSource(json: unknown): ParsedSource {
  try {
    if (!object(json)) refuse('vxsource.json is not an object')
    if (typeof json.source !== 'number') refuse('"source" is missing or not a number')
    if (json.source > SOURCE_SCHEMA) {
      refuse(`made for a newer game: source ${json.source} where this core reads ${SOURCE_SCHEMA}`)
    }
    if (json.source !== SOURCE_SCHEMA) refuse(`"source" is not ${SOURCE_SCHEMA}`)
    fields(json, ['source', 'name', 'mods'], 'vxsource.json')
    if (!text(json.name)) refuse('"name" is missing or empty')
    const ids = new Set<string>()
    const mods = list(json.mods, '"mods"').map((mod) => readMod(mod, ids))
    return {
      ok: true,
      source: freezeSource({ source: SOURCE_SCHEMA, name: json.name, mods })
    }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, error: error.error }
    throw error
  }
}
