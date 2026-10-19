import { imageTypeOf } from '@shared/imageBytes'
import { LINEUP_MIME_TYPE, LINEUP_QUALITY } from '@shared/lineup'
import { WEBP_PROFILE } from '@shared/webpProfile'
import { imageBlob } from './blob'

/**
 * Pictures re-encoded in the browser, on its own canvas. What the canvas answers is sniffed
 * rather than trusted: a browser that cannot write a format quietly hands back a PNG. Each encode
 * runs before the database transaction it feeds opens, which an await outside the database closes.
 */

/** The type every picture is kept as. */
const WEBP_TYPE = 'image/webp'

/** Enough of a picture's first bytes for the sniffer. */
const HEAD_BYTES = 16

/** {@link canEncodeWebp}'s answer, asked for once. */
let probe: Promise<boolean> | null = null

/** The first bytes of a blob, for the sniffer. */
async function headOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, HEAD_BYTES).arrayBuffer())
}

/** The type a blob's own first bytes say it is. */
export async function sniffedType(blob: Blob): Promise<string | null> {
  return imageTypeOf(await headOf(blob))
}

/** Whether this browser's canvas writes WebP: asked once a session, of a 1×1 canvas. */
export function canEncodeWebp(): Promise<boolean> {
  probe ??= (async () => {
    if (typeof OffscreenCanvas === 'undefined') return false
    try {
      const canvas = new OffscreenCanvas(1, 1)
      if (!canvas.getContext('2d')) return false
      return (await sniffedType(await canvas.convertToBlob({ type: WEBP_TYPE }))) === WEBP_TYPE
    } catch {
      return false
    }
  })()
  return probe
}

/**
 * `blob` decoded, drawn onto a canvas of its own size and written out as `type` at `quality`, or
 * `null` where any step fails or the canvas answers another type. The decode applies no colour
 * profile, so the pixels drawn are the ones stored.
 */
async function reencoded(blob: Blob, type: string, quality: number): Promise<Blob | null> {
  if (typeof OffscreenCanvas === 'undefined') return null
  let bitmap: ImageBitmap | null = null
  try {
    bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d')
    if (!context) return null
    context.drawImage(bitmap, 0, 0)
    const out = await canvas.convertToBlob({ type, quality })
    return (await sniffedType(out)) === type ? out : null
  } catch {
    return null
  } finally {
    bitmap?.close()
  }
}

/** A PNG or JPEG re-encoded as WebP at the shipped cast's quality, or `null` where it cannot be. */
export async function webpOf(blob: Blob): Promise<Blob | null> {
  if (!(await canEncodeWebp())) return null
  const type = await sniffedType(blob)
  if (type !== 'image/png' && type !== 'image/jpeg') return null
  return reencoded(blob, WEBP_TYPE, WEBP_PROFILE.quality / 100)
}

/**
 * The blob a picture is kept as: its WebP, or what it came as where it already is one, is one of
 * the editor's working files (the canvas premultiplies alpha, so no round trip is exact), or
 * cannot be re-encoded here.
 */
export async function storedBlob(input: Blob | Uint8Array, lossless: boolean): Promise<Blob> {
  const original = input instanceof Blob ? input : imageBlob(input)
  if (lossless) return original
  return (await webpOf(original)) ?? original
}

/**
 * A picture as the JPEG an image model is handed as a reference: as it is where it already is
 * one, re-encoded at the reference sheet's quality otherwise, or `null` where it cannot be.
 */
export async function jpegOf(bytes: Uint8Array): Promise<Uint8Array | null> {
  if (imageTypeOf(bytes) === LINEUP_MIME_TYPE) return bytes
  if (imageTypeOf(bytes) === null) return null
  const out = await reencoded(imageBlob(bytes), LINEUP_MIME_TYPE, LINEUP_QUALITY)
  return out ? new Uint8Array(await out.arrayBuffer()) : null
}
