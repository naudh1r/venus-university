import type { ModDef, ModOption, ModOptionGroup, ModScope } from '../bridge/shared'
import { manifestHooks } from './compat'
import { parseRange, parseVersion } from './range'

/**
 * A mod's `vxmod.json`, read. The parser checks every field and refuses the whole manifest at the
 * first thing it cannot read, naming the field, so the loader can switch the mod off with a
 * reason rather than run it half-understood. Pure, with no dependency: the loader in main and the
 * kit's tools read a manifest the same way.
 */

export const MANIFEST_SCHEMA = 1

/** Lower case letters and digits, single dashes between. */
export const MOD_ID_RULE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** Ids no mod may have: `host` is the shims' address on `vxmod://`, the other three are the kit's sides in a `side:name`. */
export const RESERVED_MOD_IDS: readonly string[] = ['host', 'shared', 'renderer', 'main']

export interface Manifest {
  readonly manifest: 1
  readonly id: string
  readonly name: string
  readonly author: string
  readonly version: string
  readonly blurb: string
  readonly source: string
  readonly kit: string
  readonly hooks: readonly string[]
  readonly game?: string
  readonly requires?: Readonly<Record<string, string>>
  readonly optional?: Readonly<Record<string, string>>
  readonly main: boolean
  readonly scope: ModScope
  readonly defaultOn: boolean
  readonly offNote?: string
  readonly options?: readonly ModOption[]
  readonly optionGroups?: readonly ModOptionGroup[]
  readonly library?: boolean
  readonly exports?: readonly string[]
  /**
   * Where the mod's data outside the save already lives, from before `modDataPath`: `data`
   * under `data/`, `playthrough` under each playthrough's folder. Each is one or two folder names.
   */
  readonly dataPath?: { readonly data?: string; readonly playthrough?: string }
}

export type ParsedManifest = { readonly ok: true; readonly manifest: Manifest } | { readonly ok: false; readonly error: string }

/** Every field schema 1 has, in the order a manifest is written and the parsed one is built. */
const FIELDS: readonly (keyof Manifest)[] = [
  'manifest',
  'id',
  'name',
  'author',
  'version',
  'blurb',
  'source',
  'kit',
  'hooks',
  'game',
  'requires',
  'optional',
  'main',
  'scope',
  'defaultOn',
  'offNote',
  'options',
  'optionGroups',
  'library',
  'exports',
  'dataPath'
]

/** The names core keeps directly under `data/`, which no mod's `dataPath.data` may start with. */
export const CORE_DATA_NAMES: readonly string[] = [
  'app.log',
  'backgrounds',
  'cast-checked',
  'characters',
  'grabbags.json',
  'mod-data',
  'mods',
  'mods.json',
  'saves',
  'scenes',
  'services',
  'settings.json',
  'tmp',
  'update'
]

/**
 * The names core keeps directly under a playthrough's folder, which no mod's
 * `dataPath.playthrough` may start with; a later semester's graduation picture and every save
 * file are refused by their shape besides.
 */
export const CORE_PLAYTHROUGH_NAMES: readonly string[] = [
  'ending.png',
  'ending.webp',
  'enrollment.json',
  'lorebook.json',
  'mod-data',
  'photos',
  'playthrough.json',
  'profile.png',
  'profile.webp',
  'replays'
]

/** One folder name of a `dataPath`. */
const DATA_SEGMENT = /^[a-z0-9][a-z0-9._-]*$/

/** Names Windows keeps for devices, whatever follows the dot. */
const DEVICE_NAME = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/

/** What core itself names at a playthrough's top beyond its fixed list: graduation pictures and saves. */
const PLAYTHROUGH_SHAPES = /^(ending-[0-9]+\.(png|webp)|.*\.json)$/

/** The fields that must be non-empty text, in the order they are checked. */
const TEXT_FIELDS = ['id', 'name', 'author', 'version', 'blurb', 'source', 'kit'] as const

const SIDES = ['shared', 'renderer', 'main'] as const
type Side = (typeof SIDES)[number]

