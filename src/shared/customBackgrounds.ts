import { isVenueTrack, type BackgroundKind, type VenueTrack } from './audio'
import { appError } from './errors'
import type { AppError } from './types'
import { validateRecord, type ValidateRecordOptions } from './jsonValidate'
import { isWindowsDeviceName } from './zipRules'

/**
 * The backgrounds the player brings: the name the writer is offered, the record kept beside the
 * pictures, and the checks both builds run before either is written.
 */

export const CUSTOM_BACKGROUND_SCHEMA_VERSION = 1

/** The record beside a background's pictures. */
export const CUSTOM_BACKGROUND_RECORD_NAME = 'background.json'

/** The pictures a background can have, the slot's half and then its rain render. */
export const BG_VARIANTS = ['day', 'night', 'day_rain', 'night_rain'] as const

/** One of a background's pictures. */
export type BgVariant = (typeof BG_VARIANTS)[number]

/** The pictures a background cannot be offered without. */
export const REQUIRED_BG_VARIANTS = ['day', 'night'] as const satisfies readonly BgVariant[]

/** The longest name the writer is offered. */
export const BG_NAME_MAX_LENGTH = 32

/** Whether `value` names one of a background's pictures. */
export function isBgVariant(value: unknown): value is BgVariant {
  return (BG_VARIANTS as readonly unknown[]).includes(value)
}

/** The file one of a background's pictures is kept under: `<name>_<variant>.png`. */
export function customBackgroundFileName(name: string, variant: BgVariant): string {
  return `${name}_${variant}.png`
}

/** One background the player brought, as its record is kept. */
export interface CustomBackground {
  schemaVersion: number
  /** The name the writer is offered and every save refers to it by. */
  name: string
  kind: BackgroundKind
  /** The song the place plays in both halves of the day; absent is none. */
  music?: VenueTrack
  createdAt: number
}

/** What the player hands over beside the pictures. */
export type CustomBackgroundDraft = Pick<CustomBackground, 'name' | 'kind' | 'music'>

/** Where each of a background's pictures can be shown from; the rain renders are optional. */
export interface CustomBackgroundUrls {
  day: string
  night: string
  day_rain?: string
  night_rain?: string
}

/** One background as a listing hands it over: its record and where its pictures are. */
export interface CustomBackgroundListing {
  record: CustomBackground
  urls: CustomBackgroundUrls
}

/** A name as the field shows it while it is typed: lowercase, every space an underscore. */
export function typedBgName(raw: string): string {
  return raw.toLowerCase().replace(/\s/g, '_')
}

/** A name as it is kept: typed, with runs of underscores merged and none at either end. */
export function normalizeBgName(raw: string): string {
  return typedBgName(raw.trim())
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

/** Why a name, already normalized, can never be a background's, or null where it can. */
function unusableName(name: string): string | null {
  if (/[^a-z0-9_]/.test(name)) return 'Use only letters a–z, numbers and spaces in the name.'
  if (!/[a-z]/.test(name)) return 'The name needs at least one letter.'
  if (name.length > BG_NAME_MAX_LENGTH) {
    return `Keep the name to ${String(BG_NAME_MAX_LENGTH)} characters.`
  }
  // The name is a folder and a file stem on disk, and a key every lookup of it reads.
  if (isWindowsDeviceName(name) || name in Object.prototype) return 'That name is reserved.'
  return null
}

/** Whether `name` is a kept background name: one a path, a URL and a lookup can all take. */
export function isSafeBgName(name: string): boolean {
  return /^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name) && unusableName(name) === null
}

/** Refuses a name that is not one a background can be kept under. */
export function assertSafeBgName(name: unknown): asserts name is string {
  if (typeof name !== 'string' || !isSafeBgName(name)) {
    throw appError('BACKGROUND_NAME_INVALID', 'That background name cannot be used.', String(name))
  }
}

/**
 * Why the name the player typed cannot be saved, or null where it can; `taken` is every name a
 * background already answers to.
 */
export function bgNameProblem(typed: string, taken: ReadonlySet<string>): string | null {
  const name = normalizeBgName(typed)
  if (name === '') return 'Name the background.'
  const unusable = unusableName(name)
  if (unusable) return unusable
  if (taken.has(name)) return `There is already a background named ${name}.`
  return null
}

