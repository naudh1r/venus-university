import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Result } from '@shared/types'
import type { SoundtrackMap } from '@shared/soundtracks'
vi.mock('../src/renderer/stores/modsStore', () => ({ modIsOn: () => true }))
beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllGlobals())
const original = { title: { file: 'a'.repeat(64) + '.wav', name: 'song.wav', loop: true } }
it('does not let a delayed list overwrite a successful edit', async () => {
  let resolve!: (result: Result<SoundtrackMap>) => void
  vi.stubGlobal('window', { api: { soundtracks: {
    list: () => new Promise<Result<SoundtrackMap>>(done => { resolve = done }),
    remove: async () => ({ ok: true, data: {} })
  } } })
  const { useSoundtrackStore: store } = await import('../src/renderer/stores/soundtrackStore')
  store.setState({ map: original, loaded: true })
  const load = store.getState().load()
  await store.getState().remove('title')
  resolve({ ok: true, data: original }); await load
  expect(store.getState().map).toEqual({})
})
it('keeps assignments and displays the bridge error when a write fails', async () => {
  vi.stubGlobal('window', { api: { soundtracks: { remove: async () => ({ ok: false, error: { code: 'DISK', message: 'Disk full.' } }) } } })
  const { useSoundtrackStore: store } = await import('../src/renderer/stores/soundtrackStore')
  store.setState({ map: original, loaded: true })
  await store.getState().remove('title')
  expect(store.getState()).toMatchObject({ map: original, busy: false, message: 'Disk full.' })
})
