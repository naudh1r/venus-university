import type { CropWindow } from '@shared/coverCrop'

/**
 * Draws `crop` of the picture into a `width`×`height` canvas and encodes it as PNG, or `null`
 * where the canvas cannot be drawn or encoded.
 */
export async function cropToPng(
  bitmap: ImageBitmap,
  crop: CropWindow,
  width: number,
  height: number
): Promise<Uint8Array<ArrayBuffer> | null> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height)
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png')
  })
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}
