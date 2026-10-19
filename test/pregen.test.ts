import { mkdtemp, mkdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character } from '@shared/types'
import { character } from './fixtures'

/**
 * The shipped cast: which root a charId resolves to, where a write to one lands (a copy under
 * `/data` in a packaged build, the shipped folder itself in an unpackaged run), and what
 * "delete" means when her folder is content the build came with. `safeStorage` rides along
 * because a removal is recorded in `settings.json`, where the secrets live. Both builds
 * resolve under one temp root, so a case flips `packaged` and the folders stay put.
 */
let root = ''
let packaged = false

vi.mock('electron', () => ({
  app: {
    get isPackaged() {
      return packaged
    },
    getAppPath: () => root,
    getPath: (name: string) => (name === 'exe' ? join(root, 'game.exe') : root)
  },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (plain: string) => Buffer.from(plain),
    decryptString: (blob: Buffer) => blob.toString()
  }
}))

const characterService = await import('../src/main/services/characterService')
const settingsService = await import('../src/main/services/settingsService')
const paths = await import('../src/main/paths')

const SHIPPED = 'shipped-1'
const OWN = 'own-1'

/** Writes one `character.json` under whichever root the caller names. */
async function seed(dir: string, charId: string, over: Partial<Character> = {}): Promise<void> {
  const folder = join(dir, charId)
  await mkdir(folder, { recursive: true })
  await writeFile(
    join(folder, 'character.json'),
    JSON.stringify(character({ charId, ...over })),
    'utf-8'
  )
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'dd-pregen-'))
  packaged = false
  Object.assign(process, { resourcesPath: root })
  // The listing is memoized for the run, so a fresh root needs a fresh read.
  paths.clearPregenCache()
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

describe('which root a character lives under', () => {
  it('sends a shipped charId to /assets and everything else to /data', async () => {
    await seed(paths.getPregenCharactersPath(), SHIPPED)
    paths.clearPregenCache()

    expect(paths.isPregenChar(SHIPPED)).toBe(true)
    expect(paths.isPregenChar(OWN)).toBe(false)
    expect(paths.getCharacterPath(SHIPPED)).toBe(join(paths.getPregenCharactersPath(), SHIPPED))
    expect(paths.getCharacterPath(OWN)).toBe(join(paths.getCharactersPath(), OWN))
    // Every other helper composes from that one, so the whole folder — and the
    // `charimg://` handler, which resolves through these — follows it.
    expect(paths.getCharacterFilePath(SHIPPED).startsWith(paths.getPregenCharactersPath())).toBe(
      true
    )
    expect(paths.getCharacterExpressionPath(SHIPPED, 'happy')).toBe(
      join(paths.getPregenCharactersPath(), SHIPPED, 'expressions', 'happy.png')
    )
  })

  it('sends a shipped charId to her copy once a packaged build has one', async () => {
    packaged = true
    await seed(paths.getPregenCharactersPath(), SHIPPED)
    await seed(paths.getCharactersPath(), SHIPPED)
    paths.clearPregenCache()

    expect(paths.hasShippedCopy(SHIPPED)).toBe(true)
    expect(paths.getCharacterPath(SHIPPED)).toBe(join(paths.getCharactersPath(), SHIPPED))
    expect(paths.isPregenChar(SHIPPED)).toBe(true)
  })
})

describe('listing', () => {
  it('answers with both roots, and hides nobody', async () => {
    await seed(paths.getPregenCharactersPath(), SHIPPED, { firstName: 'Winter' })
    await seed(paths.getCharactersPath(), OWN, { firstName: 'Ayla' })
    paths.clearPregenCache()
    await settingsService.setRemovedDefaults([SHIPPED])

    const listed = await characterService.listCharacters()
    // The removed one is still here on purpose: a save that holds her has to
    // resolve its roster, so hiding her is the renderer's job.
    expect(listed.map((c) => c.charId).sort()).toEqual([OWN, SHIPPED].sort())
  })
})

