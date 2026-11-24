import { describe, expect, it } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { optionOn, withOption } from '@shared/mods'
import {
  formatStoryRecall, lightStoryFacts, STORY_MEMORY_LIGHT_BUDGET, STORY_MEMORY_LIGHT_OPTION,
  type StoryRecallRequest, type StoryRecord
} from '@shared/storyMemory'
import { recallFromSqlite } from '../src/main/services/storyMemoryIndex'
import { withStoryExtraction } from '../src/renderer/prompts/storyMemoryPrompt'

function fact(id: string, over: Partial<StoryRecord> = {}): StoryRecord {
  return { id, kind: 'fact', subject: 'a', subjects: ['a'], category: 'promise',
    text: `Alex promised to return library book ${id}.`, date: 1, time: 0,
    knownBy: ['reader', 'a'], public: false, timeline: 'current', certainty: 'event',
    claimant: null, evidence: 'I promise to return this book.', source: 'scene', supersedes: [],
    manual: false, ...over }
}
function payload(): StoryRecallRequest {
  return { playthroughId: '123', date: 50, time: 0, cast: ['a'], query: 'library book',
    names: { a: 'Alex', b: 'Bea', reader: 'The reader' },
    records: [fact('promise'),
      fact('unrelated', { subject: 'b', subjects: ['b'], category: 'other', text: 'Bea bought new shoes.' }),
      ...Array.from({ length: 4 }, (_, i) => fact(`encounter:${i}:0`, {
        kind: 'encounter', subject: 'reader', text: 'Alex waited by the library. '.repeat(80),
        knownBy: [], date: i + 1
      }))] }
}
const rows = (text: string) => text.split('\n').filter(s => s.startsWith('{')).map(s => JSON.parse(s))

