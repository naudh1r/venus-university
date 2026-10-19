import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import sharp, { type Sharp } from 'sharp'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { imageTypeOf } from '@shared/imageBytes'

/**
 * The boot's conversion of older pictures to WebP: it deletes the file a picture was kept in, so
 * a pass that removed the wrong one, or wrote over a newer picture, loses it for good. `electron`
 * is stubbed to root `paths.ts` at a temp folder; the pictures are real, so the encode is.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

const { convertLegacyImages } = await import('../src/main/services/legacyImageService')
const { convertImageFile } = await import('../src/main/services/imageFiles')
const {
  getCharacterExpressionsPath,
  getCharacterImagePath,
  getEndingArtPath,
  getPhotosPath,
  getPregenCharactersPath
} = await import('../src/main/paths')

const CHAR = 'char-1'
const PLAYTHROUGH = '1700000000000'

/** A small picture with a transparent half, as a PNG. */
async function png(): Promise<Buffer> {
  return sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 1 } }
  })
    .composite([
      {
        input: { create: { width: 4, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } },
        left: 0,
        top: 0
      }
    ])
    .png()
    .toBuffer()
}

/** The same picture as a JPEG, as an older cloud render or thumbnail is. */
async function jpeg(): Promise<Buffer> {
  return sharp(await png()).flatten().jpeg().toBuffer()
}

async function put(path: string, bytes: Uint8Array | string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-university-legacy-'))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('convertLegacyImages', () => {
  it("converts a character's pictures, a graduation picture and a photo with its thumbnail", async () => {
    const sprite = join(getCharacterExpressionsPath(CHAR), 'happy.png')
    const base = getCharacterImagePath(CHAR, 'expressions/neutral.base.png')
    const ending = getEndingArtPath(PLAYTHROUGH)
    const photo = join(getPhotosPath(PLAYTHROUGH), '42.png')
    const thumb = join(getPhotosPath(PLAYTHROUGH), '42.thumb.jpg')
    await put(sprite, await png())
    await put(base, await png())
    await put(ending, await jpeg())
    await put(photo, await png())
    await put(thumb, await jpeg())

    const report = await convertLegacyImages(() => {})

    expect(report).toMatchObject({ total: 5, converted: 5, dropped: 0, left: 0 })
    expect(await readdir(getCharacterExpressionsPath(CHAR))).toEqual(['happy.webp', 'neutral.base.webp'])
    expect((await readdir(getPhotosPath(PLAYTHROUGH))).sort()).toEqual(['42.thumb.webp', '42.webp'])
    expect(imageTypeOf(await readFile(ending.replace(/\.png$/, '.webp')))).toBe('image/webp')
    // The base frame is fed back into every later render, so it is kept losslessly.
    const kept = await readFile(base.replace(/\.png$/, '.webp'))
    expect(kept.subarray(12, 16).toString('latin1')).toBe('VP8L')
  })

  it('removes a PNG standing beside its WebP twin and never touches the WebP', async () => {
    const dir = getCharacterExpressionsPath(CHAR)
    await put(join(dir, 'happy.png'), await png())
    await put(join(dir, 'happy.webp'), 'the newer picture')

    const report = await convertLegacyImages(() => {})

    expect(report).toMatchObject({ dropped: 1, converted: 0 })
    expect(await readdir(dir)).toEqual(['happy.webp'])
    expect(await readFile(join(dir, 'happy.webp'), 'utf8')).toBe('the newer picture')
  })

  it('never writes over a WebP that lands while the old file is being converted', async () => {
    const dir = getCharacterExpressionsPath(CHAR)
    const old = join(dir, 'happy.png')
    await put(old, await png())
    // A writer finishing first, between the pass's look and its write.
    const original = sharp.prototype.toBuffer
    vi.spyOn(sharp.prototype, 'toBuffer').mockImplementation(async function (this: Sharp) {
      await writeFile(join(dir, 'happy.webp'), 'written meanwhile')
      return original.call(this)
    } as typeof original)

    const result = await convertImageFile(old, false)

    expect(result.outcome).toBe('dropped')
    expect(await readdir(dir)).toEqual(['happy.webp'])
    expect(await readFile(join(dir, 'happy.webp'), 'utf8')).toBe('written meanwhile')
  })

  it('leaves a picture that will not decode as it is', async () => {
    const dir = getCharacterExpressionsPath(CHAR)
    const broken = (await png()).subarray(0, 40)
    await put(join(dir, 'happy.png'), broken)

    const report = await convertLegacyImages(() => {})

    expect(report).toMatchObject({ left: 1, converted: 0 })
    expect(await readFile(join(dir, 'happy.png'))).toEqual(broken)
  })

  it('never touches the shipped cast', async () => {
    const shipped = join(getPregenCharactersPath(), CHAR, 'expressions', 'happy.png')
    await put(shipped, await png())

    const report = await convertLegacyImages(() => {})

    expect(report.total).toBe(0)
    expect(await readdir(dirname(shipped))).toEqual(['happy.png'])
  })
})
