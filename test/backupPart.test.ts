import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods } from '@shared/mods'
import type { SaveDraft } from '@shared/types'
import type { BackupPart } from '@vx/modkit/main'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { record } from './fixtures'

/**
 * A mod's own share of a backup: written beside the game's, read back before anything of the
 * player's is written and made only once the game's share is, kept as it came where the mod is
 * not installed, and handed whatever the backup carries that the game itself does not read.
 * The 7-Zip pass here is real.
 */
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))

const { exportBackup, importBackup } = await import('../src/main/services/backupService')
const { backupPart, requiredBackupPart } = await import('@vx/modkit/main')
const { clearModParts } = await import('../src/main/services/modParts')
const { modDataPath } = await import('../src/main/services/modDataService')
const { createPlaythrough, listPlaythroughs } = await import('../src/main/services/saveService')
const { createZip, extractZip } = await import('../src/main/services/archiveService')
const { BACKUP_NAME } = await import('../src/shared/backup')
const { defaultSettings } = await import('../src/shared/settingsRules')
const { clearPregenCache, getDataPath, getModDataPath, getSavesPath, getSettingsPath, getSaveFilePath } = await import(
  '../src/main/paths'
)

/** Bytes no picture opens with, so nothing on the way may read them as one. */
const TAPE = Buffer.from('not a picture: a mixtape')

beforeAll(() =>
  installMods([{ id: 'tape-mod', name: 'Mixtapes', author: 'test', version: '1.4.0', scope: 'anytime', defaultOn: true, blurb: '' }])
)

/** Every temp folder a case made, removed after it. */
const made: string[] = []

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix))
  made.push(dir)
  return dir
}

/** A fresh, empty data folder, with only the settings a restore reads. */
async function freshRoot(): Promise<void> {
  root = await tempDir('venus-university-backup-part-')
  clearPregenCache()
  await mkdir(getDataPath(), { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '' }), 'utf-8')
}

beforeEach(async () => {
  clearModParts()
  await freshRoot()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  clearModParts()
  vi.restoreAllMocks()
  for (const dir of made.splice(0)) await rm(dir, { recursive: true, force: true })
})

function draft(): SaveDraft {
  return useGameStore.getState().toGameSave()
}

/** What the fixture part was handed and did. */
interface Seen {
  json?: unknown
  list?: readonly string[]
  bytes?: Buffer
  legacy?: { record: Readonly<Record<string, unknown>>; dirs: readonly string[]; archive: string }
  legacyFile?: string
  committed: boolean
  discarded: boolean
}

/** A part that carries one tape file and a json, and restores the file into its own folder. */
function tapePart(seen: Seen, fail: { prepare?: boolean; commit?: boolean } = {}): void {
  backupPart('tape-mod', {
    export: async ({ scratch }) => {
      await mkdir(join(scratch, 'songs'), { recursive: true })
      await writeFile(join(scratch, 'songs', 'side-a.bin'), TAPE)
      return { json: { side: 'a', plays: 3 }, files: ['songs/side-a.bin'] }
    },
    prepare: async (json, files, legacy) => {
      seen.json = json
      seen.list = files.list
      seen.legacy = legacy
      const music = legacy.dirs.find((dir) => dir.endsWith('exTape'))
      if (music) seen.legacyFile = await readFile(join(music, 'song.txt'), 'utf8')
      if (fail.prepare) throw new Error('the tape is chewed')
      const bytes = await readFile(join(files.dir, 'songs', 'side-a.bin'))
      return {
        commit: async () => {
          if (fail.commit) throw new Error('the deck is jammed')
          await writeFile(join(modDataPath('tape-mod'), 'side-a.bin'), bytes)
          seen.bytes = bytes
          seen.committed = true
        },
        discard: async () => {
          seen.discarded = true
        }
      }
    }
  })
}

