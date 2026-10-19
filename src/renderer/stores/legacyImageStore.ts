import { legacyImageCaption } from '../views/legacyImageCaption'
import { nameCrossingWait } from './crossingStore'

/**
 * Converts every picture an older build kept as PNG or JPEG to WebP, captioning the boot curtain
 * with its progress once there is something to convert. A failure only warns: boot goes on.
 */
export async function convertLegacyImages(): Promise<void> {
  let shown: string | null = null
  const stop = window.api.images.onProgress((progress) => {
    if (progress.total <= 0) return
    const caption = legacyImageCaption(progress)
    if (caption === shown) return
    shown = caption
    nameCrossingWait(caption)
  })
  try {
    const result = await window.api.images.convertLegacy()
    // What it did is logged where it ran; only a failure is said here.
    if (!result.ok) {
      console.warn('Picture conversion failed:', result.error.code, result.error.message)
    }
  } catch (err) {
    console.warn('Picture conversion failed:', err)
  } finally {
    stop()
    if (shown !== null) nameCrossingWait(null)
  }
}