/** What one name in `hooks` is. */
export type HookNameKind =
  /** A plain hook: `prompts.dm`, `settingsSection`. */
  | { readonly kind: 'hook'; readonly name: string }
  /** One of the kit's APIs, by side: `renderer:useModOn`. */
  | { readonly kind: 'api'; readonly side: Side; readonly name: string }
  /** An export of a library the mod requires: `<lib-id>:<export>`. */
  | { readonly kind: 'export'; readonly library: string; readonly name: string }

/**
 * Reads one name of a `hooks` list, split at its first colon: no colon is a hook, a kit side
 * before it is an API, anything else before it is a library's export. Whether that library is
 * one the mod may name is the parser's question, not this one's.
 */
export function hookNameKind(name: string): HookNameKind {
  const colon = name.indexOf(':')
  if (colon < 0) return { kind: 'hook', name }
  const prefix = name.slice(0, colon)
  const rest = name.slice(colon + 1)
  if ((SIDES as readonly string[]).includes(prefix)) return { kind: 'api', side: prefix as Side, name: rest }
  return { kind: 'export', library: prefix, name: rest }
}

type Fields = Readonly<Record<string, unknown>>

/** Thrown inside the parser with the one-line reason, and caught at its top. */
class Refusal {
  constructor(readonly error: string) {}
}

function refuse(error: string): never {
  throw new Refusal(error)
}

