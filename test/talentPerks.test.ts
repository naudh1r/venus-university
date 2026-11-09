import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeTalents, setTalentRules, type TalentState } from '@shared/campusTalents'
import { talentAssessment, talentColdProtection, talentHeartBonus, talentHeartMultiplier, talentProjectWork, talentStatGains } from '@shared/talentPerks'
import { affectionOf } from '@shared/relationship'
import { challengeStatFloor } from '@shared/startingChallenge'
import { applyStatDeltas, resolveStatDeltas, type StatContext } from '@shared/playerStats'
import { coldPassOf, COLD_READER, type ColdPassInput } from '@shared/colds'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { slotSettled } from '../src/renderer/mods/hooks'
import '../src/renderer/modEntries/campus-talents'
import { workedOn } from '../src/renderer/prompts/classProgress'
import { recordAcademics } from '../src/renderer/stores/loop/academics'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { charInfo, character, classEntry } from './fixtures'
import type { CharMemory } from '@shared/types'

const state = (ranks: TalentState['ranks'] = {}) => normalizeTalents({initialized: true, earned: 500, seed: 500, ranks})
const game = () => useGameStore.getState()
const memory = (type: CharMemory['type'], desc: string = type): CharMemory => ({type, desc, date: 7})
const ctx = (over: Partial<StatContext> = {}): StatContext => ({solo: true, classScene: false, classOutcome: null, jobOutcome: null, ...over})

beforeEach(() => {
  game().reset(); resetLoopState()
  useModsStore.setState({switches: {on: {'campus-talents': true, echo: false, breakthrough: false}, options: {}}})
})
afterEach(() => setTalentRules())

describe('Heart awards', () => {
  it('stamps new scene, text and gift memories independently of Echo without multiplying BP or old affection', () => {
    const a = character({charId: 'a'}), b = character({charId: 'b'})
    const old = {...memory('loved', 'Old'), date: 6}
    const talents = state({'heart.warmth': 3, 'heart.spark': 3, 'heart.group': 2, 'heart.gift': 2, 'heart.text': 2, 'heart.grace': 2})
    useGameStore.setState({playthroughId: 'heart-test', date: 7, time: 0, chars: ['a','b'], cast: ['a','b'],
      characters: {a, b}, charInfo: {a: charInfo({memories: [old]}), b: charInfo()}, exTalents: talents})
    const before = game()
    useGameStore.setState({charInfo: {a: charInfo({memories: [old, memory('loved'), memory('disliked'), memory('hated')],
      textMemory: memory('liked', 'Text'), giftMemories: [memory('loved', 'Gift')]}), b: charInfo({memories: [memory('liked')]})}})
    slotSettled({before, ledger: null, closingCast: [a, b]})
    const info = game().charInfo.a
    expect(info.memories[0]).toEqual(old)
    expect(info.memories[1].talentHeartMultiplier).toBeCloseTo(1.4)
    expect(info.memories[2].talentHeartMultiplier).toBe(.8)
    expect(info.memories[3].talentHeartMultiplier).toBe(1)
    expect(info.textMemory?.talentHeartMultiplier).toBeCloseTo(1.25)
    expect(info.giftMemories?.[0].talentHeartMultiplier).toBe(1.5)
    expect(affectionOf([info.memories[1]], 7)).toBeCloseTo(affectionOf([memory('loved')], 7) * 1.4)
    expect(game().exTalents.earned).toBe(506)
    slotSettled({before, ledger: null, closingCast: [a, b]})
    expect(game().exTalents.earned).toBe(506)
    expect(game().charInfo.a).toEqual(info)
    setTalentRules(false)
    expect(affectionOf([info.memories[1]], 7)).toBe(affectionOf([memory('loved')], 7))
    setTalentRules(true)
    expect(talentHeartMultiplier(info.memories[1])).toBeCloseTo(1.4)
  })
  it('limits group bonuses to scene memories, preserves severe reactions and rejects invalid saved factors', () => {
    const s = state({'heart.group': 2, 'heart.grace': 2})
    expect(talentHeartBonus(s, memory('liked'), 'scene', true)).toBe(1.1)
    expect(talentHeartBonus(s, memory('liked'), 'scene', false)).toBe(1)
    expect(talentHeartBonus(s, memory('liked'), 'text', true)).toBe(1)
    expect(talentHeartBonus(s, memory('hated'), 'scene', true)).toBe(1)
    for (const n of [NaN, Infinity, -1, 50]) expect(talentHeartMultiplier({...memory('liked'), talentHeartMultiplier: n})).toBe(1)
    expect(talentHeartMultiplier({...memory('hated'), talentHeartMultiplier: .8})).toBe(1)
  })
})

