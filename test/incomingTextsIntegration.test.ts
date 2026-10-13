import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { GameSave } from '@shared/types'
import { NO_SWITCHES, withMod } from '@shared/mods'
import { TEXT_REGENERATION_MOD, latestTextReply } from '@shared/textRegeneration'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { resetTextingLoop, sendIncomingMessage, sendMessage } from '../src/renderer/stores/textingLoop'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, stubApi } from './fixtures'

vi.mock('../src/renderer/stores/photoTurn', () => ({ sendPhoto: vi.fn() }))

const thread = () => useGameStore.getState().bunnyboard.conversations.a

beforeEach(() => {
  vi.useFakeTimers()
  resetTextingLoop()
  useGameStore.getState().reset()
  useBunnyboardStore.getState().reset()
  useModsStore.setState({ switches: NO_SWITCHES })
  useGameStore.setState({
    playthroughId: 'p', date: 7, time: 0, chars: ['a'],
    characters: charactersById(character({ charId: 'a' })),
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo({ nameKnown: true }) },
    bunnyboard: { ...useGameStore.getState().bunnyboard, conversations: { a: {
      charId: 'a', unread: 0, summary: null, messages: []
    } } }
  })
})

afterEach(() => {
  resetTextingLoop()
  restoreApi()
  vi.useRealTimers()
  vi.clearAllMocks()
})

function api() {
  const complete = vi.fn<typeof window.api.llm.completeTexting>().mockResolvedValue({
    ok: true, data: { messages: ['Hello!'], summary: 'She said hello.', sendPhoto: true,
      photoPrompt: 'A selfie at the campus cafe', photoTier: 'everyday' }
  })
  stubApi({
    jobs: { onProgress: () => () => {} },
    llm: { onTextingDelta: () => () => {}, completeTexting: complete,
      classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } }) }
  })
  return complete
}

async function finish(turn: Promise<void>) {
  await vi.advanceTimersByTimeAsync(60_000)
  await turn
}

describe('Incoming Texts in the combined package', () => {
  it.each([true, false])('keeps incoming turns out of regeneration across save/load (regeneration initially %s)', async (on) => {
    api()
    useModsStore.setState({ switches: withMod(NO_SWITCHES, TEXT_REGENERATION_MOD, on) })
    await finish(sendMessage('a', 'How are you?'))
    expect(latestTextReply(thread(), 7, 0)).not.toBeNull()
    await finish(sendIncomingMessage('a', 'She starts a new conversation'))
    expect(latestTextReply(thread(), 7, 0)).toBeNull()

    const game = useGameStore.getState()
    const save: GameSave = { ...game.toGameSave(), playthroughId: 'p', saveId: 'test', saveDate: Date.now() }
    const serialized = JSON.stringify(save)
    expect(serialized).not.toContain('She starts a new conversation')
    game.loadSave(JSON.parse(serialized), playthroughRecord({ chars: ['a'] }), game.characters)
    useModsStore.setState({ switches: NO_SWITCHES })
    expect(latestTextReply(thread(), 7, 0)).toBeNull()
    await finish(sendMessage('a', 'Thanks'))
    expect(latestTextReply(thread(), 7, 0)?.sent.text).toBe('Thanks')
  })

  it('passes incoming replies through the real photo registration and preserves its schema', async () => {
    const complete = api()
    await import('../src/renderer/modEntries/photo-feature')
    const { sendPhoto } = await import('../src/renderer/stores/photoTurn')
    await finish(sendIncomingMessage('a', 'She sends a selfie'))
    expect(complete.mock.calls[0][0].schema.schema.properties).toHaveProperty('sendPhoto')
    expect(sendPhoto).toHaveBeenCalledWith('a', useGameStore.getState().characters.a,
      expect.objectContaining({ sendPhoto: true, photoPrompt: 'A selfie at the campus cafe' }))
    expect(thread().messages.every(m => m.sender === 'contact')).toBe(true)
  })
})
