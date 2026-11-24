import { ECHO_ART_ID } from './echo'
import { imageTypeOf } from './imageBytes'

export const ECHO_ART_DIR = 'echoes/art'
export const ECHO_ART_MAX_BYTES = 20 * 1024 * 1024

export function echoArtEntry(id: string): string {
  if (!ECHO_ART_ID.test(id)) throw Error('Invalid Echo artwork id.')
  return `${ECHO_ART_DIR}/${id}.png`
}

export function echoArtIdOf(entry: string): string | null {
  if (!entry.startsWith(`${ECHO_ART_DIR}/`) || !entry.endsWith('.png')) return null
  const id = entry.slice(ECHO_ART_DIR.length + 1, -4)
  return ECHO_ART_ID.test(id) ? id : null
}

/** Validate before restore writes anything. Older backups legitimately have no artwork list. */
export function echoArtIds(value: unknown): string[] {
  if (value === undefined) return []
  // Whole-archive entry/byte limits apply to imports. A separate artwork count
  // would make two individually valid imported collections impossible to back up.
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string' || !ECHO_ART_ID.test(id))) {
    throw Error('Invalid Echo artwork list in backup.')
  }
  if (new Set(value.map(id => id.toLowerCase())).size !== value.length) throw Error('Duplicate Echo artwork id in backup.')
  return value
}

export function assertEchoPng(bytes: Uint8Array): void {
  if (bytes.byteLength < 33 || bytes.byteLength > ECHO_ART_MAX_BYTES || imageTypeOf(bytes) !== 'image/png') throw Error('Invalid or oversized Echo PNG.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (view.getUint32(8) !== 13 || view.getUint32(12) !== 0x49484452) throw Error('Invalid Echo PNG header.')
  const width = view.getUint32(16), height = view.getUint32(20)
  if (!width || !height || width * height > 25_000_000) throw Error('Echo PNG exceeds the image size limit.')
}

/** Immutable IDs must never silently replace a different image already used by another save. */
export function assertSameEchoArt(existing: Uint8Array | undefined, incoming: Uint8Array): void {
  if (existing && (existing.length !== incoming.length || existing.some((byte, index) => byte !== incoming[index]))) {
    throw Error('This backup has an Echo artwork id that belongs to a different image here. Nothing was restored.')
  }
}

/** Displayed when local segmentation cannot initialize before a paid image request. */
export const ECHO_CUTOUT_PREPARE_ERROR = "Could not load the Echo background-removal model or runtime. First use downloads about 100 MB from staticimgly.com. Check your connection and try Generate artwork again. Previous artwork is unchanged; no image API request was made."