/** One playthrough and its saves, backed up with the tape part registered. */
async function backedUp(): Promise<{ archive: string; playthroughId: string }> {
  const seen: Seen = { committed: false, discarded: false }
  tapePart(seen)
  const opening = await createPlaythrough(record(), draft())
  const archive = join(await tempDir('venus-university-backup-zip-'), 'out.zip')
  await exportBackup(archive)
  clearModParts()
  return { archive, playthroughId: opening.save.playthroughId }
}

describe('a backup part', () => {
  describe('export failure policy', () => {
    it.each([
      ['omit', 'missing source'], ['omit', 'unwritten file'], ['omit', 'invalid JSON'],
      ['abort', 'missing source'], ['abort', 'unwritten file'], ['abort', 'invalid JSON']
    ] as const)('%s policy handles %s without leaving a partial mod backup', async (exportFailure, failure) => {
      const { archive } = await backedUp()
      const previous = await readFile(archive)
      const settingsBefore = await readFile(getSettingsPath())
      let partScratch = ''
      const register = exportFailure === 'abort' ? requiredBackupPart : backupPart
      register('tape-mod', {
        export: async ({ scratch }) => {
          partScratch = scratch
          await writeFile(join(scratch, 'partial.bin'), TAPE)
          if (failure === 'missing source') await readFile(join(root, 'missing-source.bin'))
          if (failure === 'unwritten file') return { files: ['missing.bin'] }
          const circular: Record<string, unknown> = {}
          circular.self = circular
          return { json: circular }
        },
        prepare: async () => ({ commit: async () => {}, discard: async () => {} })
      })
      const laterExport = vi.fn(async () => ({ json: { intact: true } }))
      backupPart('later-mod', {
        export: laterExport,
        prepare: async () => ({ commit: async () => {}, discard: async () => {} })
      })

      if (exportFailure === 'abort') {
        await expect(exportBackup(archive)).rejects.toMatchObject({
          code: 'BACKUP_PART_FAILED',
          message: expect.stringContaining('Mixtapes')
        })
        expect(await readFile(archive)).toEqual(previous)
        expect(laterExport).not.toHaveBeenCalled()
      } else {
        await exportBackup(archive)
        expect(laterExport).toHaveBeenCalledOnce()
        const unpacked = await tempDir('venus-university-omitted-part-')
        await extractZip(archive, unpacked)
        const backup = JSON.parse(await readFile(join(unpacked, BACKUP_NAME), 'utf8'))
        expect(backup.mods['tape-mod']).toBeUndefined()
        expect(backup.mods['later-mod'].json).toEqual({ intact: true })
        expect(backup.saves).toHaveLength(1)
        expect(await readdir(join(unpacked, 'mods'))).not.toContain('tape-mod')
        expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('tape-mod'), expect.any(String))
      }
      expect(await readFile(getSettingsPath())).toEqual(settingsBefore)
      await expect(readdir(partScratch)).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('does not create a new target when an aborting part fails', async () => {
      const target = join(await tempDir('venus-university-aborted-backup-'), 'new.zip')
      requiredBackupPart('tape-mod', {
        export: async () => { throw new Error('Missing required media') },
        prepare: async () => ({ commit: async () => {}, discard: async () => {} })
      })
      await expect(exportBackup(target)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
      await expect(readFile(target)).rejects.toMatchObject({ code: 'ENOENT' })
    })

    it('exports and restores a successful part that opts into aborting failures', async () => {
      const { archive } = await backedUp()
      await freshRoot()
      const prepare = vi.fn<BackupPart['prepare']>(async json => {
        expect(json).toEqual({ intact: true })
        return { commit: async () => {}, discard: async () => {} }
      })
      requiredBackupPart('tape-mod', {
        export: async () => ({ json: { intact: true } }),
        prepare
      })
      await exportBackup(archive)
      await importBackup(archive)
      expect(prepare).toHaveBeenCalledOnce()
    })

    it.each([false, true])('shares the one-part-per-mod rule across both registrations (required first: %s)', requiredFirst => {
      const part: BackupPart = {
        export: async () => ({}),
        prepare: async () => ({ commit: async () => {}, discard: async () => {} })
      }
      const first = requiredFirst ? requiredBackupPart : backupPart
      const second = requiredFirst ? backupPart : requiredBackupPart
      first('tape-mod', part)
      expect(() => second('tape-mod', part)).toThrow('registered a second backup part')
    })
  })

  it('carries its file and json out and back in, through prepare and commit', async () => {
    const { archive, playthroughId } = await backedUp()
    await freshRoot()
    const seen: Seen = { committed: false, discarded: false }
    tapePart(seen)

    await importBackup(archive)
    expect(seen.json).toEqual({ side: 'a', plays: 3 })
    expect(seen.list).toEqual(['songs/side-a.bin'])
    expect(seen.committed).toBe(true)
    expect(await readFile(join(getModDataPath('tape-mod'), 'side-a.bin'))).toEqual(TAPE)
    expect((await listPlaythroughs()).map((entry) => entry.playthroughId)).toContain(playthroughId)
  })

  it('stops the restore with nothing written when prepare throws, naming the mod', async () => {
    const { archive } = await backedUp()
    await freshRoot()
    const live = await createPlaythrough(record(), draft())
    const before = await readdir(join(getSavesPath(), live.save.playthroughId))
    const seen: Seen = { committed: false, discarded: false }
    tapePart(seen, { prepare: true })

    await expect(importBackup(archive)).rejects.toMatchObject({
      code: 'BACKUP_PART_FAILED',
      message: expect.stringContaining('Mixtapes')
    })
    expect(await readdir(getSavesPath())).toEqual([live.save.playthroughId])
    expect(await readdir(join(getSavesPath(), live.save.playthroughId))).toEqual(before)
  })

  it('leaves the saves restored and names the mod when commit throws', async () => {
    const { archive, playthroughId } = await backedUp()
    await freshRoot()
    const seen: Seen = { committed: false, discarded: false }
    tapePart(seen, { commit: true })

    await expect(importBackup(archive)).rejects.toMatchObject({
      code: 'BACKUP_PART_FAILED',
      message: "The backup is back, but Mixtapes's data was not restored."
    })
    expect((await listPlaythroughs()).map((entry) => entry.playthroughId)).toEqual([playthroughId])
  })

  it("keeps the share of a mod with no part here as it came, under its own mod-data folder", async () => {
    const { archive } = await backedUp()
    await freshRoot()

    await importBackup(archive)
    const kept = join(getModDataPath('tape-mod'), '.backup')
    const [at] = await readdir(kept)
    expect(await readFile(join(kept, at, 'songs', 'side-a.bin'))).toEqual(TAPE)
    expect(JSON.parse(await readFile(join(kept, at, BACKUP_NAME), 'utf8'))).toEqual({
      version: '1.4.0',
      json: { side: 'a', plays: 3 },
      files: ['songs/side-a.bin']
    })
  })

  it("hands a part the record's keys and the zip's folders the game does not read", async () => {
    const { archive } = await backedUp()
    // An older build's own field and folder, as a mod once wrote them.
    const unpacked = await tempDir('venus-university-backup-legacy-')
    await extractZip(archive, unpacked)
    const backup = JSON.parse(await readFile(join(unpacked, BACKUP_NAME), 'utf8')) as Record<string, unknown>
    await writeFile(join(unpacked, BACKUP_NAME), JSON.stringify({ ...backup, exTape: { volume: 7 } }))
    await mkdir(join(unpacked, 'exTape'), { recursive: true })
    await writeFile(join(unpacked, 'exTape', 'song.txt'), 'la la')
    const legacyArchive = join(await tempDir('venus-university-backup-legacy-zip-'), 'legacy.zip')
    await createZip(unpacked, legacyArchive)

    await freshRoot()
    const seen: Seen = { committed: false, discarded: false }
    tapePart(seen)
    await importBackup(legacyArchive)
    expect(seen.legacy?.record).toEqual({ exTape: { volume: 7 } })
    expect(seen.legacy?.dirs).toHaveLength(1)
    expect(seen.legacy?.archive).toBe(legacyArchive)
    expect(seen.legacyFile).toBe('la la')
  })

  it('offers a legacy-only backup to an installed part even when there is no mods entry', async () => {
    // This is the shape of an existing VE backup, before backupPart existed.
    await createPlaythrough(record(), draft())
    const archive = join(await tempDir('venus-university-legacy-only-zip-'), 'out.zip')
    await exportBackup(archive)
    const unpacked = await tempDir('venus-university-legacy-only-')
    await extractZip(archive, unpacked)
    const backup = JSON.parse(await readFile(join(unpacked, BACKUP_NAME), 'utf8'))
    expect(backup.mods).toBeUndefined()
    await writeFile(join(unpacked, BACKUP_NAME), JSON.stringify({ ...backup, exTape: { volume: 7 } }))
    await mkdir(join(unpacked, 'exTape'), { recursive: true })
    await writeFile(join(unpacked, 'exTape', 'song.txt'), 'legacy song')
    const legacyArchive = join(await tempDir('venus-university-legacy-only-final-'), 'legacy.zip')
    await createZip(unpacked, legacyArchive)

    await freshRoot()
    const prepare = vi.fn<BackupPart['prepare']>(async (json, files, legacy) => {
      expect(json).toBeUndefined()
      expect(files.list).toEqual([])
      expect(await readdir(files.dir)).toEqual([])
      expect(legacy.record.exTape).toEqual({ volume: 7 })
      const folder = legacy.dirs.find((dir) => dir.endsWith('exTape'))
      if (!folder) throw new Error('Legacy music folder not provided')
      const bytes = await readFile(join(folder, 'song.txt'))
      return {
        commit: async () => { await writeFile(join(modDataPath('tape-mod'), 'legacy-song.txt'), bytes) },
        discard: async () => {}
      }
    })
    backupPart('tape-mod', { export: async () => ({}), prepare })
    await importBackup(legacyArchive)
    expect(prepare).toHaveBeenCalledOnce()
    expect(await readFile(join(getModDataPath('tape-mod'), 'legacy-song.txt'), 'utf8')).toBe('legacy song')
  })

  it.each([false, true])('prepares a newly installed part before restoring a backup with no mod data (fail: %s)', async fail => {
    const original = await createPlaythrough(record(), draft())
    const archive = join(await tempDir('venus-university-no-mod-data-'), 'out.zip')
    await exportBackup(archive)
    await freshRoot()
    const current = await createPlaythrough(record(), draft())
    const currentFile = getSaveFilePath(current.save.playthroughId, current.save.saveId)
    const before = await readFile(currentFile, 'utf8')
    const commit = vi.fn(async () => {})
    const prepare = vi.fn<BackupPart['prepare']>(async (json, files, legacy) => {
      expect(json).toBeUndefined()
      expect(await readdir(files.dir)).toEqual([])
      expect(files.list).toEqual([])
      expect(legacy).toEqual({ record: {}, dirs: [], archive })
      if (fail) throw new Error('Synthetic legacy parser failure')
      return { commit, discard: async () => {} }
    })
    backupPart('tape-mod', { export: async () => ({}), prepare })
    if (fail) {
      await expect(importBackup(archive)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
      expect(await readFile(currentFile, 'utf8')).toBe(before)
      expect((await listPlaythroughs()).map(entry => entry.playthroughId)).toEqual([current.save.playthroughId])
      expect(commit).not.toHaveBeenCalled()
    } else {
      await importBackup(archive)
      expect((await listPlaythroughs()).map(entry => entry.playthroughId)).toEqual([original.save.playthroughId])
      expect(commit).toHaveBeenCalledOnce()
    }
    expect(prepare).toHaveBeenCalledOnce()
  })
})
