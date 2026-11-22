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

/**
 * How the renderer encodes a WebP, on Chromium's quality scale, 0 to 1. Every render lands as
 * PNG; with "Save photos as WebP" on, the renderer re-encodes it and the PNG goes. A name says
 * which one it was meant to be, and a reader takes whichever is on disk.
 */
export const WEBP_QUALITY = 0.85

/** `risa_bunnyboard_001.png` — whose it is, where it was posted, and which one of hers. */
const PHOTO_FILE = /^[a-z0-9]+_(?:bunnyboard|chat)_\d{3,6}\.(?:png|webp)$/

/**
 * `photo_1790092329373_a1b2c3d4.png` — the name pictures were kept under before they were
 * named after the girl who sent them. Still read, never minted: a save from then still points
 * at these, and the pictures themselves are on disk.
 */
const LEGACY_PHOTO_FILE = /^photo_\d{1,20}_[a-f0-9]{8}\.png$/

/** New photos have ten random lowercase letters and digits, without a counter or kind. */
const RANDOM_PHOTO_FILE = /^[a-z0-9]{10}\.(?:png|webp)$/

/** Whether a name is one of ours, and so safe to join onto a folder path. */
export function isPhotoFile(file: string): boolean {
  if (file !== file.trim()) return false
  return RANDOM_PHOTO_FILE.test(file) || PHOTO_FILE.test(file) || LEGACY_PHOTO_FILE.test(file)
}

/** The JSON kept beside a picture, under the same stem in either image format. */
export function photoSidecarOf(file: string): string {
  return file.replace(/\.(?:png|webp)$/, '.json')
}

/** Whether a name is the sidecar of a current or legacy photo name. */
export function isPhotoSidecar(name: string): boolean {
  return name.endsWith('.json') && isPhotoFile(name.slice(0, -5) + '.png')
}

/** Whether a name is for a WebP picture, which the renderer still has to encode. */
export function isWebpPhoto(file: string): boolean {
  return isPhotoFile(file) && file.endsWith('.webp')
}

/** The PNG name a WebP picture is rendered under before it is encoded. */
export function pngPhotoOf(file: string): string {
  return file.replace(/\.webp$/, '.png')
}

/** Builds the route from a stored name, never stores a full URL in a record. */
export function photoUrl(playthroughId: string, charId: string, file: string): string {
  return `vxmod://photo-feature/@/photos/${playthroughId}/${charId}/${file}`
}
