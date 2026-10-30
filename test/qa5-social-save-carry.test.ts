import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, GameSave, Result, SaveDraft, TextingResponse } from '@shared/types'
import { meanwhileEvents, normalizeMeanwhile } from '@shared/meanwhile'
import { normalizeStoryMemory, storySnapshot, type StoryFact } from '@shared/storyMemory'
import { normalizeWhisper, whisperRecall, whisperSources } from '@shared/venusWhisper'
import { carriedModFields } from '@shared/modCarry'
import { semesterOf, semesterShiftOf } from '@shared/semesters'
import { FINAL_DATE } from '@shared/classes'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { modFieldsLeaving } from '../src/renderer/stores/semesterModCarry'
import { carryOf } from '../src/renderer/stores/semesterCarry'
import { currentStorySnapshot } from '../src/renderer/stores/storyMemory'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { generateMeanwhile } from '../src/renderer/stores/meanwhile'
import { commentOnWhisper, useWhisperActivity } from '../src/renderer/stores/venusWhisper'
import { regenerateTextReply, resetTextingLoop, textRegenerationTarget } from '../src/renderer/stores/textingLoop'
import { persistRegeneratedConversation, writeStoryMemory, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/story-memory'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const cast = charactersById(character({ charId: 'a' }), character({ charId: 'b', firstName: 'Mina' }))
const record = playthroughRecord({ chars: ['a', 'b'] })
const fact = (id: string, text: string): StoryFact => ({ id, text, subject: 'a', category: 'promise',
  timeline: 'current', certainty: 'event', claimant: null, knownBy: ['reader', 'a'], public: false,
  date: 4, time: 0, evidence: '', source: 'Player-added fact', supersedes: [], manual: true })
const thread = (): Conversation => ({ charId: 'a', unread: 1, summary: 'Rejected reply summary',
  exTextBase: { replyTo: 'sent', summary: 'Prior summary' }, messages: [
    { id: 'sent', sender: 'player', text: 'How was your day?', date: 9, time: 0 },
    { id: 'reply', sender: 'contact', text: 'Original reply', date: 9, time: 0, exReplyTo: 'sent' }
  ] })
const lines = Array.from({ length: 6 }, (_, i) => ({ speaker: i % 2 ? 'b' : 'a', text: `SPECTATOR_ONLY_QA5_${i}` }))
const replacement: TextingResponse = { messages: ['Replacement reply'], summary: 'Replacement summary', blocked: false }
let saved: SaveDraft[]
function api(complete = vi.fn(async (): Promise<Result<TextingResponse>> => ({ ok: true, data: replacement }))) {
  const save = vi.fn(async (id: string, draft: SaveDraft): Promise<Result<GameSave>> => {
    saved.push(structuredClone(draft))
    return { ok: true, data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 } }
  })
  stubApi({ llm: { completeMod: async () => ({ ok: true, data: { lines } }), completeTexting: complete,
    classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } }) },
    saves: { autosave: save } })
  return { complete, save }
}
async function watch(): Promise<void> { await generateMeanwhile(meanwhileEvents(game())[0].id, 'qa5', () => true) }
function snapshot(draft = game().toGameSave()): GameSave {
  return { ...draft, playthroughId: '123', saveId: 'autosave', saveDate: 0 }
}
beforeEach(() => {
  resetTextingLoop(); resetLoopState(); game().reset(); useBunnyboardStore.getState().reset()
  useWhisperActivity.setState({ working: false })
  useModsStore.setState({ switches: { on: {}, options: {} } })
  saved = []
  useGameStore.setState({ playthroughId: '123', date: 9, time: 0, chars: ['a', 'b'], characters: cast,
    charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
    charInfo: { a: charInfo({ nameKnown: true }), b: charInfo({ nameKnown: true }) },
    history: { 4: { 0: 'Sarah discussed the library book.', 1: 'A hidden recap.' } },
    npcRelationships: { 'a|b': { affinity: 2, encounter: { date: 8, kind: 'hangout', ref: 'green_hill_park', positive: true } } },
    bunnyboard: { ...game().bunnyboard, conversations: { a: thread() } },
    exStoryMemory: normalizeStoryMemory({ facts: [fact('manual:old', 'PRIVATE_FACT_QA5')],
      encounterSubjects: { 'encounter:4:0': ['a'] }, encounterEdits: { 'encounter:4:1': { hidden: true } } }),
    exVenusWhisper: normalizeWhisper({ version: 1, author: { id: 'b', name: 'Mina Rose', handle: 'mina', voice: 'Calm', known: true },
      discovery: { author: 'b', term: 0, day: 4, time: 0 }, people: [], dismissed: [], issues: [
        { id: 'whisper:0:9', term: 0, day: 9, title: 'Public issue', body: 'PUBLIC_GOSSIP_QA5',
          subjects: ['a'], comments: [], answered: [], weekly: true, read: true }
      ] }) })
  api()
})
afterEach(async () => { resetTextingLoop(); await writesSettled(); resetLoopState(); restoreApi(); vi.restoreAllMocks() })

