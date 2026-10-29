import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { unzipSync, zipSync } from 'fflate'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BACKUP_NAME } from '@shared/backup'
import { defaultSettings } from '@shared/settingsRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { record } from './fixtures'

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))
const { exportBackup, importBackup } = await import('../src/main/services/backupService')
const { createPlaythrough, playthroughIds, forgetParsedSaves } = await import('../src/main/services/saveService')
const { getDataPath, getSettingsPath, getSaveFilePath, clearPregenCache } = await import('../src/main/paths')

const { soundtrackLibrary, soundtrackHash } = await import('../src/main/services/soundtrackService')

function wav(sample = 0): Uint8Array {
  const bytes = Buffer.alloc(46)
  bytes.write('RIFF'); bytes.writeUInt32LE(38, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(2, 40)
  bytes.writeInt16LE(sample, 44)
  return new Uint8Array(bytes)
}

const SOURCE_ID = '1500000000000'
const CURRENT_ID = '1600000000000'
let archive = ''
let currentSave: Buffer
let currentSettings: Buffer

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-qa5-import-'))
  clearPregenCache(); forgetParsedSaves()
  await mkdir(getDataPath(), { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '', lessNsfwText: false }))
  await createPlaythrough(record(), useGameStore.getState().toGameSave(), SOURCE_ID)
  const audio = wav(), file = (await soundtrackHash(audio)) + '.wav'
  await soundtrackLibrary.restore({ map: { title: { file, name: 'Source.wav', loop: false } }, files: { [file]: audio } })
  archive = join(root, 'export.zip')
  await exportBackup(archive)
  const currentAudio = wav(12), currentFile = (await soundtrackHash(currentAudio)) + '.wav'
  await soundtrackLibrary.restore({ map: { title: { file: currentFile, name: 'Current.wav', loop: true } }, files: { [currentFile]: currentAudio } })
  // The player's live install now has additional progress and changed settings.
  await createPlaythrough(record(), { ...useGameStore.getState().toGameSave(), money: 500 }, CURRENT_ID)
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '', lessNsfwText: true }))
  currentSave = await readFile(getSaveFilePath(CURRENT_ID, CURRENT_ID))
  currentSettings = await readFile(getSettingsPath())
})
afterEach(async () => { await rm(root, { recursive: true, force: true }); clearPregenCache(); forgetParsedSaves() })

async function editedArchive(edit: (backup: Record<string, any>, entries: Record<string, Uint8Array>) => void): Promise<string> {
  const entries = unzipSync(new Uint8Array(await readFile(archive)))
  const backup = JSON.parse(new TextDecoder().decode(entries[BACKUP_NAME])) as Record<string, any>
  edit(backup, entries)
  entries[BACKUP_NAME] = new TextEncoder().encode(JSON.stringify(backup))
  const path = join(root, 'incoming.zip')
  await writeFile(path, zipSync(entries))
  return path
}

async function assertLiveUntouched(): Promise<void> {
  expect.soft(await soundtrackLibrary.read('title')).toEqual(wav(12))
  expect.soft((await soundtrackLibrary.list()).title?.name).toBe('Current.wav')
  expect.soft(await playthroughIds()).toContain(CURRENT_ID)
  expect.soft(await readFile(getSaveFilePath(CURRENT_ID, CURRENT_ID)).then(bytes => bytes.equals(currentSave)).catch(() => false)).toBe(true)
  expect.soft((await readFile(getSettingsPath())).equals(currentSettings)).toBe(true)
  expect.soft(JSON.parse(await readFile(getSettingsPath(), 'utf8')).lessNsfwText).toBe(true)
}

it('rejects a malformed characters collection before replacing live saves or settings', async () => {
  const invalid = await editedArchive(backup => { backup.characters = null })
  await expect(importBackup(invalid)).rejects.toMatchObject({ code: 'BACKUP_MALFORMED' })
  await assertLiveUntouched()
})

