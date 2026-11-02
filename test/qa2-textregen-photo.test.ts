import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GameSave, Result, SaveDraft, StructuredRequest, TextingResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { regenerateTextReply, resetTextingLoop, sendMessage } from '../src/renderer/stores/textingLoop'
import { persistRegeneratedConversation, writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

vi.mock('../src/renderer/stores/photoTurn', () => ({ sendPhoto: vi.fn() }))
const game = () => useGameStore.getState()
// Every case imports Photo Feature's entry, which loads the kit's renderer side: slow under a full run.
vi.setConfig({ testTimeout: 20_000 })

beforeEach(() => {
  vi.useFakeTimers(); resetTextingLoop(); game().reset(); useBunnyboardStore.getState().reset()
  useModsStore.setState({ switches: { on: { 'photo-feature': true }, options: {} } })
  useGameStore.setState({ playthroughId: 'qa-photo', date: 7, time: 0, chars: ['a'],
    characters: charactersById(character({ charId: 'a' })), charKeyToId: { sarah_rose: 'a' },
    charInfo: { a: charInfo({ nameKnown: true }) },
    bunnyboard: { ...game().bunnyboard, conversations: { a: { charId: 'a', unread: 0, summary: null, messages: [] } } } })
})
afterEach(async () => { resetTextingLoop(); await writesSettled(); restoreApi(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks() })

it.each(['accepted', 'failed-save', 'load-during-save', 'new-hangout', 'blocked'] as const)('dispatches a promised replacement photo only after a valid commit: %s', async outcome => {
  const answer: TextingResponse = { messages: ['Here is my coffee photo.'], summary: 'She sent a coffee photo.', blocked: false,
    sendPhoto: true, photoPrompt: 'A cup of coffee at the campus cafe', photoTier: 'everyday' }
  const complete = vi.fn(async (_r: StructuredRequest): Promise<Result<TextingResponse>> => ({ ok: true, data: answer }))
  complete.mockResolvedValueOnce({ ok: true, data: { messages: ['The coffee is great today.'], summary: 'They talked about coffee.', blocked: false, sendPhoto: false } })
  stubApi({ llm: { completeTexting: complete, onTextingDelta: () => () => {},
    classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } }) },
    jobs: { onProgress: () => () => {} },
    saves: { autosave: async (_p: string, draft: SaveDraft): Promise<Result<GameSave>> => ({ ok: true, data: { ...draft, playthroughId: 'qa-photo', saveId: 'autosave', saveDate: 0 } }) } })
  const localPhoto = await import('../src/renderer/stores/localPhotoStore')
  vi.spyOn(localPhoto, 'canSendPhotos').mockReturnValue(true)
  await import('../src/renderer/modEntries/photo-feature')
  const { sendPhoto } = await import('../src/renderer/stores/photoTurn')
  const sent = sendMessage('a', 'Send a coffee photo?')
  await vi.advanceTimersByTimeAsync(60_000); await sent
  expect(sendPhoto).toHaveBeenCalledOnce()
  expect(sendPhoto).toHaveBeenCalledWith('a', game().characters.a, expect.objectContaining({ sendPhoto: false }), true)
  expect(game().bunnyboard.conversations.a.messages.at(-1)?.photo).toBeUndefined()
  vi.mocked(sendPhoto).mockClear()
  const original = game().bunnyboard.conversations.a
  if (outcome === 'new-hangout') vi.spyOn(window.api.llm, 'classifyHangout').mockResolvedValueOnce({ ok: true, data: { playerAsked: true, characterOffered: false, description: 'Meet now.' } })
  if (outcome === 'blocked') complete.mockResolvedValueOnce({ ok: true, data: { ...answer, blocked: true } })
  if (outcome === 'failed-save') vi.spyOn(window.api.saves, 'autosave').mockResolvedValueOnce({ ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'disk full' } })
  if (outcome === 'load-during-save') vi.spyOn(window.api.saves, 'autosave').mockImplementationOnce(async (_p, draft) => {
    useGameStore.setState(s => ({ loads: s.loads + 1 }))
    return { ok: true, data: { ...draft, playthroughId: 'qa-photo', saveId: 'autosave', saveDate: 0 } }
  })
  const regenerated = regenerateTextReply('a', persistRegeneratedConversation)
  if (outcome !== 'accepted') {
    await expect(regenerated).rejects.toThrow()
    expect(sendPhoto).not.toHaveBeenCalled()
    expect(game().bunnyboard.conversations.a).toBe(original)
    return
  }
  await regenerated
  const request = complete.mock.calls[1][0]
  expect(request.schema.schema.properties).toHaveProperty('sendPhoto')
  expect(game().bunnyboard.conversations.a.messages.at(-1)?.text).toBe('Here is my coffee photo.')
  expect(sendPhoto).toHaveBeenCalledWith('a', game().characters.a, expect.objectContaining({ sendPhoto: true }), true)
})
