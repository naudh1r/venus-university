import { afterEach, expect, it, vi } from 'vitest'
import { desktopChannel } from '../../src/shared/desktopSurface'
import { restoreApi, stubApi } from '../fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../../src/renderer/stores/gameStore')
const { prepareAutosave, writeAutosave } = await import('../../src/renderer/stores/loop/saves')
const { resetLoopState } = await import('../../src/renderer/stores/loop/state')
const { canInviteToScene } = await import('../../src/renderer/mods/sceneInvitations')

afterEach(() => { useGameStore.getState().reset(); restoreApi(); vi.restoreAllMocks() })

it('drops deferred writes when a different save is loaded before flushing', async () => {
  const autosave = vi.fn().mockResolvedValue({ ok: true, data: null })
  stubApi({ saves: { autosave } })
  useGameStore.setState({ playthroughId: '1' })
  const serialize = vi.spyOn(useGameStore.getState(), 'toGameSave')
  const flush = prepareAutosave(null)
  useGameStore.setState(state => ({ loads: state.loads + 1 }))
  await flush()
  expect(serialize).not.toHaveBeenCalled()
  expect(autosave).not.toHaveBeenCalled()
  const abandoned = prepareAutosave(null)
  resetLoopState()
  await abandoned()
  expect(autosave).not.toHaveBeenCalled()
})

it('keeps a later native decision when a deferred exchange flushes afterwards', async () => {
  const autosave = vi.fn().mockResolvedValue({ ok: true, data: null })
  stubApi({ saves: { autosave } })
  useGameStore.setState({ playthroughId: '1', money: 10 })
  const flush = prepareAutosave(null)
  useGameStore.setState({ money: 20 })
  await writeAutosave(null)
  await flush()
  expect(autosave.mock.calls.map(([, draft]) => draft.money)).toEqual([20])
})

it('writes the newer deferred capture once when two exchanges flush out of order', async () => {
  const autosave = vi.fn().mockResolvedValue({ ok: true, data: null })
  stubApi({ saves: { autosave } })
  useGameStore.setState({ playthroughId: '1', money: 10 })
  const older = prepareAutosave(null)
  useGameStore.setState({ money: 20 })
  const newer = prepareAutosave(null)
  await Promise.all([newer(), older(), newer()])
  expect(autosave.mock.calls.map(([, draft]) => draft.money)).toEqual([20])
})

it('can recover the retained decision after a later write fails', async () => {
  const autosave = vi.fn()
    .mockResolvedValueOnce({ ok: false, error: { code: 'TEST', message: 'Synthetic write failure' } })
    .mockResolvedValue({ ok: true, data: null })
  stubApi({ saves: { autosave } })
  useGameStore.setState({ playthroughId: '1', money: 10 })
  const flush = prepareAutosave(null)
  useGameStore.setState({ money: 20 })
  await writeAutosave(null)
  await flush()
  await flush()
  expect(autosave.mock.calls.map(([, draft]) => draft.money)).toEqual([20, 10])
})

it('drops a deferred write when a different save loads while the write is queued', async () => {
  const autosave = vi.fn().mockResolvedValue({ ok: true, data: null })
  stubApi({ saves: { autosave } })
  useGameStore.setState({ playthroughId: '1' })
  const pending = prepareAutosave(null)()
  useGameStore.setState(state => ({ loads: state.loads + 1 }))
  await pending
  expect(autosave).not.toHaveBeenCalled()
})

it('requires a playable game before offering an invitation', () => {
  useGameStore.getState().reset()
  expect(canInviteToScene()).toBe(false)
  useGameStore.setState({ playthroughId: '1', date: 10, time: 1 })
  expect(canInviteToScene()).toBe(true)
  useGameStore.setState({ busy: true })
  expect(canInviteToScene()).toBe(false)
})

it('keeps desktop methods in the declaring window namespace', () => {
  expect(desktopChannel('sample-tool', 'read')).toBe('surface:sample-tool:read')
  expect(() => desktopChannel('sample-tool', 'other:read')).toThrow()
  expect(() => desktopChannel('other:sample-tool', 'read')).toThrow()
})