function isPlainObject(value: unknown): value is Fields {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

/** An own field of a plain object, or undefined where it has none. */
function field(object: Fields, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined
}

const quote = (value: unknown): string => JSON.stringify(value) ?? String(value)

/**
 * Reads a `vxmod.json`. `folder`, when given, is the id and version folder the manifest was read
 * from; the manifest must agree with both. On success the manifest is a fresh object with exactly
 * the fields the file had, values as written.
 */
export function parseManifest(json: unknown, folder?: { id: string; version: string } | null): ParsedManifest {
  try {
    return { ok: true, manifest: read(json, folder ?? null) }
  } catch (caught) {
    if (caught instanceof Refusal) return { ok: false, error: caught.error }
    throw caught
  }
}

function read(json: unknown, folder: { id: string; version: string } | null): Manifest {
  if (!isPlainObject(json)) refuse('vxmod.json is not an object')
  const get = (key: string): unknown => field(json, key)

  const schema = get('manifest')
  if (typeof schema !== 'number') refuse('"manifest" is missing or not a number')
  if (schema > MANIFEST_SCHEMA) refuse(`made for a newer game: manifest ${schema} where this core reads ${MANIFEST_SCHEMA}`)
  if (schema !== MANIFEST_SCHEMA) refuse(`"manifest" is ${schema} where this core reads ${MANIFEST_SCHEMA}`)

  // A manifest for a newer schema is refused rather than half-read: the schema grows only by a
  // new `manifest` number, so a field this core does not know is one it cannot honour.
  const unknown = Object.keys(json).find((key) => !(FIELDS as readonly string[]).includes(key))
  if (unknown !== undefined) refuse(`unknown field ${quote(unknown)}`)

  for (const key of TEXT_FIELDS) text(key, get(key))
  const hooksValue = get('hooks')
  if (hooksValue === undefined) refuse('"hooks" is missing')
  if (!Array.isArray(hooksValue)) refuse('"hooks" is not a list of names, each once')
  boolean('main', get('main'), true)
  const scope = get('scope')
  if (scope === undefined) refuse('"scope" is missing')
  if (scope !== 'anytime' && scope !== 'playthrough') refuse('"scope" is not "anytime" or "playthrough"')
  boolean('defaultOn', get('defaultOn'), true)

  const id = get('id') as string
  if (!MOD_ID_RULE.test(id)) refuse(`"id" is not lower-case words with dashes: ${quote(id)}`)
  if (RESERVED_MOD_IDS.includes(id)) refuse(`"id" ${id} is reserved`)

  const version = get('version') as string
  if (!parseVersion(version)) refuse(`"version" is not major.minor.patch: ${quote(version)}`)

  if (folder) {
    if (folder.id !== id) refuse(`the folder says ${folder.id}, the manifest says ${id}`)
    if (folder.version !== version) refuse(`the folder says ${folder.version}, the manifest says ${version}`)
  }

  const hooks = manifestHooks(hooksValue)
  if (!hooks) refuse('"hooks" is not a list of names, each once')

  const game = get('game')
  if (game !== undefined && (typeof game !== 'string' || !parseRange(game))) {
    refuse(`"game" is not a version range: ${quote(game)}`)
  }

  const requires = dependencies('requires', get('requires'), id)
  const optional = dependencies('optional', get('optional'), id)
  if (requires && optional) {
    const both = Object.keys(optional).find((dep) => dep in requires)
    if (both !== undefined) refuse(`"optional" repeats ${both} from "requires"`)
  }

  for (const name of hooks) {
    const kind = hookNameKind(name)
    if (kind.kind !== 'export') continue
    const named = MOD_ID_RULE.test(kind.library) && ((requires && kind.library in requires) || (optional && kind.library in optional))
    if (!named) refuse(`uses ${quote(name)} but does not require ${kind.library}`)
    if (kind.name === '') refuse(`uses ${quote(name)} but names no export`)
  }

  const offNote = get('offNote')
  if (offNote !== undefined && typeof offNote !== 'string') refuse('"offNote" is not a string')
  const options = optionList(get('options'))
  const optionGroups = groupList(get('optionGroups'))
  for (const option of options ?? []) {
    if (option.group !== undefined && !(optionGroups ?? []).some((group) => group.id === option.group)) {
      refuse(`option ${option.id} names group ${quote(option.group)}, which "optionGroups" does not have`)
    }
  }

  const library = get('library')
  boolean('library', library, false)
  const exportsValue = get('exports')
  let exports: string[] | null = null
  if (exportsValue !== undefined) {
    exports = manifestHooks(exportsValue)
    if (!exports) refuse('"exports" is not a list of names, each once')
  }
  if (library === true && !exports) refuse('a library must list its "exports"')
  if (library !== true && exports && exports.length > 0) refuse('only a library has "exports"')
  const dataPath = dataPaths(get('dataPath'))

  // Built field by field in the written order, with fresh copies of the lists and maps, so the
  // result shares nothing with the parsed JSON and holds nothing the file did not.
  const copies: Record<string, unknown> = { hooks, requires, optional, options, optionGroups, exports, dataPath }
  const manifest: Record<string, unknown> = {}
  for (const key of FIELDS) {
    const value = key in copies ? copies[key] : get(key)
    if (value !== undefined && value !== null) manifest[key] = value
  }
  return manifest as unknown as Manifest
}

/** `dataPath`: an object of `data` and `playthrough`, each a folder of one or two names core does not use. */
function dataPaths(value: unknown): { data?: string; playthrough?: string } | undefined {
  if (value === undefined) return undefined
  if (!isPlainObject(value)) refuse('"dataPath" is not an object of "data" and "playthrough"')
  const out: { data?: string; playthrough?: string } = {}
  for (const [key, path] of Object.entries(value)) {
    if (key !== 'data' && key !== 'playthrough') refuse(`"dataPath" has an unknown field ${quote(key)}`)
    if (typeof path !== 'string') refuse(`"dataPath.${key}" is not a string`)
    const segments = path.split('/')
    const bad =
      path.includes('..') ||
      segments.length > 2 ||
      segments.some((segment) => !DATA_SEGMENT.test(segment) || segment.endsWith('.') || DEVICE_NAME.test(segment))
    if (bad) refuse(`"dataPath.${key}" is not one or two lower-case folder names: ${quote(path)}`)
    const first = segments[0]
    const core = key === 'data' ? CORE_DATA_NAMES.includes(first) : CORE_PLAYTHROUGH_NAMES.includes(first) || PLAYTHROUGH_SHAPES.test(first)
    if (core) refuse(`"dataPath.${key}" names ${quote(first)}, which the game keeps for itself`)
    out[key] = path
  }
  return out
}

function text(key: string, value: unknown): void {
  if (value === undefined) refuse(`${quote(key)} is missing`)
  if (typeof value !== 'string') refuse(`${quote(key)} is not a string`)
  if (value.trim() === '') refuse(`${quote(key)} is empty`)
}

function boolean(key: string, value: unknown, required: boolean): void {
  if (value === undefined) {
    if (required) refuse(`${quote(key)} is missing`)
    return
  }
  if (typeof value !== 'boolean') refuse(`${quote(key)} is not true or false`)
}

/** `requires` or `optional`: mod ids, none of them the mod itself, each with a range. */
function dependencies(key: 'requires' | 'optional', value: unknown, self: string): Record<string, string> | undefined {
  if (value === undefined) return undefined
  if (!isPlainObject(value)) refuse(`${quote(key)} is not an object of mod ids and version ranges`)
  const out: Record<string, string> = {}
  for (const [dep, range] of Object.entries(value)) {
    if (!MOD_ID_RULE.test(dep)) refuse(`${quote(key)} names ${quote(dep)}, which is not a mod id`)
    if (RESERVED_MOD_IDS.includes(dep)) refuse(`${quote(key)} names ${dep}, which is reserved`)
    if (dep === self) refuse(`${quote(key)} names the mod itself`)
    if (typeof range !== 'string' || !parseRange(range)) refuse(`${quote(key)} has no version range for ${dep}: ${quote(range)}`)
    out[dep] = range
  }
  return out
}

/** Checks one entry of `options` or `optionGroups`: a plain object with exactly the allowed keys. */
function entry(list: 'options' | 'optionGroups', value: unknown, allowed: readonly string[]): Fields {
  const noun = list === 'options' ? 'option' : 'option group'
  if (!isPlainObject(value)) refuse(`${quote(list)} has an entry that is not an object`)
  const id = field(value, 'id')
  if (typeof id !== 'string' || id === '') refuse(`${quote(list)} has an entry with no "id"`)
  const extra = Object.keys(value).find((key) => !allowed.includes(key))
  if (extra !== undefined) refuse(`${noun} ${id} has an unknown field ${quote(extra)}`)
  for (const key of ['label', 'hint']) {
    if (typeof field(value, key) !== 'string') refuse(`${noun} ${id} has no ${quote(key)} string`)
  }
  return value
}

function optionList(value: unknown): ModOption[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) refuse('"options" is not a list')
  const options: ModOption[] = []
  for (const item of value) {
    const fields = entry('options', item, ['id', 'label', 'hint', 'default', 'group'])
    const id = fields.id as string
    if (typeof field(fields, 'default') !== 'boolean') refuse(`option ${id} has no "default" of true or false`)
    const group = field(fields, 'group')
    if (group !== undefined && typeof group !== 'string') refuse(`option ${id} has a "group" that is not a string`)
    if (options.some((option) => option.id === id)) refuse(`"options" has ${id} twice`)
    const option: ModOption = { id, label: fields.label as string, hint: fields.hint as string, default: fields.default as boolean }
    options.push(group === undefined ? option : { ...option, group })
  }
  return options
}

