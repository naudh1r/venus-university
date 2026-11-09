import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { STAT_KEYS } from '@shared/playerStats'
import { blocksNewRomance, registerRomanceRequirement, romanceMinimumsOf } from '@shared/romanceRequirements'
import { setSharedModRules } from '@shared/modRules'
import { crushChance, crushHintUpdate, emptyFlags, foldRelationshipEvents, meetsCrushStandards } from '@shared/relationship'
import type { LedgerResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { relationshipLines } from '../src/renderer/prompts/relationship'
import { applyLedger, ledgerActs, projectLedger } from '../src/renderer/stores/sceneSanitizer'
import { rollCrushSettle } from '../src/renderer/stores/loop/crushes'
import { character, charInfo } from './fixtures'

const allGodly = { brain: 100, body: 100, heart: 100 }
const gatedCharacter = character({ charId: 'a', traits: ['Materialist'], preferredStat: 'heart' })
const game = () => useGameStore.getState()
let on = false
const setOn = (value: boolean) => { on = value; setSharedModRules(id => id === 'test-romance' && on) }
registerRomanceRequirement('test-romance', who => who?.traits?.includes('Materialist') ? allGodly : null)
const ledger: LedgerResponse = {
  memories: [{ charKey: 'sarah_rose', type: 'loved', desc: 'their conversation' }],
  events: [{ charKey: 'sarah_rose', event: 'became_lovers' }],
  acts: [{ kind: 'kiss', chars: ['sarah_rose'], inPublic: false }]
}

beforeEach(() => {
  game().reset(); setOn(true)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  useGameStore.setState({
    date: 7, characters: { a: gatedCharacter }, chars: ['a'], cast: ['a'],
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo() },
    stats: { brain: 100, body: 99, heart: 100 }
  })
})
afterEach(() => { setSharedModRules(() => false); vi.restoreAllMocks() })

