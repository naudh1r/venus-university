/** A window into a source picture, in source pixels. */
export interface CropWindow {
  x: number
  y: number
  width: number
  height: number
}

/** The largest centred `aspect` (width / height) window to cut out of a `width`×`height` source. */
export function coverCrop(width: number, height: number, aspect: number): CropWindow {
  // Flooring both sides keeps the window inside the source whichever way round the picture is.
  const cropWidth = Math.floor(Math.min(width, height * aspect))
  const cropHeight = Math.floor(cropWidth / aspect)
  return {
    x: Math.floor((width - cropWidth) / 2),
    y: Math.floor((height - cropHeight) / 2),
    width: cropWidth,
    height: cropHeight
  }
}
