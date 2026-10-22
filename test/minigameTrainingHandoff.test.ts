import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { fileResult } from '../src/renderer/minigames/table'
import { finishSlotActivity } from '../src/renderer/stores/slotActivity'
import { submitAction } from '../src/renderer/stores/gameLoop'
import CAT_PAIRS from '@shared/minigameEntries/cat-pairs'
import { MINI_GAMES } from '@shared/minigames'
vi.mock('../src/renderer/stores/gameLoop', () => ({ submitAction: vi.fn(), takeTurnFromReply: vi.fn(() => false) }))
vi.mock('../src/renderer/stores/slotActivity', () => ({ finishSlotActivity: vi.fn() }))
vi.mock('../src/renderer/stores/loop/hooks', async original => ({ ...await original<typeof import('../src/renderer/stores/loop/hooks')>(), advance: vi.fn() }))
vi.mock('../src/renderer/views/boxRows', () => ({ boxFits: () => true }))
beforeEach(() => {
  vi.clearAllMocks()
  useGameStore.getState().reset()
  useGameStore.setState({ awaitingInput: true, sceneActivity: { owner: MINI_GAMES, id: 'cat-pairs', stat: 'brain', location: 'cutetea', label: 'Train', status: 'pending' } })
})
describe('training result handoff', () => {
  it.each(['won', 'lost', 'draw', 'played'] as const)('records completion for %s, retaining companion and result facts', outcome => {
    fileResult({ outcome, summary: 'Finished.', account: ['Nine pairs found.'] }, { game: CAT_PAIRS, names: ['Ana'], stake: '' })
    expect(finishSlotActivity).toHaveBeenCalledExactlyOnceWith(MINI_GAMES, 'cat-pairs', true, expect.stringContaining('Ana'))
    expect(vi.mocked(finishSlotActivity).mock.calls[0][3]).toContain('Nine pairs found.')
    expect(submitAction).not.toHaveBeenCalled()
  })
  it('records walking away as incomplete and leaves broken play retryable', () => {
    fileResult({ outcome: 'broken', summary: 'Error.' }, { game: CAT_PAIRS, names: [], stake: '' })
    expect(finishSlotActivity).not.toHaveBeenCalled()
    fileResult({ outcome: 'abandoned', summary: 'Left.' }, { game: CAT_PAIRS, names: [], stake: '' })
    expect(finishSlotActivity).toHaveBeenCalledExactlyOnceWith(MINI_GAMES, 'cat-pairs', false, expect.stringContaining('Played alone'))
  })
})
