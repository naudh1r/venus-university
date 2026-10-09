import { isCharFileRel } from './characterFiles'
import { SAFE_CHAR_ID } from './characterRules'
import { isArchiveCruft } from './characterTransfer'
import {
  isBgVariant,
  isSafeBgName,
  readCustomBackground,
  type BgVariant,
  type CustomBackground
} from './customBackgrounds'
import { appError } from './errors'
import type { ValidateRecordOptions } from './jsonValidate'
import type { PhotoMeta } from './photos'
import { REPLAY_ID, replayIdsOf, validateReplay, type SlotReplay } from './replays'
import { SAFE_NUMERIC_ID } from './saveRules'
import { validateSavedScene, type SavedScene } from './sceneCreator'
import type {
  Character,
  Enrollment,
  GameSave,
  GrabBags,
  PlaythroughRecord,
  RendererSettings
} from './types'

/**
 * Everything one install keeps, as a zip either build writes and reads back. Settings are
 * carried as the renderer sees them, so no backup ever carries the API key.
 */

/** The record at the root of a backup; every image sits beside it under its character. */
export const BACKUP_NAME = 'backup.json'
export const BACKUP_SCHEMA_VERSION = 1

/** Where each kind of file sits inside a backup. */
export const CHARACTERS_DIR = 'characters'
const ENDING_ART_DIR = 'endingArt'
const PROFILE_PICTURES_DIR = 'profilePictures'
const PHOTOS_DIR = 'photos'
const BACKGROUNDS_DIR = 'backgrounds'

/** One save, with where it belongs written beside it. */
export interface BackupSave {
  playthroughId: string
  saveId: string
  save: GameSave
}

/** One Bunnyboard photo, with where it belongs written beside it; its bytes sit under `photoEntry`. */
export interface BackupPhoto {
  playthroughId: string
  photoId: string
  meta?: PhotoMeta
}

/** One calendar replay, carried whole inside the record, with where it belongs written beside it. */
export interface BackupReplay {
  playthroughId: string
  replayId: string
  replay: SlotReplay
}

/** One playthrough: the record it settled on, or the enrollment still waiting for one. */
export interface BackupPlaythrough {
  record: PlaythroughRecord | null
  enrollment: Enrollment | null
  createdAt: number
}

/** Everything a backup carries beside the images. */
export interface BackupFile {
  schemaVersion: number
  /** As the renderer sees them, so no backup can ever carry the API key. */
  settings: RendererSettings
  grabbags: GrabBags
  playthroughs: Record<string, BackupPlaythrough>
  saves: BackupSave[]
  /** The playthroughs whose graduation picture is in the zip. */
  endingArt: string[]
  /** The playthroughs whose profile picture is in the zip; absent in backups from before it. */
  profilePictures?: string[]
  /** Every Bunnyboard photo in the zip; absent in backups from before it. */
  photos?: BackupPhoto[]
  /** The player's own backgrounds, their pictures in the zip; absent in backups from before them. */
  backgrounds?: CustomBackground[]
  /** Every scene the player saved from the Scene Creator; absent in backups from before them. */
  scenes?: SavedScene[]
  /** Every replay a carried save names; absent in backups from before them. */
  replays?: BackupReplay[]
  characters: Character[]
}

/** How a backup is checked once it has been read. */
export const BACKUP_READ: ValidateRecordOptions<BackupFile> = {
  label: BACKUP_NAME,
  malformed: { code: 'BACKUP_MALFORMED', message: 'That zip is not a Venus University backup.' },
  schemaVersion: { code: 'BACKUP_SCHEMA_VERSION' },
  expects: BACKUP_SCHEMA_VERSION,
  required: {
    schemaVersion: true,
    settings: true,
    grabbags: true,
    playthroughs: true,
    saves: true,
    endingArt: true,
    characters: true
  }
}

/**
 * What a backup may hold before a byte of it is unpacked: it carries a whole cast, so the caps
 * a single character export is opened under would refuse one.
 */
export const BACKUP_ZIP_LIMITS = { maxEntries: 16384, maxTotalBytes: 8 * 1024 ** 3 }

/** What a backup is called: `venus-university-backup-<local date>.zip`. */
export function backupName(at = new Date()): string {
  const pad = (value: number): string => String(value).padStart(2, '0')
  const date = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
  return `venus-university-backup-${date}.zip`
}

/** Where one of a character's images sits inside a backup. */
export function charFileEntry(charId: string, rel: string): string {
  return `${CHARACTERS_DIR}/${charId}/${rel}`
}

/** Where one playthrough's graduation picture sits; the PNG bytes keep no extension. */
export function endingArtEntry(playthroughId: string): string {
  return `${ENDING_ART_DIR}/${playthroughId}`
}

/** Where one playthrough's profile picture sits; the PNG bytes keep no extension. */
export function profilePictureEntry(playthroughId: string): string {
  return `${PROFILE_PICTURES_DIR}/${playthroughId}`
}

/** Where one photo's picture sits; the bytes keep no extension, like the other pictures. */
export function photoEntry(playthroughId: string, photoId: string): string {
  return `${PHOTOS_DIR}/${playthroughId}/${photoId}`
}

/** Where one of a background's pictures sits; the PNG bytes keep no extension. */
export function backgroundEntry(name: string, variant: BgVariant): string {
  return `${BACKGROUNDS_DIR}/${name}/${variant}`
}