describe('Training and challenge stats', () => {
  const s = state({'brain.focus': 2, 'brain.notes': 1, 'body.training': 2, 'body.partner': 1, 'body.pe': 1, 'body.shift': 1})
  const resolve = (context: StatContext, pe = false) => talentStatGains(s, resolveStatDeltas({brain: true, body: true}, context), context, pe)
  it('boosts actual solo gains and recovers negative stats without resetting their floor or adding free stats', () => {
    const gained = resolve(ctx())
    expect(gained.deltas).toEqual({brain: 4, body: 4, heart: 0})
    expect(applyStatDeltas({brain: -60, body: -60, heart: -60}, gained.deltas, key => challengeStatFloor('rock-bottom', key))).toEqual({brain: -56, body: -56, heart: -60})
    const native = resolveStatDeltas(undefined, ctx())
    expect(talentStatGains(s, native, ctx(), false).deltas).toEqual(native.deltas)
    expect(resolve(ctx({sick: true, gradeOutcome: {heart: 2, lines: []}})).deltas).toEqual({brain: 0, body: 0, heart: 2})
  })
  it('keeps work, PE, class and company bonuses exclusive and honors the native first-stat limit', () => {
    expect(resolve(ctx({solo: false, classScene: true, classOutcome: {stat: 'brain', attended: true}})).deltas).toEqual({brain: 2, body: 0, heart: 0})
    expect(resolve(ctx({solo: false, classScene: true, classOutcome: {stat: 'body', attended: true}}), true).deltas.body).toBe(2)
    const work = ctx({jobOutcome: {gain: {stats: ['body'], text: 'Work'}}})
    expect(resolve(work).deltas).toEqual({brain: 0, body: 2, heart: 0})
    const company = ctx({solo: false})
    expect(resolve(company).deltas).toEqual({brain: 1, body: 0, heart: 0})
    expect(talentStatGains(s, resolveStatDeltas({body: true}, company), company, false).deltas.body).toBe(2)
    setTalentRules(false)
    expect(resolve(ctx()).deltas).toEqual(resolveStatDeltas({brain: true, body: true}, ctx()).deltas)
  })
})

