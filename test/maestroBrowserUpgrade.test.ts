import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { openDB } from 'idb'
import { beforeEach, expect, it, vi } from 'vitest'
import { APP_ID } from '@shared/appId'
import { emptyLorebook } from '@shared/lorebookRecord'

beforeEach(() => { globalThis.indexedDB = new IDBFactory(); vi.resetModules() })

it('upgrades the previous VE browser database without losing Maestro data', async () => {
  const old = await openDB(APP_ID, 9, { upgrade(db) {
    for (const store of ['settings', 'playthroughs', 'echoArt', 'echoSources', 'soundtrackMeta', 'soundtrackFiles']) db.createObjectStore(store)
    db.createObjectStore('saves').createIndex('byDate', ['playthroughId', 'saveDate'])
  } })
  const save = { playthroughId: 'p', saveDate: 1, exTalents: { bp: 53.25 }, exBreakthrough: { meters: { a: 85 } } }
  await old.put('saves', save, ['p', 'autosave'])
  await old.put('playthroughs', { name: 'My ongoing run', mods: ['campus-talents'] }, 'p')
  await old.put('echoArt', new Blob(['art']), 'a')
  await old.put('echoSources', new Blob(['source']), 'a')
  await old.put('soundtrackMeta', { title: { file: 'song.wav', name: 'My song', loop: true } }, 'tracks')
  await old.put('soundtrackFiles', new Blob(['music']), 'song.wav')
  old.close()
  const { database } = await import('../src/web/db/open')
  const db = await database()
  try {
    // Other mods can add stores in later versions; Maestro data must still survive.
    expect(db.version).toBeGreaterThanOrEqual(10)
    expect(await db.get('saves', ['p', 'autosave'])).toEqual(save)
    expect(await db.getAllFromIndex('saves', 'byDate', ['p', 1])).toEqual([save])
    expect(await db.get('playthroughs', 'p')).toMatchObject({ name: 'My ongoing run' })
    expect(await (await db.get('echoArt', 'a'))!.text()).toBe('art')
    expect(await (await db.get('echoSources', 'a'))!.text()).toBe('source')
    expect(await db.get('soundtrackMeta', 'tracks')).toMatchObject({ title: { file: 'song.wav' } })
    expect(await (await db.get('soundtrackFiles', 'song.wav'))!.text()).toBe('music')
    await db.put('lorebooks', emptyLorebook(), 'p')
    expect(await db.get('lorebooks', 'p')).toEqual(emptyLorebook())
  } finally { db.close() }
})
