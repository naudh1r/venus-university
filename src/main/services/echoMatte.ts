export interface EchoMatteResult {
  bitmap: Uint8Array
  background: 'black' | 'white' | null
  cleared: number
  feathered: number
}

/**
 * Remove a flat neutral backdrop connected to the image border, not similarly colored
 * details inside the creature. NativeImage uses premultiplied four-byte pixels; neutral
 * colors make this independent of RGB/BGR order. Existing alpha is never increased.
 * This is conservative color keying, not semantic segmentation of arbitrary scenery.
 */
export function clearEchoMatte(input: Uint8Array, width: number, height: number): EchoMatteResult {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
      width * height > 25_000_000 || input.length !== width * height * 4) throw Error('Invalid Echo bitmap.')
  const unchanged = (): EchoMatteResult => ({ bitmap: input, background: null, cleared: 0, feathered: 0 })
  let white = 0, black = 0, border = 0
  const sample = (pixel: number): void => {
    border++
    const i = pixel * 4
    if (input[i + 3] < 250) return
    const min = Math.min(input[i], input[i + 1], input[i + 2])
    const max = Math.max(input[i], input[i + 1], input[i + 2])
    if (min >= 238 && max - min <= 12) white++
    if (max <= 20) black++
  }
  for (let x = 0; x < width; x++) { sample(x); if (height > 1) sample((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { sample(y * width); if (width > 1) sample(y * width + width - 1) }
  const background = white / border >= .75 ? 'white' : black / border >= .75 ? 'black' : null
  if (!background) return unchanged()
  const light = background === 'white', count = width * height
  const mask = new Uint8Array(count), queue = new Uint32Array(count)
  let head = 0, tail = 0
  const enqueue = (pixel: number): void => {
    if (mask[pixel]) return
    const i = pixel * 4, alpha = input[i + 3]
    const min = Math.min(input[i], input[i + 1], input[i + 2])
    const max = Math.max(input[i], input[i + 1], input[i + 2])
    // Transparent pixels allow disconnected pieces of the outer matte to meet.
    if (alpha > 0 && (alpha < 250 || (light ? min < 235 || max - min > 16 : max > 20))) return
    mask[pixel] = 1
    queue[tail++] = pixel
  }
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1) }
  const neighbors = (pixel: number, visit: (neighbor: number) => void): void => {
    const x = pixel % width
    if (x > 0) visit(pixel - 1)
    if (x + 1 < width) visit(pixel + 1)
    if (pixel >= width) visit(pixel - width)
    if (pixel + width < count) visit(pixel + width)
  }
  while (head < tail) neighbors(queue[head++], enqueue)
  const bitmap = new Uint8Array(input)
  let cleared = 0, feathered = 0
  for (let pixel = 0; pixel < count; pixel++) {
    const i = pixel * 4
    if (mask[pixel]) {
      if (input[i + 3]) cleared++
      bitmap.fill(0, i, i + 4)
      continue
    }
    if (input[i + 3] < 250) continue // Preserve already-transparent interior artwork.
    let edge = false
    neighbors(pixel, n => { if (mask[n]) edge = true })
    if (!edge) continue
    const min = Math.min(input[i], input[i + 1], input[i + 2])
    const max = Math.max(input[i], input[i + 1], input[i + 2])
    const distance = light ? 255 - min : max
    if (distance >= 75) continue
    // A single-pixel soft boundary, with white/black matte removed from the colors.
    const coverage = Math.max(distance / 255, Math.min(1, Math.max(0, (distance - 20) / 55)))
    const alpha = Math.round(input[i + 3] * coverage)
    for (let channel = 0; channel < 3; channel++) {
      bitmap[i + channel] = Math.min(alpha, Math.max(0, Math.round(input[i + channel] - (light ? input[i + 3] - alpha : 0))))
    }
    bitmap[i + 3] = alpha
    if (alpha < input[i + 3]) feathered++
  }
  return { bitmap, background, cleared, feathered }
}
