import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeStoryMemory, storySnapshot, formatStoryRecall, assertStoryRecall, type StoryFact } from '@shared/storyMemory'
import { DatabaseSync } from 'node:sqlite'
import { recallFromSqlite } from '../src/main/services/storyMemoryIndex'
import type { SlotIntroInput } from '../src/renderer/prompts/slotIntroPrompt'
import { modRequest, setHookRules } from '../src/renderer/mods/hooks'
import '../src/renderer/modEntries/story-memory'
import { character, charactersById } from './fixtures'

beforeEach(() => setHookRules({ isOn: id => id === 'story-memory', order: () => 0 }))
afterEach(() => setHookRules({ isOn: () => true, order: () => 0 }))

describe('QA: slot-opening Story Memory must target the characters it writes', () => {
  it.each(['standard', 'light'] as const)('restricts each private fact to its DM author in %s mode, with SQLite parity', mode => {
    const alice = character({ charId: 'a', firstName: 'Alice' })
    const bob = character({ charId: 'b', firstName: 'Bob' })
    const carol = character({ charId: 'c', firstName: 'Carol' })
    const fact = (id: string, knownBy: string[], publicFact = false): StoryFact => ({
      id, subject: id, category: 'secret', text: `${id} has a private scholarship concern.`,
      date: 9, time: 0, timeline: 'current', certainty: 'event', claimant: null,
      knownBy, public: publicFact, evidence: '', source: 'Player-added correction', supersedes: [], manual: true
    })
    const snapshot = storySnapshot({ playthroughId: '123', date: 10, time: 0,
      history: { 9: { 0: 'Alice and Bob discussed a narrator-only medical detail.' } },
      characters: charactersById(alice, bob, carol), exStoryMemory: normalizeStoryMemory({ facts: [
        fact('a', ['a']), fact('b', ['b']), fact('c', ['c']),
        fact('narrator', []), fact('reader-only', ['reader']), { ...fact('public', [], true), subject: 'a' }
      ] }) })!
    const input = { storyMemory: snapshot, recent: ['scholarship concern'],
      askers: [{ character: alice }], breakups: [{ character: bob }], posters: [{ character: carol }] } as unknown as SlotIntroInput
    const payload = modRequest('slot-intro', { input }, { system: 'rules', user: 'Write the slot.', schema: { name: 'slot', schema: {} } }).storyMemory!
    payload.mode = mode
    assertStoryRecall(payload)
    const actual = formatStoryRecall(payload)
    expect(new Set(actual.included)).toEqual(new Set(['a', 'b', 'public']))
    const rows = actual.text.split('\n').filter(line => line.startsWith('{')).map(line => JSON.parse(line))
    expect(rows.find(row => (row.text ?? row.fact).startsWith('a ')).useOnlyFor).toEqual(['Only the DM written by Alice Rose [a]'])
    expect(rows.find(row => (row.text ?? row.fact).startsWith('b ')).useOnlyFor).toEqual(['Only the DM written by Bob Rose [b]'])
    expect(actual.text).toContain('must not appear in public posts')
    expect(actual.text.length).toBeLessThan(mode === 'light' ? 6000 : 18000)
    const db = new DatabaseSync(':memory:')
    try {
      const indexed = recallFromSqlite(db, payload)
      expect(indexed.text).toBe(actual.text)
      expect(indexed.included).toEqual(actual.included)
    } finally { db.close() }
  })

  it('rejects malformed audience metadata at the recall boundary', () => {
    expect(() => assertStoryRecall({ slotAuthors: { dm: '../not-a-key', posts: [] } })).toThrow('slot authors')
  })
  it.each(['askers', 'breakups'] as const)('retains the %s character in recall scope', section => {
    const alice = character({ charId: 'a', firstName: 'Alice' })
    const snapshot = storySnapshot({ playthroughId: '123', date: 10, time: 0, history: {},
      characters: charactersById(alice), exStoryMemory: normalizeStoryMemory({ facts: [{
        id: 'manual:correction', subject: 'a', category: 'role', text: 'Alice is now a law student, having left the art department.',
        date: 9, time: 0, timeline: 'current', certainty: 'event', claimant: null,
        knownBy: ['a'], public: false, evidence: '', source: 'Player-added correction', supersedes: [], manual: true
      }] }) })!
    const input = { storyMemory: snapshot, recent: [], askers: [], breakups: [], posters: [],
      [section]: [{ character: alice }] } as unknown as SlotIntroInput
    const request = modRequest('slot-intro', { input }, { system: 'rules', user: 'Write Alice.',
      schema: { name: 'slot', schema: {} } })
    const actual = request.storyMemory!
    // Positive control: this same valid save fact is relevant when its author is targeted.
    expect(formatStoryRecall({ ...actual, cast: ['a'] }).included).toContain('manual:correction')
    expect(formatStoryRecall(actual).included).toContain('manual:correction')
  })
  it('keeps a public player correction in Light recall for an opening DM', () => {
    const alice = character({ charId: 'a', firstName: 'Alice' })
    const snapshot = storySnapshot({ playthroughId: '123', date: 10, time: 0, history: {},
      characters: charactersById(alice), exStoryMemory: normalizeStoryMemory({ facts: [{
        id: 'manual:correction', subject: 'a', category: 'role', text: 'Alice is now a law student, having left the art department.',
        date: 9, time: 0, timeline: 'current', certainty: 'event', claimant: null,
        knownBy: ['reader', 'a'], public: true, evidence: '', source: 'Player-added correction', supersedes: [], manual: true
      }] }) })!
    const input = { storyMemory: snapshot, recent: [], askers: [{ character: alice }], breakups: [], posters: [] } as unknown as SlotIntroInput
    const request = modRequest('slot-intro', { input }, { system: 'rules', user: 'Write Alice.',
      schema: { name: 'slot', schema: {} } })
    const actual = { ...request.storyMemory!, mode: 'light' as const }
    expect(formatStoryRecall({ ...actual, cast: ['a'] }).included).toContain('manual:correction')
    expect(formatStoryRecall(actual).included).toContain('manual:correction')
  })
})
