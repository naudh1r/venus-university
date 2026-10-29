import { isCharFileRel } from './characterFiles'
import { ECHO_ART_DIR, echoArtIdOf } from './echoArtwork'
import { readCharacterRecord, SAFE_CHAR_ID } from './characterRules'
import { isArchiveCruft } from './characterTransfer'
import {
  isBgVariant,
  isSafeBgName,
  readCustomBackground,
  type BgVariant,
  type CustomBackground
} from './customBackgrounds'
import { appError } from './errors'
import { SOUNDTRACK_FILE, SOUNDTRACK_BACKUP_DIR } from './soundtracks'
import { isSafeEntryName, modPartEntryOf, MOD_PARTS_DIR } from './modParts'
import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { validateRecord, type ValidateRecordOptions } from './jsonValidate'
import { readLorebookRecord, type LorebookRecord } from './lorebookRecord'
import { PHOTO_META_READ, type PhotoMeta } from './photos'
import { REPLAY_ID, replayIdsOf, validateReplay, type SlotReplay } from './replays'
import { classifySaveId, ENROLLMENT_READ, RECORD_READ, SAVE_READ, SAFE_NUMERIC_ID } from './saveRules'
import { validateSavedScene, type SavedScene } from './sceneCreator'
import { recordReplayIds } from './semesters'
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
const SEMESTER_ENDING_ART_DIR = 'semesterEndingArt'
const PROFILE_PICTURES_DIR = 'profilePictures'
const PHOTOS_DIR = 'photos'
const BACKGROUNDS_DIR = 'backgrounds'

/** The top-level folders this build writes into a backup; any other is a mod's or a newer build's. */
const CORE_DIRS = [
  CHARACTERS_DIR,
  ENDING_ART_DIR,
  SEMESTER_ENDING_ART_DIR,
  PROFILE_PICTURES_DIR,
  PHOTOS_DIR,
  BACKGROUNDS_DIR,
  MOD_PARTS_DIR,
  // The in-repo mods' own folders, written and read back by their code here.
  ECHO_ART_DIR.split('/')[0]
]

/** Whether a top-level folder of a backup is none this build writes: a mod's, or a newer build's. */
export function isLegacyDir(name: string): boolean {
  return !CORE_DIRS.includes(name) && isSafeEntryName(name)
}

/** The top-level folder `name` sits in when it is none this build writes, or null. */
export function legacyDirOf(name: string): string | null {
  const parts = name.split('/')
  if (parts.length < 2 || !isLegacyDir(parts[0])) return null
  return parts.every(isSafeEntryName) ? parts[0] : null
}

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

/** One mod's own share of a backup: its files sit under `mods/<id>/` in the zip. */
export interface BackupModPart {
  /** The version of the mod that wrote it. */
  version: string
  /** What the mod's part answered beside its files; absent where it answered none. */
  json?: unknown
  /** Its files, as paths under its folder. */
  files: string[]
}

/** Everything a backup carries beside the images. */
export interface BackupFile {
  /** Optional desktop reflection images and positions, including shipped characters. */
  exReflections?: Record<string, unknown>
  /** Immutable Echo PNG IDs, with bytes under echoes/art; absent in older backups. */
  exEchoArt?: string[]
  schemaVersion: number
  /** As the renderer sees them, so no backup can ever carry the API key. */
  settings: RendererSettings
  grabbags: GrabBags
  playthroughs: Record<string, BackupPlaythrough>
  saves: BackupSave[]
  /** The playthroughs whose first semester's graduation picture is in the zip. */
  endingArt: string[]
  /** Every later semester's graduation picture in the zip; absent in backups from before them. */
  semesterEndingArt?: SemesterPicture[]
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
  /** Each playthrough's own lorebook, by playthrough id; absent in backups from before them. */
  lorebooks?: Record<string, LorebookRecord>
  /** Each mod's own share, by mod id, in the order the parts wrote them; absent where none did. */
  mods?: Record<string, BackupModPart>
  characters: Character[]
}

/** Every key of the record this build reads; any other key is a mod's or a newer build's, kept for the mods' parts. */
// Mods may augment BackupFile without making core the owner of their legacy keys.
const BACKUP_KEYS: Partial<Record<keyof BackupFile, true>> = {
  schemaVersion: true,
  settings: true,
  grabbags: true,
  playthroughs: true,
  saves: true,
  endingArt: true,
  semesterEndingArt: true,
  profilePictures: true,
  photos: true,
  backgrounds: true,
  scenes: true,
  replays: true,
  lorebooks: true,
  mods: true,
  characters: true,
  // The in-repo mods' own fields, written and read back by their code here.
  exEchoArt: true,
  exReflections: true
}

