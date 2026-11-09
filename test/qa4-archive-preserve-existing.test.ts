import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { unzipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKUP_NAME, type BackupFile } from '@shared/backup'
import { defaultSettings } from '@shared/settingsRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { record } from './fixtures'

// Production paths and archive operations use only disposable synthetic roots.
let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))

const { exportBackup, importBackup } = await import('../src/main/services/backupService')
const { exportCharacter, importCharacter } = await import('../src/main/services/characterTransferService')
const { createCharacter } = await import('../src/main/services/characterService')
const { createPlaythrough, loadSave } = await import('../src/main/services/saveService')
const { getGrabBags, setGrabBags } = await import('../src/main/services/grabBagService')
const { getDataPath, getSettingsPath, clearPregenCache } = await import('../src/main/paths')
const { soundtrackLibrary, soundtrackDirectory } = await import('../src/main/services/soundtrackService')
const { writePortableReflection } = await import('../src/main/services/reflectionStorage')
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-qa4-archive-'))
  clearPregenCache()
  await mkdir(getDataPath(), { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '' }))
  await setGrabBags({ inspiration: ['original'] })
})

afterEach(async () => {
  soundtrackLibrary.cancelPick()
  await rm(root, { recursive: true, force: true })
  clearPregenCache()
})

async function assignedTrack(): Promise<string> {
  // The storage service takes decoded-duration approval from its caller; audio is never played.
  const picked = await soundtrackLibrary.pick('fixture.mp3', Uint8Array.of(73, 68, 51), 1)
  const map = await soundtrackLibrary.commit('title', picked.token, 60, 1)
  return join(soundtrackDirectory(), map.title!.file)
}

function backupRecord(bytes: Uint8Array): BackupFile {
  return JSON.parse(new TextDecoder().decode(unzipSync(bytes)[BACKUP_NAME])) as BackupFile
}

describe('archive replacement preserves the existing file on source failures', () => {
  it('keeps an existing whole-game backup when a soundtrack source cannot be read', async () => {
    const opening = await createPlaythrough(record(), useGameStore.getState().toGameSave())
    const music = await assignedTrack()
    const target = join(root, 'backup.zip')
    await exportBackup(target)
    const previous = await readFile(target)
    expect(backupRecord(previous).mods?.['custom-soundtracks']?.json).toMatchObject({ v: 1, tracks: { title: expect.any(Object) } })
    expect(backupRecord(previous).saves).toHaveLength(1)
    // Model a file lost or made unavailable since the earlier successful backup.
    await rm(music)
    await expect(exportBackup(target)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
    const after = await readFile(target).catch(() => null)
    expect((await loadSave(opening.save.playthroughId, opening.save.saveId)).playthroughId).toBe(opening.save.playthroughId)
    expect(after?.equals(previous) ?? false, 'preflight failed before ZIP creation; the older valid backup must remain').toBe(true)
  })

  it('keeps an existing character ZIP when the added portable reflection source is invalid', async () => {
    const girl = await createCharacter('Mina', 'Aoki')
    await writePortableReflection(girl.charId, {
      version: 1,
      image: `data:image/png;base64,${png.toString('base64')}`,
      stage: { x: -12, y: 8, scale: 1.2 }
    })
    const target = join(root, 'character.zip')
    await exportCharacter(girl.charId, target)
    const previous = await readFile(target)
    expect(unzipSync(previous)['manifest.json']).toBeDefined()
    // Synthetic corruption of a source only, never of the valid destination archive.
    await writeFile(join(getDataPath(), 'echoes', 'reflections', `${girl.charId}.portable.json`), '{')
    await expect(exportCharacter(girl.charId, target)).rejects.toThrow()
    const after = await readFile(target).catch(() => null)
    expect(after?.equals(previous) ?? false, 'the existing character ZIP has not been opened for writing').toBe(true)
  })

  it('a failed export to another path leaves the earlier backup intact and restorable', async () => {
    const music = await assignedTrack()
    const target = join(root, 'backup.zip')
    await exportBackup(target)
    const previous = await readFile(target)
    await rm(music)
    await expect(exportBackup(join(root, 'other.zip'))).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
    expect(await readFile(target)).toEqual(previous)
    await setGrabBags({ inspiration: ['new'] })
    await importBackup(target)
    expect(await getGrabBags()).toEqual({ inspiration: ['original'] })
    expect(await readFile(music)).toEqual(Buffer.from([73, 68, 51]))
  })

  it('successful overwrites replace both archive types with usable new content', async () => {
    const target = join(root, 'backup.zip')
    await exportBackup(target)
    await setGrabBags({ inspiration: ['new'] })
    await exportBackup(target)
    expect(backupRecord(await readFile(target)).grabbags).toEqual({ inspiration: ['new'] })
    await importBackup(target)
    expect(await getGrabBags()).toEqual({ inspiration: ['new'] })
    const girl = await createCharacter('Mina', 'Aoki')
    const characterTarget = join(root, 'character.zip')
    await exportCharacter(girl.charId, characterTarget)
    await exportCharacter(girl.charId, characterTarget)
    expect((await importCharacter(characterTarget)).firstName).toBe('Mina')
  })
})