describe('additive romance requirements', () => {
  it.each([false, true])('combines by maximum, independent of registration order (reverse=%s)', reverse => {
    const rules = [
      ['test-a', { brain: 60, body: 35 }],
      ['test-b', { brain: 100, heart: 15 }]
    ] as const
    for (const [id, rule] of reverse ? [...rules].reverse() : rules) {
      registerRomanceRequirement(id, () => rule)
    }
    setSharedModRules(id => id === 'test-a' || id === 'test-b')
    expect(romanceMinimumsOf(gatedCharacter)).toEqual({ brain: 100, body: 35, heart: 15 })
  })

  it('ignores non-finite answers and does not call disabled providers', () => {
    const disabled = vi.fn(() => ({ brain: 1000 }))
    registerRomanceRequirement('test-disabled', disabled)
    registerRomanceRequirement('test-invalid', () => ({ brain: NaN, body: Infinity, heart: 15 }))
    setSharedModRules(id => id === 'test-invalid')
    expect(romanceMinimumsOf(gatedCharacter)).toEqual({ heart: 15 })
    expect(disabled).not.toHaveBeenCalled()
    expect(blocksNewRomance(gatedCharacter, { brain: 0, body: 0, heart: NaN })).toBe(true)
  })

  it('has no optional requirements without an enabled registration', () => {
    setSharedModRules(() => false)
    expect(romanceMinimumsOf(gatedCharacter)).toEqual({})
    expect(blocksNewRomance(gatedCharacter, { brain: 0, body: 0, heart: 0 })).toBe(false)
  })

  it.each(STAT_KEYS)('rejects one deficient %s even with high affection and the other stats above Godly', key => {
    const stats = { brain: 180, body: 180, heart: 180, [key]: 99.99 }
    expect(meetsCrushStandards(gatedCharacter, stats)).toBe(false)
    expect(crushChance(gatedCharacter, stats, 10000)).toBe(0)
    expect(blocksNewRomance(gatedCharacter, stats)).toBe(true)
  })

  it.each([-100, -80, -60, -30, -15, 0, 15, 35, 60, 99])('blocks the %s starting/progress value', value => {
    expect(meetsCrushStandards(gatedCharacter, { brain: value, body: 100, heart: 100 })).toBe(false)
  })

  it('opens eligibility at exactly 100 in every stat, keeping the normal affection-based chance', () => {
    expect(meetsCrushStandards(gatedCharacter, allGodly)).toBe(true)
    expect(crushChance(gatedCharacter, allGodly, 0)).toBeCloseTo(.4)
    expect(crushChance(gatedCharacter, allGodly, 50)).toBe(1)
    expect(game().charInfo.a.flags.isLover).toBe(false)
  })

  it('takes precedence over High Standards and every preferred-stat selection', () => {
    for (const preferredStat of STAT_KEYS) {
      const who = character({ traits: ['Materialist', 'High Standards'], preferredStat })
      expect(meetsCrushStandards(who, { brain: 99, body: 100, heart: 100 })).toBe(false)
      expect(meetsCrushStandards(who, allGodly)).toBe(true)
    }
  })

  it('uses the ordinary rules for untagged characters and while the mod is off', () => {
    const stats = { brain: 0, body: 0, heart: 35 }
    expect(meetsCrushStandards(character(), stats)).toBe(true)
    expect(meetsCrushStandards(character({ traits: ['High Standards'] }), stats)).toBe(false)
    setOn(false)
    expect(meetsCrushStandards(gatedCharacter, stats)).toBe(true)
    expect(gatedCharacter.traits).toEqual(['Materialist'])
    expect(relationshipLines(gatedCharacter, emptyFlags(), true, 0, undefined, stats).join(' ')).not.toContain('requires Brain')
    setOn(true)
    expect(meetsCrushStandards(gatedCharacter, stats)).toBe(false)
  })

  it('reports Godly for the missing stat, then acknowledges all three when qualified', () => {
    const hint = crushHintUpdate('Sarah', gatedCharacter, game().stats, undefined)
    expect(hint.line).toContain('Body needs to be at least Godly')
    expect(crushHintUpdate('Sarah', gatedCharacter, allGodly, hint.hint).line).toContain('Brain, Body, and Heart seem to have caught')
    expect(crushHintUpdate('Sarah', gatedCharacter, game().stats, { met: true }).line).toContain('Body needs to be at least Godly')
  })

  it('the actual crush roll and a banked/direct award cannot bypass the gate', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const projected = projectLedger(game().charInfo, { memories: ledger.memories }, 7).charInfo
    expect(rollCrushSettle({ memories: ledger.memories }, projected)).toEqual([])
    game().setCrush('a')
    expect(game().charInfo.a.flags.hasCrush).toBe(false)
    useGameStore.setState({ stats: allGodly })
    expect(rollCrushSettle({ memories: ledger.memories }, projected)).toEqual(['a'])
    game().setCrush('a')
    expect(game().charInfo.a.flags.hasCrush).toBe(true)
  })

  it('blocks AI milestones and acts in both the ending projection and the saved result, keeping friendship', () => {
    const projected = projectLedger(game().charInfo, ledger, 7).scene.a
    expect(projected.flags.isLover).toBe(false)
    expect(projected.flags.hasKissed).toBe(false)
    expect(projected.memories).toHaveLength(1)
    expect(ledgerActs(ledger)).toEqual([])
    applyLedger(ledger)
    expect(game().charInfo.a.flags).toEqual(projected.flags)
    expect(game().charInfo.a.memories).toEqual(projected.memories)
    game().applyRelationshipEvents('a', ['kissed', 'sex', 'became_lovers', 'agreed_to_harem'])
    expect(game().charInfo.a.flags).toMatchObject({ isLover: false, hasKissed: false, hadSex: false, benefits: false, harem: false })
  })

  it('allows the same ending once the requirements are met', () => {
    useGameStore.setState({ stats: allGodly })
    const projected = projectLedger(game().charInfo, ledger, 7).scene.a
    applyLedger(ledger)
    expect(projected.flags).toMatchObject({ isLover: true, hasKissed: true })
    expect(game().charInfo.a.flags).toEqual(projected.flags)
    expect(ledgerActs(ledger)).toHaveLength(1)
  })

  it('does not turn a blocked group act into a different act with the remaining character', () => {
    useGameStore.setState({
      characters: { a: gatedCharacter, b: character({ charId: 'b' }) },
      charKeyToId: { sarah_rose: 'a', other_person: 'b' },
      charInfo: { a: charInfo(), b: charInfo() }
    })
    const group: LedgerResponse = { acts: [{ kind: 'sex', chars: ['sarah_rose', 'other_person'], inPublic: false }] }
    expect(ledgerActs(group)).toEqual([])
    const projected = projectLedger(game().charInfo, group, 7).scene
    expect(projected.a.flags.hadSex).toBe(false)
    expect(projected.b.flags.hadSex).toBe(false)
  })

  it('leaves established lovers alone at lower stats, but does not bypass a new romance after breakup', () => {
    const info = charInfo({ flags: { ...emptyFlags(), isLover: true, hasMet: true } })
    const stats = { brain: 60, body: 60, heart: 60 }
    const ctx = { character: gatedCharacter, stats }
    expect(blocksNewRomance(gatedCharacter, stats, info.flags)).toBe(false)
    expect(foldRelationshipEvents(info, ['kissed'], 7, ctx).flags).toMatchObject({ isLover: true, hasKissed: true })
    expect(foldRelationshipEvents(info, ['broke_up', 'became_lovers', 'sex'], 7, ctx).flags).toMatchObject({ isLover: false, hadSex: false })
    expect(relationshipLines(gatedCharacter, info.flags, true, 50, info, stats).join(' ')).not.toContain('requires Brain')
  })

  it('allows nonromantic events while locked', () => {
    game().applyRelationshipEvents('a', ['gave_contact_info', 'unblocked', 'friendzoned_reader'])
    expect(game().charInfo.a.flags).toMatchObject({ gaveContactInfo: true, blocked: false, friendZonedBy: true })
  })

  it('does not contradict the requirement on a Promiscuous day or after an old crush', () => {
    const who = character({ traits: ['Materialist', 'Promiscuous', 'Mood-swings'] })
    const flags = { ...emptyFlags(), hasCrush: true, benefits: true, hasMet: true }
    const lines = relationshipLines(who, flags, true, 999, undefined, game().stats,
      { texting: true, texted: true }, { date: 6, offset: 7 }).join(' ')
    expect(lines).toContain('Brain at Godly, Body at Godly and Heart at Godly')
    expect(lines).toContain('will not initiate or accept')
    expect(lines).not.toContain('down to fuck')
    expect(lines).not.toContain('friends with benefits')
    expect(flags.hasCrush).toBe(true)
  })

  it('preserves the native created-scene attraction override', () => {
    const lines = relationshipLines(gatedCharacter, emptyFlags(), true, 0, undefined, game().stats,
      { texting: false, texted: false }, undefined, false).join(' ')
    expect(lines).not.toContain('requires Brain')
  })

})
