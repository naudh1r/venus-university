import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeTalents } from '@shared/campusTalents'
import { echoAffinity, normalizeEcho } from '@shared/echo'
import { affectionFor } from '@shared/relationship'
import type { CharInfo, LedgerResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { projectSlotMemories, slotSettled } from '../src/renderer/mods/hooks'
import { applyLedger, projectLedger } from '../src/renderer/stores/sceneSanitizer'
import { rollCrushSettle } from '../src/renderer/stores/loop/crushes'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { fetchEndingOpening } from '../src/renderer/stores/loop/hooks'
import { character, charInfo, stubApi, restoreApi } from './fixtures'
import '../src/renderer/modEntries/campus-talents'
import '../src/renderer/modEntries/echo'

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/stores/gameLoop')
const game = () => useGameStore.getState()
const ledger: LedgerResponse = { memories: [{ charKey: 'sarah_rose', type: 'loved', desc: 'their conversation' }] }
const cast = () => [game().characters.a]
const preview = (before = game(), after = projectLedger(before.charInfo, ledger, before.date).charInfo) =>
  projectSlotMemories({ before, closingCast: cast() }, after)
const affection = (info: Record<string, CharInfo>) => affectionFor(info.a, game().date, game().characters.a)
const switches = (talents: boolean, echo: boolean) => useModsStore.setState({ switches: { on: { 'campus-talents': talents, echo }, options: {} } })

beforeEach(() => {
  game().reset(); resetLoopState(); switches(true, true)
  stubApi({ jobs: { onProgress: () => () => {} } })
  useGameStore.setState({
    playthroughId: 'affection-projection-test', date: 7, time: 0,
    characters: { a: character({ charId: 'a', preferredStat: 'heart' }) }, chars: ['a'], cast: ['a'],
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo({ flags: { ...charInfo().flags, hasMet: true } }) },
    stats: { brain: 60, body: 60, heart: 60 },
    exTalents: normalizeTalents({ initialized: true, earned: 500, ranks: {
      'heart.spark': 3, 'heart.warmth': 3, 'heart.group': 2, 'heart.text': 2, 'heart.gift': 2, 'heart.grace': 2,
      matching: 3, neutral: 2, competing: 3, 'heart.anticipation': 1
    } }),
    exEcho: normalizeEcho({ player: { aspect: 'daylark', name: 'Player' }, girls: { a: { aspect: 'daylark', name: 'Partner' } } })
  })
  loopState.closingCast = cast()
})
afterEach(() => { resetLoopState(); restoreApi(); vi.restoreAllMocks() })

