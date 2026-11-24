import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSave, Result, SaveDraft, StructuredRequest, TextingResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useLorebookStore } from '../src/renderer/stores/lorebookStore'
import { regenerateTextReply, resetTextingLoop, sendMessage } from '../src/renderer/stores/textingLoop'
import { persistRegeneratedConversation, writesSettled } from '../src/renderer/stores/loop/saves'
import '../src/renderer/modEntries/character-dynamics'
import '../src/renderer/modEntries/reckoning'
import '../src/renderer/modEntries/breakthrough'
import '../src/renderer/modEntries/story-memory'
import { calendarEvent, character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const answer: TextingResponse = { messages: ['Hello there.'], summary: 'An ordinary greeting.', blocked: false }

beforeEach(() => {
  vi.useFakeTimers(); resetTextingLoop(); game().reset(); useBunnyboardStore.getState().reset()
  useLorebookStore.getState().drop()
  useModsStore.setState({ switches: { on: { 'character-dynamics': true }, options: {} } })
  useGameStore.setState({ playthroughId: 'qa-regen', date: 7, time: 0, chars: ['a'],
    characters: charactersById(character({ charId: 'a' })), charKeyToId: { sarah_rose: 'a' },
    charInfo: { a: charInfo({ nameKnown: true }) },
    events: [calendarEvent({ date: 9, description: 'Our reserved planetarium visit', charIds: ['a'] })],
    exCharacterDynamics: { version: 1, characters: { a: {
      relationship: { kind: 'ex-girlfriend', reason: 'They separated after moving to different cities.' },
      traits: ['guarded'], growth: { id: 'qa-growth', name: 'New confidence',
        description: 'She learned to voice her needs.', reframes: ['Asking is allowed.', 'A no is survivable.', 'Her feelings matter.'] }
    } } },
    bunnyboard: { ...game().bunnyboard, conversations: { a: { charId: 'a', unread: 0, summary: null, messages: [] } } } })
})

afterEach(async () => { resetTextingLoop(); await writesSettled(); restoreApi(); vi.useRealTimers(); vi.restoreAllMocks() })

async function requests() {
  const complete = vi.fn(async (_r: StructuredRequest): Promise<Result<TextingResponse>> => ({ ok: true, data: answer }))
  stubApi({ llm: { completeTexting: complete, onTextingDelta: () => () => {},
    classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } }) },
    jobs: { onProgress: () => () => {} },
    saves: { autosave: async (_p: string, draft: SaveDraft): Promise<Result<GameSave>> => ({ ok: true, data: { ...draft, playthroughId: 'qa-regen', saveId: 'autosave', saveDate: 0 } }) } })
  const sent = sendMessage('a', 'Hello!')
  await vi.advanceTimersByTimeAsync(60_000); await sent
  await regenerateTextReply('a', persistRegeneratedConversation)
  expect(complete).toHaveBeenCalledTimes(2)
  return { normal: complete.mock.calls[0][0].user, replacement: complete.mock.calls[1][0].user,
    normalRequest: complete.mock.calls[0][0], replacementRequest: complete.mock.calls[1][0] }
}

describe('QA2 ordinary and regenerated DM continuity parity', () => {
  it('keeps the same Character Dynamics starting relationship and nudges', async () => {
    const { normal, replacement } = await requests()
    expect(normal).toContain('They separated after moving to different cities.')
    expect(normal).toContain('Gentle tendencies: Guarded:')
    expect(replacement).toContain('They separated after moving to different cities.')
    expect(replacement).toContain('Gentle tendencies: Guarded:')
  })
  it.each([true, false])('keeps earned growth with Character Dynamics %s', async enabled => {
    useModsStore.setState({ switches: { on: { 'character-dynamics': enabled, reckoning: true }, options: {} } })
    const { normal, replacement } = await requests()
    expect(normal).toContain('She learned to voice her needs.')
    expect(replacement).toContain('She learned to voice her needs.')
  })
  it('keeps the actual saved upcoming plans when rebuilding a reply', async () => {
    const { normal, replacement } = await requests()
    expect(normal).toContain('Our reserved planetarium visit')
    expect(replacement).toContain('Our reserved planetarium visit')
  })
  it('retains Breakthrough continuity through its fallback to the active save', async () => {
    useGameStore.setState(s => ({ exBreakthrough: { ...s.exBreakthrough, moments: { a: [
      { id: 'qa-bt', date: 6, time: 1, outcome: 'Sarah promised to send her violin recording.' }
    ] } } }))
    const { normal, replacement } = await requests()
    expect(normal).toContain('Sarah promised to send her violin recording.')
    expect(replacement).toContain('Sarah promised to send her violin recording.')
  })
  it('retains Story Memory recall input through its active-save fallback', async () => {
    useModsStore.setState(s => ({ switches: { ...s.switches, on: { ...s.switches.on, 'story-memory': true } } }))
    useGameStore.setState({ playthroughId: '123456789', history: { 6: { 0: 'Sarah discussed her violin recording.' } } })
    const { normalRequest, replacementRequest } = await requests()
    expect(normalRequest.storyMemory).toBeDefined()
    expect(normalRequest.storyMemory?.records).toHaveLength(1)
    expect(replacementRequest.storyMemory).toEqual(normalRequest.storyMemory)
  })
  it('includes current native lorebook edits beside Story Memory in ordinary and regenerated texts', async () => {
    useLorebookStore.setState({ book: [{ handle: 'custom1', custom: true, keys: ['Hello'], text: 'Hello is the name of Sarah’s campus radio show.' }] })
    useModsStore.setState(s => ({ switches: { ...s.switches, on: { ...s.switches.on, 'story-memory': true } } }))
    useGameStore.setState({ playthroughId: '123456789', history: { 6: { 0: 'Sarah discussed her violin recording.' } } })
    const { normal, replacement, normalRequest, replacementRequest } = await requests()
    expect(normal).toContain('campus radio show')
    expect(replacement).toContain('campus radio show')
    expect(normalRequest.storyMemory?.records).toHaveLength(1)
    expect(replacementRequest.storyMemory).toEqual(normalRequest.storyMemory)
  })
})
