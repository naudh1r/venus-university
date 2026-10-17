import { beforeEach, expect, it, vi } from 'vitest'
import DARTS from '../src/shared/minigameEntries/darts'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useTableStore } from '../src/renderer/minigames/session'
import { fileResult } from '../src/renderer/minigames/table'
import { submitAction } from '../src/renderer/stores/gameLoop'

vi.mock('../src/renderer/stores/gameLoop', () => ({ submitAction: vi.fn(), takeTurnFromReply: () => false }))

beforeEach(() => {
  vi.mocked(submitAction).mockClear()
  useGameStore.getState().reset()
  useGameStore.setState({ awaitingInput: true, busy: false, pendingLines: [], cast: [], departed: [] })
  useTableStore.getState().setPlayed(null)
})

it('immediately asks the narrator to close a completed solo Darts scene with the real result', () => {
  fileResult({ outcome: 'won', summary: 'You beat the house at darts on your own.', account: ['301 reduced to zero.'] }, { game: DARTS, names: [], stake: '' })
  expect(submitAction).toHaveBeenCalledExactlyOnceWith('You beat the house at darts on your own.')
  const played = useTableStore.getState().played!
  expect(played.finishSolo).toBe(true)
  expect(played.next).toBeUndefined()
  expect(played.brief.join('\n')).toContain('301 reduced to zero.')
  expect(played.brief.join('\n')).toContain('no new decision point')
  expect(played.brief.join('\n')).toContain('Do not replay a throw')
})

it('gets an immediate reaction without forcing scene closure when a bystander is present', () => {
  useGameStore.setState({ cast: ['maddy'] })
  fileResult({ outcome: 'lost', summary: 'You lost with 50 remaining.' }, { game: DARTS, names: [], stake: '' })
  expect(submitAction).toHaveBeenCalledExactlyOnceWith('You lost with 50 remaining.')
  const played = useTableStore.getState().played!
  expect(played.finishSolo).toBe(false)
  expect(played.brief.join('\n')).toContain('Anyone already present watched')
})
