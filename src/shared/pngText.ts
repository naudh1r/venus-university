import { imageTypeOf } from './imageBytes'
import { bytesToBase64 } from './base64'
import { appError } from './errors'

/**
 * Reading and writing PNG `tEXt` chunks: the one hand-rolled byte format the card export needs,
 * since a SillyTavern card is a picture with its sheet hidden in the file that carries it.
 */

/** The eight bytes every PNG opens with. */
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** ASCII bytes of a four-letter chunk type. */
function typeBytes(type: string): number[] {
  return Array.from(type, (char) => char.charCodeAt(0))
}

/** The CRC32 table, built once, over every byte value's eight-bit polynomial division. */
const CRC_TABLE: number[] = (() => {
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    table.push(c >>> 0)
  }
  return table
})()

/** The CRC32 of `bytes`, the checksum a PNG chunk carries over its type and data. */
function crc32(bytes: readonly number[]): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** A 32-bit unsigned integer as four big-endian bytes. */
function u32Bytes(value: number): number[] {
  return [
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff
  ]
}

/** A big-endian 32-bit unsigned integer read out of `bytes` at `offset`. */
function readU32(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) |
      (bytes[offset + 1] << 16) |
      (bytes[offset + 2] << 8) |
      bytes[offset + 3]) >>>
    0
  )
}

/** How many bytes go into one `String.fromCharCode` call, so a long sheet cannot overflow the stack. */
const CHAR_CHUNK = 0x8000

/** Bytes to a Latin-1 string, one call's worth of char codes at a time. */
function bytesToLatin1(bytes: Uint8Array): string {
  let text = ''
  for (let i = 0; i < bytes.length; i += CHAR_CHUNK) {
    text += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHAR_CHUNK)))
  }
  return text
}

/** A Latin-1 string to its bytes — `bytesToLatin1`'s inverse. */
function latin1ToBytes(text: string): number[] {
  const bytes = new Array<number>(text.length)
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i)
  return bytes
}

/** One chunk as it sits in the file: its type, data and where it ends. */
interface Chunk {
  type: string
  data: Uint8Array
  /** The byte offset one past this chunk's CRC — where the next chunk, if any, starts. */
  end: number
}

/** The chunk starting at `offset`, or throws where the length claims bytes past the file's end. */
function readChunk(png: Uint8Array, offset: number): Chunk {
  const length = readU32(png, offset)
  const typeStart = offset + 4
  const dataStart = typeStart + 4
  const dataEnd = dataStart + length
  const crcEnd = dataEnd + 4
  if (crcEnd > png.length) {
    throw appError(
      'CARD_NOT_PNG',
      'The card picture could not be written.',
      'a chunk runs past the end of the file'
    )
  }
  const type = bytesToLatin1(png.subarray(typeStart, dataStart))
  return { type, data: png.subarray(dataStart, dataEnd), end: crcEnd }
}

/** Every chunk in `png`, from just after the signature through `IEND`. */
function readChunks(png: Uint8Array): Chunk[] {
  const chunks: Chunk[] = []
  let offset = PNG_SIGNATURE.length
  while (offset < png.length) {
    const chunk = readChunk(png, offset)
    chunks.push(chunk)
    offset = chunk.end
    if (chunk.type === 'IEND') break
  }
  return chunks
}

/** Refuses anything that is not a PNG whose first chunk is `IHDR`. */
function assertWellFormedPng(png: Uint8Array): Chunk[] {
  if (imageTypeOf(png) !== 'image/png') {
    throw appError('CARD_NOT_PNG', 'The card picture could not be written.', 'not a PNG')
  }
  const chunks = readChunks(png)
  if (chunks.length === 0 || chunks[0].type !== 'IHDR') {
    throw appError(
      'CARD_NOT_PNG',
      'The card picture could not be written.',
      'the first chunk is not IHDR'
    )
  }
  return chunks
}

/** One `tEXt` chunk's bytes, keyword and text encoded as the spec lays them out. */
function textChunkBytes(keyword: string, text: string): Uint8Array {
  const data = [...latin1ToBytes(keyword), 0x00, ...latin1ToBytes(text)]
  const type = typeBytes('tEXt')
  const crc = crc32([...type, ...data])
  return Uint8Array.from([...u32Bytes(data.length), ...type, ...data, ...u32Bytes(crc)])
}

/**
 * Inserts one `tEXt` chunk per `entries` right after `IHDR`, keyword by keyword, replacing any
 * existing `tEXt` chunk under the same keyword rather than duplicating it.
 */
export function withTextChunks(png: Uint8Array, entries: Readonly<Record<string, string>>): Uint8Array {
  const chunks = assertWellFormedPng(png)
  const keywords = new Set(Object.keys(entries))

  const kept: Uint8Array[] = []
  const inserted: Uint8Array[] = Object.entries(entries).map(([keyword, text]) =>
    textChunkBytes(keyword, text)
  )

  let ihdrSeen = false
  for (const chunk of chunks) {
    const bytes = png.subarray(chunk.end - (4 + 4 + chunk.data.length + 4), chunk.end)
    if (chunk.type === 'tEXt') {
      const nul = chunk.data.indexOf(0x00)
      const keyword = String.fromCharCode(...chunk.data.subarray(0, nul === -1 ? chunk.data.length : nul))
      if (keywords.has(keyword)) continue
    }
    kept.push(bytes)
    if (chunk.type === 'IHDR' && !ihdrSeen) {
      ihdrSeen = true
      kept.push(...inserted)
    }
  }

  const total = kept.reduce((sum, bytes) => sum + bytes.length, 0)
  const out = new Uint8Array(PNG_SIGNATURE.length + total)
  out.set(PNG_SIGNATURE, 0)
  let offset = PNG_SIGNATURE.length
  for (const bytes of kept) {
    out.set(bytes, offset)
    offset += bytes.length
  }
  return out
}

/** Every `tEXt` chunk in `png`, keyword to text. */
export function textChunksOf(png: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {}
  for (const chunk of readChunks(png)) {
    if (chunk.type !== 'tEXt') continue
    const nul = chunk.data.indexOf(0x00)
    if (nul === -1) continue
    const keyword = String.fromCharCode(...chunk.data.subarray(0, nul))
    const text = bytesToLatin1(chunk.data.subarray(nul + 1))
    out[keyword] = text
  }
  return out
}

/** UTF-8 encodes `text`, then base64s the bytes — works the same in a browser and in Node. */
export function utf8ToBase64(text: string): string {
  return bytesToBase64(new TextEncoder().encode(text))
}