/** The record's own keys this build does not read, with their values as read. */
export function unknownBackupKeys(record: BackupFile): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !Object.hasOwn(BACKUP_KEYS, key)))
}

/**
 * The mods' shares a backup carries, each under a mod id with a version and a list of its files;
 * refuses the backup before anything is written.
 */
export function modPartsFromBackup(record: BackupFile): Record<string, BackupModPart> {
  const carried: unknown = record.mods ?? {}
  const bad = (where: string): never => {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, where)
  }
  if (typeof carried !== 'object' || carried === null || Array.isArray(carried)) bad('mods')
  const parts: Record<string, BackupModPart> = {}
  for (const [modId, value] of Object.entries(carried as Record<string, unknown>)) {
    const where = `mods.${modId}`
    if (!MOD_ID_RULE.test(modId)) bad(where)
    if (typeof value !== 'object' || value === null || Array.isArray(value)) bad(where)
    const { version, json, files } = value as Partial<BackupModPart>
    if (typeof version !== 'string') bad(where)
    const list: unknown = files ?? []
    if (!Array.isArray(list) || !list.every((rel) => typeof rel === 'string' && rel.split('/').every(isSafeEntryName))) {
      bad(where)
    }
    parts[modId] = { version: version as string, ...(json !== undefined ? { json } : {}), files: [...(list as string[])] }
  }
  return parts
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