describe('optional light story memory', () => {
  it('defaults to standard and stores its toggle outside the playthrough', () => {
    const before = { on: {}, options: {} }
    expect(optionOn(before, 'story-memory', STORY_MEMORY_LIGHT_OPTION)).toBe(false)
    const on = withOption(before, 'story-memory', STORY_MEMORY_LIGHT_OPTION, true)
    expect(optionOn(on, 'story-memory', STORY_MEMORY_LIGHT_OPTION)).toBe(true)
    expect(before).toEqual({ on: {}, options: {} })
    const p = payload()
    expect(formatStoryRecall(p)).toEqual(formatStoryRecall({ ...p, mode: 'standard' }))
  })
  it('reduces large recaps without altering any stored source or corrected text', () => {
    const p = payload(), before = JSON.stringify(p)
    const light = formatStoryRecall({ ...p, mode: 'light' })
    expect(light.text.length).toBeLessThan(formatStoryRecall(p).text.length * .6)
    expect(light.text.length).toBeLessThanOrEqual(STORY_MEMORY_LIGHT_BUDGET)
    expect(light.included).toContain('promise')
    expect(light.included).not.toContain('unrelated')
    expect(JSON.stringify(p)).toBe(before)
    expect(formatStoryRecall(p).included).toContain('unrelated')
  })
  it('keeps knowledge, claims, corrections and prior-semester provenance explicit', () => {
    const p = payload()
    p.records = [fact('claim', { text: 'Alex says Bea has the atlas.', certainty: 'claim',
      claimant: 'a', knownBy: ['a'], manual: true, origin: { term: 0, day: 6 }, timeline: 'alternate' }),
      fact('narrator', { text: 'Alex hides a letter.', knownBy: [] })]
    const text = formatStoryRecall({ ...p, mode: 'light' }).text
    expect(text).toContain('Empty knownBy and all encounter excerpts are narrator-only')
    const claim = rows(text).find(r => r.certainty === 'claim')
    expect(claim).toMatchObject({ knownBy: ['Alex'], claimant: 'Alex', playerCorrection: true,
      originalSemester: 1, originalDay: 6, timeline: 'alternate', public: false })
    expect(rows(text).find(r => r.fact === 'Alex hides a letter.').knownBy).toEqual([])
  })
  it('deduplicates identical facts without merging different knowledge scopes', () => {
    const p = payload()
    p.records = [fact('one'), fact('two', { text: fact('one').text }),
      fact('three', { text: fact('one').text, knownBy: ['a'] })]
    const light = formatStoryRecall({ ...p, mode: 'light' })
    expect(light.included).toHaveLength(2)
    expect(rows(light.text).map(r => r.knownBy)).toEqual([['reader', 'a'].map(id => p.names[id]), ['Alex']])
  })
  it('prioritizes relevant corrections over a large collection of routine facts', () => {
    const p = payload()
    p.records = [...Array.from({ length: 100 }, (_, i) => fact(`noise:${i}`, { text: 'Routine detail. '.repeat(40) })),
      fact('corrected', { manual: true, text: 'Alex did NOT return the library book.' })]
    const r = formatStoryRecall({ ...p, mode: 'light' })
    expect(r.included[0]).toBe('corrected')
    expect(r.text).toContain('Alex did NOT return the library book.')
    expect(r.text.length).toBeLessThanOrEqual(STORY_MEMORY_LIGHT_BUDGET)
  })
  it('keeps exact sentences and labels all recaps as partial narrator references', () => {
    const p = payload()
    p.records = [fact('recap', { kind: 'encounter', subject: 'reader', knownBy: [],
      text: 'They discussed routine weather. '.repeat(100) + 'Alex did not return the library book.' })]
    const r = rows(formatStoryRecall({ ...p, mode: 'light' }).text)[0]
    expect(r.narratorOnly).toBe(true)
    expect(r.encounterExcerpts).toContain('Alex did not return the library book.')
    expect(r.encounterExcerpts.length).toBeLessThanOrEqual(1000)
  })
  it('does not let an unrelated private fact in just because its topic matches', () => {
    const p = payload()
    p.records = [fact('secret', { subject: 'b', subjects: ['b'], knownBy: ['b'], text: 'Bea stole the library book.' })]
    expect(lightStoryFacts(p.records, p.cast, p.query)).toEqual([])
  })
  it('keeps SQLite and fallback identical in both modes, including empty cast and old topic matches', () => {
    const db = new DatabaseSync(':memory:')
    try {
      for (const cast of [['a'], ['a', 'b'], []]) for (const mode of ['standard', 'light'] as const) {
        const p = { ...payload(), cast, mode }
        p.records.push(fact('old', { kind: 'encounter', date: -20,
          origin: { term: 0, day: 8 }, text: 'Alex hid the library book under the atlas.' }))
        expect(recallFromSqlite(db, p).text).toBe(formatStoryRecall(p).text)
      }
    } finally { db.close() }
  })
  it('limits ledger references while preserving extraction and matching old promises', () => {
    const p = payload()
    p.records = [...Array.from({ length: 90 }, (_, i) => fact(`unrelated:${i}`, {
      subject: 'b', subjects: ['b'], text: 'Bea bought some new shoes. '.repeat(20), category: 'other'
    })), fact('old-promise')]
    const request = { system: 'rules', user: 'SCENE SO FAR\nAlex returned the library book.',
      schema: { name: 'ledger', schema: { properties: {}, required: [] } } }
    const original = JSON.stringify(p)
    const standard = withStoryExtraction(request, p, ['alex'])
    const light = withStoryExtraction(request, p, ['alex'], { mode: 'light', cast: ['a'] })
    expect(light.user).toContain('old-promise')
    expect(light.user).not.toContain('unrelated:')
    expect(light.user.length).toBeLessThan(standard.user.length / 2)
    expect(light.schema).toEqual(standard.schema)
    expect(light.user).toContain('Never supersede a player correction')
    expect(light.user).toContain('at most 8 NEW lasting developments')
    expect(JSON.stringify(p)).toBe(original)
    expect(withStoryExtraction(request, p, ['alex'], { mode: 'standard' })).toEqual(standard)
  })
})
