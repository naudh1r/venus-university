import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useTableStore } from '../src/renderer/minigames/session'
import { fileResult } from '../src/renderer/minigames/table'
import { submitAction } from '../src/renderer/stores/gameLoop'
import DARTS from '../src/shared/minigameEntries/darts'
const POOL = { ...DARTS, id: 'generic-fixture', resultBrief: undefined }
import type { MiniGameDef } from '../src/shared/minigames'
import type { PlayResult } from '../src/renderer/minigames/play'

vi.mock('../src/renderer/stores/gameLoop', () => ({ submitAction: vi.fn(), takeTurnFromReply: vi.fn(() => false) }))
vi.mock('../src/renderer/stores/loop/hooks', async (importOriginal) => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/hooks')>(), advance: vi.fn()
}))
vi.mock('../src/renderer/views/boxRows', () => ({ boxFits: () => true }))

const result: PlayResult = { outcome: 'won', summary: 'You won the match.', account: ['Final balance: 0.'] }
const played = (game: MiniGameDef, names: string[] = ['Ana']) => ({ game, names, stake: 'You agreed on a soda.' })
const brief = () => useTableStore.getState().played!.brief.join('\n')

beforeEach(() => {
  vi.clearAllMocks()
  useTableStore.getState().setPlayed(null)
  useGameStore.setState({ awaitingInput: true, busy: false, streaming: false, pendingLines: [], sceneLog: [], currentSceneTranscript: [], charKeyToId: {}, emotions: {} })
})

describe('completed game narration handoff', () => {
  it.each(['won', 'lost', 'draw'] as const)('uses the Darts pack cue for a %s result with all facts retained', (outcome) => {
    fileResult({ ...result, outcome }, played(DARTS))
    expect(submitAction).toHaveBeenCalledExactlyOnceWith(result.summary)
    expect(brief()).toContain('Ana')
    expect(brief()).toContain('Final balance: 0.')
    expect(brief()).toContain('You agreed on a soda.')
    for (const line of DARTS.resultBrief!) expect(brief()).toContain(line)
    expect(brief()).toContain('Begin AFTER that moment')
  })

  it('takes directions from the definition rather than checking a game id', () => {
    fileResult(result, played({ ...DARTS, id: 'renamed-pack' }))
    expect(brief()).toContain(DARTS.resultBrief![0])
    fileResult(result, played({ ...POOL, resultBrief: ['Open after the handshake.'] }))
    expect(brief()).toContain('Open after the handshake.')
    expect(brief()).not.toContain('AFTER DARTS')
  })

  it.each([undefined, []])('preserves the default cue when the optional field is %s', (resultBrief) => {
    fileResult(result, played({ ...POOL, resultBrief }))
    expect(brief()).toContain('Open on the result, then let Ana react to it in character: how the game went, anything in it worth a remark, and the stake if there was one.')
    expect(brief()).not.toContain('AFTER DARTS')
  })

  it.each(['abandoned', 'broken'] as const)('keeps the existing %s flow without claiming a final impact', (outcome) => {
    fileResult({ ...result, outcome }, played(DARTS))
    expect(brief()).toContain('Nobody won it.')
    expect(brief()).not.toContain('AFTER DARTS')
    expect(submitAction).toHaveBeenCalledExactlyOnceWith(result.summary)
  })

  it('keeps solo results on the transcript for the next action without an immediate model call', () => {
    fileResult(result, played(DARTS, []))
    expect(submitAction).not.toHaveBeenCalled()
    expect(useTableStore.getState().played?.next).toBe(true)
    expect(brief()).toContain('on his own')
    expect(brief()).not.toContain('AFTER DARTS')
    expect(useGameStore.getState().currentSceneTranscript.at(-1)?.text).toBe(result.summary)
  })
})
