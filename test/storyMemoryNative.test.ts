import { withOption } from '@shared/mods'
import { STORY_MEMORY_LIGHT_OPTION } from '@shared/storyMemory'
import { useModsStore } from '../src/renderer/stores/modsStore'
import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import {
  assertStoryRecall, formatStoryRecall, STORY_MEMORY_BUDGET, STORY_MEMORY_LIGHT_BUDGET,
  type StoryRecord, type StoryRecallRequest, withStoryRecall
} from '@shared/storyMemory'
import { calendarOf } from '@shared/semesters'
import { DEFAULT_MEMORY_BUDGETS } from '@shared/settingsRules'
import type { StructuredRequest } from '@shared/types'
import { recallFromSqlite } from '../src/main/services/storyMemoryIndex'
import { withNativeStoryRecall, withStoryExtraction } from '../src/renderer/prompts/storyMemoryPrompt'
import { recapLore } from '../src/renderer/prompts/recaps'
import { buildScenePrompt, buildContinuationPrompt, buildClosingPrompt, buildSoloPrompt, type PromptState } from '../src/renderer/prompts/scenePrompt'
import { buildTextingPrompt } from '../src/renderer/prompts/textingPrompt'
import { modRequest, setHookRules } from '../src/renderer/mods/hooks'
import '../src/renderer/modEntries/story-memory'
import { character, charInfo } from './fixtures'

const summary = 'Alex met the reader at the library.\nAlex promised to bring an atlas next time.'
const history = { 9: { 1: summary } }
const nativeRecap = () => recapLore('last night', 10, 0, history, 'spring')[0]
const request = (context = nativeRecap()): StructuredRequest => ({
  system: 'Native rules and world setting.', user: `LOREBOOK\n\n${context}\n\nYOUR TURN\nTalk.`,
  schema: { name: 'scene', schema: {} }, logFrom: 8
})
const fact = (id: string, over: Partial<StoryRecord> = {}): StoryRecord => ({
  id, kind: 'fact', subject: 'a', subjects: ['a'], category: 'promise',
  text: 'Alex promised to bring an atlas next time.', date: 9, time: 1,
  knownBy: ['reader', 'a'], public: false, timeline: 'current', certainty: 'event',
  claimant: null, evidence: 'I promise to bring an atlas next time.', source: 'scene',
  supersedes: [], manual: false, ...over
})
const encounter = (day: number, over: Partial<StoryRecord> = {}): StoryRecord => fact(`encounter:${day}:1`, {
  kind: 'encounter', subject: 'reader', category: undefined, date: day, text: `Alex visited the library on day ${day}.`,
  knownBy: [], timeline: 'unspecified', evidence: '', ...over
})
const payload = (over: Partial<StoryRecallRequest> = {}): StoryRecallRequest => ({
  playthroughId: '123', date: 10, time: 0, cast: ['a'], query: 'last night',
  names: { a: 'Alex', b: 'Bea', reader: 'The reader' },
  records: [encounter(9, { text: summary }), fact('promise')], ...over
})
const rows = (text: string) => text.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))

beforeEach(() => setHookRules({ isOn: id => id === 'story-memory', order: () => 0 }))
afterEach(() => setHookRules({ isOn: () => true, order: () => 0 }))