describe('what may be done to a shipped character', () => {
  beforeEach(async () => {
    await seed(paths.getPregenCharactersPath(), SHIPPED)
    await seed(paths.getCharactersPath(), OWN)
    paths.clearPregenCache()
  })

  it('writes to the shipped folder itself in an unpackaged run, and offers no reset', async () => {
    await characterService.writeCharacter(character({ charId: SHIPPED, firstName: 'Edited' }))

    expect(paths.listShippedCopies()).toEqual([])
    await expect(readFile(join(paths.getPregenCharactersPath(), SHIPPED, 'character.json'), 'utf-8'))
      .resolves.toContain('Edited')
    await expect(characterService.resetDefault(SHIPPED)).rejects.toMatchObject({
      code: 'CHARACTER_NOT_SHIPPED'
    })
  })

  it('copies a shipped character out on her first edit in a packaged build', async () => {
    packaged = true
    const shippedFolder = join(paths.getPregenCharactersPath(), SHIPPED)
    await mkdir(join(shippedFolder, 'expressions'), { recursive: true })
    await writeFile(join(shippedFolder, 'expressions', 'neutral.png'), 'sprite-bytes')
    const before = await readFile(join(shippedFolder, 'character.json'))

    const written = await characterService.writeCharacter(
      character({ charId: SHIPPED, firstName: 'Edited' })
    )

    // The build's folder is untouched; the copy holds her record and the sprites beside it.
    expect(await readFile(join(shippedFolder, 'character.json'))).toEqual(before)
    const copy = join(paths.getCharactersPath(), SHIPPED)
    expect(await readFile(join(copy, 'expressions', 'neutral.png'), 'utf-8')).toBe('sprite-bytes')
    expect(paths.listShippedCopies()).toEqual([SHIPPED])
    expect((await characterService.getCharacter(SHIPPED)).firstName).toBe('Edited')
    expect((await characterService.getDefaultsStatus()).edited).toEqual([SHIPPED])

    // She is listed once, in her shipped place, carrying the edit.
    const listed = (await characterService.listCharacters()).filter((c) => c.charId === SHIPPED)
    expect(listed).toHaveLength(1)
    expect(listed[0].updatedAt).toBe(written.updatedAt)
  })

  it('goes back to the shipped record when a copy is reset', async () => {
    packaged = true
    await characterService.writeCharacter(character({ charId: SHIPPED, firstName: 'Edited' }))

    const reset = await characterService.resetDefault(SHIPPED)

    expect(reset.firstName).not.toBe('Edited')
    expect(paths.listShippedCopies()).toEqual([])
    await expect(readFile(join(paths.getCharactersPath(), SHIPPED, 'character.json'))).rejects
      .toMatchObject({ code: 'ENOENT' })
    // The next edit copies her afresh.
    await characterService.writeCharacter(character({ charId: SHIPPED, firstName: 'Again' }))
    expect((await characterService.getCharacter(SHIPPED)).firstName).toBe('Again')
  })

  it('keeps an edited copy when she is deleted, recording the removal', async () => {
    packaged = true
    await characterService.writeCharacter(character({ charId: SHIPPED, firstName: 'Edited' }))
    await characterService.deleteCharacter(SHIPPED)

    expect((await characterService.getCharacter(SHIPPED)).firstName).toBe('Edited')
    expect((await settingsService.getSettings()).removedDefaults).toEqual([SHIPPED])
  })

  it('writes to the player’s own in either build', async () => {
    await expect(characterService.writeCharacter(character({ charId: OWN }))).resolves.toMatchObject(
      { charId: OWN }
    )
  })

  it('records a removal instead of deleting the folder', async () => {
    await characterService.deleteCharacter(SHIPPED)

    // Nothing left disk: the folder is content the build came with, and no
    // reinstall is on offer to put it back.
    await expect(characterService.getCharacter(SHIPPED)).resolves.toMatchObject({ charId: SHIPPED })
    expect((await settingsService.getSettings()).removedDefaults).toEqual([SHIPPED])

    // Twice is once: the list says who is off the roster, not how often.
    await characterService.deleteCharacter(SHIPPED)
    expect((await settingsService.getSettings()).removedDefaults).toEqual([SHIPPED])
  })
})
