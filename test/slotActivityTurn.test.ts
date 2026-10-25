import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { runSceneTurn } from '../src/renderer/stores/loop/turn'
import { registerLoopHooks } from '../src/renderer/stores/loop/hooks'
import type { SceneCall } from '../src/renderer/stores/loop/stream'
import { writeAutosave } from '../src/renderer/stores/loop/saves'
import { character } from './fixtures'
vi.mock('../src/renderer/stores/loop/saves', async original => ({
  ...await original<typeof import('../src/renderer/stores/loop/saves')>(), writeAutosave: vi.fn(async () => {})
}))
const ending = vi.fn(async () => {})
const activity = { owner: 'pack', id: 'game', stat: 'body' as const, location: 'btb_arcade', label: 'Train', status: 'pending' as const }
beforeEach(() => {
  vi.clearAllMocks()
  useGameStore.getState().reset()
  resetLoopState()
  registerLoopHooks({ advance: vi.fn(), runEnding: ending, fetchEndingOpening: vi.fn(async () => null), dispatchTurn: vi.fn(), prefetchTextLedger: vi.fn(), claimTextLedger: vi.fn(async () => ({})) })
})
function reply(end: boolean): SceneCall {
  return Promise.resolve({ ok: true, data: { lines: [], end, summary: null, applied: true, at: 0, reply: { lines: [], end_scene: end } } })
}
describe('interactive training at the scene boundary', () => {
  it.each([true, false])('holds setup even if the model closes it (solo=%s)', async solo => {
    const girl = character({ charId: 'girl' })
    useGameStore.setState({ sceneActivity: activity, cast: solo ? [] : ['girl'], characters: { girl }, busy: true })
    await runSceneTurn(reply(true), { scene: null, action: 'Train' }, solo ? [] : ['girl'], solo ? [] : [girl], solo)
    expect(ending).not.toHaveBeenCalled()
    expect(useGameStore.getState().sceneEnding).toBe(false)
    expect(useGameStore.getState().busy).toBe(false)
    expect(vi.mocked(writeAutosave).mock.calls[0][0]?.activity).toEqual(activity)
  })
  it.each(['completed', 'abandoned'] as const)('settles the slot after %s even if the model leaves it open', async status => {
    useGameStore.setState({ sceneActivity: { ...activity, status }, busy: true })
    await runSceneTurn(reply(false), { scene: null, action: 'Aftermath' }, [], [], true)
    expect(ending).toHaveBeenCalledExactlyOnceWith(true)
    expect(useGameStore.getState().sceneEnding).toBe(true)
  })
  it('lets a turn taken over the closing run as any other once the closing has landed', async () => {
    const girl = character({ charId: 'girl' })
    useGameStore.setState({ sceneActivity: { ...activity, status: 'abandoned' }, cast: ['girl'], characters: { girl }, busy: true })
    await runSceneTurn(reply(false), { scene: null, action: 'Aftermath' }, ['girl'], [girl], false)
    expect(useGameStore.getState().sceneActivity?.closed).toBe(true)
    // The reader talks over the goodbye: the ending is dropped and his turn goes out.
    useGameStore.setState({ sceneEnding: false, busy: true })
    await runSceneTurn(reply(false), { scene: null, action: 'I ask her to play' }, ['girl'], [girl], false)
    expect(ending).toHaveBeenCalledOnce()
    expect(useGameStore.getState().sceneEnding).toBe(false)
  })
  it('keeps an ordinary solo scene on its original ending path', async () => {
    await runSceneTurn(reply(false), { scene: null, action: 'Read' }, [], [], true)
    expect(ending).toHaveBeenCalledExactlyOnceWith(true)
  })
})