/** Check every collection and row used by restore before either backend changes live data. */
export function preflightBackup(record: BackupFile): void {
  const bad = (where: string): never => {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, where)
  }
  const object = (value: unknown, where: string): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return bad(where)
    return value as Record<string, unknown>
  }
  const array = (value: unknown, where: string): unknown[] => {
    if (!Array.isArray(value)) return bad(where)
    return value
  }
  const id = (value: unknown, where: string, pattern = SAFE_NUMERIC_ID): string => {
    if (typeof value !== 'string' || !pattern.test(value)) return bad(where)
    return value
  }
  const unique = (seen: Set<string>, key: string, where: string): void => {
    if (seen.has(key)) bad(where)
    seen.add(key)
  }
  object(record, BACKUP_NAME)
  object(record.settings, 'settings')
  for (const [key, values] of Object.entries(object(record.grabbags, 'grabbags'))) {
    if (array(values, 'grabbags.' + key).some(value => typeof value !== 'string')) bad('grabbags.' + key)
  }
  for (const [key, value] of Object.entries(object(record.playthroughs, 'playthroughs'))) {
    id(key, 'playthroughs')
    const row = object(value, 'playthroughs.' + key)
    if (typeof row.createdAt !== 'number' || !Number.isFinite(row.createdAt)) bad('playthroughs.' + key)
    if (row.record !== null) validateRecord(object(row.record, key), key, RECORD_READ)
    if (row.enrollment !== null) validateRecord(object(row.enrollment, key), key, ENROLLMENT_READ)
  }
  const saves = new Set<string>()
  for (const [index, value] of array(record.saves, 'saves').entries()) {
    const where = 'saves[' + index + ']'
    const row = object(value, where)
    const playthroughId = id(row.playthroughId, where)
    if (typeof row.saveId !== 'string' || !classifySaveId(row.saveId)) bad(where)
    unique(saves, playthroughId + '/' + row.saveId, where)
    validateRecord(object(row.save, where), where, SAVE_READ)
  }
  for (const [field, values] of [['endingArt', record.endingArt], ['profilePictures', record.profilePictures ?? []]] as const) {
    const seen = new Set<string>()
    for (const value of array(values, field)) unique(seen, id(value, field), field)
  }
  const photos = new Set<string>()
  for (const [index, value] of array(record.photos ?? [], 'photos').entries()) {
    const where = 'photos[' + index + ']'
    const row = object(value, where)
    unique(photos, id(row.playthroughId, where) + '/' + id(row.photoId, where), where)
    if (row.meta !== undefined) validateRecord(object(row.meta, where), where, PHOTO_META_READ)
  }
  const characters = new Set<string>()
  for (const [index, value] of array(record.characters, 'characters').entries()) {
    const where = 'characters[' + index + ']'
    const row = object(value, where)
    unique(characters, id(row.charId, where, SAFE_CHAR_ID), where)
    readCharacterRecord(row, where)
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

/** One later semester's graduation picture, by playthrough and semester. */
export interface SemesterPicture {
  playthroughId: string
  semesterId: string
}

/**
 * Where a later semester's graduation picture sits: a folder of its own, since the first
 * semester's sits at its playthrough's own name in `endingArt`.
 */
export function semesterEndingArtEntry(playthroughId: string, semesterId: string): string {
  return `${SEMESTER_ENDING_ART_DIR}/${playthroughId}/${semesterId}`
}

/**
 * The later semesters' graduation pictures a backup carries, each under ids that can name a
 * path and no pair twice; refuses the backup before anything is written.
 */
export function semesterPicturesFromBackup(record: BackupFile): SemesterPicture[] {
  const carried: unknown = record.semesterEndingArt ?? []
  if (!Array.isArray(carried)) {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, 'semesterEndingArt')
  }
  const seen = new Set<string>()
  return carried.map((entry: unknown, index) => {
    const { playthroughId, semesterId } = (entry ?? {}) as Partial<SemesterPicture>
    if (
      typeof playthroughId !== 'string' ||
      !SAFE_NUMERIC_ID.test(playthroughId) ||
      typeof semesterId !== 'string' ||
      !SAFE_NUMERIC_ID.test(semesterId) ||
      seen.has(`${playthroughId}/${semesterId}`)
    ) {
      throw appError(
        BACKUP_READ.malformed.code,
        BACKUP_READ.malformed.message,
        `semesterEndingArt[${String(index)}]`
      )
    }
    seen.add(`${playthroughId}/${semesterId}`)
    return { playthroughId, semesterId }
  })
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

/** Whether `name` is one picture a playthrough keeps by id: `<dir>/<playthroughId>/<id>` and nothing deeper. */
function isPicturePair(name: string, dir: string): boolean {
  if (!name.startsWith(`${dir}/`)) return false
  const rest = name.slice(dir.length + 1)
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
 * graduation picture, a profile picture, a photo or a background's picture, a mod's own file
 * (`file`, never read as a picture), a file in a top-level folder this build does not write
 * (`legacy`, kept for the mods' parts), something the archive carries that no unpack keeps, or
 * something this build never wrote.
 */
export function classifyBackupEntry(name: string): 'record' | 'image' | 'audio' | 'file' | 'legacy' | 'skip' | 'reject' {
  if (echoArtIdOf(name)) return 'image'
  if (name.startsWith(SOUNDTRACK_BACKUP_DIR + '/') && SOUNDTRACK_FILE.test(name.slice(SOUNDTRACK_BACKUP_DIR.length + 1))) return 'audio'
  if (name === BACKUP_NAME) return 'record'
  if (isArchiveCruft(name)) return 'skip'
  if (charFileOf(name)) return 'image'
  if (isPlaythroughPicture(name, ENDING_ART_DIR)) return 'image'
  if (isPicturePair(name, SEMESTER_ENDING_ART_DIR)) return 'image'
  if (isPlaythroughPicture(name, PROFILE_PICTURES_DIR)) return 'image'
  if (isPicturePair(name, PHOTOS_DIR)) return 'image'
  if (isBackgroundPicture(name)) return 'image'
  if (modPartEntryOf(name)) return 'file'
  if (legacyDirOf(name)) return 'legacy'
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

/**
 * Every replay a backup's saves or its records' semester logs name, once each, by playthrough:
 * what an export carries.
 */
export function namedReplays(
  saves: readonly BackupSave[],
  playthroughs: Readonly<Record<string, Pick<BackupPlaythrough, 'record'>>> = {}
): Array<{ playthroughId: string; replayId: string }> {
  const seen = new Set<string>()
  const named: Array<{ playthroughId: string; replayId: string }> = []
  const name = (playthroughId: string, replayId: string): void => {
    const key = `${playthroughId}/${replayId}`
    if (seen.has(key)) return
    seen.add(key)
    named.push({ playthroughId, replayId })
  }
  for (const { playthroughId, save } of saves) {
    for (const replayId of replayIdsOf(save.replays)) name(playthroughId, replayId)
  }
  for (const [playthroughId, { record }] of Object.entries(playthroughs)) {
    if (!record) continue
    for (const replayId of recordReplayIds(record)) name(playthroughId, replayId)
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

/**
 * The lorebooks a backup carries, each checked as its own file is, under a playthrough id that
 * can name a path; refuses the backup before anything is written.
 */
export function lorebooksFromBackup(record: BackupFile): Record<string, LorebookRecord> {
  const carried: unknown = record.lorebooks ?? {}
  if (typeof carried !== 'object' || carried === null || Array.isArray(carried)) {
    throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, 'lorebooks')
  }
  const lorebooks: Record<string, LorebookRecord> = {}
  for (const [playthroughId, lorebook] of Object.entries(carried)) {
    if (!SAFE_NUMERIC_ID.test(playthroughId)) {
      throw appError(BACKUP_READ.malformed.code, BACKUP_READ.malformed.message, playthroughId)
    }
    lorebooks[playthroughId] = readLorebookRecord(
      lorebook,
      `lorebooks.${playthroughId}`,
      BACKUP_READ.malformed
    )
  }
  return lorebooks
}
