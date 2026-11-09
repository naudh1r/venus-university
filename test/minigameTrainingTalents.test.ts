import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeTalents, setTalentRules } from '@shared/campusTalents'
import { MINI_GAMES } from '@shared/minigames'
import type { PlayerStats } from '@shared/playerStats'
import type { SlotActivity } from '@shared/slotActivity'
import { useGameStore } from '../src/renderer/stores/gameStore'
import '../src/renderer/modEntries/campus-talents'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { sceneLines, stubApi, restoreApi } from './fixtures'

// A training slot settled with Campus Talents on: the bonus follows the stat the slot trained.
const crossing = vi.hoisted(() => ({ release: () => {} }))
vi.mock('../src/renderer/stores/slotCrossing', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/slotCrossing')>(),
  coverSlotCrossing: () => new Promise<void>(resolve => { crossing.release = resolve })
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { advance } = await import('../src/renderer/stores/gameLoop')
await import('../src/renderer/modEntries/mini-games')
const game = () => useGameStore.getState()
const start: PlayerStats = { brain: 10, body: 10, heart: 10 }
const training: SlotActivity = { owner: MINI_GAMES, id: 'darts', location: 'pino_cola_lounge', label: 'Train Body', stat: 'body', status: 'completed', closed: true }

beforeEach(() => {
  game().reset(); resetLoopState(); setTalentRules(true)
  useModsStore.setState({ switches: { on: { 'campus-talents': true, 'mini-games': true, echo: false, reckoning: false }, options: {} } })
  useGameStore.setState({ playthroughId: 'training-talents-test', date: 7, time: 0, cast: [],
    sceneEnding: true, statusShown: false, awaitingInput: false, pendingLines: [],
    currentSceneTranscript: sceneLines('The reader practised darts alone.'), stats: start,
    // Deep Focus II and Body Training II.
    exTalents: normalizeTalents({ initialized: true, earned: 1000, ranks: { 'brain.focus': 2, 'body.training': 2 } }) })
  stubApi({ jobs: { onProgress: () => () => {} }, saves: { autosave: async (id, draft) =>
    ({ ok: true, data: { ...draft, playthroughId: id, saveId: 'auto', saveDate: 0 } }) } })
})
afterEach(async () => { resetLoopState(); crossing.release(); await writesSettled(); restoreApi(); setTalentRules() })

/** Runs the ending's projection, then the boundary that applies it. */
function settle(): PlayerStats {
  advance()
  useGameStore.setState({ pendingLines: [], statusModal: null, statusShown: true })
  loopState.statusSteps = []
  advance()
  return game().stats
}

describe('a solo Body training slot the ledger read as Brain, with Deep Focus II and Body Training II', () => {
  it('pays the trained Body and its talent bonus, and nothing for Brain, once completed', () => {
    useGameStore.setState({ sceneActivity: training })
    loopState.pendingLedgerResult = { stats: { brain: true } }
    expect(settle()).toEqual({ brain: 10, body: 14, heart: 10 })
  })
  it('pays no exercise at all when walked away from', () => {
    useGameStore.setState({ sceneActivity: { ...training, status: 'abandoned' } })
    loopState.pendingLedgerResult = { stats: { brain: true } }
    expect(settle()).toEqual(start)
  })
  it('leaves a scene without a training slot to the ledger and the talents', () => {
    loopState.pendingLedgerResult = { stats: { brain: true } }
    expect(settle()).toEqual({ brain: 14, body: 10, heart: 10 })
  })
})