describe('affection before the crush roll', () => {
  it('uses 14.56 rather than 8 for the same 30% crush roll, without changing the live state', () => {
    const before = game(), original = JSON.stringify(before.toGameSave())
    const raw = projectLedger(before.charInfo, ledger, before.date).charInfo
    const weighted = preview(before, raw)
    vi.spyOn(Math, 'random').mockReturnValue(.30)
    expect(affection(raw)).toBe(8)
    expect(affection(weighted)).toBeCloseTo(14.56)
    expect(rollCrushSettle(ledger, raw)).toEqual([])
    expect(rollCrushSettle(ledger, weighted)).toEqual(['a'])
    expect(game()).toBe(before)
    expect(JSON.stringify(game().toGameSave())).toBe(original)
    applyLedger(ledger)
    slotSettled({ before, ledger, closingCast: cast() })
    expect(game().charInfo.a.memories).toEqual(weighted.a.memories)
    expect(affection(game().charInfo)).toBeCloseTo(14.56)
    expect(game().exTalents.earned).toBe(501) // 2 base BP × the current-stat rate of .7, with .4 retained.
    expect(game().exTalents.bpFraction).toBeCloseTo(.4)
    const settled = JSON.stringify(game().toGameSave())
    slotSettled({ before, ledger, closingCast: cast() })
    expect(JSON.stringify(game().toGameSave())).toBe(settled)
  })

  it.each([[true, true, 14.56], [true, false, 10.4], [false, true, 10], [false, false, 8]] as const)(
    'matches settlement with talents=%s and Echoes=%s', (talents, echo, expected) => {
      switches(talents, echo)
      const before = game(), weighted = preview()
      expect(affection(weighted)).toBeCloseTo(expected)
      applyLedger(ledger); slotSettled({ before, ledger, closingCast: cast() })
      expect(affection(game().charInfo)).toBeCloseTo(expected)
    }
  )

  it('the actual ending banks its crush using the weighted projection', async () => {
    // The tutorial opening is authored, avoiding any AI call while exercising the real pipeline.
    useGameStore.setState({ date: 0, time: 0, semesterIndex: 0 })
    loopState.pendingLedgerResult = ledger
    vi.spyOn(Math, 'random').mockReturnValue(.30)
    const before = game()
    const opening = await fetchEndingOpening(ledger)
    expect(opening?.crushes).toEqual(['a'])
    expect(opening?.lines).toEqual([])
    expect(game()).toBe(before)
    expect(game().charInfo.a.flags?.hasCrush).not.toBe(true)
  })

  it('previews Anticipation once without consuming it or paying BP, then commits it once', () => {
    useGameStore.setState({ exTalents: { ...game().exTalents, abilities: {
      ...game().exTalents.abilities, anticipation: { a: { term: 0, date: 6, time: 1 } }
    } } })
    const before = game(), two: LedgerResponse = { memories: [...ledger.memories!, { charKey: 'sarah_rose', type: 'loved', desc: 'a second moment' }] }
    const raw = projectLedger(before.charInfo, two, 7).charInfo
    const first = preview(before, raw), second = preview(before, first)
    expect(affection(first)).toBeCloseTo(17.36 + 14.56)
    expect(second).toEqual(first)
    expect(game().exTalents).toBe(before.exTalents)
    expect(game().exTalents.abilities.anticipation.a).toBeDefined()
    applyLedger(two); slotSettled({ before, ledger: two, closingCast: cast() })
    expect(game().charInfo.a.memories).toEqual(first.a.memories)
    expect(game().exTalents.abilities.anticipation.a).toBeUndefined()
  })

  it('preserves old weights and separates group, text, gift, disliked and hated memories', () => {
    const old = { date: 6, type: 'loved' as const, desc: 'old', talentHeartMultiplier: 1.1 }
    useGameStore.setState({ charInfo: { a: charInfo({ memories: [old] }) } })
    const before = game(), after = { a: charInfo({
      memories: [old, { date: 7, type: 'loved', desc: 'scene' }, { date: 7, type: 'disliked', desc: 'disliked' }, { date: 7, type: 'hated', desc: 'hated' }],
      textMemory: { date: 7, type: 'loved', desc: 'text' }, giftMemories: [{ date: 7, type: 'loved', desc: 'gift' }]
    }) }
    const closingCast = [...cast(), character({ charId: 'b' })]
    const weighted = projectSlotMemories({ before, closingCast }, after)
    expect(weighted.a.memories[0]).toBe(old)
    expect(weighted.a.memories[1].talentHeartMultiplier).toBeCloseTo(1.4)
    expect(weighted.a.memories[2].talentHeartMultiplier).toBe(.8)
    expect(weighted.a.memories[3].talentHeartMultiplier).toBe(1)
    expect(weighted.a.textMemory?.talentHeartMultiplier).toBeCloseTo(1.4)
    expect(weighted.a.giftMemories?.[0].talentHeartMultiplier).toBe(1.5)
    expect(after.a.memories[1].talentHeartMultiplier).toBeUndefined()
    useGameStore.setState({ charInfo: after }); slotSettled({ before, ledger: null, closingCast })
    expect(game().charInfo).toEqual(weighted)
  })

  it.each(['neutral', 'competing'] as const)('previews %s Echo affinity exactly as saved', affinity => {
    const aspect = affinity === 'competing' ? 'veilkeeper' : 'hearthwarden'
    useGameStore.setState({ exEcho: normalizeEcho({ ...game().exEcho, girls: { a: { aspect, name: 'Partner' } } }) })
    expect(echoAffinity(game().exEcho, 'a')).toBe(affinity)
    const before = game(), weighted = preview()
    expect(affection(weighted)).toBeCloseTo(affinity === 'neutral' ? 11.44 : 10.4)
    applyLedger(ledger); slotSettled({ before, ledger, closingCast: cast() })
    expect(weighted.a.memories).toEqual(game().charInfo.a.memories)
  })

  it('does not seed talent currency or assign live Echoes while previewing an older save', () => {
    useGameStore.setState({ exTalents: normalizeTalents({}), exEcho: normalizeEcho({}) })
    const before = game(), weighted = preview()
    expect(game()).toBe(before)
    expect(game().exTalents.initialized).toBe(false)
    expect(game().exEcho.player).toBeNull()
    applyLedger(ledger); slotSettled({ before, ledger, closingCast: cast() })
    expect(game().charInfo.a.memories).toEqual(weighted.a.memories)
  })

  it.each(['replaying', 'createdScene'] as const)('leaves %s previews untouched', field => {
    const before = { ...game(), [field]: {} } as ReturnType<typeof game>
    const after = projectLedger(before.charInfo, ledger, 7).charInfo
    expect(projectSlotMemories({ before, closingCast: cast() }, after)).toBe(after)
  })
})
