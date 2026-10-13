import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { carryWhisper, ensureWhisperAuthor, normalizeWhisper, observeWhisperSlot, whisperSources, WHISPER_OBSERVATIONS,
  type WhisperObservation, type WhisperPresence } from '@shared/venusWhisper'
import type { NpcEncounter, NpcRelationshipMap } from '@shared/npcRelationships'
import type { GameSave, SaveDraft, StructuredRequest } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { recordWhisperObservations } from '../src/renderer/stores/whisperObservations'
import { publishWhisper } from '../src/renderer/stores/venusWhisper'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { SPRING_BREAK_LEAVE } from '../src/renderer/prompts/springBreak'
import { classEntry, character, charInfo, charactersById, playthroughRecord, restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const encounter = (over: Partial<NpcEncounter> = {}): NpcEncounter => ({ date: 7, kind: 'hangout', ref: 'green_hill_park', positive: true, ...over })
const relationships = (e = encounter(), pair = 'b|c'): NpcRelationshipMap => ({ [pair]: { affinity: 2, encounter: e } })
function seed(): void {
  game().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  useGameStore.setState({ playthroughId: 'p', date: 7, time: 0, chars: ['a', 'b', 'c'],
    characters: charactersById(character({ charId: 'a', personality: 'Sarah is observant.', likes: ['strong coffee', 'quiet mornings'] }),
      character({ charId: 'b', firstName: 'Mina' }), character({ charId: 'c', firstName: 'Robin' })),
    charInfo: { a: charInfo({ nameKnown: true, handle: 'sarah', hiddenSchedule: { 0: { location: 'green_hill_park', kind: 'fun' } } }),
      b: charInfo({ nameKnown: true }), c: charInfo({ nameKnown: true }) },
    classes: { 'BIO 210': classEntry() } })
  useGameStore.setState({ exVenusWhisper: ensureWhisperAuthor(game(), () => 0) })
}
beforeEach(seed)
afterEach(async () => { await writesSettled(); restoreApi(); vi.restoreAllMocks() })

/** Execute the same collector used by the mod's settled-slot hook with the real timetable. */
function settle(e = encounter(), pair = 'b|c'): void {
  const before = game()
  useGameStore.setState({ npcRelationships: relationships(e, pair) })
  recordWhisperObservations({ before, ledger: null, closingCast: [] })
}

describe('firsthand Whisper evidence', () => {
  it('uses the native haunt, active overlay, class and work shift, with commitments taking precedence', () => {
    settle()
    expect(game().exVenusWhisper.observations?.[0].perspective).toBe('nearby')
    seed()
    useGameStore.setState({ npcOverlay: { date: 7, time: 0, groups: [{ location: 'cutetea', members: ['a', 'b', 'c'] }], wentOut: [] } })
    settle(encounter({ ref: 'cutetea' }))
    expect(game().exVenusWhisper.observations).toHaveLength(1)
    seed()
    useGameStore.setState(s => ({ charInfo: { ...s.charInfo, a: { ...s.charInfo.a, schedule: { 0: 'BIO 210' } } } }))
    settle()
    expect(game().exVenusWhisper.observations).toEqual([])
    settle(encounter({ kind: 'class', ref: 'BIO 210' }))
    expect(game().exVenusWhisper.observations?.[0].perspective).toBe('classmate')
    seed()
    useGameStore.setState(s => ({ charInfo: { ...s.charInfo, a: { ...s.charInfo.a, job: { jobId: 'cutetea', shifts: [0] } } } }))
    settle(encounter({ ref: 'cutetea' }))
    expect(game().exVenusWhisper.observations?.[0].perspective).toBe('on shift')
  })

  it('does not invent presence from stale overlays, holidays, away dates, the reader cast or absent alumni', () => {
    useGameStore.setState({ npcOverlay: { date: 6, time: 0, groups: [{ location: 'cutetea', members: ['a', 'b'] }], wentOut: [] } })
    settle(encounter({ ref: 'cutetea' }))
    expect(game().exVenusWhisper.observations).toEqual([])
    seed()
    useGameStore.setState({ cast: ['a'] })
    settle()
    expect(game().exVenusWhisper.observations).toEqual([])
    seed()
    useGameStore.setState({ chars: ['b', 'c'] })
    settle()
    expect(game().exVenusWhisper.observations).toEqual([])
    expect(game().exVenusWhisper.author?.id).toBe('a')
    seed()
    // Sunday has no classes, regardless of the saved Monday timetable.
    useGameStore.setState(s => ({ date: 6, charInfo: { ...s.charInfo, a: { ...s.charInfo.a, schedule: { 0: 'BIO 210' } } } }))
    settle(encounter({ date: 6, kind: 'class', ref: 'BIO 210' }))
    expect(game().exVenusWhisper.observations).toEqual([])
    seed()
    useGameStore.setState({ date: SPRING_BREAK_LEAVE, springBreakAway: ['a'], npcOverlay: {
      date: SPRING_BREAK_LEAVE, time: 0, groups: [{ location: 'green_hill_park', members: ['a', 'b', 'c'] }], wentOut: [] } })
    settle(encounter({ date: SPRING_BREAK_LEAVE }))
    expect(game().exVenusWhisper.observations).toEqual([])
  })

  it('requires new settled evidence, excludes rooms/missing subjects, and cannot witness a different location', () => {
    const cases: [NpcEncounter, WhisperPresence | null, string[], number][] = [
      [encounter(), { location: 'cutetea' }, [], 0],
      [encounter(), null, [], 0],
      [encounter(), { location: 'green_hill_park' }, ['c'], 0],
      [encounter({ ref: 'room' }), { location: 'room' }, [], 0],
      [encounter({ date: 6 }), { location: 'green_hill_park' }, [], 0],
      [encounter({ kind: 'dorm', ref: 'lowrise_1_lounge' }), { location: 'room' }, [], 0],
      [encounter(), { location: 'green_hill_park' }, [], 1]
    ]
    for (const [e, presence, excluded, expected] of cases) {
      const snapshot = { ...game(), npcRelationships: relationships(e) }
      expect(observeWhisperSlot(snapshot, {}, presence, excluded).observations).toHaveLength(expected)
      expect(observeWhisperSlot(snapshot, snapshot.npcRelationships, presence).observations).toEqual([])
    }
    useGameStore.setState(s => ({ characters: { a: s.characters.a, b: s.characters.b } }))
    settle()
    expect(game().exVenusWhisper.observations).toEqual([])
  })

  it('collects and publishes firsthand events even when the player knows neither participant', () => {
    useGameStore.setState(s => ({ charInfo: Object.fromEntries(Object.entries(s.charInfo)
      .map(([id, info]) => [id, { ...info, nameKnown: false }])) }))
    useGameStore.setState(s => ({ exVenusWhisper: { ...s.exVenusWhisper,
      author: { ...s.exVenusWhisper.author!, known: false } } }))
    settle(encounter(), 'a|b')
    expect(game().exVenusWhisper.observations).toHaveLength(1)
    useGameStore.setState({ date: 9 })
    const sources = whisperSources(game())
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ basis: 'witnessed', subjects: ['a', 'b'] })
    expect(sources[0].text).toContain('Mina')
    expect(sources[0]).not.toHaveProperty('author')
    expect(game().charInfo.a.nameKnown).toBe(false)
    expect(game().charInfo.b.nameKnown).toBe(false)
    expect(game().exVenusWhisper.author?.known).toBeFalsy()
  })

  it('can report on unfamiliar bystanders but still excludes their unobserved public feeds', () => {
    useGameStore.setState(s => ({ charInfo: { ...s.charInfo,
      b: { ...s.charInfo.b, nameKnown: false, feed: [{ id: 'unknown-post', date: 7, time: 0, text: 'Not a witnessed event', likes: 0 }] },
      c: { ...s.charInfo.c, nameKnown: false } } }))
    settle()
    useGameStore.setState({ date: 9 })
    expect(whisperSources(game()).map(source => source.basis)).toEqual(['witnessed'])
  })

  it('preserves a real public run-in involving the author without granting access to unrelated dorm conversations', () => {
    settle(encounter({ kind: 'dorm', ref: 'lowrise_1_lounge' }), 'a|b')
    expect(game().exVenusWhisper.observations?.[0].perspective).toBe('participant')
    const snapshot = game().exVenusWhisper
    settle(encounter({ kind: 'dorm', ref: 'lowrise_1_lounge' }), 'a|b')
    expect(game().exVenusWhisper).toEqual(snapshot)
  })

  it('follows a settled run-in away from the standing haunt, including an unknown partner', () => {
    const before = game()
    useGameStore.setState(s => ({ chars: [...s.chars, 'd'], characters: { ...s.characters, d: character({ charId: 'd' }) },
      charInfo: { ...s.charInfo, d: charInfo({ nameKnown: false }) },
      npcRelationships: { ...relationships(), ...relationships(encounter({ ref: 'cutetea' }), 'a|d') } }))
    recordWhisperObservations({ before, ledger: null, closingCast: [] })
    // The real run-in is printable; the unrelated park encounter is not witnessed.
    expect(game().exVenusWhisper.observations).toHaveLength(1)
    expect(game().exVenusWhisper.observations?.[0].subjects).toEqual(['a', 'd'])
  })

  it('survives save/load and rescheduling, without treating old, future or previous-term encounters as current evidence', () => {
    expect(whisperSources({ ...game(), npcRelationships: relationships() })).toEqual([])
    settle()
    const saved = game().toGameSave()
    game().loadSave(saved as GameSave, playthroughRecord({ chars: ['a', 'b', 'c'] }), game().characters)
    useGameStore.setState(s => ({ date: 9, charInfo: { ...s.charInfo, a: { ...s.charInfo.a, hiddenSchedule: {} } } }))
    expect(whisperSources(game()).map(s => s.basis)).toEqual(['witnessed'])
    expect(whisperSources({ ...game(), date: 7, time: 0 })).toEqual([])
    expect(whisperSources({ ...game(), date: 16 })).toEqual([])
    expect(whisperSources({ ...game(), termIndex: 1 })).toEqual([])
    // Public posts are readable remotely, but are never classified as witnessed scenes.
    useGameStore.setState(s => ({ charInfo: { ...s.charInfo, b: { ...s.charInfo.b, feed: [{ id: 'p', text: 'A public update.', date: 8, time: 1, likes: 0 }] } } }))
    expect(whisperSources(game()).map(s => s.basis)).toEqual(['public-post', 'witnessed'])
  })

  it('bounds and validates saved observations and filters future carryover', () => {
    settle()
    const o = game().exVenusWhisper.observations![0]
    const stamped = (day: number): WhisperObservation => ({ ...o, id: `witness:0:${day}:0:b|c`, day })
    const observations = Array.from({ length: WHISPER_OBSERVATIONS + 5 }, (_, day) => stamped(day))
    expect(normalizeWhisper({ ...game().exVenusWhisper, observations }).observations).toHaveLength(WHISPER_OBSERVATIONS)
    const dirty = [null, { ...o, author: 'other' }, { ...o, subjects: ['b', 'b'] }, { ...o, time: 3 }, { ...o, where: 'x'.repeat(201) }, o, o]
    expect(normalizeWhisper({ ...game().exVenusWhisper, observations: dirty }).observations).toEqual([o])
    const carried = carryWhisper({ ...game().exVenusWhisper, observations: [stamped(7), stamped(10)] }, 0, 9)
    expect(carried.observations).toEqual([o])
    expect(carried.author).toEqual(game().exVenusWhisper.author)
    const fresh = observeWhisperSlot({ ...game(), date: 30, exVenusWhisper: carried }, {}, null)
    expect(fresh.observations).toEqual([])
  })

  it('sends only bounded clue/evidence data to the writer and preserves observations collected during generation', async () => {
    settle()
    useGameStore.setState({ date: 9 })
    const initial = game().exVenusWhisper.observations!
    const complete = vi.fn(async (request: StructuredRequest) => {
      const data = JSON.parse(request.user)
      expect(data.publicSources).toHaveLength(1)
      expect(data.publicSources[0].basis).toBe('witnessed')
      expect(data.authorHints).toEqual(['quiet mornings'])
      expect(data.temperament).not.toContain('Sarah')
      expect(data).not.toHaveProperty('author')
      expect(request.user).not.toMatch(/backstory|datingHistory|hiddenSchedule|PRIVATE|"author"/)
      const later: WhisperObservation = { ...initial[0], id: 'witness:0:9:0:b|c', day: 9 }
      useGameStore.setState(s => ({ time: 1, exVenusWhisper: { ...s.exVenusWhisper, observations: [...initial, later] } }))
      return { ok: true as const, data: { title: 'An interesting afternoon', body: 'The park had its share of drama.', sources: data.publicSources.map((s: { id: string }) => s.id), comments: [] } }
    })
    stubApi({ llm: { completeWhisper: complete }, saves: { autosave: async (_p: string, draft: SaveDraft) => ({ ok: true, data: { ...draft, playthroughId: 'p', saveId: 'autosave', saveDate: 0 } as GameSave }) } })
    await publishWhisper('test', () => true, true)
    expect(game().exVenusWhisper.observations).toHaveLength(2)
    expect(whisperSources({ ...game(), date: 9, time: 0 })).toHaveLength(1)
    expect(game().exVenusWhisper.issues[0].subjects).toEqual(['b', 'c'])
  })
})
