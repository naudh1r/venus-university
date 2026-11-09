import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeTalents, setTalentRules } from '@shared/campusTalents'
import { readTalentGrowth } from '@shared/talentGrowth'
import { resolveStatDeltas, type PlayerStats } from '@shared/playerStats'
import { talentStatGains } from '@shared/talentPerks'
import { useGameStore } from '../src/renderer/stores/gameStore'
import '../src/renderer/modEntries/campus-talents'
import '../src/renderer/modEntries/starting-challenge'
import { settleSceneStats } from '../src/renderer/mods/hooks'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { sceneLines, stubApi, restoreApi } from './fixtures'

// Exercise the real preview and commit path, stopping before the next slot's AI.
const crossing = vi.hoisted(() => ({ release: () => {} }))
vi.mock('../src/renderer/stores/slotCrossing', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/slotCrossing')>(),
  coverSlotCrossing: () => new Promise<void>(resolve => { crossing.release = resolve })
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { advance } = await import('../src/renderer/stores/gameLoop')
const stats = (n: number): PlayerStats => ({ brain: n, body: n, heart: n })
const game = () => useGameStore.getState()
const legacy = { brain: .5, body: .25, heart: .75 }
const ranks = (rank: number) => ({ 'brain.focus': rank, 'body.training': rank, 'heart.confidence': rank })

beforeEach(() => {
  game().reset(); resetLoopState(); setTalentRules(true)
  useModsStore.setState({ switches: { on: { 'campus-talents': true, 'starting-challenge': true, echo: false, reckoning: false }, options: {} } })
  useGameStore.setState({ playthroughId: 'full-stat-gains-test', date: 7, time: 0, cast: [],
    sceneEnding: true, statusShown: false, awaitingInput: false, pendingLines: [],
    currentSceneTranscript: sceneLines('The reader practiced alone.'),
    exStartingChallenge: { version: 2, floors: { brain: -100, body: -100, heart: -100 } } })
  stubApi({ jobs: { onProgress: () => () => {} }, saves: { autosave: async (id, draft) =>
    ({ ok: true, data: { ...draft, playthroughId: id, saveId: 'auto', saveDate: 0 } }) } })
})
afterEach(async () => { resetLoopState(); crossing.release(); await writesSettled(); restoreApi(); setTalentRules() })

describe('Full activity and skill gains through native scene settlement', () => {
  const cases = [-100, -80, -60, -30, -1, 0, 1, 60, 100].flatMap(start =>
    [0, 1, 2].flatMap(rank => [false, true].map(multiple => ({ start, rank, multiple }))))
  it.each(cases)('applies the full award at $start with rank $rank, multiple stats: $multiple', async ({ start, rank, multiple }) => {
    const initial = stats(start)
    useGameStore.setState({ stats: initial,
      exTalents: normalizeTalents({ initialized: true, earned: 1000, ranks: ranks(rank), growth: legacy }) })
    loopState.pendingLedgerResult = { stats: multiple ? { brain: true, body: true, heart: true } : { brain: true } }
    advance()
    expect(game().stats).toEqual(initial)
    expect(game().exTalents.growth).toEqual(legacy)
    expect(JSON.stringify([game().currentLine, game().pendingLines, loopState.statusSteps])).not.toContain('Progress toward your next stat point')
    useGameStore.setState({ pendingLines: [], statusModal: null, statusShown: true })
    loopState.statusSteps = []
    advance()
    const expected = { brain: start + 2 + rank, body: start + (multiple ? 2 + rank : 0), heart: start + (multiple ? 2 + rank : 0) }
    expect(game().stats).toEqual(expected)
    expect(game().exTalents.growth).toEqual(legacy)
    const saved = JSON.parse(JSON.stringify(game().toGameSave()))
    expect(saved.stats).toEqual(expected)
    expect(normalizeTalents(saved.exTalents).growth).toEqual(legacy)
  })
  it('keeps native gains when disabled, even with purchased skills and legacy fractions', () => {
    setTalentRules(false)
    useModsStore.setState({ switches: { on: { 'campus-talents': false }, options: {} } })
    useGameStore.setState({ stats: stats(0), exTalents: normalizeTalents({ initialized: true, earned: 1000, ranks: ranks(2), growth: legacy }) })
    loopState.pendingLedgerResult = { stats: { brain: true, body: true, heart: true } }
    advance()
    useGameStore.setState({ pendingLines: [], statusModal: null, statusShown: true })
    loopState.statusSteps = []; advance()
    expect(game().stats).toEqual(stats(2))
    expect(game().exTalents.growth).toEqual(legacy)
  })
})

describe('Stat-independent bonuses and old save compatibility', () => {
  it('projects through the registered hook repeatedly without spending points or changing the input', () => {
    useGameStore.setState({stats:stats(-100),exTalents:normalizeTalents({initialized:true,earned:1000,ranks:ranks(2)})})
    const before=game(), saved=JSON.stringify(before.toGameSave())
    const ledger={brain:true,body:true,heart:true}
    const ctx={solo:true,classScene:false,classOutcome:null,jobOutcome:null}
    const native=resolveStatDeltas(ledger,ctx)
    for(let i=0;i<3;i++) expect(settleSceneStats(native,{ledger,ctx}).deltas).toEqual(stats(4))
    expect(native.deltas).toEqual(stats(2))
    expect(game()).toBe(before)
    expect(JSON.stringify(game().toGameSave())).toBe(saved)
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    expect(settleSceneStats(native,{ledger,ctx})).toEqual(native)
  })
  it('gives the same full bonuses at every integer from -100 through +100', () => {
    const s = normalizeTalents({ initialized: true, earned: 1000, ranks: ranks(2) })
    const ctx = { solo: true, classScene: false, classOutcome: null, jobOutcome: null }
    for (let start = -100; start <= 100; start++) {
      const native = resolveStatDeltas({ brain: true, body: true, heart: true }, ctx)
      expect(talentStatGains(s, native, ctx, false, start).deltas).toEqual(stats(4))
    }
  })
  it('retains valid legacy fractions without changing current stats, BP or skill ranks', () => {
    expect(readTalentGrowth({ brain: -1, body: Infinity, heart: 1 })).toEqual(stats(0))
    expect(readTalentGrowth(null)).toBeUndefined()
    const s = normalizeTalents({ initialized: true, earned: 1000, spent: 80, ranks: ranks(1), growth: legacy, bpFraction: .5 })
    expect(normalizeTalents(JSON.parse(JSON.stringify(s)))).toEqual(s)
    expect(s).toMatchObject({ growth: legacy, earned: 1000, spent: 80, ranks: ranks(1), bpFraction: .5 })
  })
})
