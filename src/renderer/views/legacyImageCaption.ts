import type { LegacyImageProgress } from '@shared/types'

/**
 * What the curtain's mark says the picture conversion is doing. One short line, since the caption
 * is drawn as a single uppercase mono row, and a whole percent, so it is rewritten a hundred
 * times at most.
 */
export function legacyImageCaption(progress: LegacyImageProgress): string {
  const percent = progress.total > 0 ? Math.floor((progress.done / progress.total) * 100) : 0
  return `Compressing images ${percent}%`
}
