import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/appId'

it('adds 0.7 applications to VE v12 without losing saves, art, presets or music', async () => {
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
  const rows: [string, IDBValidKey, unknown][] = [
    ['settings', 'settings', { marker: 'keep settings' }],
    ['saves', ['p', '0'], { marker: 'keep save' }],
    ['playthroughs', 'p', { marker: 'keep run' }],
    ['characters', 'girl', { marker: 'keep character' }],
    ['photos', ['p', 'photo'], new Blob(['photo'])],
    ['echoArt', 'echo', new Blob(['echo portrait'])],
    ['echoSources', 'source', new Blob(['echo source'])],
    ['profilePictures', 'p', new Blob(['reader portrait'])],
    ['soundtrackMeta', 'tracks', { marker: 'keep assignments' }],
    ['soundtrackFiles', 'track', new Blob(['music'])],
    ['presets', 'presets', { marker: 'keep preset' }],
    ['studioPrompts', 'studioPrompts', { marker: 'keep studio' }],
    ['lorebooks', 'p', { marker: 'keep lorebook' }]
  ]
  const old = await openDB(APP_ID, 12, { upgrade(db) {
    for (const [store] of rows) db.createObjectStore(store)
  } })
  for (const [store, key, value] of rows) await old.put(store, value, key)
  old.close()
  const { database } = await import('../src/web/db/open')
  const db = await database()
  expect(db.version).toBe(14)
  expect(db.objectStoreNames.contains('applications')).toBe(true)
  for (const [store, key, value] of rows) {
    const saved = await (db as any).get(store, key)
    if (value instanceof Blob) expect(await saved.text()).toBe(await value.text())
    else expect(saved).toEqual(value)
  }
  db.close()
})
