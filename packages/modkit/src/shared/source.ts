import { MOD_ID_RULE, RESERVED_MOD_IDS, parseManifest, type Manifest } from './manifest'
import { parseVersion } from './range'

export const SOURCE_SCHEMA = 1
export const MAX_SOURCE_SCREENSHOTS = 8

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

export type ParsedSource = { readonly ok: true; readonly source: ModSource<ListedRelease> }
  | { readonly ok: false; readonly error: string }

type Fields = Record<string, unknown>
const object = (value: unknown): value is Fields => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const https = (value: unknown): value is string => {
  if (!text(value)) return false
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password }
  catch { return false }
}
class Refusal { constructor(readonly error: string) {} }
function refuse(error: string): never { throw new Refusal(error) }
function fields(value: unknown, allowed: readonly string[], where: string): Fields {
  if (!object(value)) refuse(`${where} is not an object`)
  const extra = Object.keys(value).find(key => !allowed.includes(key))
  if (extra !== undefined) refuse(`${where} has unknown field ${JSON.stringify(extra)}`)
  return value
}
function version(value: unknown, where: string): string {
  if (!text(value) || !parseVersion(value)) refuse(`${where} is not major.minor.patch`)
  return value
}
function address(value: unknown, where: string): string {
  if (!https(value)) refuse(`${where} must be an https URL without credentials`)
  return value
}
function list(value: unknown, where: string): unknown[] {
  if (!Array.isArray(value)) refuse(`${where} is not a list`)
  return value
}

/** Reads a whole vxsource.json; only bad screenshot entries are isolated instead of fatal. */
export function parseSource(json: unknown): ParsedSource {
  try {
    if (!object(json)) refuse('vxsource.json is not an object')
    if (typeof json.source !== 'number') refuse('"source" is missing or not a number')
    if (json.source > SOURCE_SCHEMA) refuse(`made for a newer game: source ${json.source} where this core reads ${SOURCE_SCHEMA}`)
    if (json.source !== SOURCE_SCHEMA) refuse(`"source" is not ${SOURCE_SCHEMA}`)
    fields(json, ['source', 'name', 'mods'], 'vxsource.json')
    if (!text(json.name)) refuse('"name" is missing or empty')
    const ids = new Set<string>()
    const mods = list(json.mods, '"mods"').map(raw => {
      const mod = fields(raw, ['id', 'repo', 'releases', 'withdrawn', 'bundledIn', 'cover', 'screenshots'], 'mod entry')
      if (!text(mod.id) || !MOD_ID_RULE.test(mod.id) || RESERVED_MOD_IDS.includes(mod.id)) refuse('mod entry has an invalid or reserved id')
      const id = mod.id
      if (ids.has(id)) refuse(`mod id ${id} is listed twice`)
      ids.add(id)
      const repo = address(mod.repo, `${id}.repo`)
      const versions = new Set<string>()
      const releases = list(mod.releases, `${id}.releases`).map(rawRelease => {
        const release = fields(rawRelease, ['version', 'zip', 'sha256', 'size', 'manifest', 'approved'], `${id} release`)
        const v = version(release.version, `${id}.version`)
        if (versions.has(v)) refuse(`${id} version ${v} is listed twice`)
        versions.add(v)
        const where = `${id}@${v}`
        const zip = address(release.zip, `${where}.zip`)
        if (typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/i.test(release.sha256)) refuse(`${where}.sha256 must be a SHA-256 hash`)
        if (!Number.isSafeInteger(release.size) || (release.size as number) <= 0) refuse(`${where}.size must be a positive safe integer`)
        const parsed = parseManifest(release.manifest, { id, version: v })
        if (!parsed.ok) refuse(`${where}.manifest: ${parsed.error}`)
        let approved: SourceApproval | undefined
        if (release.approved !== undefined) {
          const a = fields(release.approved, ['by', 'pr', 'at'], `${where}.approved`)
          if (!text(a.by)) refuse(`${where}.approved.by is missing or empty`)
          if (!Number.isSafeInteger(a.pr) || (a.pr as number) <= 0) refuse(`${where}.approved.pr must be a positive safe integer`)
          if (typeof a.at !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(a.at) || !Number.isFinite(Date.parse(a.at)) || new Date(a.at).toISOString().slice(0, 10) !== a.at) refuse(`${where}.approved.at is not a calendar date`)
          approved = { by: a.by, pr: a.pr as number, at: a.at }
        }
        return { version: v, zip, sha256: release.sha256, size: release.size as number, manifest: parsed.manifest,
          ...(approved ? { approved } : {}) }
      })
      const withdrawnVersions = new Set<string>()
      const withdrawn = mod.withdrawn === undefined ? undefined : list(mod.withdrawn, `${id}.withdrawn`).map(rawWithdrawal => {
        const w = fields(rawWithdrawal, ['version', 'reason'], `${id} withdrawal`)
        const v = version(w.version, `${id}.withdrawn.version`)
        if (withdrawnVersions.has(v)) refuse(`${id} withdrawn version ${v} is listed twice`)
        withdrawnVersions.add(v)
        if (!text(w.reason)) refuse(`${id}.withdrawn.reason is missing or empty`)
        return { version: v, reason: w.reason }
      })
      const screenshots: SourceScreenshot[] = []
      if (Array.isArray(mod.screenshots)) for (const shot of mod.screenshots) {
        if (!object(shot) || Object.keys(shot).some(key => key !== 'url' && key !== 'caption') || !https(shot.url) || (shot.caption !== undefined && !text(shot.caption))) continue
        screenshots.push({ url: shot.url, ...(shot.caption !== undefined ? { caption: shot.caption as string } : {}) })
        if (screenshots.length === MAX_SOURCE_SCREENSHOTS) break
      }
      return { id, repo, releases,
        ...(mod.bundledIn !== undefined ? { bundledIn: version(mod.bundledIn, `${id}.bundledIn`) } : {}),
        ...(withdrawn !== undefined ? { withdrawn } : {}),
        ...(mod.cover !== undefined ? { cover: address(mod.cover, `${id}.cover`) } : {}),
        ...(screenshots.length ? { screenshots } : {}) }
    })
    return { ok: true, source: { source: SOURCE_SCHEMA, name: json.name, mods } }
  } catch (error) {
    if (error instanceof Refusal) return { ok: false, error: error.error }
    throw error
  }
}
