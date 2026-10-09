import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character } from './fixtures'

/**
 * The name a new picture is given. A save can point at names whose pictures are not in the
 * folder, from a render cut short or a save carried over without its pictures; handing one of
 * those out again puts the new picture under both bubbles.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

const { photoLanded, reservePhotoName, storeWebpPhoto } = await import(
  '../src/main/services/localPhotoService'
)
const { setPhotoSwitches } = await import('../src/shared/photoSwitches')

const april = character({ charId: 'april-1', firstName: 'April' })

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-photo-names-'))
  setPhotoSwitches({ webp: false })
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('reservePhotoName', () => {
  it('passes over the names the save already points at, with no file behind them', async () => {
    const name = await reservePhotoName('100', april, 'chat', [
      'april_chat_001.png',
      'april_chat_002.png'
    ])
    expect(name).toBe('april_chat_003.png')
  })

  it('counts what is on disk as well', async () => {
    const folder = join(root, 'data', 'saves', '200', 'photos', 'april-1')
    await mkdir(folder, { recursive: true })
    await writeFile(join(folder, 'april_chat_004.png'), '')
    expect(await reservePhotoName('200', april, 'chat', ['april_chat_001.png'])).toBe(
      'april_chat_005.png'
    )
  })

  it('ignores anything in the list that is not one of its names', async () => {
    expect(await reservePhotoName('300', april, 'chat', ['../escape.png', 42, null])).toBe(
      'april_chat_001.png'
    )
  })
})

/** The smallest file `imageTypeOf` reads as WebP: a RIFF header with the WEBP form tag. */
const WEBP = new Uint8Array([
  ...new TextEncoder().encode('RIFF'),
  4,
  0,
  0,
  0,
  ...new TextEncoder().encode('WEBPVP8 ')
])

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false
  )
}

describe('photos saved as WebP', () => {
  const folder = (): string => join(root, 'data', 'saves', '400', 'photos', 'april-1')

  beforeEach(() => setPhotoSwitches({ webp: true }))

  it('names a new picture as WebP, counting the PNGs already there', async () => {
    await mkdir(folder(), { recursive: true })
    await writeFile(join(folder(), 'april_chat_002.png'), '')
    expect(await reservePhotoName('400', april, 'chat', ['april_chat_001.webp'])).toBe(
      'april_chat_003.webp'
    )
  })

  it('finds a WebP that is still only its PNG', async () => {
    await mkdir(folder(), { recursive: true })
    await writeFile(join(folder(), 'april_chat_001.png'), '')
    expect(await photoLanded('400', 'april-1', 'april_chat_001.webp')).toBe(true)
    expect(await photoLanded('400', 'april-1', 'april_chat_002.webp')).toBe(false)
  })

  it('keeps the encoded WebP and drops the PNG it came from', async () => {
    await mkdir(folder(), { recursive: true })
    await writeFile(join(folder(), 'april_chat_001.png'), 'png')
    await storeWebpPhoto('400', 'april-1', 'april_chat_001.webp', WEBP)
    expect(await readFile(join(folder(), 'april_chat_001.webp'))).toEqual(Buffer.from(WEBP))
    expect(await exists(join(folder(), 'april_chat_001.png'))).toBe(false)
  })

  it('leaves the PNG standing for bytes that are not WebP, or a name that is not', async () => {
    await mkdir(folder(), { recursive: true })
    await writeFile(join(folder(), 'april_chat_001.png'), 'png')
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    await expect(storeWebpPhoto('400', 'april-1', 'april_chat_001.webp', png)).rejects.toThrow()
    await expect(storeWebpPhoto('400', 'april-1', 'april_chat_001.png', WEBP)).rejects.toThrow()
    expect(await exists(join(folder(), 'april_chat_001.png'))).toBe(true)
    expect(await exists(join(folder(), 'april_chat_001.webp'))).toBe(false)
  })
})