/** What a second background under a name already kept is refused with. */
export function backgroundTaken(name: string): AppError {
  return appError('BACKGROUND_TAKEN', `There is already a background named ${name}.`, name)
}

/** How a background's record is checked once it has been read. */
export const CUSTOM_BACKGROUND_READ: ValidateRecordOptions<CustomBackground> = {
  label: CUSTOM_BACKGROUND_RECORD_NAME,
  malformed: { code: 'BACKGROUND_MALFORMED', message: 'A custom background could not be read.' },
  schemaVersion: { code: 'BACKGROUND_SCHEMA_VERSION' },
  expects: CUSTOM_BACKGROUND_SCHEMA_VERSION,
  required: { schemaVersion: true, name: true, kind: true, createdAt: true }
}

/** Whether `value` is one of the two kinds a background is listed under. */
function isBackgroundKind(value: unknown): value is BackgroundKind {
  return value === 'interior' || value === 'exterior'
}

/**
 * Checks one parsed record and hands back the fields this build reads. A song this build does
 * not have is read as none rather than costing the player the place; `malformed` names the
 * refusal for a caller reading records out of something other than the folder.
 */
export function readCustomBackground(
  parsed: unknown,
  where: string,
  malformed = CUSTOM_BACKGROUND_READ.malformed
): CustomBackground {
  const record = validateRecord<CustomBackground>(parsed, where, {
    ...CUSTOM_BACKGROUND_READ,
    malformed
  })
  const refuse = (why: string): never => {
    throw appError(malformed.code, `${CUSTOM_BACKGROUND_RECORD_NAME} ${why}.`, where)
  }
  if (typeof record.name !== 'string' || !isSafeBgName(record.name)) {
    refuse('names no usable name')
  }
  if (!isBackgroundKind(record.kind)) refuse('is neither an interior nor an exterior')
  if (typeof record.createdAt !== 'number' || !Number.isFinite(record.createdAt)) {
    refuse('carries no creation time')
  }

  const music = record.music === undefined || isVenueTrack(record.music) ? record.music : undefined
  if (music !== record.music) {
    console.warn(
      `[backgrounds] ${where} plays "${String(record.music)}", which this build lacks — none.`
    )
  }
  return {
    schemaVersion: record.schemaVersion,
    name: record.name,
    kind: record.kind,
    ...(music ? { music } : {}),
    createdAt: record.createdAt
  }
}

/** Refuses what the renderer handed over unless it is a background this build can keep. */
export function assertCustomBackgroundDraft(draft: unknown): CustomBackgroundDraft {
  const candidate = (typeof draft === 'object' && draft !== null ? draft : {}) as Record<
    string,
    unknown
  >
  const { name, kind, music } = candidate
  assertSafeBgName(name)
  const refuse = (): never => {
    throw appError('BACKGROUND_INVALID', 'That background could not be saved.', name)
  }
  if (!isBackgroundKind(kind)) return refuse()
  if (music === undefined) return { name, kind }
  if (!isVenueTrack(music)) return refuse()
  return { name, kind, music }
}

/**
 * Refuses a set of pictures, keyed by variant, unless every key is a variant and the day and
 * the night are both there; the bytes themselves are each build's to check.
 */
export function assertBackgroundVariants<T>(
  images: unknown,
  isPicture: (value: unknown) => value is T
): Partial<Record<BgVariant, T>> {
  if (typeof images !== 'object' || images === null) {
    throw appError('BACKGROUND_INVALID', 'That background could not be saved.', 'No pictures.')
  }
  const out: Partial<Record<BgVariant, T>> = {}
  for (const [variant, picture] of Object.entries(images)) {
    if (!isBgVariant(variant) || !isPicture(picture)) {
      throw appError('BACKGROUND_INVALID', 'That background could not be saved.', variant)
    }
    out[variant] = picture
  }
  for (const variant of REQUIRED_BG_VARIANTS) {
    if (out[variant] === undefined) {
      throw appError(
        'BACKGROUND_INVALID',
        'A background needs a day and a night picture.',
        `No ${variant} picture.`
      )
    }
  }
  return out
}
