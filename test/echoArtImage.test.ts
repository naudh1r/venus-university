import { expect, it } from 'vitest'
import sharp from 'sharp'
import { decodeEchoArt, MAX_ECHO_ART_BYTES } from '../src/main/services/echoArtImage'

// Real codecs: Electron's nativeImage accepts PNG/JPEG but rejects WebP on Windows.
it.each(['png', 'jpeg', 'webp-lossless', 'webp-lossy'] as const)('reads %s into a portable PNG without changing small image dimensions', async format => {
  const input = sharp({ create: { width: 32, height: 48, channels: 4, background: { r: 80, g: 90, b: 120, alpha: 0.5 } } })
  const bytes = await (format === 'png' ? input.png() : format === 'jpeg' ? input.jpeg() : input.webp({ lossless: format === 'webp-lossless' })).toBuffer()
  const output = await decodeEchoArt(bytes)
  expect(await sharp(output).metadata()).toMatchObject({ format: 'png', width: 32, height: 48 })
  if (format !== 'jpeg') {
    const { data, info } = await sharp(output).raw().toBuffer({ resolveWithObject: true })
    expect(info.channels).toBe(4)
    expect(data[3]).toBeGreaterThan(120)
    expect(data[3]).toBeLessThan(135)
  }
})

it('caps the longest edge while preserving aspect ratio and respects JPEG orientation', async () => {
  const png = await sharp({ create: { width: 800, height: 2000, channels: 3, background: '#987654' } }).webp().toBuffer()
  expect(await sharp(await decodeEchoArt(png)).metadata()).toMatchObject({ width: 614, height: 1536 })
  const jpeg = await sharp({ create: { width: 24, height: 40, channels: 3, background: '#987654' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  expect(await sharp(await decodeEchoArt(jpeg)).metadata()).toMatchObject({ width: 40, height: 24 })
})

it('refuses invalid, truncated, oversized and excessive-pixel images before they can be stored', async () => {
  await expect(decodeEchoArt(Buffer.from('not an image'))).rejects.toThrow('readable image')
  await expect(decodeEchoArt(Buffer.from('RIFF0000WEBPbroken'))).rejects.toThrow('readable image')
  await expect(decodeEchoArt(Buffer.alloc(MAX_ECHO_ART_BYTES + 1))).rejects.toThrow('20 MB')
  const tooBig = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: '#000000' } }).png().toBuffer()
  await expect(decodeEchoArt(tooBig)).rejects.toThrow('25 megapixels')
})
