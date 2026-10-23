import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { finishSlotActivity, resumeSlotActivity } from '../src/renderer/stores/slotActivity'
import { submitAction } from '../src/renderer/stores/gameLoop'
import { writeAutosave } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'

vi.mock('../src/renderer/stores/gameLoop', () => ({ submitAction: vi.fn() }))
vi.mock('../src/renderer/stores/loop/saves', () => ({ writeAutosave: vi.fn(async () => {}) }))
const activity = { owner: 'pack', id: 'game', stat: 'body' as const, location: 'btb_arcade', label: 'Train', status: 'pending' as const }
beforeEach(() => {
  vi.clearAllMocks()
  resetLoopState()
  useGameStore.getState().reset()
  useGameStore.setState({ sceneActivity: activity, awaitingInput: true, currentSceneTranscript: [{ speaker: 'reader', text: 'Train' }] })
})
describe('slot completion transaction', () => {
  it('saves the result before requesting aftermath and never moves points itself', async () => {
    const before = useGameStore.getState().stats
    expect(await finishSlotActivity('pack', 'game', true, 'You lost, but completed the session.')).toBe(true)
    expect(writeAutosave).toHaveBeenCalledOnce()
    expect(vi.mocked(writeAutosave).mock.calls[0][0]?.activity?.status).toBe('completed')
    expect(vi.mocked(writeAutosave).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(submitAction).mock.invocationCallOrder[0])
    expect(useGameStore.getState().stats).toEqual(before)
    expect(await finishSlotActivity('pack', 'game', true, 'Duplicate')).toBe(false)
    expect(submitAction).toHaveBeenCalledOnce()
  })
  it('rejects another game or owner and settles abandonment without completion', async () => {
    expect(await finishSlotActivity('wrong', 'game', true, 'Wrong')).toBe(false)
    expect(await finishSlotActivity('pack', 'other', true, 'Wrong')).toBe(false)
    expect(await finishSlotActivity('pack', 'game', false, 'Walked away')).toBe(true)
    expect(useGameStore.getState().sceneActivity?.status).toBe('abandoned')
  })
  it('resumes a persisted result, but does not bypass an AI error or replay a pending activity', async () => {
    await resumeSlotActivity()
    expect(submitAction).not.toHaveBeenCalled()
    useGameStore.setState({ sceneActivity: { ...activity, status: 'completed', result: 'Finished' } })
    await resumeSlotActivity()
    expect(submitAction).toHaveBeenCalledOnce()
    useGameStore.setState({ turnError: { code: 'LLM_ERROR', message: 'Retry required' } as never })
    await resumeSlotActivity()
    expect(submitAction).toHaveBeenCalledOnce()
  })
})
