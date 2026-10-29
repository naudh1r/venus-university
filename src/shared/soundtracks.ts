import { appError } from './errors'
import type { ModDef } from '@vx/modkit/shared'
import type { Result } from './types'

export const SOUNDTRACK_MOD = 'custom-soundtracks'
export const SOUNDTRACK_DEF: ModDef = {
  id: SOUNDTRACK_MOD, name: 'Custom soundtracks', author: 'Maestro Leeds', version: '1.1.0',
  scope: 'anytime', defaultOn: true,
  blurb: 'Replace the game’s music with your own local audio files. Open Custom soundtracks in Settings.',
  offNote: 'Turning this off plays the original music. Your imported tracks and choices are kept.'
}
export const SOUNDTRACK_LABELS = {
  reckoning_dungeon: 'The Unspoken · meditation',
  reckoning: 'Breaking Through the Silence · questions',
  reckoning_victory: 'Breaking Through the Silence · victory',
  title: 'Title screen', landing_day: 'Weekday · day', landing_night: 'Weekday · night',
  landing_day_alt: 'Weekend · day', landing_night_alt: 'Weekend · night', ending: 'Ending',
  venue_edm: 'Venue · electronic', venue_lofi: 'Venue · lo-fi', venue_pop: 'Venue · pop', venue_rock: 'Venue · rock'
} as const
export type SoundtrackKey = keyof typeof SOUNDTRACK_LABELS
export interface SoundtrackTrack { file: string; name: string; loop: boolean }
export type SoundtrackMap = Partial<Record<SoundtrackKey, SoundtrackTrack>>
export interface SoundtrackPick { token: string; name: string; bytes: Uint8Array }
export interface SoundtracksApi {
  list(): Promise<Result<SoundtrackMap>>
  pick(): Promise<Result<SoundtrackPick | null>>
  commit(key: SoundtrackKey, token: string, duration: number): Promise<Result<SoundtrackMap>>
  remove(key: SoundtrackKey): Promise<Result<SoundtrackMap>>
  loop(key: SoundtrackKey, value: boolean): Promise<Result<SoundtrackMap>>
  read(key: SoundtrackKey): Promise<Result<Uint8Array | null>>
  cleanup(): Promise<Result<{ count: number }>>
}
export const SOUNDTRACK_MAX_BYTES = 50 * 1024 * 1024
export const SOUNDTRACK_MAX_SECONDS = 1200
export const SOUNDTRACK_FILE = /^[a-f0-9]{64}\.(mp3|ogg|wav)$/
export const SOUNDTRACK_BACKUP_DIR = 'exMusic'

declare module './backup' { interface BackupFile { exMusic?: SoundtrackMap } }

export function isSoundtrackKey(value: string): value is SoundtrackKey {
  return Object.hasOwn(SOUNDTRACK_LABELS, value)
}
export function assertSoundtrackKey(value: string): asserts value is SoundtrackKey {
  if (!isSoundtrackKey(value)) throw appError('SOUNDTRACK_KEY', 'That soundtrack slot does not exist.')
}
export function soundtrackExtension(name: string): string {
  const ext = /\.(mp3|ogg|wav)$/i.exec(name)?.[0].toLowerCase()
  if (!ext) throw appError('SOUNDTRACK_FORMAT', 'Choose an MP3, OGG or WAV file.')
  return ext
}
export function assertSoundtrackBytes(bytes: Uint8Array): void {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > SOUNDTRACK_MAX_BYTES) {
    throw appError('SOUNDTRACK_SIZE', 'Choose a nonempty audio file up to 50 MB.')
  }
}
export function assertSoundtrackDuration(seconds: number): void {
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > SOUNDTRACK_MAX_SECONDS) {
    throw appError('SOUNDTRACK_DURATION', 'Choose an audio track up to 20 minutes long.')
  }
}
/** The legacy map has no schema wrapper; a missing loop flag originally meant looping. */
export function readSoundtrackMap(value: unknown): SoundtrackMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw appError('SOUNDTRACK_MAP', 'The soundtrack choices are malformed.')
  }
  const out: SoundtrackMap = {}
  for (const [key, item] of Object.entries(value)) {
    assertSoundtrackKey(key)
    if (!item || typeof item !== 'object' || typeof item.file !== 'string' || !SOUNDTRACK_FILE.test(item.file) ||
        typeof item.name !== 'string' || !item.name.trim() || item.name.length > 180 ||
        /[\x00-\x1f]/.test(item.name) || (item.loop !== undefined && typeof item.loop !== 'boolean')) {
      throw appError('SOUNDTRACK_MAP', 'A soundtrack assignment is malformed.')
    }
    out[key] = { file: item.file, name: item.name, loop: item.loop !== false }
  }
  return out
}

export interface SoundtrackSnapshot { map: SoundtrackMap; files: Record<string, Uint8Array> }
export type SoundtrackHash = (bytes: Uint8Array) => Promise<string>
/** Versioned desktop backup-part metadata. Legacy/browser exMusic remains readable separately. */
export async function prepareSoundtrackBackupPart(
  value: unknown, read: (file: string) => Promise<Uint8Array>, hash: SoundtrackHash
): Promise<SoundtrackSnapshot | null> {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !('v' in value) || value.v !== 1 || !('tracks' in value) || value.tracks === undefined) {
    throw appError('SOUNDTRACK_BACKUP', 'The custom music backup format is not supported.')
  }
  if (value.tracks === null) return null
  return prepareSoundtrackSnapshot(value.tracks, read, hash)
}

/** Check all referenced content before a backup is allowed to change any game data. */
export async function prepareSoundtrackSnapshot(
  value: unknown, read: (file: string) => Promise<Uint8Array>, hash: SoundtrackHash
): Promise<SoundtrackSnapshot | null> {
  if (value === undefined) return null
  const map = readSoundtrackMap(value)
  const files: Record<string, Uint8Array> = {}
  for (const { file } of Object.values(map)) {
    if (files[file]) continue
    const bytes = await read(file)
    assertSoundtrackBytes(bytes)
    if (await hash(bytes) !== file.slice(0, 64)) {
      throw appError('SOUNDTRACK_INTEGRITY', 'A soundtrack file failed its integrity check.')
    }
    files[file] = bytes
  }
  return { map, files }
}
