import { isWebpPhoto, WEBP_QUALITY } from '@shared/photoFiles'
import type { Character, Result } from '@shared/types'

/**
 * Renders one picture, and stores it as WebP where its name asks for that.
 *
 * ComfyUI only saves PNG, and main has no image encoder, so the renderer does it with
 * Chromium's own: main reads it the PNG that just landed, it encodes that, and hands the bytes
 * back to be kept in its place. The bytes come over IPC rather than from `playimg://`: the
 * page's policy refuses that fetch, and a canvas drawn from another origin cannot be encoded.
 *
 * A failed encode is not a failed photo: the PNG stays, and every reader takes whichever of the
 * two is on disk.
 */
export async function renderPhoto(
  playthroughId: string,
  character: Character,
  tier: string,
  scene: string,
  file: string
): Promise<Result<string>> {
  const result = await window.api.photo.generate(playthroughId, character, tier, scene, file)
  if (result.ok && isWebpPhoto(file)) await encodeWebp(playthroughId, character.charId, file)
  return result
}

async function encodeWebp(playthroughId: string, charId: string, file: string): Promise<void> {
  try {
    const png = await window.api.photo.read(playthroughId, charId, file)
    if (!png.ok) throw new Error(`could not read it back: ${png.error.code}`)
    const blob = new Blob([new Uint8Array(png.data)], { type: 'image/png' })
    const bitmap = await createImageBitmap(blob)
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0)
    bitmap.close()
    const webp = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY })
    // A browser that cannot encode WebP answers with a PNG instead of failing.
    if (webp.type !== 'image/webp') throw new Error(`the encoder gave ${webp.type}`)
    const bytes = new Uint8Array(await webp.arrayBuffer())
    const stored = await window.api.photo.storeWebp(playthroughId, charId, file, bytes)
    if (!stored.ok) throw new Error(`${stored.error.code}: ${stored.error.message}`)
  } catch (error) {
    console.warn(`[photo] kept ${file} as PNG: ${String(error)}`)
  }
}
