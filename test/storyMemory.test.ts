import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  acceptStoryFacts,
  assertStoryRecall,
  formatStoryRecall,
  normalizeStoryMemory,
  recallPayload,
  STORY_MEMORY_BUDGET,
  storySnapshot,
  withStoryRecall,
  type StoryFact,
  type StoryRecallRequest
} from '@shared/storyMemory'
import { READER_SPEAKER, type GameSave, type StructuredRequest } from '@shared/types'
import { recallFromSqlite } from '../src/main/services/storyMemoryIndex'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { currentStorySnapshot } from '../src/renderer/stores/storyMemory'
import { writeStoryMemory, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { withStoryExtraction } from '../src/renderer/prompts/storyMemoryPrompt'
import { mergeLedgerReplies } from '../src/renderer/prompts/textLedgerPrompt'
import {
  character,
  charactersById,
  charInfo,
  playthroughRecord,
  restoreApi,
  sceneLines,
  stubApi
} from './fixtures'

const a = character({ charId: 'a' }),
  b = character({ charId: 'b', firstName: 'Mina' }),
  chars = charactersById(a, b)
const game = () => useGameStore.getState()
const request: StructuredRequest = {
  system: 'rules',
  user: 'Reader takes a walk',
  schema: {
    name: 'ledger',
    schema: { properties: { memories: { type: 'array' } }, required: ['memories'] }
  },
  logFrom: 5
}
const fact = (over: Partial<StoryFact> = {}): StoryFact => ({
  id: 'fact:1',
  subject: 'a',
  category: 'promise',
  text: 'Sarah promised to return the book.',
  timeline: 'current',
  certainty: 'event',
  claimant: null,
  knownBy: ['reader', 'a'],
  public: false,
  date: 1,
  time: 0,
  evidence: 'I will return your book tomorrow.',
  source: 'scene',
  supersedes: [],
  manual: false,
  ...over
})
const evidence = { speaker: 'sarah_rose', text: 'I will return your book tomorrow.' }
const context = {
  date: 2,
  time: 0 as const,
  cast: ['a'],
  charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
  transcript: [evidence]
}
const candidate = {
  subject: 'sarah_rose',
  category: 'promise',
  text: 'Sarah promised to return the book.',
  timeline: 'current',
  certainty: 'event',
  claimant: 'none',
  knownBy: ['reader', 'sarah_rose'],
  public: false,
  evidence: evidence.text,
  supersedes: []
}
function seed(): void {
  game().reset()
  resetLoopState()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  useGameStore.setState({
    playthroughId: '123',
    date: 7,
    time: 0,
    chars: ['a', 'b'],
    cast: ['a'],
    characters: chars,
    charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
    charInfo: { a: charInfo({ nameKnown: true }), b: charInfo({ nameKnown: true }) },
    currentSceneTranscript: sceneLines('At the library.'),
    sceneLog: sceneLines('At the library.'),
    awaitingInput: true,
    history: {
      1: { 0: 'Sarah returned a blue atlas.' },
      2: { 0: 'Mina explored the lake.' },
      3: { 0: 'Sarah visited the greenhouse.' }
    },
    exStoryMemory: normalizeStoryMemory({ facts: [fact()] })
  })
}
const payload = (): StoryRecallRequest => ({
  ...storySnapshot(game())!,
  cast: ['a'],
  query: 'blue atlas'
})
beforeEach(() => {
  seed()
  stubApi({
    saves: {
      autosave: async (id, draft) => ({
        ok: true,
        data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 }
      })
    }
  })
})
afterEach(async () => {
  await writesSettled()
  restoreApi()
  vi.restoreAllMocks()
})