describe('Story Memory alongside native 0.6 recall', () => {
  it.each(['standard', 'light'] as const)('sends a native recap once, keeping the distinct promise and all saved data (%s)', mode => {
    const p = payload({ mode }), original = JSON.stringify(p), native = request()
    const prepared = withNativeStoryRecall(native, p, p.cast, p.query, 'spring')
    expect(prepared.storyMemory?.coveredEncounters).toEqual(['encounter:9:1'])
    const recall = formatStoryRecall({ ...prepared.storyMemory!, mode })
    expect(recall.included).toEqual(['promise'])
    const final = withStoryRecall(prepared, recall)
    const redundant = withStoryRecall({ ...native, storyMemory: p }, formatStoryRecall(p))
    expect(final.user.length).toBeLessThan(redundant.user.length)
    expect(final.user.split('Alex met the reader at the library.')).toHaveLength(2)
    expect(final.user).toContain('Alex promised to bring an atlas next time.')
    expect(final.system).toBe(native.system)
    expect(final.schema).toBe(native.schema)
    expect(final.logFrom).toBe(native.logFrom! + recall.text.length + 1)
    expect(final.user.endsWith('YOUR TURN\nTalk.')).toBe(true)
    expect(final).not.toHaveProperty('storyMemory')
    expect(JSON.stringify(p)).toBe(original)
  })

  it.each(['STORY SO FAR', 'SCENE SO FAR', 'RECENT MESSAGES', 'YOUR TURN'])(
    'does not mistake a recap quoted under %s for native recall', header => {
      const p = payload(), r = request('Unrelated campus lore.')
      r.user = `LOREBOOK\nUnrelated campus lore.\n${header}\n${nativeRecap()}`
      expect(withNativeStoryRecall(r, p, p.cast, '', 'spring').storyMemory?.coveredEncounters).toBeUndefined()
    })

  it('requires the complete matching date, time, wording and witness guard', () => {
    const p = payload()
    for (const text of [summary, 'Alex met the reader at the library.',
      nativeRecap().replace('promised', 'did not promise'), nativeRecap().replace('Night', 'Day'),
      nativeRecap().replace(' Only those who were there know what happened.', '')]) {
      expect(withNativeStoryRecall(request(text), p, p.cast, '', 'spring').storyMemory?.coveredEncounters).toBeUndefined()
    }
  })

  it('uses the active season and leaves no empty Story Memory block when native recall covers everything', () => {
    const p = payload({ records: [encounter(9, { text: summary })] })
    const fall = recapLore('last night', 10, 0, history, 'fall')[0]
    const r = withNativeStoryRecall(request(fall), p, p.cast, p.query, 'fall')
    expect(r.storyMemory?.coveredEncounters).toEqual(['encounter:9:1'])
    expect(withNativeStoryRecall(request(fall), p, p.cast, p.query, 'spring').storyMemory?.coveredEncounters).toBeUndefined()
    for (const mode of ['standard', 'light'] as const) {
      const recall = formatStoryRecall({ ...r.storyMemory!, mode })
      expect(recall.text).toBe('')
      expect(withStoryRecall(r, recall)).toEqual(request(fall))
    }
  })

  it.each(['standard', 'light'] as const)('keeps corrected and previous-semester recaps even when text overlaps (%s)', mode => {
    const p = payload({ mode, records: [encounter(9, { text: summary, manual: true }),
      encounter(-5, { id: 'term:0:encounter:9:1', text: summary, origin: { term: 0, day: 9 } })] })
    const r = withNativeStoryRecall(request(), p, p.cast, '', 'spring')
    expect(r.storyMemory?.coveredEncounters).toBeUndefined()
    // The shared formatter defensively preserves corrections even if a caller marks the ID covered.
    const recall = formatStoryRecall({ ...r.storyMemory!, mode, coveredEncounters: ['encounter:9:1'] })
    expect(recall.included).toContain('encounter:9:1')
    expect(recall.included).toContain('term:0:encounter:9:1')
  })

  it.each(['standard', 'light'] as const)('deduplicates exact facts while retaining knowledge, time, meaning and corrections (%s)', mode => {
    const base = fact('original')
    const variants: Partial<StoryRecord>[] = [
      { knownBy: ['a'] }, { certainty: 'claim', claimant: 'a' }, { timeline: 'alternate' },
      { date: 8 }, { public: true }, { manual: true }, { category: 'secret' },
      { text: 'Alex did not promise to bring an atlas next time.' }
    ]
    for (const over of variants) {
      const p = payload({ mode, records: [base, { ...base, id: 'duplicate', knownBy: ['a', 'reader'] }, fact('different', over)] })
      const result = formatStoryRecall(p)
      expect(result.included).toHaveLength(2)
      expect(result.included).toContain('different')
    }
  })

  it.each(['standard', 'light'] as const)('prioritizes cast milestones and promises over recent routine facts (%s)', mode => {
    const noise = Array.from({ length: 120 }, (_, i) => fact(`noise:${i}`, {
      category: 'other', text: `Alex admired ordinary campus decoration ${i}. `.repeat(12)
    }))
    const p = payload({ mode, query: '', records: [...noise,
      fact('old-promise', { date: 0 }),
      fact('first-kiss', { date: 1, category: 'relationship', text: 'Alex and the reader shared their first kiss.' }),
      fact('correction', { manual: true, category: 'other', text: 'Alex studies chemistry, not law.' })] })
    const recall = formatStoryRecall(p)
    expect(recall.included[0]).toBe('correction')
    expect(recall.included).toContain('old-promise')
    expect(recall.included).toContain('first-kiss')
    expect(recall.text.length).toBeLessThanOrEqual(mode === 'light' ? STORY_MEMORY_LIGHT_BUDGET : STORY_MEMORY_BUDGET)
    expect(rows(recall.text).find(r => (r.text ?? r.fact).includes('first kiss')).knownBy).toEqual(['The reader', 'Alex'])
  })

  it('ranks the ledger reference against this scene, so an old promise is available for a supported update', () => {
    const p = payload({ records: [...Array.from({ length: 100 }, (_, i) => fact(`unrelated:${i}`, {
      subject: 'b', subjects: ['b'], category: 'other', text: `Bea bought ordinary decoration ${i}. `.repeat(20)
    })), fact('old-promise', { date: 0 })] })
    const ledger = { ...request(), user: 'SCENE SO FAR\nAlex brought the atlas.',
      schema: { name: 'ledger', schema: { properties: {}, required: [] } } }
    const result = withStoryExtraction(ledger, p, ['alex'], { cast: ['a'] })
    expect(result.user).toContain('old-promise')
    expect(result.user).toContain('Never supersede a player correction')
    expect(result.user).toContain('Quote 12–600 exact characters')
    expect(result.schema.schema).toHaveProperty('properties.exStoryFacts')
  })

  it('validates request-only coverage metadata', () => {
    for (const bad of ['encounter:9:1', ['fact:1'], ['term:0:encounter:9:1'], [null]])
      expect(() => assertStoryRecall({ ...payload(), coveredEncounters: bad })).toThrow('native coverage')
    expect(() => assertStoryRecall({ ...payload(), coveredEncounters: ['encounter:9:1'] })).not.toThrow()
  })

  it('retains full SQLite indexing and topic fallback without padding native-covered recaps with unrelated older ones', () => {
    const db = new DatabaseSync(':memory:')
    try {
      for (const mode of ['standard', 'light'] as const) for (const cast of [['a'], ['a', 'b'], []]) {
        const p = payload({ mode, cast, query: 'telescope', records: [fact('promise'),
          encounter(0, { text: 'Alex repaired a telescope.' }),
          ...Array.from({ length: 9 }, (_, i) => encounter(i + 1))],
          coveredEncounters: ['encounter:9:1', 'encounter:8:1', 'encounter:7:1'] })
        const indexed = recallFromSqlite(db, p)
        expect(indexed.text).toBe(formatStoryRecall(p).text)
        expect(indexed.included).toContain('encounter:0:1')
        expect(indexed.included).not.toContain('encounter:6:1')
        expect(indexed.included).not.toContain('encounter:9:1')
        expect(db.prepare('SELECT COUNT(*) AS n FROM records').get()?.n).toBe(p.records.length)
        const uncovered = { ...p, coveredEncounters: [] }
        expect(recallFromSqlite(db, uncovered).included).toContain('encounter:9:1')
      }
    } finally { db.close() }
  })
})

