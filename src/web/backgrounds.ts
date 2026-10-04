import { base64ToBytes } from '@shared/base64'
import {
  assertBackgroundVariants,
  assertCustomBackgroundDraft,
  assertSafeBgName,
  backgroundTaken,
  BG_VARIANTS,
  CUSTOM_BACKGROUND_SCHEMA_VERSION,
  isBgVariant,
  readCustomBackground,
  type BgVariant,
  type CustomBackground,
  type CustomBackgroundListing,
  type CustomBackgroundUrls
} from '@shared/customBackgrounds'
import { appError, toAppError } from '@shared/errors'
import { assertRoomPicture } from '@shared/roomPicture'
import { imageBlob } from './blob'
import {
  allBackgroundRows,
  deleteBackgroundRow,
  insertBackgroundRow,
  readBackgroundRow
} from './db/backgrounds'
import type { StoredBackground } from './db/open'

/**
 * The player's own backgrounds in the browser: rows in the database, shown through object URLs
 * that stay the same for as long as the picture behind them does, so listing them again never
 * reads as the stage's background changing.
 */

/** Every URL handed out, by `name@createdAt/variant`. */
const urls = new Map<string, string>()

/** What one picture's URL is kept under; a background re-added under its name is a new one. */
function urlKey(record: CustomBackground, variant: BgVariant): string {
  return `${record.name}@${String(record.createdAt)}/${variant}`
}

/** The URL one picture is shown from, minted on its first listing and kept after it. */
function urlFor(record: CustomBackground, variant: BgVariant, blob: Blob): string {
  const key = urlKey(record, variant)
  const held = urls.get(key)
  if (held) return held
  const url = URL.createObjectURL(blob)
  urls.set(key, url)
  return url
}

/** One row as a listing, or null where it is not a whole background kept under its own name. */
function listingOf(name: string, row: StoredBackground): CustomBackgroundListing | null {
  let record: CustomBackground
  try {
    record = readCustomBackground(row.record, `backgrounds/${name}`)
  } catch (err) {
    const why = toAppError(err).message
    console.warn(`[backgrounds] ${name} could not be read — skipping it:`, why)
    return null
  }
  if (record.name !== name) {
    console.warn(`[backgrounds] ${name} holds the record of "${record.name}" — skipping it.`)
    return null
  }

  const found: Partial<CustomBackgroundUrls> = {}
  for (const variant of BG_VARIANTS) {
    const blob = row.images?.[variant]
    if (blob instanceof Blob) found[variant] = urlFor(record, variant, blob)
  }
  if (!found.day || !found.night) {
    console.warn(`[backgrounds] ${name} is missing its day or night picture — skipping it.`)
    return null
  }
  return { record, urls: { ...found, day: found.day, night: found.night } }
}

/** Lets go of every URL `keep` does not hold. */
function releaseUrls(keep: (key: string) => boolean): void {
  for (const [key, url] of urls) {
    if (keep(key)) continue
    URL.revokeObjectURL(url)
    urls.delete(key)
  }
}

/** `backgrounds:list` — every whole background, by name, letting go of URLs whose picture went. */
export async function listBackgrounds(): Promise<CustomBackgroundListing[]> {
  const listed: CustomBackgroundListing[] = []
  const live = new Set<string>()
  for (const [name, row] of await allBackgroundRows()) {
    const listing = listingOf(name, row)
    if (!listing) continue
    listed.push(listing)
    for (const variant of BG_VARIANTS) {
      if (listing.urls[variant]) live.add(urlKey(listing.record, variant))
    }
  }
  releaseUrls((key) => live.has(key))
  return listed
}

/**
 * `backgrounds:add` — keeps a new background, `images` being each picture's base64 PNG bytes by
 * variant, and answers it as a listing does. A name already kept is refused.
 */
export async function addBackground(
  draft: unknown,
  images: unknown
): Promise<CustomBackgroundListing> {
  const checked = assertCustomBackgroundDraft(draft)
  const encoded = assertBackgroundVariants(
    images,
    (value): value is string => typeof value === 'string'
  )
  const pictures: Partial<Record<BgVariant, Blob>> = {}
  for (const variant of BG_VARIANTS) {
    const png = encoded[variant]
    if (png === undefined) continue
    const bytes = base64ToBytes(png)
    assertRoomPicture(bytes)
    pictures[variant] = imageBlob(bytes)
  }

  const row: StoredBackground = {
    record: { schemaVersion: CUSTOM_BACKGROUND_SCHEMA_VERSION, ...checked, createdAt: Date.now() },
    images: pictures
  }
  // Decided inside the transaction and refused outside it, so a taken name is not mistaken for
  // the browser's storage failing.
  if (!(await insertBackgroundRow(row))) throw backgroundTaken(checked.name)

  const listing = listingOf(checked.name, row)
  if (!listing) throw appError('BACKGROUND_UNWRITABLE', 'Could not save the background.')
  return listing
}

/** `backgrounds:remove` — the row and every URL it was shown through. */
export async function removeBackground(name: unknown): Promise<void> {
  assertSafeBgName(name)
  await deleteBackgroundRow(name)
  releaseUrls((key) => !key.startsWith(`${name}@`))
}

/** `backgrounds:readImage` — one picture's bytes, or null where the background has none. */
export async function readBackgroundImage(
  name: unknown,
  variant: unknown
): Promise<Uint8Array<ArrayBuffer> | null> {
  assertSafeBgName(name)
  if (!isBgVariant(variant)) {
    throw appError('BACKGROUND_INVALID', 'That background picture does not exist.', String(variant))
  }
  const blob = (await readBackgroundRow(name))?.images?.[variant]
  return blob instanceof Blob ? new Uint8Array(await blob.arrayBuffer()) : null
}

/** Lets go of every URL, once a restore has replaced the rows behind them. */
export function forgetBackgroundUrls(): void {
  releaseUrls(() => false)
}