it('restores saves and custom soundtrack bytes and assignments together', async () => {
  await importBackup(archive)
  expect(await soundtrackLibrary.read('title')).toEqual(wav())
  expect((await soundtrackLibrary.list()).title).toMatchObject({ name: 'Source.wav', loop: false })
  expect(await playthroughIds()).toEqual([SOURCE_ID])
  expect(JSON.parse(await readFile(getSettingsPath(), 'utf8')).lessNsfwText).toBe(false)
})

it('preserves the previous whole-game export when reading settings fails before ZIP creation', async () => {
  const previous = await readFile(archive)
  await writeFile(getSettingsPath(), 'invalid JSON')
  await expect(exportBackup(archive)).rejects.toBeDefined()
  expect(await readFile(archive)).toEqual(previous)
})

it('preserves a previous character export if the character cannot be read', async () => {
  const { createCharacter } = await import('../src/main/services/characterService')
  const { exportCharacter } = await import('../src/main/services/characterTransferService')
  const girl = await createCharacter('Test', 'Character')
  const file = join(root, 'character.zip')
  await exportCharacter(girl.charId, file)
  const previous = await readFile(file)
  await expect(exportCharacter('missing-character', file)).rejects.toBeDefined()
  expect(await readFile(file)).toEqual(previous)
  await exportCharacter(girl.charId, file)
  expect(unzipSync(new Uint8Array(await readFile(file)))).toBeDefined()
})

it.each([false, true])('rejects altered or missing soundtrack bytes before replacing live data (missing: %s)', async missing => {
  const invalid = await editedArchive((backup, entries) => {
    const key = 'mods/custom-soundtracks/' + backup.mods['custom-soundtracks'].json.tracks.title.file
    if (missing) delete entries[key]
    else entries[key][entries[key].length - 1] ^= 1
  })
  await expect(importBackup(invalid)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
  await assertLiveUntouched()
})

it('keeps current music when importing an older backup without music', async () => {
  const legacy = await editedArchive((backup, entries) => {
    delete entries['mods/custom-soundtracks/' + backup.mods['custom-soundtracks'].json.tracks.title.file]
    delete backup.mods['custom-soundtracks']
  })
  await importBackup(legacy)
  expect(await playthroughIds()).toEqual([SOURCE_ID])
  expect(await soundtrackLibrary.read('title')).toEqual(wav(12))
  expect((await soundtrackLibrary.list()).title?.name).toBe('Current.wav')
})

it.each([false, true])('reads a legacy-only exMusic backup before any live write (corrupt: %s)', async corrupt => {
  const legacy = await editedArchive((backup, entries) => {
    const part = backup.mods['custom-soundtracks']
    backup.exMusic = part.json.tracks
    for (const file of part.files) {
      entries['exMusic/' + file] = entries['mods/custom-soundtracks/' + file]
      delete entries['mods/custom-soundtracks/' + file]
    }
    delete backup.mods['custom-soundtracks']
    if (corrupt) entries['exMusic/' + backup.exMusic.title.file][45] ^= 1
  })
  if (corrupt) {
    await expect(importBackup(legacy)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
    await assertLiveUntouched()
  } else {
    await importBackup(legacy)
    expect(await soundtrackLibrary.read('title')).toEqual(wav())
    expect(await playthroughIds()).toEqual([SOURCE_ID])
  }
})

it.each([undefined, null, { v: 2, tracks: {} }, { v: 1 }, { v: 1, tracks: [] }])(
  'rejects malformed or future Soundtracks metadata before writes: %j', async json => {
    const invalid = await editedArchive(backup => { backup.mods['custom-soundtracks'].json = json })
    await expect(importBackup(invalid)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
    await assertLiveUntouched()
  }
)

it.each([null, {}])('gives the new metadata precedence over stale legacy fields (tracks: %j)', async tracks => {
  const mixed = await editedArchive(backup => {
    backup.exMusic = { thisIsNotASlot: { file: '../invalid' } }
    backup.mods['custom-soundtracks'].json = { v: 1, tracks }
  })
  await importBackup(mixed)
  expect(await playthroughIds()).toEqual([SOURCE_ID])
  if (tracks === null) expect(await soundtrackLibrary.read('title')).toEqual(wav(12))
  else expect(await soundtrackLibrary.list()).toEqual({})
})
