import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Conversation, GameSave, Result, TextingResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { regenerateTextReply, resetTextingLoop, retryFailedMessage, sendMessage } from '../src/renderer/stores/textingLoop'
import { persistRegeneratedConversation, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { leaveToMenu } = await import('../src/renderer/stores/gameLoop')
const game = () => useGameStore.getState()
const chars = charactersById(character({ charId: 'a' }), character({ charId: 'b', firstName: 'Mina' }))
const answer: TextingResponse = { messages: ['Replacement'], summary: 'Fresh summary', blocked: false }
const thread = (charId: string): Conversation => ({ charId, unread: 0, summary: 'Original summary',
  exTextBase: { replyTo: `sent-${charId}`, summary: 'Prior summary' }, messages: [
    { id: `sent-${charId}`, sender: 'player', text: 'How was your day?', date: 7, time: 0 },
    { id: `reply-${charId}`, sender: 'contact', text: 'Original reply', date: 7, time: 0, exReplyTo: `sent-${charId}` }
  ] })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}

beforeEach(() => {
  resetTextingLoop(); resetLoopState(); game().reset(); useBunnyboardStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  useGameStore.setState({ playthroughId: '123', date: 7, time: 0, chars: ['a', 'b'], characters: chars,
    charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
    charInfo: { a: charInfo({ nameKnown: true }), b: charInfo({ nameKnown: true }) },
    bunnyboard: { ...game().bunnyboard, conversations: { a: thread('a'), b: thread('b') } } })
})
afterEach(async () => {
  resetTextingLoop(); await writesSettled(); resetLoopState(); restoreApi(); vi.restoreAllMocks()
})

async function exercise(oldCharacter: string, settleOldFirst: boolean, retry = false) {
  const old = deferred<Result<TextingResponse>>(), replacement = deferred<Result<TextingResponse>>()
  const complete = vi.fn<typeof window.api.llm.completeTexting>()
  if (retry) complete.mockResolvedValueOnce({ ok: false, error: { code: 'QA4_FAIL', message: 'Synthetic failure' } })
  complete.mockImplementationOnce(() => old.promise).mockImplementationOnce(() => replacement.promise)
  const save = vi.fn<typeof window.api.saves.autosave>().mockImplementation(async (id, draft) => ({
    ok: true, data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 }
  }))
  const classify = vi.fn<typeof window.api.llm.classifyHangout>().mockResolvedValue({
    ok: true, data: { playerAsked: false, characterOffered: false, description: '' }
  })
  stubApi({ jobs: { cancelGroup: async () => ({ ok: true, data: undefined }) }, llm: {
    onTextingDelta: () => () => {}, completeTexting: complete, classifyHangout: classify
  }, saves: { autosave: save } })
  const checkpoint: GameSave = { ...game().toGameSave(), playthroughId: '123', saveId: 'prior', saveDate: 0 }
  if (retry) await sendMessage(oldCharacter, 'A failed outgoing message')
  const oldTurn = retry ? retryFailedMessage(oldCharacter) : sendMessage(oldCharacter, 'An abandoned outgoing message')
  expect(complete).toHaveBeenCalledTimes(retry ? 2 : 1)
  await leaveToMenu()
  expect(game().playthroughId).toBeNull()
  // Hydrate the saved landing through the production load action. Calling enterGame would
  // additionally request fresh slot narration, which is unrelated to this texting race.
  game().loadSave(checkpoint, playthroughRecord({ chars: ['a', 'b'] }), chars)
  expect(game().bunnyboard.conversations.a.messages.at(-1)?.text).toBe('Original reply')
  if (settleOldFirst) { old.resolve({ ok: true, data: answer }); await oldTurn }
  const nextTurn = regenerateTextReply('a', persistRegeneratedConversation)
    .then(value => ({ value, error: undefined }), error => ({ value: undefined, error: String(error) }))
  expect(useBunnyboardStore.getState().busyCharIds).toContain('a')
  if (!settleOldFirst) { old.resolve({ ok: true, data: answer }); await oldTurn }
  const busyAfterOldSettles = useBunnyboardStore.getState().busyCharIds.includes('a')
  replacement.resolve({ ok: true, data: answer })
  const outcome = await nextTurn
  return { busyAfterOldSettles, outcome, save, classify, complete }
}

describe('QA4 abandoned ordinary DM versus regenerated reply after load', () => {
  it.each([false, true])('does not let an abandoned send/retry (%s) invalidate the new regeneration', async retry => {
    const result = await exercise('a', false, retry)
    expect.soft(result.busyAfterOldSettles).toBe(true)
    expect.soft(result.outcome.error).toBeUndefined()
    expect.soft(result.outcome.value).toEqual({ replaced: 1, created: 1 })
    expect.soft(result.save).toHaveBeenCalledOnce()
    expect.soft(game().bunnyboard.conversations.a.messages.at(-1)?.text).toBe('Replacement')
  })
  it('control: an old request for a different character does not invalidate the new regeneration', async () => {
    const result = await exercise('b', false)
    expect(result.busyAfterOldSettles).toBe(true)
    expect(result.outcome.error).toBeUndefined()
    expect(result.save).toHaveBeenCalledOnce()
    expect(game().bunnyboard.conversations.a.messages.at(-1)?.text).toBe('Replacement')
  })
  it('control: an old same-character request settled before regeneration cannot invalidate it', async () => {
    const result = await exercise('a', true)
    expect(result.busyAfterOldSettles).toBe(true)
    expect(result.outcome.error).toBeUndefined()
    expect(result.save).toHaveBeenCalledOnce()
    expect(game().bunnyboard.conversations.a.messages.at(-1)?.text).toBe('Replacement')
  })
})
