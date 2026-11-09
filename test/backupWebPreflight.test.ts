import 'fake-indexeddb/auto'
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb'
import { unzipSync, zipSync } from 'fflate'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BACKUP_NAME } from '@shared/backup'
import { emptyLorebook } from '@shared/lorebookRecord'
import { defaultSettings } from '@shared/settingsRules'
import { stampRecord, stampSave } from '@shared/saveRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { character, record } from './fixtures'

const mocks = vi.hoisted(() => ({ pick: vi.fn(), download: vi.fn() }))
vi.mock('../src/web/transfer', async original => ({ ...await original<typeof import('../src/web/transfer')>(), pickFile: mocks.pick }))
vi.mock('../src/web/download', () => ({ offerDownload: mocks.download }))
vi.mock('../src/web/packs', () => ({ isShipped: () => false, shippedCharIds: () => [], buildPack: (files: Record<string, Uint8Array>) => zipSync(files) }))
vi.mock('../src/web/settings', () => ({ rendererSettings: async () => defaultSettings(), currentSettings: async () => defaultSettings(), rowFor: (v: unknown) => v, forgetSettings: () => {} }))
vi.mock('../src/web/backgrounds', () => ({ forgetBackgroundUrls: () => {} }))
vi.mock('../src/web/db/chars', () => ({ forgetRels: () => {} }))
vi.mock('../src/web/images', () => ({ revokeAll: () => {} }))


function wav(sample = 0): Uint8Array {
  const bytes = Buffer.alloc(46)
  bytes.write('RIFF'); bytes.writeUInt32LE(38, 4); bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16); bytes.writeUInt16LE(1, 20); bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(8000, 24); bytes.writeUInt32LE(16000, 28); bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34); bytes.write('data', 36); bytes.writeUInt32LE(2, 40)
  bytes.writeInt16LE(sample, 44)
  return new Uint8Array(bytes)
}

const SOURCE_ID = '1500000000000', CURRENT_ID = '1600000000000'
const sourceBook = { ...emptyLorebook(), setting: 'The archived campus setting.' }
const currentBook = { ...emptyLorebook(), setting: 'The current campus setting.' }
let db: Awaited<ReturnType<typeof import('../src/web/db/open').database>>
let archive: Uint8Array
let music: typeof import('../src/web/soundtracks')
let sourceFile: string
let currentFile: string
let liveSave: ReturnType<typeof stampSave>

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory(); vi.resetModules(); vi.clearAllMocks()
  const { database } = await import('../src/web/db/open')
  const { exportBackup } = await import('../src/web/backup')
  db = await database()
  const sourceSave = stampSave(useGameStore.getState().toGameSave(), SOURCE_ID, SOURCE_ID, 100)
  await db.put('playthroughs', { record: stampRecord(record()), enrollment: null, createdAt: 100 }, SOURCE_ID)
  await db.put('saves', sourceSave, [SOURCE_ID, SOURCE_ID])
  await db.put('characters', character(), 'char-1')
  music = await import('../src/web/soundtracks')
  sourceFile = (await music.soundtrackHash(wav())) + '.wav'
  await music.soundtrackLibrary.restore({ map: { title: { file: sourceFile, name: 'Source.wav', loop: false } }, files: { [sourceFile]: wav() } })
  await db.put('lorebooks', sourceBook, SOURCE_ID)
  await exportBackup()
  archive = mocks.download.mock.calls[0][1] as Uint8Array
  await db.clear('soundtrackFiles')
  currentFile = (await music.soundtrackHash(wav(12))) + '.wav'
  await music.soundtrackLibrary.restore({ map: { title: { file: currentFile, name: 'Current.wav', loop: true } }, files: { [currentFile]: wav(12) } })
  liveSave = stampSave({ ...useGameStore.getState().toGameSave(), money: 500 }, CURRENT_ID, CURRENT_ID, 200)
  await db.put('playthroughs', { record: stampRecord(record()), enrollment: null, createdAt: 200 }, CURRENT_ID)
  await db.put('saves', liveSave, [CURRENT_ID, CURRENT_ID])
  await db.put('lorebooks', currentBook, CURRENT_ID)
  await db.put('lorebooks', currentBook, SOURCE_ID)
  await db.put('settings', { ...defaultSettings(), lessNsfwText: true }, 'settings')
})
afterEach(() => db?.close())

