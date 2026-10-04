import { mkdir, readdir, readFile, rm, stat, unlink } from 'fs/promises'
import {
  assertBackgroundVariants,
  assertCustomBackgroundDraft,
  assertSafeBgName,
  BG_VARIANTS,
  backgroundTaken,
  CUSTOM_BACKGROUND_READ,
  CUSTOM_BACKGROUND_SCHEMA_VERSION,
  customBackgroundFileName,
  isBgVariant,
  isSafeBgName,
  readCustomBackground,
  REQUIRED_BG_VARIANTS,
  type BgVariant,
  type CustomBackground,
  type CustomBackgroundListing,
  type CustomBackgroundUrls
} from '@shared/customBackgrounds'
import { appError, messageOf, toAppError } from '@shared/errors'
import { assertRoomPicture } from '@shared/roomPicture'
import {
  getBackgroundsPath,
  getCustomBackgroundImagePath,
  getCustomBackgroundPath,
  getCustomBackgroundRecordPath
} from '../paths'
import { readJsonFile, writeAtomicBytes, writeAtomicJson } from './jsonFile'

/**
 * The backgrounds the player brought, one folder each under `data/backgrounds`: the pictures
 * first and the record last, so a folder without its record is a write that never finished
 * and reads as absent.
 */

/** What a background write raises when the disk refuses it. */
const UNWRITABLE = { code: 'BACKGROUND_UNWRITABLE', message: 'Could not save the background.' }

/** What a background read raises when the disk refuses it. */
const UNREADABLE = { code: 'BACKGROUND_UNREADABLE', message: 'Could not read the backgrounds.' }

/** Whether a file is there to be read. */
async function exists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

/** Where one of a background's pictures is shown from: the image protocol, by its own name. */
function customBgUrl(record: CustomBackground, variant: BgVariant): string {
  const file = customBackgroundFileName(record.name, variant)
  return `bgimg://custom/${record.name}/${file}?v=${String(record.createdAt)}`
}

/** One background as its folder holds it, or null where it is not a whole one. */
async function backgroundIn(name: string): Promise<CustomBackgroundListing | null> {
  if (!isSafeBgName(name)) {
    console.warn(`[backgrounds] ${name} is not a name a background takes — skipping it.`)
    return null
  }

  const path = getCustomBackgroundRecordPath(name)
  let record: CustomBackground
  try {
    const read = await readJsonFile<null>(path, {
      malformed: CUSTOM_BACKGROUND_READ.malformed,
      unreadable: UNREADABLE,
      onMissing: () => null
    })
    // A folder with no record is a write that never finished.
    if (read.kind === 'missing') return null
    record = readCustomBackground(read.parsed, path)
  } catch (err) {
    const why = toAppError(err).message
    console.warn(`[backgrounds] ${name} could not be read — skipping it:`, why)
    return null
  }
  if (record.name !== name) {
    console.warn(`[backgrounds] ${name} holds the record of "${record.name}" — skipping it.`)
    return null
  }

  const urls: Partial<CustomBackgroundUrls> = {}
  for (const variant of BG_VARIANTS) {
    if (await exists(getCustomBackgroundImagePath(name, variant))) {
      urls[variant] = customBgUrl(record, variant)
    }
  }
  if (!urls.day || !urls.night) {
    console.warn(`[backgrounds] ${name} is missing its day or night picture — skipping it.`)
    return null
  }
  return { record, urls: { ...urls, day: urls.day, night: urls.night } }
}