describe('save-owned story continuity', () => {
  it('requires generated evidence, a valid cast and speaker, and settles a batch idempotently', () => {
    const rows = [
      candidate,
      { ...candidate, text: 'An unfulfilled wish', evidence: 'I would like a new bicycle.' },
      { ...candidate, subject: 'mina_rose' },
      { ...candidate, knownBy: ['mina_rose'] },
      { ...candidate, certainty: 'claim', claimant: 'unknown' }
    ]
    const accepted = acceptStoryFacts(undefined, rows, context)
    expect(accepted.facts).toHaveLength(1)
    expect(accepted.facts[0].knownBy).toEqual(['reader', 'a'])
    expect(acceptStoryFacts(accepted, rows, context)).toEqual(accepted)
    const corrected = normalizeStoryMemory({
      ...accepted,
      edits: { [accepted.facts[0].id]: { text: 'A player-corrected promise.' } }
    })
    const replayed = acceptStoryFacts(corrected, rows, context)
    expect(replayed.facts).toHaveLength(1)
    expect(replayed.edits[accepted.facts[0].id].text).toBe('A player-corrected promise.')
    expect(
      acceptStoryFacts(undefined, [candidate], {
        ...context,
        transcript: [{ speaker: READER_SPEAKER, text: evidence.text }]
      }).facts
    ).toEqual([])
    expect(acceptStoryFacts(undefined, [candidate], { ...context, transcript: [] }).facts).toEqual(
      []
    )
  })
  it('does not let automatic facts supersede corrections or mix claims and timelines', () => {
    const old = normalizeStoryMemory({
      facts: [
        fact(),
        fact({ id: 'manual', manual: true }),
        fact({ id: 'claim', certainty: 'claim', claimant: 'a' }),
        fact({ id: 'alternate', timeline: 'alternate' })
      ]
    })
    const next = acceptStoryFacts(
      old,
      [{ ...candidate, supersedes: ['fact:1', 'manual', 'claim', 'alternate'] }],
      context
    )
    expect(next.facts.at(-1)?.supersedes).toEqual(['fact:1'])
    const records = storySnapshot({ ...game(), exStoryMemory: next })!.records
    expect(records.some((r) => r.id === 'fact:1')).toBe(false)
    expect(records.some((r) => r.id === 'alternate')).toBe(true)
  })
  it('imports legacy optional fields defensively and carries them through disabled saves', () => {
    const memory = normalizeStoryMemory({
      facts: [fact(), { id: 'bad' }, fact({ id: '__proto__' })],
      edits: { 'fact:1': { text: 'A player correction.', date: 999 } },
      hidden: ['other']
    })
    expect(memory.facts).toHaveLength(1)
    expect(memory.edits['fact:1'].date).toBe(1)
    expect(memory.edits['fact:1'].manual).toBe(true)
    useGameStore.setState({ exStoryMemory: memory })
    const save = {
      ...game().toGameSave(),
      playthroughId: '123',
      saveId: 'manual',
      saveDate: 0
    } as GameSave
    useModsStore.setState({ switches: { on: { 'story-memory': false }, options: {} } })
    game().loadSave(save, playthroughRecord({ chars: ['a', 'b'] }), chars)
    expect(currentStorySnapshot()).toBeUndefined()
    expect(game().toGameSave().exStoryMemory).toEqual(memory)
    delete save.exStoryMemory
    game().loadSave(save, playthroughRecord({ chars: ['a', 'b'] }), chars)
    expect(game().exStoryMemory.facts).toEqual([])
  })
  it('keeps narrator knowledge distinct and does not infer witnesses from recap name matches', () => {
    const p = payload(),
      recap = p.records.find((r) => r.id === 'encounter:1:0')!
    expect(recap.subjects).toEqual(['a'])
    expect(recap.knownBy).toEqual([])
    const recall = formatStoryRecall(p)
    expect(recall.included).not.toContain('encounter:2:0')
    const secret = fact({ id: 'private', subject: 'b', knownBy: ['b'], text: 'A private secret.' })
    useGameStore.setState({ exStoryMemory: normalizeStoryMemory({ facts: [secret] }) })
    expect(formatStoryRecall(payload()).included).not.toContain('private')
  })
  it('caps prompts and selects per character while hiding future and deleted recall', () => {
    useGameStore.setState({
      exStoryMemory: normalizeStoryMemory({
        facts: Array.from({ length: 200 }, (_, i) => fact({ id: `f${i}`, text: 'A'.repeat(800) })),
        encounterEdits: { 'encounter:1:0': { hidden: true } }
      }),
      history: { ...game().history, 100: { 0: 'Sarah has a future event.' } }
    })
    const p = payload(),
      r = formatStoryRecall(p)
    expect(p.records.some((x) => x.id === 'encounter:100:0')).toBe(false)
    expect(p.records.some((x) => x.id === 'encounter:1:0')).toBe(false)
    expect(r.text.length).toBeLessThanOrEqual(STORY_MEMORY_BUDGET)
    expect(r.included.length).toBeLessThan(200)
    const before = game().history
    storySnapshot({
      ...game(),
      exStoryMemory: normalizeStoryMemory({
        encounterEdits: { 'encounter:3:0': { text: 'Corrected recap.' } }
      })
    })
    expect(game().history).toBe(before)
  })
  it('extends only enabled ledger requests and preserves the native ledger fields across merging', () => {
    expect(withStoryExtraction(request, undefined, ['sarah_rose'])).toBe(request)
    const enriched = withStoryExtraction(request, storySnapshot(game()), ['sarah_rose'])
    expect(enriched.schema.schema.required).toEqual(['memories', 'exStoryFacts'])
    const largeSnapshot = storySnapshot(game())!
    largeSnapshot.records = Array.from({ length: 3000 }, (_, i) => ({
      ...fact({ id: `fact:${i}`, text: 'A lasting development. '.repeat(36) }),
      kind: 'fact' as const,
      subjects: ['a']
    }))
    const largeLedger = withStoryExtraction(request, largeSnapshot, ['sarah_rose'])
    expect(largeLedger.user.length - request.user.length).toBeLessThan(8500)
    expect(largeLedger.user.startsWith(request.user)).toBe(true)
    const merged = mergeLedgerReplies(
      { exStoryFacts: [candidate], memories: [] },
      { textMemories: [] }
    )
    expect(merged.exStoryFacts).toEqual([candidate])
    const raw = { ...request, ...recallPayload(storySnapshot(game()), ['a'], 'atlas') }
    const clean = withStoryRecall(raw, formatStoryRecall(payload()))
    expect(clean).not.toHaveProperty('storyMemory')
    expect(clean.user.endsWith(request.user)).toBe(true)
    expect(clean.logFrom).toBeGreaterThan(request.logFrom!)
    expect(withStoryRecall(raw).user).toBe(request.user)
  })
})

