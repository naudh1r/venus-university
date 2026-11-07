import { afterEach, expect, it, vi } from 'vitest'
import { desktopChannel } from '../../src/shared/desktopSurface'
import { restoreApi, stubApi } from '../fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../../src/renderer/stores/gameStore')
const { prepareAutosave } = await import('../../src/renderer/stores/loop/saves')
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
