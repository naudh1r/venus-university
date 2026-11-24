import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Result } from '@shared/types'
import type { SoundtrackMap } from '@shared/soundtracks'

vi.mock('../src/renderer/stores/modsStore', () => ({ modIsOn: () => true }))
beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())

const saved: SoundtrackMap = { title: { file: 'a'.repeat(64) + '.wav', name: 'saved-title.wav', loop: true } }

/** Hold the same list call startup and the soundtrack panel join. */
async function fixture() {
  let resolve!: (result: Result<SoundtrackMap>) => void
  vi.stubGlobal('window', { api: { soundtracks: {
    list: vi.fn(() => new Promise<Result<SoundtrackMap>>(done => { resolve = done })),
    pick: vi.fn(async () => ({ ok: true, data: null })),
    cleanup: vi.fn(async () => ({ ok: true, data: { count: 0 } })),
    remove: vi.fn(async () => ({ ok: true, data: {} }))
  } } })
  const { useSoundtrackStore: store, soundtrackActive } = await import('../src/renderer/stores/soundtrackStore')
  const loading = store.getState().load()
  return { store, soundtrackActive, loading, resolve: (result: Result<SoundtrackMap>) => resolve(result) }
}

it('keeps the initial saved assignments when a concurrent picker is cancelled', async () => {
  const { store, soundtrackActive, loading, resolve } = await fixture()
  await store.getState().choose('landing_day')
  expect(window.api.soundtracks.pick).toHaveBeenCalledOnce()
  expect(store.getState().busy).toBe(false)
  resolve({ ok: true, data: saved }); await loading
  expect.soft(store.getState().map).toEqual(saved)
  expect.soft(store.getState().loaded).toBe(true)
  expect.soft(soundtrackActive('title')).toBe(true)
  const reload = store.getState().load()
  resolve({ ok: true, data: saved }); await reload
  expect(store.getState().map).toEqual(saved)
  expect(soundtrackActive('title')).toBe(true)
})

it('keeps the initial saved assignments when concurrent unused-file cleanup changes no assignment', async () => {
  const { store, soundtrackActive, loading, resolve } = await fixture()
  await store.getState().cleanup()
  expect(store.getState().message).toBe('Deleted 0 unused imported copies.')
  resolve({ ok: true, data: saved }); await loading
  expect.soft(store.getState().map).toEqual(saved)
  expect.soft(soundtrackActive('title')).toBe(true)
})

it('loads the same saved assignments when the read is not invalidated', async () => {
  const { store, soundtrackActive, loading, resolve } = await fixture()
  resolve({ ok: true, data: saved }); await loading
  expect(store.getState().map).toEqual(saved)
  expect(store.getState().loaded).toBe(true)
  expect(soundtrackActive('title')).toBe(true)
})

it('still rejects a stale list after a real successful assignment change', async () => {
  const { store, loading, resolve } = await fixture()
  await store.getState().remove('title')
  resolve({ ok: true, data: saved }); await loading
  expect(store.getState().map).toEqual({})
  expect(store.getState().loaded).toBe(true)
})