it('leaves the browser transaction unchanged when the characters collection is malformed', async () => {
  const entries = unzipSync(archive)
  const backup = JSON.parse(new TextDecoder().decode(entries[BACKUP_NAME]))
  backup.characters = null
  entries[BACKUP_NAME] = new TextEncoder().encode(JSON.stringify(backup))
  mocks.pick.mockResolvedValue(new File([new Uint8Array(zipSync(entries))], 'invalid.zip'))
  const { importBackup } = await import('../src/web/backup')
  await expect(importBackup()).rejects.toMatchObject({ code: 'BACKUP_MALFORMED' })
  await assertMusicUntouched()
  expect.soft(await db.get('saves', [CURRENT_ID, CURRENT_ID])).toEqual(liveSave)
  expect.soft(await db.getAllKeys('playthroughs')).toContain(CURRENT_ID)
  expect.soft((await db.get('settings', 'settings'))?.lessNsfwText).toBe(true)
})

it('replaces browser saves and restores the source records when the same archive is valid', async () => {
  mocks.pick.mockResolvedValue(new File([new Uint8Array(archive)], 'valid.zip'))
  const { importBackup } = await import('../src/web/backup')
  expect(await importBackup()).toBe(true)
  expect(await music.soundtrackLibrary.read('title')).toEqual(wav())
  expect((await music.soundtrackLibrary.list()).title).toMatchObject({ file: sourceFile, name: 'Source.wav', loop: false })
  expect(await db.getAllKeys('playthroughs')).toEqual([SOURCE_ID])
  expect(await db.get('saves', [CURRENT_ID, CURRENT_ID])).toBeUndefined()
  expect(await db.getAllKeys('lorebooks')).toEqual([SOURCE_ID])
  expect(await db.get('lorebooks', SOURCE_ID)).toEqual(sourceBook)
})

it.each(['characters', 'soundtrackFiles'])('aborts game and music writes if %s throws synchronously', async (failingStore) => {
  mocks.pick.mockResolvedValue(new File([new Uint8Array(archive)], 'valid.zip'))
  const original = IDBObjectStore.prototype.put
  const put = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (this.name === failingStore) throw new Error('injected late write failure')
    return original.call(this, value, key)
  })
  try {
    const { importBackup } = await import('../src/web/backup')
    await expect(importBackup()).rejects.toMatchObject({ code: 'STORAGE_FAILED' })
  } finally { put.mockRestore() }
  await assertMusicUntouched()
  expect(await db.get('saves', [CURRENT_ID, CURRENT_ID])).toEqual(liveSave)
  expect(await db.getAllKeys('playthroughs')).toContain(CURRENT_ID)
  expect((await db.get('settings', 'settings'))?.lessNsfwText).toBe(true)
  expect(await db.get('lorebooks', SOURCE_ID)).toEqual(currentBook)
  expect(await db.get('lorebooks', CURRENT_ID)).toEqual(currentBook)
})

async function assertMusicUntouched(): Promise<void> {
  expect(await music.soundtrackLibrary.read('title')).toEqual(wav(12))
  expect((await music.soundtrackLibrary.list()).title).toMatchObject({ file: currentFile, name: 'Current.wav', loop: true })
  expect(await db.get('soundtrackFiles', sourceFile)).toBeUndefined()
}

it('rejects altered soundtrack bytes before opening a restore transaction', async () => {
  const entries = unzipSync(archive)
  entries['exMusic/' + sourceFile][45] ^= 1
  mocks.pick.mockResolvedValue(new File([new Uint8Array(zipSync(entries))], 'invalid-music.zip'))
  const { importBackup } = await import('../src/web/backup')
  await expect(importBackup()).rejects.toMatchObject({ code: 'SOUNDTRACK_INTEGRITY' })
  expect(await db.get('saves', [CURRENT_ID, CURRENT_ID])).toEqual(liveSave)
  expect((await db.get('settings', 'settings'))?.lessNsfwText).toBe(true)
  await assertMusicUntouched()
})

it('restores a legacy archive without changing existing music', async () => {
  const entries = unzipSync(archive)
  const backup = JSON.parse(new TextDecoder().decode(entries[BACKUP_NAME]))
  delete backup.exMusic
  delete entries['exMusic/' + sourceFile]
  entries[BACKUP_NAME] = new TextEncoder().encode(JSON.stringify(backup))
  mocks.pick.mockResolvedValue(new File([new Uint8Array(zipSync(entries))], 'legacy.zip'))
  const { importBackup } = await import('../src/web/backup')
  expect(await importBackup()).toBe(true)
  expect(await db.getAllKeys('playthroughs')).toEqual([SOURCE_ID])
  await assertMusicUntouched()
})
