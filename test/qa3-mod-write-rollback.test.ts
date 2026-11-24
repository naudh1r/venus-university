import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { ModSwitches } from '@shared/mods'
import type { Result } from '@shared/types'

const showError = vi.hoisted(() => vi.fn())
vi.mock('../src/renderer/stores/gameStore', () => ({ useGameStore: {
  getState: () => ({ playthroughId: null, playthroughMods: [] }), subscribe: () => () => {}
} }))
vi.mock('../src/renderer/stores/uiStore', () => ({ useUiStore: { getState: () => ({ showError }) } }))
vi.mock('../src/renderer/stores/loop/state', () => ({ loopState: { record: null } }))

let useModsStore: typeof import('../src/renderer/stores/modsStore')['useModsStore']
let stored: ModSwitches
const failed: Result<null> = { ok: false, error: { code: 'MODS_UNWRITABLE', message: 'Could not save mods.json.' } }
const success: Result<null> = { ok: true, data: null }
const writes = vi.fn<(switches: ModSwitches) => Promise<Result<null>>>()
beforeEach(async () => {
  vi.resetModules(); showError.mockClear(); writes.mockReset()
  stored = { on: { 'custom-soundtracks': true, 'story-memory': true, 'plot-twist': true }, options: {} }
  vi.stubGlobal('window', { api: { mods: { set: writes, get: async () => ({ ok: true, data: structuredClone(stored) }) } } })
  ;({ useModsStore } = await import('../src/renderer/stores/modsStore'))
  await useModsStore.getState().load()
})
afterEach(() => vi.unstubAllGlobals())

it('restores the last persisted switches when two queued writes both fail', async () => {
  let finish!: (value: Result<null>) => void
  writes.mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue(failed)
  const first = useModsStore.getState().setMod('custom-soundtracks', false)
  await Promise.resolve() // First UI event starts its write before the next click.
  const second = useModsStore.getState().setMod('story-memory', false)
  finish(failed)
  await Promise.all([first, second])
  expect(writes).toHaveBeenCalledTimes(2)
  expect(showError).toHaveBeenCalledTimes(2)
  expect(useModsStore.getState().switches).toEqual(stored)
})

it('does not undo a persisted snapshot after three ordinary clicks overlap a slow write', async () => {
  let finish!: () => void
  writes.mockImplementationOnce(switches => new Promise(resolve => { finish = () => { stored = structuredClone(switches); resolve(success) } }))
    .mockImplementationOnce(async switches => { stored = structuredClone(switches); return success }).mockResolvedValue(failed)
  const first = useModsStore.getState().setMod('custom-soundtracks', false)
  await Promise.resolve()
  const second = useModsStore.getState().setMod('story-memory', false)
  await Promise.resolve()
  const third = useModsStore.getState().setMod('plot-twist', false)
  await Promise.resolve()
  expect(writes).toHaveBeenCalledTimes(1) // Slow first write keeps both subsequent UI changes queued.
  finish()
  await Promise.all([first, second, third])
  expect(stored.on['plot-twist']).toBe(false)
  expect(showError).toHaveBeenCalledTimes(1)
  expect(useModsStore.getState().switches).toEqual(stored)
})

it('single failed change correctly returns to persisted settings', async () => {
  writes.mockResolvedValue(failed)
  await useModsStore.getState().setMod('custom-soundtracks', false)
  expect(useModsStore.getState().switches).toEqual(stored)
})

it('successful queued changes agree with persisted settings', async () => {
  writes.mockImplementation(async switches => { stored = structuredClone(switches); return success })
  await Promise.all([
    useModsStore.getState().setMod('custom-soundtracks', false),
    useModsStore.getState().setMod('story-memory', false)
  ])
  expect(useModsStore.getState().switches).toEqual(stored)
})