describe('Academic progress and grades', () => {
  it('banks extra project work once per slot, keeps old sessions native and preserves earned progress across toggles and reloads', () => {
    useGameStore.setState({exTalents: state({'brain.method': 2, 'brain.cram': 1})})
    expect(talentProjectWork(game().exTalents, 0)).toBe(1.5)
    expect(talentProjectWork(game().exTalents, 1)).toBe(2)
    game().recordProjectWork('ART', 'midterm', 7, 0, 'Day work')
    game().recordProjectWork('ART', 'midterm', 7, 1, 'Night work')
    game().recordProjectWork('ART', 'midterm', 7, 1, 'Retry')
    expect(workedOn(game().classRecords.ART, 'midterm')).toBe(3.5)
    setTalentRules(false)
    game().recordProjectWork('ART', 'midterm', 8, 0)
    const reloaded = JSON.parse(JSON.stringify(game().classRecords.ART))
    expect(workedOn(reloaded, 'midterm')).toBe(4.5)
    expect(reloaded.midtermProject.sessions).toHaveLength(3)
    expect(workedOn({meetings: [], midtermProject: {sessions: [{date: 1, time: 0}, {date: 2, time: 0, talentWorkUnits: 999}]}}, 'midterm')).toBe(2)
  })
  it('preserves missing assessments and unfinished-work ceilings', () => {
    const s = state({'brain.exam': 3, 'brain.polish': 3})
    expect(talentAssessment(s, 0, 'exam', false, true, true)).toBe(0)
    expect(talentAssessment(s, 0, 'showcase', true, false, false)).toBe(0)
    expect(talentAssessment(s, 95, 'exam', true, true, false)).toBe(99)
    expect(talentAssessment(s, 95, 'showcase', true, true, true)).toBe(100)
    setTalentRules(false)
    expect(talentAssessment(s, 20, 'exam', true, true, true)).toBe(20)
  })
  it('applies the exam bonus exactly once to the real grade ledger, leaving the negative-Brain debt intact', () => {
    const entry = classEntry({slot: 1, difficulty: 'easy'})
    useGameStore.setState({classes: {[entry.code]: entry}, playerSchedule: {1: entry.code}, date: 42, time: 1,
      stats: {brain: -30, body: -30, heart: -30}, exTalents: state({'brain.exam': 3}), sceneClass: entry.code,
      classRecords: {[entry.code]: {meetings: [], midterm: {asked: 3, correct: 3}}}})
    recordAcademics(null)
    expect(game().classRecords[entry.code].midtermScore).toBe(29)
    useGameStore.setState({stats: {brain: 100, body: 100, heart: 100}})
    recordAcademics(null)
    expect(game().classRecords[entry.code].midtermScore).toBe(29)
  })
  it('scores an attended showcase from banked work with its own bonus and never recalculates a frozen result', () => {
    const entry = classEntry({slot: 3, kind: 'project', difficulty: 'hard'})
    useGameStore.setState({classes: {[entry.code]: entry}, playerSchedule: {3: entry.code}, date: 43, time: 1,
      sceneClass: entry.code, stats: {brain: 0, heart: 0, body: 0}, exTalents: state({'brain.polish': 3}),
      classRecords: {[entry.code]: {meetings: [], midtermProject: {sessions: Array.from({length: 4}, (_, i) => ({date: i + 2, time: 1 as const, talentWorkUnits: 2}))}}}})
    recordAcademics(null)
    expect(game().classRecords[entry.code].midtermScore).toBe(59)
    expect(game().classRecords[entry.code].midtermHeartTier).toBeUndefined()
    setTalentRules(false); recordAcademics(null)
    expect(game().classRecords[entry.code].midtermScore).toBe(59)
  })
})

describe('Player cold resistance', () => {
  const cold = {strain: 4, since: 10, incubation: 2}
  const input: ColdPassInput = {slot: 14, seedable: false, present: ['a'], girls: {a: {cold}}, reader: {}, bodyTier: 1,
    contacts: [{kind: 'private', members: [COLD_READER, 'a']}]}
  it('reduces player contact infections and keeps NPC-only transmission unchanged', () => {
    const protection = talentColdProtection(state({'body.resist': 3}))
    expect(coldPassOf(input, () => .4).reader).toBeDefined()
    expect(coldPassOf({...input, ...protection}, () => .4).reader).toBeUndefined()
    const npc = {...input, reader: {cold}, girls: {a: {}}}
    expect(coldPassOf({...npc, ...protection}, () => .4)).toEqual(coldPassOf(npc, () => .4))
    setTalentRules(false)
    expect(talentColdProtection(state({'body.resist': 3, 'body.mild': 2}))).toEqual({readerCatchFactor: 1, readerMildBonus: 0})
  })
  it('makes only newly caught player colds more likely to be mild', () => {
    expect(coldPassOf(input, () => .4).reader?.mild).toBeUndefined()
    const after = coldPassOf({...input, ...talentColdProtection(state({'body.mild': 2}))}, () => .4)
    expect(after.reader?.mild).toBe(true)
    expect(input.girls.a?.cold).toEqual(cold)
    expect(coldPassOf({...input, reader: {cold}, ...talentColdProtection(state({'body.mild': 2}))}, () => .4).reader).toBeUndefined()
  })
})