function groupList(value: unknown): ModOptionGroup[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) refuse('"optionGroups" is not a list')
  const groups: ModOptionGroup[] = []
  for (const item of value) {
    const fields = entry('optionGroups', item, ['id', 'label', 'hint'])
    const id = fields.id as string
    if (groups.some((group) => group.id === id)) refuse(`"optionGroups" has ${id} twice`)
    groups.push({ id, label: fields.label as string, hint: fields.hint as string })
  }
  return groups
}

/**
 * The manifest as `MODS` lists it: `requires` is the ids of the manifest's `requires`, left out
 * when there are none; `library` is there only when true; `offNote`, `options` and
 * `optionGroups` are carried when the manifest has them.
 */
export function modDefOf(manifest: Manifest): ModDef {
  const requires = Object.keys(manifest.requires ?? {})
  return {
    id: manifest.id,
    name: manifest.name,
    author: manifest.author,
    version: manifest.version,
    ...(manifest.game !== undefined && { game: manifest.game }),
    scope: manifest.scope,
    defaultOn: manifest.defaultOn,
    blurb: manifest.blurb,
    ...(manifest.offNote !== undefined && { offNote: manifest.offNote }),
    ...(requires.length > 0 && { requires }),
    ...(manifest.options !== undefined && { options: manifest.options }),
    ...(manifest.optionGroups !== undefined && { optionGroups: manifest.optionGroups }),
    ...(manifest.library === true && { library: true })
  }
}
