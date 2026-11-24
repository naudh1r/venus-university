/**
 * Refine an AI mask only when the source has the requested flat white backdrop. Flood from
 * already transparent pixels through near-white remnants; enclosed white highlights stay.
 * Never key black or other dark creature details out of the image.
 */
export function refineWhiteEchoEdges(source: Uint8ClampedArray, cutout: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const count = width * height
  if (count < 1 || count > 25_000_000 || source.length !== count * 4 || cutout.length !== source.length) throw Error('Invalid Echo mask dimensions.')
  let border = 0, white = 0
  const pale = (i: number): boolean => Math.min(source[i], source[i + 1], source[i + 2]) >= 238 && Math.max(source[i], source[i + 1], source[i + 2]) - Math.min(source[i], source[i + 1], source[i + 2]) <= 12
  const sample = (p: number): void => { border++; if (source[p * 4 + 3] >= 250 && pale(p * 4)) white++ }
  for (let x = 0; x < width; x++) { sample(x); sample((height - 1) * width + x) }
  for (let y = 1; y < height - 1; y++) { sample(y * width); sample(y * width + width - 1) }
  if (white < border * .75) return cutout
  const result = new Uint8ClampedArray(cutout), mask = new Uint8Array(count), queue = new Uint32Array(count)
  let head = 0, tail = 0
  for (let p = 0; p < count; p++) if (cutout[p * 4 + 3] < 8) { mask[p] = 1; queue[tail++] = p }
  const neighbors = (p: number, visit: (p: number) => void): void => {
    if (p % width) visit(p - 1)
    if (p % width < width - 1) visit(p + 1)
    if (p >= width) visit(p - width)
    if (p < count - width) visit(p + width)
  }
  const grow = (p: number): void => { if (!mask[p] && pale(p * 4)) { mask[p] = 1; queue[tail++] = p } }
  while (head < tail) neighbors(queue[head++], grow)
  for (let p = 0; p < count; p++) {
    const i = p * 4
    if (mask[p]) { result.fill(0, i, i + 4); continue }
    // Only remove matte colour at an already-soft edge, never darken opaque interior detail.
    const alpha = result[i + 3] / 255
    if (alpha <= 0 || alpha >= .98) continue
    let edge = false; neighbors(p, n => { if (mask[n]) edge = true })
    if (edge) for (let c = 0; c < 3; c++) result[i + c] = Math.max(0, Math.min(255, (source[i + c] - (1 - alpha) * 255) / alpha))
  }
  return result
}
