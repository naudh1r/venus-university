import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { strFromU8, unzipSync, zipSync } from 'fflate'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/appId'
import { SOUNDTRACK_MOD } from '@shared/soundtracks'

let root = ''
let webEnabled = true
let downloaded: Uint8Array | string | undefined
const selected = vi.hoisted(() => ({ file: vi.fn() }))
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => root, getPath: () => root } }))
vi.mock('../src/web/mods', () => ({ readModSwitches: () => ({ on: { 'custom-soundtracks': webEnabled }, options: {} }) }))
vi.mock('../src/web/download', () => ({ offerDownload: (name: string, content: Uint8Array | string) => {
  downloaded = content
  return name
} }))
vi.mock('../src/web/transfer', async original => ({
  ...await original<typeof import('../src/web/transfer')>(), pickFile: selected.file
}))
// This storage fixture has no shipped cast; ZIP packing and storage remain real.
vi.mock('../src/web/packs', async original => ({
  ...await original<typeof import('../src/web/packs')>(), isShipped: () => false, shippedCharIds: () => []
}))
const bytes = new Uint8Array([1, 2, 3, 4])
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'venus-soundtracks-'))
  globalThis.indexedDB = new IDBFactory()
  webEnabled = true
  downloaded = undefined
  selected.file.mockReset()
  vi.resetModules()
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

it('round-trips desktop storage and leaves the selected source untouched during cleanup', async () => {
  const { soundtrackLibrary: lib, pickSoundtrack, soundtrackDirectory } = await import('../src/main/services/soundtrackService')
  const source = join(root, 'original.WAV')
  await writeFile(source, bytes)
  const picked = await pickSoundtrack(source, 12)
  const map = await lib.commit('landing_night', picked.token, 5, 12)
  const file = map.landing_night!.file
  expect(new Uint8Array(await readFile(join(soundtrackDirectory(), file)))).toEqual(bytes)
  expect(await lib.read('landing_night')).toEqual(bytes)
  await lib.remove('landing_night')
  expect(await lib.cleanup()).toEqual({ count: 1 })
  expect(new Uint8Array(await readFile(source))).toEqual(bytes)
})

it('loads legacy desktop assignments and refuses to overwrite a corrupt assignment map', async () => {
  const { soundtrackLibrary: lib, soundtrackDirectory, soundtrackHash } = await import('../src/main/services/soundtrackService')
  await mkdir(soundtrackDirectory(), { recursive: true })
  const file = await soundtrackHash(bytes) + '.wav'
  const path = join(soundtrackDirectory(), 'tracks.json')
  await writeFile(join(soundtrackDirectory(), file), bytes)
  await writeFile(path, JSON.stringify({ title: { file, name: 'legacy.wav' } }))
  expect((await lib.list()).title?.loop).toBe(true)
  await writeFile(path, '{bad json')
  await expect(lib.remove('title')).rejects.toThrow()
  expect(await readFile(path, 'utf8')).toBe('{bad json')
})

it.each([5, 6, 7])('upgrades browser storage v%s without changing existing rows', async (version) => {
  const old = await openDB(APP_ID, version, { upgrade(db) {
    db.createObjectStore('log')
    db.createObjectStore('scenes')
    db.createObjectStore('replays')
  } })
  await old.put('scenes', { title: 'A saved scene' }, 'scene')
  await old.put('replays', { title: 'A saved replay' }, ['playthrough', 'replay'])
  await old.put('log', 'existing data', 'log'); old.close()
  const { database } = await import('../src/web/db/open')
  const db = await database()
  expect(db.version).toBe(12)
  expect(await db.get('scenes', 'scene')).toEqual({ title: 'A saved scene' })
  expect(await db.get('replays', ['playthrough', 'replay'])).toEqual({ title: 'A saved replay' })
  expect(await db.get('log', 'log')).toBe('existing data')
  expect(db.objectStoreNames.contains('soundtrackFiles')).toBe(true)
  db.close()
})

it('moves a verified desktop snapshot to browser storage and back without changing hashes', async () => {
  const native = await import('../src/main/services/soundtrackService')
  const web = await import('../src/web/soundtracks')
  const picked = await native.soundtrackLibrary.pick('song.wav', bytes, 7)
  await native.soundtrackLibrary.commit('venue_pop', picked.token, 4, 7)
  const snapshot = await native.soundtrackLibrary.snapshot()
  await web.soundtrackLibrary.restore(snapshot)
  expect(await web.soundtrackLibrary.read('venue_pop')).toEqual(bytes)
  expect(await web.soundtrackLibrary.snapshot()).toEqual(snapshot)
  await web.soundtrackLibrary.loop('venue_pop', false)
  await native.soundtrackLibrary.restore(await web.soundtrackLibrary.snapshot())
  expect((await native.soundtrackLibrary.list()).venue_pop?.loop).toBe(false)
  const { database } = await import('../src/web/db/open'); (await database()).close()
})

