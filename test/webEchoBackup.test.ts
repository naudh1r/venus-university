import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { unzipSync, zipSync } from 'fflate'
import { beforeEach, expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/appId'
import { BACKUP_NAME } from '@shared/backup'
import { echoArtEntry } from '@shared/echoArtwork'
import { defaultSettings } from '@shared/settingsRules'
const mocks = vi.hoisted(() => ({ pick: vi.fn(), download: vi.fn() }))
vi.mock('../src/web/transfer', async original => ({ ...await original<typeof import('../src/web/transfer')>(), pickFile: mocks.pick }))
vi.mock('../src/web/download', () => ({ offerDownload: mocks.download }))
vi.mock('../src/web/packs', () => ({ isShipped: () => false, shippedCharIds: () => [], buildPack: (files: Record<string, Uint8Array>) => zipSync(files) }))
vi.mock('../src/web/settings', () => ({ rendererSettings: async () => defaultSettings(), currentSettings: async () => defaultSettings(), rowFor: (v: unknown) => v, forgetSettings: () => {} }))
vi.mock('../src/web/backgrounds', () => ({ forgetBackgroundUrls: () => {} }))
vi.mock('../src/web/db/chars', () => ({ forgetRels: () => {} }))
vi.mock('../src/web/images', () => ({ revokeAll: () => {} }))
vi.mock('../src/web/soundtracks', () => ({ soundtrackHash: vi.fn(), soundtrackLibrary: { snapshotForBackup: async () => null, exclusive: (fn: () => unknown) => fn() } }))
const id = 'fdc99b1a-bd3b-41ca-897f-757b3bf983c3'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
beforeEach(() => { globalThis.indexedDB = new IDBFactory(); vi.resetModules(); vi.clearAllMocks() })

it('upgrades version 8 without losing settings or existing records', async () => {
  const old = await openDB(APP_ID, 8, { upgrade(db) { db.createObjectStore('settings'); db.createObjectStore('playthroughs') } })
  await old.put('settings', { marker: 'keep' }, 'settings'); await old.put('playthroughs', { name: 'Keep this run' }, '123'); old.close()
  const { database } = await import('../src/web/db/open')
  const db = await database()
  expect(db.version).toBe(14)
  expect(await db.get('settings', 'settings')).toEqual({ marker: 'keep' })
  expect(await db.get('playthroughs', '123')).toEqual({ name: 'Keep this run' })
  expect(await db.count('echoArt')).toBe(0); db.close()
})

it('round trips global Echo images and rejects conflicting IDs before any restore writes', async () => {
  const { database } = await import('../src/web/db/open')
  const { exportBackup, importBackup } = await import('../src/web/backup')
  const db = await database()
  await db.add('echoArt', new Blob([png], { type: 'image/png' }), id)
  await exportBackup()
  const archive = mocks.download.mock.calls[0][1] as Uint8Array
  const entries = unzipSync(archive)
  expect(JSON.parse(new TextDecoder().decode(entries[BACKUP_NAME])).exEchoArt).toEqual([id])
  expect(entries[echoArtEntry(id)]).toEqual(new Uint8Array(png))
  await db.clear('echoArt')
  mocks.pick.mockResolvedValue(new File([new Uint8Array(archive)], 'backup.zip'))
  expect(await importBackup()).toBe(true)
  expect(new Uint8Array(await (await db.get('echoArt', id))!.arrayBuffer())).toEqual(new Uint8Array(png))
  const different = Buffer.from(png); different[different.length - 1] ^= 1
  await db.put('echoArt', new Blob([different]), id)
  const before = await db.get('settings', 'settings')
  await expect(importBackup()).rejects.toThrow('different image')
  expect(await db.get('settings', 'settings')).toEqual(before)
  db.close()
})

it('round trips 4097 accumulated images within the whole-archive limits', async () => {
  const { database } = await import('../src/web/db/open')
  const { exportBackup, importBackup } = await import('../src/web/backup')
  const db = await database(), ids = Array.from({ length: 4097 }, (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`)
  const transaction = db.transaction('echoArt', 'readwrite')
  for (const key of ids) await transaction.store.add(new Blob([png], { type: 'image/png' }), key)
  await transaction.done
  await exportBackup()
  const archive = mocks.download.mock.calls[0][1] as Uint8Array, entries = unzipSync(archive)
  expect(JSON.parse(new TextDecoder().decode(entries[BACKUP_NAME])).exEchoArt).toEqual(ids)
  await db.clear('echoArt')
  mocks.pick.mockResolvedValue(new File([new Uint8Array(archive)], 'backup.zip'))
  expect(await importBackup()).toBe(true)
  expect(await db.getAllKeys('echoArt')).toEqual(ids)
  expect(new Uint8Array(await (await db.get('echoArt', ids.at(-1)!))!.arrayBuffer())).toEqual(new Uint8Array(png))
  db.close()
}, 20000)