describe('native SQLite index', () => {
  it('matches fallback ranking, replaces a rewound snapshot, and never mixes playthroughs', () => {
    const dir = mkdtempSync(join(tmpdir(), 'vu-story-test-')),
      db = new DatabaseSync(join(dir, 'memory.sqlite'))
    try {
      const p = payload(),
        first = recallFromSqlite(db, p)
      expect(first.engine).toBe('SQLite')
      expect(first.text).toBe(formatStoryRecall(p).text)
      expect(recallFromSqlite(db, p)).toEqual(first)
      const rewound = { ...p, date: 1, records: p.records.filter((r) => r.date <= 1) }
      expect(recallFromSqlite(db, rewound).included).not.toContain('encounter:3:0')
      expect(db.prepare('SELECT COUNT(*) as n FROM records').get()?.n).toBe(rewound.records.length)
      const other = { ...p, playthroughId: '456', records: [] }
      expect(recallFromSqlite(db, other).text).toBe('')
      expect(db.prepare('SELECT COUNT(*) as n FROM records').get()?.n).toBe(0)
    } finally {
      db.close()
      rmSync(dir, { recursive: true })
    }
  })
  it('rolls back failed replacements and rejects unsafe payloads before touching the index', () => {
    const db = new DatabaseSync(':memory:')
    try {
      const p = payload()
      recallFromSqlite(db, p)
      db.exec(
        "CREATE TRIGGER reject_write BEFORE INSERT ON records BEGIN SELECT RAISE(ABORT,'test failure'); END"
      )
      expect(() => recallFromSqlite(db, { ...p, records: p.records.slice(0, 1) })).toThrow()
      expect(db.prepare('SELECT COUNT(*) as n FROM records').get()?.n).toBe(p.records.length)
      for (const invalid of [
        { ...p, playthroughId: '../escape' },
        { ...p, records: [...p.records, p.records[0]] },
        { ...p, records: [{ ...p.records[0], date: 99 }] },
        { ...p, cast: ['__proto__'] },
        { ...p, records: [{ ...p.records[0], knownBy: 'everyone' }] }
      ])
        expect(() => assertStoryRecall(invalid)).toThrow()
    } finally {
      db.close()
    }
  })
  it('uses bound values for search terms and rejects unknown index versions', () => {
    const db = new DatabaseSync(':memory:')
    try {
      const p = { ...payload(), query: "atlas'); DROP TABLE records; --" }
      expect(recallFromSqlite(db, p).text).toBe(formatStoryRecall(p).text)
      db.exec('PRAGMA user_version=99')
      expect(() => recallFromSqlite(db, p)).toThrow('version')
      expect(db.prepare('SELECT COUNT(*) as n FROM records').get()?.n).toBeGreaterThan(0)
    } finally {
      db.close()
    }
  })
})

