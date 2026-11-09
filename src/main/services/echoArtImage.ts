import { imageTypeOf } from '@vx/modkit/shared'
import { openImage } from './imageFiles'

export const MAX_ECHO_ART_BYTES = 20 * 1024 * 1024
const UNREADABLE = 'This file is not a readable image. Use PNG, JPEG or WebP.'

/** Decode with the same WebP-capable library as character art; keep portable art as PNG. */
export async function decodeEchoArt(bytes: Uint8Array): Promise<Buffer> {
  if (bytes.byteLength > MAX_ECHO_ART_BYTES) throw Error('Choose an image smaller than 20 MB.')
  if (!imageTypeOf(bytes)) throw Error(UNREADABLE)
  const image = await openImage(bytes)
  const size = await image.metadata().catch(() => { throw Error(UNREADABLE) })
  if (!size.width || !size.height) throw Error(UNREADABLE)
  if (size.width * size.height > 25_000_000) throw Error('Choose an image smaller than 25 megapixels.')
  try {
    return await image.rotate().resize(1536, 1536, { fit: 'inside', withoutEnlargement: true }).png().toBuffer()
  } catch {
    throw Error(UNREADABLE)
  }
}
