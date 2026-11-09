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

const { carryPhotos, photoLanded, reservePhotoName, storeWebpPhoto } = await import(
  '../src/main/services/localPhotoService'
)
const { setModSwitches, getModSwitches } = await import('../src/main/services/modsService')
const { withOption } = await import('../src/shared/mods')
const { photoMainEntry } = await import('../src/main/modEntries/photo-feature')
photoMainEntry()

const PNG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const KEPT = Buffer.concat([PNG, Buffer.from('kept')])

const april = character({ charId: 'april-1', firstName: 'April' })

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-photo-names-'))
  for (const pid of ['100', '200', '300', '301', '400', '401', '500', '501']) {
    await mkdir(join(root, 'data', 'saves', pid), { recursive: true })
  }
  await setModSwitches(withOption(await getModSwitches(), 'photo-feature', 'webp', false))
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
    const folder = join(root, 'data', 'saves', '200', 'mod-data', 'photo-feature', 'april-1')
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
  const folder = (): string => join(root, 'data', 'saves', '400', 'mod-data', 'photo-feature', 'april-1')

  beforeEach(async () => setModSwitches(withOption(await getModSwitches(), 'photo-feature', 'webp', true)))

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

describe('carryPhotos', () => {
  const folderOf = (playthroughId: string, charId: string): string =>
    join(root, 'data', 'saves', playthroughId, 'mod-data', 'photo-feature', charId)

  it('copies every girl it finds into the next semester, PNG and WebP as they are', async () => {
    await mkdir(folderOf('300', 'april-1'), { recursive: true })
    await mkdir(folderOf('300', 'risa-2'), { recursive: true })
    await writeFile(join(folderOf('300', 'april-1'), 'april_chat_001.png'), PNG)
    await writeFile(join(folderOf('300', 'risa-2'), 'risa_bunnyboard_001.webp'), WEBP)

    await carryPhotos('300', '301')

    expect(await readFile(join(folderOf('301', 'april-1'), 'april_chat_001.png'))).toEqual(PNG)
    expect(await readFile(join(folderOf('301', 'risa-2'), 'risa_bunnyboard_001.webp'))).toEqual(Buffer.from(WEBP))
  })

  it('leaves a picture already in the new semester as it is', async () => {
    await mkdir(folderOf('400', 'april-1'), { recursive: true })
    await mkdir(folderOf('401', 'april-1'), { recursive: true })
    await writeFile(join(folderOf('400', 'april-1'), 'april_chat_001.png'), PNG)
    await writeFile(join(folderOf('401', 'april-1'), 'april_chat_001.png'), KEPT)

    await carryPhotos('400', '401')

    expect(await readFile(join(folderOf('401', 'april-1'), 'april_chat_001.png'))).toEqual(KEPT)
  })

  it('has nothing to do for a semester with no photos', async () => {
    await expect(carryPhotos('500', '501')).resolves.toBeUndefined()
  })
})