describe('durable edits', () => {
  it('commits only after a successful write and leaves both histories intact on failure', async () => {
    const old = game().exStoryMemory,
      history = game().history,
      next = normalizeStoryMemory({ ...old, hidden: ['fact:1'] })
    let release!: (value: never) => void
    stubApi({
      saves: {
        autosave: () =>
          new Promise((resolve) => {
            release = resolve
          })
      }
    })
    const pending = writeStoryMemory(next, {
      playthroughId: '123',
      loads: game().loads,
      previous: old
    })
    await Promise.resolve()
    expect(game().exStoryMemory).toBe(old)
    release({ ok: true, data: {} } as never)
    await pending
    expect(game().exStoryMemory.hidden).toEqual(['fact:1'])
    expect(game().history).toBe(history)
    stubApi({
      saves: {
        autosave: async () => ({ ok: false, error: { code: 'SAVE_FAILED', message: 'Disk full' } })
      }
    })
    const stable = game().exStoryMemory
    await expect(
      writeStoryMemory(next, { playthroughId: '123', loads: game().loads, previous: stable })
    ).rejects.toThrow('Disk full')
    expect(game().exStoryMemory).toBe(stable)
  })
  it('refuses busy, disabled, ending and stale saves; a delayed result cannot update a new load', async () => {
    const old = game().exStoryMemory,
      expected = { playthroughId: '123', loads: game().loads, previous: old }
    useGameStore.setState({ busy: true })
    await expect(writeStoryMemory(old, expected)).rejects.toThrow()
    useGameStore.setState({ busy: false, sceneEnding: true })
    await expect(writeStoryMemory(old, expected)).rejects.toThrow()
    useGameStore.setState({ sceneEnding: false })
    useModsStore.setState({ switches: { on: { 'story-memory': false }, options: {} } })
    await expect(writeStoryMemory(old, expected)).rejects.toThrow()
    useModsStore.setState({ switches: { on: {}, options: {} } })
    await expect(
      writeStoryMemory(old, { ...expected, loads: expected.loads - 1 })
    ).rejects.toThrow()
    let release!: (value: never) => void
    stubApi({
      saves: {
        autosave: () =>
          new Promise((resolve) => {
            release = resolve
          })
      }
    })
    const pending = writeStoryMemory(normalizeStoryMemory({ ...old, hidden: ['fact:1'] }), expected)
    await Promise.resolve()
    useGameStore.setState({ loads: game().loads + 1 })
    release({ ok: true, data: {} } as never)
    await pending
    expect(game().exStoryMemory).toBe(old)
  })
})
