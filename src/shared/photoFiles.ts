/**
 * The names the pictures on a thread are kept under. One vocabulary, shared by the renderer
 * that asks for a photo, the service that writes it and the protocol that serves it — a name
 * nothing here would mint is a name nothing here will read.
 *
 * A name is settled before the picture is drawn, not after it lands, because the message or
 * post that carries it is written to the save the moment it appears. A name minted at the end
 * reaches the save only if the game is still running when the render finishes; one minted at
 * the start is recoverable, and a picture whose bubble was lost can be found again by looking
 * for the name that bubble was already carrying.
 */

/** Which thread a picture belongs to, which is the middle of its name. */
const PHOTO_KINDS = ['bunnyboard', 'chat'] as const
export type PhotoKind = (typeof PHOTO_KINDS)[number]

export function isPhotoKind(value: unknown): value is PhotoKind {
  return PHOTO_KINDS.includes(value as PhotoKind)
}

/**
 * What a picture is stored as. Every render lands as PNG; with "Save photos as WebP" on, the
 * renderer re-encodes it and the PNG goes. A name says which one it was meant to be, and a
 * reader takes whichever is on disk, so a WebP that never got written still shows its PNG.
 */
export type PhotoFormat = 'png' | 'webp'

/** How the renderer encodes a WebP: Chromium's quality scale, 0 to 1. */
export const WEBP_QUALITY = 0.85

/** `risa_bunnyboard_001.png` — whose it is, where it was posted, and which one of hers. */
const PHOTO_FILE = /^[a-z0-9]+_(?:bunnyboard|chat)_\d{3,6}\.(?:png|webp)$/

/**
 * `photo_1790092329373_a1b2c3d4.png` — the name pictures were kept under before they were
 * named after the girl who sent them. Still read, never minted: a save from then still points
 * at these, and the pictures themselves are on disk.
 */
const LEGACY_PHOTO_FILE = /^photo_\d{1,20}_[a-f0-9]{8}\.png$/

/** Whether a name is one of ours, and so safe to join onto a folder path. */
export function isPhotoFile(file: string): boolean {
  return PHOTO_FILE.test(file) || LEGACY_PHOTO_FILE.test(file)
}

/** How many digits the counter carries, so a folder sorts the way it was filled. */
const INDEX_DIGITS = 3

/**
 * The part of a name that is her: lowercase letters and digits of her first name, and her
 * character id where that leaves nothing — a name is a filename before it is a label.
 */
export function photoSlug(firstName: string, charId: string): string {
  const slug = firstName.toLowerCase().replace(/[^a-z0-9]/g, '')
  return slug.length > 0 ? slug : charId.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8)
}

/** Mints the name one picture is stored under. */
export function photoFileName(
  slug: string,
  kind: PhotoKind,
  index: number,
  format: PhotoFormat = 'png'
): string {
  return `${slug}_${kind}_${String(index).padStart(INDEX_DIGITS, '0')}.${format}`
}

/** Whether a name is for a WebP picture, which the renderer still has to encode. */
export function isWebpPhoto(file: string): boolean {
  return isPhotoFile(file) && file.endsWith('.webp')
}

/** The PNG name a WebP picture is rendered under before it is encoded. */
export function pngPhotoOf(file: string): string {
  return file.replace(/\.webp$/, '.png')
}

/** The counter in one of her names, or `null` for a name that is not one of this pair's. */
export function photoIndexOf(file: string, slug: string, kind: PhotoKind): number | null {
  const match = new RegExp(`^${slug}_${kind}_(\\d{${INDEX_DIGITS},6})\\.(?:png|webp)$`).exec(file)
  return match ? Number(match[1]) : null
}

/** The next free counter for one girl's pictures of one kind, given the names already taken. */
export function nextPhotoIndex(
  taken: readonly string[],
  slug: string,
  kind: PhotoKind
): number {
  let highest = 0
  for (const file of taken) {
    const index = photoIndexOf(file, slug, kind)
    if (index !== null && index > highest) highest = index
  }
  return highest + 1
}

/**
 * The host every photo URL carries. It is a constant rather than the playthrough because a
 * scheme registered `standard` has its host canonicalized like a web host, and a save id is
 * all digits — which Chromium reads as an IPv4 address, overflows, and rejects as an invalid
 * URL before any request is made. Everything that identifies the picture lives in the path.
 */
const PHOTO_HOST = 'photos'

/** The URL the renderer draws a photo from. */
export function photoUrl(playthroughId: string, charId: string, file: string): string {
  return `playimg://${PHOTO_HOST}/${playthroughId}/${charId}/${file}`
}