it.each([true, false])('exports native music only while enabled (%s), retaining local tracks and restoring while off', async (enabled) => {
  const { soundtrackLibrary: lib } = await import('../src/main/services/soundtrackService')
  const { exportBackup, importBackup } = await import('../src/main/services/backupService')
  const { setModSwitches } = await import('../src/main/services/modsService')
  const pick = await lib.pick('song.wav', bytes, 7)
  const map = await lib.commit('title', pick.token, 8, 7)
  await setModSwitches({ on: { [SOUNDTRACK_MOD]: enabled }, options: {} })
  const archive = join(root, 'backup.zip')
  await exportBackup(archive)
  const entries = unzipSync(await readFile(archive))
  const record = JSON.parse(strFromU8(entries['backup.json']))
  expect(record).not.toHaveProperty('exMusic')
  if (enabled) {
    expect(record.mods[SOUNDTRACK_MOD].json).toEqual({ v: 1, tracks: map })
    expect(entries['mods/' + SOUNDTRACK_MOD + '/' + map.title!.file]).toEqual(bytes)
  } else {
    expect(record.mods[SOUNDTRACK_MOD].json).toEqual({ v: 1, tracks: null })
    expect(record.mods[SOUNDTRACK_MOD].files).toEqual([])
    expect(Object.keys(entries).filter(name => name.startsWith('mods/' + SOUNDTRACK_MOD + '/') && !name.endsWith('/'))).toEqual([])
  }
  expect(await lib.list()).toEqual(map)
  expect(await lib.read('title')).toEqual(bytes)
  if (enabled) { await lib.remove('title'); await lib.cleanup() }
  await setModSwitches({ on: { [SOUNDTRACK_MOD]: false }, options: {} })
  await importBackup(archive)
  expect(await lib.list()).toEqual(map)
  expect(await lib.read('title')).toEqual(bytes)
})

it.each([true, false])('exports browser music only while enabled (%s), without changing its stored files', async (enabled) => {
  const { soundtrackLibrary: lib } = await import('../src/web/soundtracks')
  const { exportBackup } = await import('../src/web/backup')
  const { database } = await import('../src/web/db/open')
  try {
    const pick = await lib.pick('song.wav', bytes, 0)
    const map = await lib.commit('title', pick.token, 8, 0)
    webEnabled = enabled
    await exportBackup()
    expect(downloaded).toBeInstanceOf(Uint8Array)
    const entries = unzipSync(downloaded as Uint8Array)
    const record = JSON.parse(strFromU8(entries['backup.json']))
    if (enabled) {
      expect(record.exMusic).toEqual(map)
      expect(entries['exMusic/' + map.title!.file]).toEqual(bytes)
    } else {
      expect(record).not.toHaveProperty('exMusic')
      expect(Object.keys(entries).filter(name => name.startsWith('exMusic/'))).toEqual([])
    }
    expect(await lib.list()).toEqual(map)
    expect(await lib.read('title')).toEqual(bytes)
  } finally { (await database()).close() }
})

it('moves a full desktop backup into the browser and the browser legacy-format backup back to desktop', async () => {
  const native = await import('../src/main/services/soundtrackService')
  const nativeBackup = await import('../src/main/services/backupService')
  const web = await import('../src/web/soundtracks')
  const webBackup = await import('../src/web/backup')
  const { database } = await import('../src/web/db/open')
  try {
    const picked = await native.soundtrackLibrary.pick('portable.wav', bytes, 7)
    await native.soundtrackLibrary.commit('venue_pop', picked.token, 4, 7)
    await native.soundtrackLibrary.loop('venue_pop', false)
    const expected = await native.soundtrackLibrary.snapshot()
    const archive = join(root, 'desktop.zip')
    await nativeBackup.exportBackup(archive)
    selected.file.mockResolvedValue(new File([new Uint8Array(await readFile(archive))], 'desktop.zip'))
    expect(await webBackup.importBackup()).toBe(true)
    expect(await web.soundtrackLibrary.snapshot()).toEqual(expected)

    await webBackup.exportBackup()
    const legacy = join(root, 'browser.zip')
    await writeFile(legacy, downloaded as Uint8Array)
    expect(JSON.parse(strFromU8(unzipSync(downloaded as Uint8Array)['backup.json'])).exMusic).toEqual(expected.map)
    await native.soundtrackLibrary.remove('venue_pop')
    await native.soundtrackLibrary.cleanup()
    await nativeBackup.importBackup(legacy)
    expect(await native.soundtrackLibrary.snapshot()).toEqual(expected)
  } finally { (await database()).close() }
})

it.each(['missing', 'corrupt', 'future', 'metadata'])('refuses %s native soundtrack data before the browser transaction', async failure => {
  const native = await import('../src/main/services/soundtrackService')
  const nativeBackup = await import('../src/main/services/backupService')
  const web = await import('../src/web/soundtracks')
  const webBackup = await import('../src/web/backup')
  const { database } = await import('../src/web/db/open')
  const db = await database()
  try {
    const picked = await native.soundtrackLibrary.pick('portable.wav', bytes, 7)
    const map = await native.soundtrackLibrary.commit('title', picked.token, 4, 7)
    const archive = join(root, 'desktop.zip')
    await nativeBackup.exportBackup(archive)
    const entries = unzipSync(await readFile(archive))
    const backup = JSON.parse(strFromU8(entries['backup.json']))
    const audioPath = 'mods/' + SOUNDTRACK_MOD + '/' + map.title!.file
    if (failure === 'missing') delete entries[audioPath]
    if (failure === 'corrupt') entries[audioPath][0] ^= 1
    if (failure === 'future') backup.mods[SOUNDTRACK_MOD].json.v = 2
    if (failure === 'metadata') delete backup.mods[SOUNDTRACK_MOD].json
    entries['backup.json'] = new TextEncoder().encode(JSON.stringify(backup))
    selected.file.mockResolvedValue(new File([new Uint8Array(zipSync(entries))], 'invalid.zip'))

    const current = await web.soundtrackLibrary.pick('current.wav', Uint8Array.of(8, 9, 10), 0)
    await web.soundtrackLibrary.commit('title', current.token, 4, 0)
    const before = await web.soundtrackLibrary.snapshot()
    await db.put('grabbags', { inspiration: ['Keep me'] }, 'grabbags')
    await expect(webBackup.importBackup()).rejects.toBeDefined()
    expect(await web.soundtrackLibrary.snapshot()).toEqual(before)
    expect(await db.get('grabbags', 'grabbags')).toEqual({ inspiration: ['Keep me'] })
  } finally { db.close() }
})
