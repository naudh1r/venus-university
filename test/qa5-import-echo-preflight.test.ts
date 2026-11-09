import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { unzipSync, zipSync } from 'fflate'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BACKUP_NAME } from '@shared/backup'
import { echoArtEntry } from '@shared/echoArtwork'
import { defaultSettings } from '@shared/settingsRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { record } from './fixtures'

let root = ''
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root },
  safeStorage: { isEncryptionAvailable: () => false }
}))
const { createCharacter } = await import('../src/main/services/characterService')
const { exportBackup, importBackup } = await import('../src/main/services/backupService')
const { createPlaythrough, playthroughIds, forgetParsedSaves } = await import('../src/main/services/saveService')
const { writePortableReflection, readPortableReflection } = await import('../src/main/services/reflectionStorage')
const { getDataPath, getSettingsPath, getSaveFilePath, clearPregenCache } = await import('../src/main/paths')
const { soundtrackLibrary, soundtrackHash } = await import('../src/main/services/soundtrackService')

const ART_ID = 'c53da120-548c-4a76-aeb5-d3e11cd2f95a'
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
const REFLECTION = { version: 1, image: `data:image/png;base64,${PNG.toString('base64')}`, stage: { x: 0, y: 0, scale: 1 } }
const CURRENT_REFLECTION = { ...REFLECTION, stage: { x: 22, y: -8, scale: 1.25 } }
const SOURCE_ID = '1500000000000'
const CURRENT_ID = '1600000000000'
let archive = ''
let reflectionId = ''
let currentSave: Buffer
let currentSettings: Buffer

// A real WAV container avoids relying on an arbitrary non-audio byte string in the music fixture.
function wav(): Uint8Array {
  const bytes = Buffer.alloc(46)
  bytes.write('RIFF'); bytes.writeUInt32LE(38, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(2, 40)
  return bytes
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-qa5-import-'))
  clearPregenCache(); forgetParsedSaves()
  await mkdir(getDataPath(), { recursive: true })
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '', lessNsfwText: false }))
  await createPlaythrough(record(), useGameStore.getState().toGameSave(), SOURCE_ID)
  reflectionId = (await createCharacter('QA', 'Character')).charId
  await writePortableReflection(reflectionId, REFLECTION)
  await mkdir(join(getDataPath(), 'echoes', 'art'), { recursive: true })
  await writeFile(join(getDataPath(), echoArtEntry(ART_ID)), PNG)
  const audio = wav(), file = `${await soundtrackHash(audio)}.wav`
  await soundtrackLibrary.restore({ map: { title: { file, name: 'QA.wav', loop: true } }, files: { [file]: audio } })
  archive = join(root, 'export.zip')
  await exportBackup(archive)
  // The player's live install now has additional progress and a newer portrait placement.
  await createPlaythrough(record(), { ...useGameStore.getState().toGameSave(), exPlotTwist: 'Synthetic current-game story premise' }, CURRENT_ID)
  await writePortableReflection(reflectionId, CURRENT_REFLECTION)
  await writeFile(getSettingsPath(), JSON.stringify({ ...defaultSettings(), apiKey: '', lessNsfwText: true }))
  await rm(join(getDataPath(), echoArtEntry(ART_ID)))
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
  expect.soft(await playthroughIds()).toContain(CURRENT_ID)
  expect.soft(await readFile(getSaveFilePath(CURRENT_ID, CURRENT_ID)).then(bytes => bytes.equals(currentSave)).catch(() => false)).toBe(true)
  expect.soft((await readFile(getSettingsPath())).equals(currentSettings)).toBe(true)
  expect.soft(JSON.parse(await readFile(getSettingsPath(), 'utf8')).lessNsfwText).toBe(true)
  expect.soft(await readPortableReflection(reflectionId)).toEqual(CURRENT_REFLECTION)
  expect.soft(await readFile(join(getDataPath(), echoArtEntry(ART_ID))).catch(() => null)).toBeNull()
}

it('rejects a malformed characters collection before replacing live saves, settings, or new artwork', async () => {
  const invalid = await editedArchive(backup => { backup.characters = null })
  await expect(importBackup(invalid)).rejects.toMatchObject({ code: 'BACKUP_MALFORMED' })
  await assertLiveUntouched()
})

it('rejects invalid reflection placement before writing any mixed backup data', async () => {
  const invalid = await editedArchive(backup => { backup.exReflections[reflectionId].stage.scale = 9 })
  await expect(importBackup(invalid)).rejects.toThrow('Invalid reflection position')
  await assertLiveUntouched()
})

it('rejects a soundtrack integrity mismatch before writing Echoes, reflections, settings or saves', async () => {
  const invalid = await editedArchive((backup, entries) => {
    const key = `mods/custom-soundtracks/${backup.mods['custom-soundtracks'].json.tracks.title.file}`
    entries[key] = new Uint8Array(entries[key]); entries[key][entries[key].length - 1] ^= 1
  })
  await expect(importBackup(invalid)).rejects.toMatchObject({ code: 'BACKUP_PART_FAILED' })
  await assertLiveUntouched()
})

it('restores all supported extension data together from the valid original archive', async () => {
  await importBackup(archive)
  expect(await playthroughIds()).toEqual([SOURCE_ID])
  expect(await readPortableReflection(reflectionId)).toEqual(REFLECTION)
  expect(await readFile(join(getDataPath(), echoArtEntry(ART_ID)))).toEqual(PNG)
  expect(await soundtrackLibrary.read('title')).toEqual(new Uint8Array(wav()))
  expect(JSON.parse(await readFile(getSettingsPath(), 'utf8')).lessNsfwText).toBe(false)
})
