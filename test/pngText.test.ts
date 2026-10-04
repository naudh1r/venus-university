import { zlibSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { base64ToBytes } from '../src/shared/base64'
import { textChunksOf, utf8ToBase64, withTextChunks } from '../src/shared/pngText'

/**
 * A card whose chunks are malformed is one SillyTavern refuses to read, and nothing else in
 * the app checks a PNG's chunk layout or CRCs — this is the one place that does.
 */

/** The eight bytes every PNG opens with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** An independent CRC32, so a bug shared with `pngText.ts` could not hide from this test. */
function crc32(bytes: number[]): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let i = 0; i < 8; i++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** A 32-bit big-endian integer as four bytes. */
function u32(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff]
}

/** ASCII bytes of a four-letter chunk type. */
function ascii(text: string): number[] {
  return Array.from(text, (char) => char.charCodeAt(0))
}

/** One chunk's bytes: length, type, data, then a CRC over type and data. */
function chunk(type: string, data: number[]): number[] {
  const typeAndData = [...ascii(type), ...data]
  return [...u32(data.length), ...typeAndData, ...u32(crc32(typeAndData))]
}

/** A minimal valid one-pixel PNG: signature, IHDR, one IDAT, IEND. */
function onePixelPng(): Uint8Array {
  const ihdr = chunk('IHDR', [
    ...u32(1), // width
    ...u32(1), // height
    8, // bit depth
    6, // colour type: RGBA
    0, // compression
    0, // filter
    0 // interlace
  ])
  // One scanline: a filter byte, then one RGBA pixel.
  const scanline = Uint8Array.from([0, 255, 0, 0, 255])
  const idat = chunk('IDAT', Array.from(zlibSync(scanline, { level: 0 })))
  const iend = chunk('IEND', [])
  return Uint8Array.from([...PNG_SIGNATURE, ...ihdr, ...idat, ...iend])
}

/** The chunk type starting at `offset`, four bytes after its length field. */
function typeAt(png: Uint8Array, offset: number): string {
  return String.fromCharCode(...png.subarray(offset + 4, offset + 8))
}

/** The byte length of one whole chunk (length + type + data + crc) starting at `offset`. */
function chunkSize(png: Uint8Array, offset: number): number {
  const length = (png[offset] << 24) | (png[offset + 1] << 16) | (png[offset + 2] << 8) | png[offset + 3]
  return 12 + length
}

describe('withTextChunks', () => {
  it('keeps the signature intact and IHDR still first', () => {
    const png = onePixelPng()

    const written = withTextChunks(png, { chara: utf8ToBase64('{}') })

    expect(Array.from(written.subarray(0, 8))).toEqual(PNG_SIGNATURE)
    expect(typeAt(written, 8)).toBe('IHDR')
  })

  it('places both written chunks right after IHDR and before IDAT', () => {
    const png = onePixelPng()

    const written = withTextChunks(png, { chara: utf8ToBase64('{}'), ccv3: utf8ToBase64('{}') })

    let offset = 8
    const types: string[] = []
    while (true) {
      const type = typeAt(written, offset)
      types.push(type)
      if (type === 'IEND') break
      offset += chunkSize(written, offset)
    }
    expect(types).toEqual(['IHDR', 'tEXt', 'tEXt', 'IDAT', 'IEND'])
  })

  it('gives each written chunk a CRC that recomputes over its type and data', () => {
    const png = onePixelPng()

    const written = withTextChunks(png, { chara: utf8ToBase64('hello') })

    let offset = 8
    while (typeAt(written, offset) !== 'tEXt') offset += chunkSize(written, offset)
    const length = (written[offset] << 24) | (written[offset + 1] << 16) | (written[offset + 2] << 8) | written[offset + 3]
    const typeAndData = Array.from(written.subarray(offset + 4, offset + 8 + length))
    const storedCrc =
      (written[offset + 8 + length] << 24) |
      (written[offset + 9 + length] << 16) |
      (written[offset + 10 + length] << 8) |
      written[offset + 11 + length]
    expect(storedCrc >>> 0).toBe(crc32(typeAndData))
  })

  it('replaces a keyword written twice, rather than duplicating it', () => {
    const png = onePixelPng()

    const first = withTextChunks(png, { chara: utf8ToBase64('one') })
    const second = withTextChunks(first, { chara: utf8ToBase64('two') })

    const chunks = textChunksOf(second)
    expect(chunks.chara).toBe(utf8ToBase64('two'))

    let count = 0
    let offset = 8
    while (typeAt(second, offset) !== 'IEND') {
      if (typeAt(second, offset) === 'tEXt') count++
      offset += chunkSize(second, offset)
    }
    expect(count).toBe(1)
  })

  it('refuses bytes that are not a PNG', () => {
    const notPng = Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8])

    expect(() => withTextChunks(notPng, { chara: 'x' })).toThrow()
  })
})

describe('textChunksOf', () => {
  it('round-trips base64 of non-ASCII JSON, byte for byte', () => {
    const payload = JSON.stringify({ name: 'Zoë — 日本' })
    const png = onePixelPng()

    const written = withTextChunks(png, { chara: utf8ToBase64(payload) })
    const read = textChunksOf(written)

    expect(Buffer.from(read.chara, 'base64').toString('utf8')).toBe(payload)
    expect(new TextDecoder().decode(base64ToBytes(read.chara))).toBe(payload)
  })
})