describe('fifth-pass social save and carry integration controls', () => {
  it('composes Meanwhile, a memory edit, a public comment and a regenerated reply in the same autosave', async () => {
    await watch()
    const previous = game().exStoryMemory
    await writeStoryMemory({ ...previous, facts: [...previous.facts, fact('manual:new', 'A second player fact.')] },
      { playthroughId: '123', loads: game().loads, previous })
    const commentId = await commentOnWhisper('whisper:0:9', 'I read the issue.', undefined, () => true)
    await regenerateTextReply('a', persistRegeneratedConversation)
    expect(saved).toHaveLength(4)
    expect(saved.at(-1)?.exNpcWatch?.scenes[0].lines).toEqual(lines)
    expect(saved.at(-1)?.exStoryMemory?.facts.map(f => f.id)).toEqual(['manual:old', 'manual:new'])
    expect(saved.at(-1)?.exVenusWhisper?.issues[0].comments[0].id).toBe(commentId)
    expect(saved.at(-1)?.bunnyboard.conversations.a.summary).toBe('Replacement summary')
    const before = game().toGameSave()
    game().loadSave(snapshot(saved.at(-1)), record, cast)
    expect(game().toGameSave().exNpcWatch).toEqual(before.exNpcWatch)
    expect(game().toGameSave().exStoryMemory).toEqual(before.exStoryMemory)
    expect(game().toGameSave().exVenusWhisper).toEqual(before.exVenusWhisper)
    expect(game().bunnyboard.conversations.a).toEqual(before.bunnyboard.conversations.a)
  })

  it('retains an unrelated arriving thread and read receipts while a replacement is generated', async () => {
    await watch()
    const social = { memory: game().exStoryMemory, whisper: game().exVenusWhisper, meanwhile: game().exNpcWatch }
    let release!: (value: Result<TextingResponse>) => void
    api(vi.fn(() => new Promise<Result<TextingResponse>>(resolve => { release = resolve })))
    const pending = regenerateTextReply('a', persistRegeneratedConversation)
    game().appendChatMessage('b', { id: 'independent', sender: 'contact', text: 'An independent incoming reply.', date: 9, time: 0 }, 1)
    game().markConversationRead('a')
    release({ ok: true, data: replacement })
    await pending
    expect(saved.at(-1)?.bunnyboard.conversations.b.messages[0].id).toBe('independent')
    expect(saved.at(-1)?.bunnyboard.conversations.a.unread).toBe(0)
    expect(game().exStoryMemory).toBe(social.memory)
    expect(game().exVenusWhisper).toBe(social.whisper)
    expect(game().exNpcWatch).toBe(social.meanwhile)
  })

  it('does not acknowledge a Meanwhile cache when a later memory edit owns the safe-save lock', async () => {
    const { save } = api()
    let release!: (value: Result<GameSave>) => void
    let started!: () => void
    const writing = new Promise<void>(resolve => { started = resolve })
    save.mockImplementationOnce(async (_id, draft) => {
      saved.push(structuredClone(draft)); started()
      return new Promise<Result<GameSave>>(resolve => { release = resolve })
    })
    const watching = watch()
    const rejected = expect(watching).rejects.toThrow('changed')
    await writing
    const previous = game().exStoryMemory
    const edit = writeStoryMemory({ ...previous, facts: [...previous.facts, fact('manual:new', 'An editor correction.')] },
      { playthroughId: '123', loads: game().loads, previous })
    release({ ok: true, data: snapshot(saved[0]) })
    await rejected
    await edit
    expect(game().exNpcWatch.scenes).toEqual([])
    expect(saved.at(-1)?.exNpcWatch?.scenes).toEqual([])
    expect(game().exStoryMemory.facts.at(-1)?.id).toBe('manual:new')
    expect(saved.at(-1)?.exStoryMemory?.facts.at(-1)?.id).toBe('manual:new')
  })

  it('keeps the social archives separate through disabled save/load and the New Game+ carry', async () => {
    await watch()
    await regenerateTextReply('a', persistRegeneratedConversation)
    useModsStore.setState({ switches: { on: { 'story-memory': false, 'meanwhile-conversations': false,
      'venus-whisper': false, 'text-regeneration': false }, options: {} } })
    useGameStore.setState({ date: FINAL_DATE, time: 0, graduationSeen: true })
    const old = snapshot()
    game().loadSave(old, record, cast)
    expect(currentStorySnapshot()).toBeUndefined()
    // What Continue hands the next semester: the game's own carry, and the mods' beside it.
    const { carry } = carryOf(game(), semesterOf(record))
    const mods = modFieldsLeaving(snapshot(), { playthroughId: '123', index: 0, season: 'spring', characters: cast })
    const roundTrip = JSON.parse(JSON.stringify(mods)) as typeof mods
    game().reset()
    useGameStore.setState({ playthroughId: '456', date: 0, time: 0, chars: ['a'], characters: { a: cast.a }, charInfo: { a: charInfo() } })
    // The opening save as New Game+ composes it: the mods' fields, and the threads its own carry moved.
    const opening = { ...game().toGameSave(), ...carriedModFields(roundTrip), bunnyboard: carry.bunnyboard }
    game().loadSave({ ...opening, playthroughId: '456', saveId: 'opening', saveDate: 0 },
      playthroughRecord({ chars: ['a'] }), { a: cast.a })
    const archive = meanwhileEvents(game())
    expect(archive).toHaveLength(1)
    expect(archive[0]).toMatchObject({ date: 8 - semesterShiftOf('spring'), origin: { term: 0, day: 8 }, participantNames: { b: 'Mina Rose' } })
    expect(archive[0].lines).toEqual(lines)
    expect(game().exVenusWhisper.discovery).toEqual(old.exVenusWhisper?.discovery)
    expect(game().exVenusWhisper.issues).toEqual(old.exVenusWhisper?.issues)
    expect(whisperRecall(game().exVenusWhisper, 1, 0, ['a'])).toEqual([])
    expect(game().exStoryMemory.encounterEdits['term:0:encounter:4:1']).toEqual({ hidden: true })
    expect(game().bunnyboard.conversations.a.summary).toBe('Replacement summary')
    expect(game().bunnyboard.conversations.a.messages.at(-1)?.exReplyTo).toBe('sent')
    expect(game().bunnyboard.conversations.a.messages.at(-1)?.date).toBe(9 - semesterShiftOf('spring'))
    useModsStore.setState({ switches: { on: {}, options: {} } })
    expect(textRegenerationTarget('a')).toBeNull()
    const recall = storySnapshot(game())!
    expect(recall.records.some(r => r.id === 'term:0:manual:old')).toBe(true)
    expect(recall.records.some(r => r.id === 'term:0:encounter:4:1')).toBe(false)
    expect(JSON.stringify(recall)).not.toContain('SPECTATOR_ONLY_QA5')
    expect(JSON.stringify(recall)).not.toContain('PUBLIC_GOSSIP_QA5')
  })

  it('does not promote generated spectator dialogue or private corrections into newsletter sources or canonical recall', async () => {
    const before = storySnapshot(game())!
    await watch()
    expect(storySnapshot(game())).toEqual(before)
    expect(game().history).toEqual({ 4: { 0: 'Sarah discussed the library book.', 1: 'A hidden recap.' } })
    expect(whisperSources(game())).toEqual([])
    expect(normalizeMeanwhile(saved.at(-1)?.exNpcWatch).scenes[0].lines).toEqual(lines)
    expect(JSON.stringify(whisperSources(game()))).not.toMatch(/SPECTATOR_ONLY_QA5|PRIVATE_FACT_QA5/)
  })
})
