import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatMessage, Result } from '@shared/types'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

const mocks = vi.hoisted(() => ({ render: vi.fn() }))
vi.mock('../src/renderer/stores/photoWebp', () => ({ renderPhoto: mocks.render }))
vi.mock('../src/renderer/stores/photoTipDelivery', () => ({ tellAboutDmPhotos: vi.fn() }))
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useSettingsStore } = await import('../src/renderer/stores/settingsStore')
const { useSetupStore } = await import('../src/renderer/stores/setupStore')
const local = await import('../src/renderer/stores/localPhotoStore')
const { setPhotoSwitches } = await import('../src/shared/photoSwitches')
const turn = await import('../src/renderer/stores/photoTurn')
const girl = character({ charId: 'a' })
const earlyFile = 'sarah_chat_001.png'
const lead = { sendPhoto: true, photoPrompt: 'Coffee at the campus cafe', photoTier: 'everyday' }
const reserve = vi.fn(), drop = vi.fn()
let finish: (result: Result<string>) => void

/** Appends the final reply, or the delivery failure the texting loop would file. */
function reply(error = false): void {
  const message: ChatMessage = { id: 'reply', sender: error ? 'system' : 'contact',
    text: error ? 'Delivery failed' : 'Here is my coffee.', date: 0, time: 0, ...(error ? { error: true } : {}) }
  useGameStore.setState(s => ({ bunnyboard: { ...s.bunnyboard, conversations: {
    a: { ...s.bunnyboard.conversations.a, messages: [...s.bunnyboard.conversations.a.messages, message] }
  } } }))
}

/** Reads the actual message records which a subsequent save would carry. */
function messages(): ChatMessage[] {
  return useGameStore.getState().bunnyboard.conversations.a.messages
}

beforeEach(() => {
  useGameStore.getState().reset()
  setPhotoSwitches({ on: true, photos: true, explicit: true, webp: false })
  useSettingsStore.setState({ settings: { comfyDeferred: false } as never })
  useSetupStore.setState({ status: { comfyReady: true } as never })
  useGameStore.setState(s => ({ playthroughId: '1', date: 0, time: 0,
    characters: charactersById(girl), charInfo: { a: charInfo({ flags: { ...charInfo().flags,
      gaveContactInfo: true, hasCrush: true } }) },
    bunnyboard: { ...s.bunnyboard, conversations: { a: { charId: 'a', unread: 0, summary: null,
      messages: [{ id: 'ask', sender: 'player', text: 'Send a coffee photo?', date: 0, time: 0 }] } } }
  }))
  vi.spyOn(local, 'savePhotoState').mockImplementation(() => {})
  reserve.mockReset().mockResolvedValue({ ok: true, data: 'sarah_chat_002.png' })
    .mockResolvedValueOnce({ ok: true, data: earlyFile })
  drop.mockReset().mockResolvedValue({ ok: true, data: undefined })
  mocks.render.mockReset().mockResolvedValue({ ok: true, data: 'sarah_chat_002.png' })
    .mockImplementationOnce(() => new Promise<Result<string>>(resolve => { finish = resolve }))
  stubApi({ jobs: { onProgress: () => () => {} }, photo: { reserveName: reserve, drop } })
})
afterEach(() => {
  turn.clearEarlyPhotos()
  restoreApi()
  vi.restoreAllMocks()
})

describe('an early DM photo while the reply is still being written', () => {
  it.each(['load', 'switched-off', 'blocked', 'failed', 'different-prompt', 'no-photo', 'different-tier'] as const)(
    'never attaches an abandoned render and drops it after settling: %s', async outcome => {
      turn.startDmPhoto('a', girl, lead)
      await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce())
      if (outcome === 'load') useGameStore.setState(s => ({ loads: s.loads + 1 }))
      if (outcome === 'switched-off') setPhotoSwitches({ on: false })
      if (outcome === 'blocked') useGameStore.setState(s => ({ charInfo: {
        a: { ...s.charInfo.a, flags: { ...s.charInfo.a.flags, blocked: true } }
      } }))
      if (outcome === 'failed') reply(true)
      if (outcome === 'blocked' || outcome === 'switched-off' || outcome.startsWith('different-') || outcome === 'no-photo') {
        reply()
        await turn.sendPhoto('a', girl, { ...lead,
          ...(outcome === 'blocked' ? { blocked: true } : {}),
          ...(outcome === 'different-prompt' ? { photoPrompt: 'A walk beside the library' } : {}),
          ...(outcome === 'different-tier' ? { photoTier: 'suggestive' } : {}),
          ...(outcome === 'no-photo' ? { sendPhoto: false } : {})
        }, true)
      }
      expect(messages().some(message => message.photo?.file === earlyFile)).toBe(false)
      expect(drop).not.toHaveBeenCalled()
      finish({ ok: true, data: earlyFile })
      await vi.waitFor(() => expect(drop).toHaveBeenCalledExactlyOnceWith('1', 'a', earlyFile))
      expect(messages().some(message => message.photo?.file === earlyFile)).toBe(false)
    }
  )

  it('attaches the matching running render and settles the same file without rendering again', async () => {
    turn.startDmPhoto('a', girl, lead)
    await vi.waitFor(() => expect(mocks.render).toHaveBeenCalledOnce())
    reply()
    await turn.sendPhoto('a', girl, lead, true)
    expect(messages().at(-1)?.photo).toMatchObject({ file: earlyFile, pending: true })
    expect(reserve).toHaveBeenCalledOnce()
    expect(mocks.render).toHaveBeenCalledOnce()
    finish({ ok: true, data: earlyFile })
    await vi.waitFor(() => expect(messages().at(-1)?.photo).toEqual({
      file: earlyFile, tier: 'everyday', scene: lead.photoPrompt
    }))
    expect(drop).not.toHaveBeenCalled()
    expect(mocks.render).toHaveBeenCalledOnce()
  })
})
