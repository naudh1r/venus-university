import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterTransferPart } from '../src/main/services/modParts'
import { character } from './fixtures'

/**
 * A mod's own share of a character export: carried out in the manifest and its own folder,
 * taken back in only once every part has read it, and undone, all of it, when one part will not
 * take her. The 7-Zip pass here is real.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

const { createCharacter } = await import('../src/main/services/characterService')
const { duplicateCharacter, exportCharacter, importCharacter } = await import(
  '../src/main/services/characterTransferService'
)
const { characterTransferPart, clearModParts } = await import('../src/main/services/modParts')
const { createZip } = await import('../src/main/services/archiveService')
const { MANIFEST_NAME } = await import('../src/shared/characterTransfer')
const { CHARACTER_FILE_NAME } = await import('../src/shared/characterFiles')
const { getCharactersPath, getDataPath } = await import('../src/main/paths')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-university-transfer-part-'))
  clearModParts()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  clearModParts()
  await rm(root, { recursive: true, force: true })
  vi.restoreAllMocks()
})

/** Where the fixture part keeps each character's note: its own folder, by charId. */
function noteDir(): string {
  return join(getDataPath(), 'mod-data', 'note-mod')
}

/** A part that keeps one note per character in its own folder, and a file beside it in the export. */
function notePart(over: Partial<CharacterTransferPart> = {}): { seen: unknown[] } {
  const seen: unknown[] = []
  characterTransferPart('note-mod', {
    export: async (charId, dir) => {
      await writeFile(join(dir, 'note.txt'), `about ${charId}`)
      return { note: await readFile(join(noteDir(), `${charId}.txt`), 'utf8') }
    },
    validate: async (json, _dir, legacy) => {
      seen.push({ json, legacy })
    },
    adopt: async (charId, json, dir) => {
      await mkdir(noteDir(), { recursive: true })
      const file = join(noteDir(), `${charId}.txt`)
      const beside = await readFile(join(dir, 'note.txt'), 'utf8').catch(() => '')
      await writeFile(file, `${(json as { note?: string } | undefined)?.note ?? 'none'}|${beside}`)
      return () => rm(file, { force: true })
    },
    duplicate: async (fromId, toId) => {
      const file = join(noteDir(), `${toId}.txt`)
      await writeFile(file, await readFile(join(noteDir(), `${fromId}.txt`), 'utf8'))
      return () => rm(file, { force: true })
    },
    ...over
  })
  return { seen }
}

/** A character on disk with the fixture part's note on her. */
async function noted(): Promise<string> {
  const { charId } = await createCharacter('Mina', 'Aoki')
  await mkdir(noteDir(), { recursive: true })
  await writeFile(join(noteDir(), `${charId}.txt`), 'likes rain')
  return charId
}

describe('a character transfer part', () => {
  it("carries the mod's json and file out and back in", async () => {
    notePart()
    const charId = await noted()
    const archive = join(root, 'export.zip')
    await exportCharacter(charId, archive)

    const imported = await importCharacter(archive)
    expect(await readFile(join(noteDir(), `${imported.charId}.txt`), 'utf8')).toBe(`likes rain|about ${charId}`)
    // The mod's files are its own, never part of her folder.
    expect(await readdir(join(getCharactersPath(), imported.charId))).not.toContain('mods')
  })

  it('takes her back out, the earlier parts first undone, when a later part will not take her', async () => {
    notePart()
    characterTransferPart('stubborn-mod', {
      export: async () => undefined,
      validate: async () => {},
      adopt: async () => {
        throw new Error('no room')
      },
      duplicate: async () => async () => {}
    })
    const charId = await noted()
    const archive = join(root, 'export.zip')
    await exportCharacter(charId, archive)

    await expect(importCharacter(archive)).rejects.toMatchObject({ code: 'IMPORT_FAILED' })
    expect(await readdir(getCharactersPath())).toEqual([charId])
    expect(await readdir(noteDir())).toEqual([`${charId}.txt`])
  })

  it("carries the mod's data to a duplicate", async () => {
    notePart()
    const charId = await noted()
    const copy = await duplicateCharacter(charId)
    expect(await readFile(join(noteDir(), `${copy.charId}.txt`), 'utf8')).toBe('likes rain')
  })

  it("hands a part the manifest's keys the game does not read, and no json where it carries none", async () => {
    const { seen } = notePart()
    const dir = join(root, 'handmade')
    await mkdir(dir, { recursive: true })
    const { charId: _identity, ...portable } = character({ firstName: 'Mina', lastName: 'Aoki' })
    await writeFile(join(dir, CHARACTER_FILE_NAME), JSON.stringify(portable))
    await writeFile(
      join(dir, MANIFEST_NAME),
      JSON.stringify({
        format: 'venus-university-character',
        schemaVersion: 2,
        exportedAt: '2015-01-19T00:00:00.000Z',
        firstName: 'Mina',
        lastName: 'Aoki',
        exTape: { mood: 'wistful' }
      })
    )
    const archive = join(root, 'legacy.zip')
    await createZip(dir, archive)

    const imported = await importCharacter(archive)
    expect(seen).toEqual([{ json: undefined, legacy: { exTape: { mood: 'wistful' } } }])
    expect(await readFile(join(noteDir(), `${imported.charId}.txt`), 'utf8')).toBe('none|')
  })
})
