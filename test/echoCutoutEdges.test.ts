import { expect, it } from 'vitest'
import { refineWhiteEchoEdges } from '@shared/echoCutoutEdges'

it('removes connected white remnants while preserving black outlines and enclosed white highlights', () => {
  const width = 7, height = 7
  const source = new Uint8ClampedArray(width * height * 4).fill(255)
  const cutout = new Uint8ClampedArray(source)
  for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) {
    if (x === 3 && y === 3) continue
    const i = (y * width + x) * 4
    source.fill(0, i, i + 3); cutout.fill(0, i, i + 3)
  }
  cutout[3] = 0
  const actual = refineWhiteEchoEdges(source, cutout, width, height)
  expect(actual[(width + 3) * 4 + 3]).toBe(0)
  expect([...actual.slice((3 * width + 3) * 4, (3 * width + 3) * 4 + 4)]).toEqual([255, 255, 255, 255])
  expect([...actual.slice((2 * width + 3) * 4, (2 * width + 3) * 4 + 4)]).toEqual([0, 0, 0, 255])
})

it('does not color-key dark backgrounds or alter opaque interior colors', () => {
  const source = new Uint8ClampedArray(4 * 9).fill(20), cutout = new Uint8ClampedArray(source)
  for (let i = 3; i < source.length; i += 4) source[i] = cutout[i] = 255
  cutout[3] = 0
  expect(refineWhiteEchoEdges(source, cutout, 3, 3)).toEqual(cutout)
  expect(() => refineWhiteEchoEdges(source, cutout, 0, 3)).toThrow()
})

it('decontaminates a translucent white matte at the mask edge', () => {
  const source = new Uint8ClampedArray(4 * 9).fill(255), cutout = new Uint8ClampedArray(source)
  source.set([127, 127, 127, 255], 16); cutout.set([127, 127, 127, 128], 16)
  cutout[3] = 0
  const result = refineWhiteEchoEdges(source, cutout, 3, 3)
  expect([...result.slice(16, 20)]).toEqual([0, 0, 0, 128])
})