/** One character image out of a backup: whose it is and where it goes, or null for anything else. */
export function charFileOf(name: string): { charId: string; rel: string } | null {
  if (!name.startsWith(`${CHARACTERS_DIR}/`)) return null
  const rest = name.slice(CHARACTERS_DIR.length + 1)
  const cut = rest.indexOf('/')
  if (cut <= 0) return null

  const charId = rest.slice(0, cut)
  const rel = rest.slice(cut + 1)
  return SAFE_CHAR_ID.test(charId) && isCharFileRel(rel) ? { charId, rel } : null
}

/** Whether `name` is one playthrough's picture in `dir`: a bare playthrough id and nothing under it. */
function isPlaythroughPicture(name: string, dir: string): boolean {
  if (!name.startsWith(`${dir}/`)) return false
  const id = name.slice(dir.length + 1)
  return SAFE_NUMERIC_ID.test(id) && !id.includes('/')
}

/** Whether `name` is one photo's picture: `photos/<playthroughId>/<photoId>` and nothing deeper. */
function isPhotoPicture(name: string): boolean {
  if (!name.startsWith(`${PHOTOS_DIR}/`)) return false
  const rest = name.slice(PHOTOS_DIR.length + 1)
  const parts = rest.split('/')
  return parts.length === 2 && SAFE_NUMERIC_ID.test(parts[0]) && SAFE_NUMERIC_ID.test(parts[1])
}

/** Whether `name` is a background's picture: `backgrounds/<name>/<variant>` and nothing deeper. */
function isBackgroundPicture(name: string): boolean {
  if (!name.startsWith(`${BACKGROUNDS_DIR}/`)) return false
  const parts = name.slice(BACKGROUNDS_DIR.length + 1).split('/')
  return parts.length === 2 && isSafeBgName(parts[0]) && isBgVariant(parts[1])
}

/**
 * What one entry of an arriving backup is: the record, one of a character's pictures, a
 * graduation picture, a profile picture, a photo or a background's picture, something the
 * archive carries that no unpack keeps, or something this build never wrote.
 */
export function classifyBackupEntry(name: string): 'record' | 'image' | 'skip' | 'reject' {
  if (name === BACKUP_NAME) return 'record'
  if (isArchiveCruft(name)) return 'skip'
  if (charFileOf(name)) return 'image'
  if (isPlaythroughPicture(name, ENDING_ART_DIR)) return 'image'
  if (isPlaythroughPicture(name, PROFILE_PICTURES_DIR)) return 'image'
  if (isPhotoPicture(name)) return 'image'
  if (isBackgroundPicture(name)) return 'image'
  return 'reject'
}

/**
 * The backgrounds a backup carries, every record checked as the folder's are and no name twice;
 * refuses the backup before anything is written.
 */
export function backgroundsFromBackup(record: BackupFile): CustomBackground[] {
  const carried: unknown = record.backgrounds ?? []
  if (!Array.isArray(carried)) {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, 'backgrounds')
  }
  const seen = new Set<string>()
  return carried.map((entry: unknown, index) => {
    const where = `backgrounds[${String(index)}]`
    const background = readCustomBackground(entry, where, BACKUP_READ.malformed)
    if (seen.has(background.name)) {
      throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, background.name)
    }
    seen.add(background.name)
    return background
  })
}

/**
 * The saved scenes a backup carries, each checked as a scene's own file is and no id twice;
 * refuses the backup before anything is written. A restore writes each over the scene of its id.
 */
export function scenesFromBackup(record: BackupFile): SavedScene[] {
  const carried: unknown = record.scenes ?? []
  if (!Array.isArray(carried)) {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, 'scenes')
  }
  const seen = new Set<string>()
  return carried.map((entry: unknown, index) => {
    const scene = validateSavedScene(entry, `scenes[${String(index)}]`)
    if (seen.has(scene.id)) {
      throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, scene.id)
    }
    seen.add(scene.id)
    return scene
  })
}

/** Every replay a backup's saves name, once each, by playthrough: what an export carries. */
export function namedReplays(
  saves: readonly BackupSave[]
): Array<{ playthroughId: string; replayId: string }> {
  const seen = new Set<string>()
  const named: Array<{ playthroughId: string; replayId: string }> = []
  for (const { playthroughId, save } of saves) {
    for (const replayId of replayIdsOf(save.replays)) {
      const key = `${playthroughId}/${replayId}`
      if (seen.has(key)) continue
      seen.add(key)
      named.push({ playthroughId, replayId })
    }
  }
  return named
}

/**
 * The replays a backup carries, each checked as a replay's own file is, under a playthrough id
 * and a replay id that can name a path, and no pair twice; refuses the backup before anything
 * is written.
 */
export function replaysFromBackup(record: BackupFile): BackupReplay[] {
  const carried: unknown = record.replays ?? []
  if (!Array.isArray(carried)) {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, 'replays')
  }
  const seen = new Set<string>()
  return carried.map((entry: unknown, index) => {
    const where = `replays[${String(index)}]`
    const { playthroughId, replayId, replay } = (entry ?? {}) as Partial<BackupReplay>
    if (
      typeof playthroughId !== 'string' ||
      !SAFE_NUMERIC_ID.test(playthroughId) ||
      typeof replayId !== 'string' ||
      !REPLAY_ID.test(replayId)
    ) {
      throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, where)
    }
    const key = `${playthroughId}/${replayId}`
    if (seen.has(key)) {
      throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, key)
    }
    seen.add(key)
    return { playthroughId, replayId, replay: validateReplay(replay, where) }
  })
}