/** `backgrounds:list` — every whole background the player brought, by name. */
export async function listCustomBackgrounds(): Promise<CustomBackgroundListing[]> {
  let names: string[]
  try {
    names = await readdir(getBackgroundsPath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError(UNREADABLE.code, UNREADABLE.message, messageOf(err))
  }
  const listed: CustomBackgroundListing[] = []
  for (const name of names.sort()) {
    const background = await backgroundIn(name)
    if (background) listed.push(background)
  }
  return listed
}

/** Writes `record`'s pictures and then its record into a folder emptied first. */
async function writeBackground(
  record: CustomBackground,
  pictures: Partial<Record<BgVariant, Uint8Array>>
): Promise<void> {
  const folder = getCustomBackgroundPath(record.name)
  try {
    // Whatever an unfinished write left behind, a rain picture included, goes first.
    await rm(folder, { recursive: true, force: true, maxRetries: 5 })
    await mkdir(folder, { recursive: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, messageOf(err))
  }
  for (const variant of BG_VARIANTS) {
    const bytes = pictures[variant]
    if (!bytes) continue
    await writeAtomicBytes(getCustomBackgroundImagePath(record.name, variant), bytes, UNWRITABLE)
  }
  await writeAtomicJson(getCustomBackgroundRecordPath(record.name), record, UNWRITABLE)
}

/**
 * `backgrounds:add` — keeps a new background, `images` being each picture's base64 PNG bytes
 * by variant, and answers it as a listing does. A name already kept is refused.
 */
export async function addCustomBackground(
  draft: unknown,
  images: unknown
): Promise<CustomBackgroundListing> {
  const checked = assertCustomBackgroundDraft(draft)
  const encoded = assertBackgroundVariants(
    images,
    (value): value is string => typeof value === 'string'
  )
  const pictures: Partial<Record<BgVariant, Uint8Array>> = {}
  for (const variant of BG_VARIANTS) {
    const png = encoded[variant]
    if (png === undefined) continue
    const bytes = Buffer.from(png, 'base64')
    assertRoomPicture(bytes)
    pictures[variant] = bytes
  }

  if (await exists(getCustomBackgroundRecordPath(checked.name))) {
    throw backgroundTaken(checked.name)
  }

  const record: CustomBackground = {
    schemaVersion: CUSTOM_BACKGROUND_SCHEMA_VERSION,
    ...checked,
    createdAt: Date.now()
  }
  await writeBackground(record, pictures)

  const listed = await backgroundIn(record.name)
  if (!listed) throw appError(UNWRITABLE.code, UNWRITABLE.message, record.name)
  return listed
}

/** `backgrounds:remove` — the record first, so a folder the removal stops short of is absent. */
export async function removeCustomBackground(name: unknown): Promise<void> {
  assertSafeBgName(name)
  try {
    await unlink(getCustomBackgroundRecordPath(name))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw appError(UNWRITABLE.code, 'Could not remove the background.', messageOf(err))
    }
  }
  await rm(getCustomBackgroundPath(name), { recursive: true, force: true, maxRetries: 5 }).catch(
    (err: unknown) => {
      console.warn(`[backgrounds] ${name}'s pictures were left behind:`, messageOf(err))
    }
  )
}

/** `backgrounds:readImage` — one picture's bytes, or null where the background has none. */
export async function readCustomBackgroundImage(
  name: unknown,
  variant: unknown
): Promise<Uint8Array | null> {
  assertSafeBgName(name)
  if (!isBgVariant(variant)) {
    throw appError('BACKGROUND_INVALID', 'That background picture does not exist.', String(variant))
  }
  try {
    return await readFile(getCustomBackgroundImagePath(name, variant))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw appError(UNREADABLE.code, 'Could not read the background.', messageOf(err))
  }
}

/**
 * Puts one background back out of a backup, replacing whatever the folder held under its name;
 * one whose day or night is not in `pictures` is left as it is.
 */
export async function restoreCustomBackground(
  record: CustomBackground,
  pictures: Partial<Record<BgVariant, Uint8Array>>
): Promise<void> {
  if (REQUIRED_BG_VARIANTS.some((variant) => !pictures[variant])) {
    console.warn(`[backup] ${record.name} is missing its day or night picture — not restored.`)
    return
  }
  await writeBackground(record, pictures)
}