describe('real native prompt builders', () => {
  const alex = character({ charId: 'a', firstName: 'Alex' })
  function state(): PromptState {
    return { playthroughId: '123', date: 10, time: 0, storyMemory: payload(),
      backgrounds: { interior: ['library'], exterior: ['quad'] }, lorebook: [],
      charInfo: { a: charInfo({ nameKnown: true, notes: 'Alex prefers quiet meetings.' }) },
      npcRelationships: {}, roster: [], classes: {}, playerSchedule: {}, classRosters: {},
      calendar: calendarOf('spring', [], {}), bg: null, classCode: null, projectClass: null,
      playerJob: null, jobId: null, visitJobId: null, giftNotes: [], emotions: {}, onStage: [],
      lessNsfwText: false, memoryBudgets: DEFAULT_MEMORY_BUDGETS, history,
      cgReady: {}, customCgReady: {}, outfitReady: {}, roomReady: {} }
  }
  it('reads ledger mode at dispatch, including override removal, without changing stored facts', () => {
    const before = useModsStore.getState().switches, s = state(), snapshot = structuredClone(s.storyMemory)
    const native = { ...request(), schema: { name: 'ledger', schema: { properties: {}, required: [] } } }
    const check = (mode: 'standard' | 'light') => {
      expect(modRequest('ledger', { state: s, charKeys: [] }, native))
        .toEqual(withStoryExtraction(native, s.storyMemory, [], { mode, cast: [] }))
      expect(s.storyMemory).toEqual(snapshot)
    }
    try {
      useModsStore.setState({ switches: { on: {}, options: {} } }); check('standard')
      useModsStore.setState({ switches: withOption(useModsStore.getState().switches, 'story-memory', STORY_MEMORY_LIGHT_OPTION, true) }); check('light')
      useModsStore.setState({ switches: withOption(useModsStore.getState().switches, 'story-memory', STORY_MEMORY_LIGHT_OPTION, false) }); check('standard')
      useModsStore.setState({ switches: { on: {}, options: {} } }); check('standard')
      setHookRules({ isOn: () => false, order: () => 0 })
      expect(modRequest('ledger', { state: s, charKeys: [] }, native)).toBe(native)
    } finally { useModsStore.setState({ switches: before }) }
  })
  it('recognizes native recall in opening, continuation, closing, solo and text requests', () => {
    const s = state(), action = 'Remember last night?'
    const native = [
      buildScenePrompt([alex], action, s, '', ''),
      buildContinuationPrompt([alex], action, [], s, '', '', null, 1),
      buildClosingPrompt([alex], [{ speaker: 'alex_rose', text: 'Remember last night?' }], s, '', '', null),
      buildSoloPrompt(action, s, '', ''),
      buildTextingPrompt(alex, s.charInfo.a, undefined, action, { ...s, memoryBudget: 2 }, '')
    ]
    for (const r of native) {
      expect(r.user).toContain(nativeRecap())
      expect(r.storyMemory?.coveredEncounters).toEqual(['encounter:9:1'])
      expect(formatStoryRecall(r.storyMemory!).included).toContain('promise')
      expect(formatStoryRecall(r.storyMemory!).included).not.toContain('encounter:9:1')
    }
    expect(native[0].user).toContain('Important notes on Alex: Alex prefers quiet meetings.')
    expect(native[4].user).toContain('Important notes on Alex: Alex prefers quiet meetings.')
  })
  it('leaves the native request intact when Story Memory is off', () => {
    const enabled = buildScenePrompt([alex], 'last night', state(), '', '')
    setHookRules({ isOn: () => false, order: () => 0 })
    const disabled = buildScenePrompt([alex], 'last night', state(), '', '')
    expect(disabled.storyMemory).toBeUndefined()
    expect(disabled.user).toBe(enabled.user)
    expect(disabled.system).toBe(enabled.system)
    expect(disabled.schema).toEqual(enabled.schema)
  })
})
