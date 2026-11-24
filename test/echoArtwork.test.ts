import { describe, expect, it } from 'vitest'
import { assertEchoPng, assertSameEchoArt, echoArtEntry, echoArtIdOf, echoArtIds } from '@shared/echoArtwork'
import { classifyBackupEntry } from '@shared/backup'
const id = 'fdc99b1a-bd3b-41ca-897f-757b3bf983c3'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
describe('portable Echo artwork records', () => {
  it('accepts only fixed PNG paths below the Echo artwork directory', () => {
    expect(echoArtIdOf(echoArtEntry(id))).toBe(id)
    expect(classifyBackupEntry(echoArtEntry(id))).toBe('image')
    for (const bad of ['../../settings', `${id}/x`, `${id}.png`, 'C:/data/secret']) {
      expect(() => echoArtEntry(bad)).toThrow()
      expect(echoArtIdOf(`echoes/art/${bad}.png`)).toBeNull()
    }
    expect(classifyBackupEntry('echoes/sources/private.png')).toBe('reject')
  })
  it('reads old backups but rejects duplicate and malformed manifests', () => {
    expect(echoArtIds(undefined)).toEqual([])
    expect(echoArtIds([id])).toEqual([id])
    for (const value of [null, {}, ['../../settings'], [id, id.toUpperCase()], Array(4097).fill(id)]) expect(() => echoArtIds(value)).toThrow()
  })
  it('rejects oversized dimensions before an image is decoded', () => {
    expect(() => assertEchoPng(png)).not.toThrow()
    const large = Buffer.from(png); large.writeUInt32BE(100000, 16)
    large.writeUInt32BE(100000, 20)
    expect(() => assertEchoPng(large)).toThrow('size limit')
    expect(() => assertEchoPng(png.subarray(0, 24))).toThrow()
  })
  it('will not overwrite an immutable id with another image', () => {
    expect(() => assertSameEchoArt(undefined, png)).not.toThrow()
    expect(() => assertSameEchoArt(Buffer.from(png), png)).not.toThrow()
    const different = Buffer.from(png); different[different.length - 1] ^= 1
    expect(() => assertSameEchoArt(different, png)).toThrow('different image')
  })
})
