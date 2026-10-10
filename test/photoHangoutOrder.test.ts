import { afterEach, expect, it, vi } from 'vitest'
import type { Result } from '@shared/types'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

afterEach(() => { vi.useRealTimers(); restoreApi() })

it('shows the hangout only after its photo bubble is attached, without waiting for image rendering', async () => {
  vi.resetModules()
  vi.useFakeTimers()
  let reserve!: (result: Result<string>) => void
  const generate = vi.fn(() => new Promise<Result<string>>(() => {}))
  stubApi({
    jobs: { onProgress: () => () => {} },
    saves: { autosave: async () => ({ ok: true, data: {} as never }) },
    photo: { reserveName: () => new Promise(resolve => { reserve = resolve }), generate },
    llm: {
      onTextingDelta: () => () => {},
      completeTexting: async () => ({ ok: true, data: {
        messages: ['Yes, come over.'], sendPhoto: true, photoPrompt: 'me at the library', photoTier: 'everyday'
      } }),
      classifyHangout: async () => ({ ok: true, data: {
        playerAsked: true, characterOffered: false, description: 'Coffee with Sarah.',
        outcome: 'accepted', playerQuote: 'Come over?', replyQuote: 'Yes, come over.'
      } })
    }
  })
  const game = (await import('../src/renderer/stores/gameStore')).useGameStore
  const phone = (await import('../src/renderer/stores/bunnyboardStore')).useBunnyboardStore
  const texting = await import('../src/renderer/stores/textingLoop')
  await import('../src/renderer/modEntries/photo-feature')
  await import('../src/renderer/modEntries/strict-schema')
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: id => id === 'strict-schema' || id === 'photo-feature', order: () => 0 })
  const { setPhotoSwitches } = await import('../src/shared/photoSwitches')
  setPhotoSwitches({ photos: true })
  const settings = (await import('../src/renderer/stores/settingsStore')).useSettingsStore
  settings.setState({ settings: { comfyDeferred: false } as never })
  const setup = (await import('../src/renderer/stores/setupStore')).useSetupStore
  setup.setState({ status: { comfyReady: true } as never })
  const loopHooks = await import('../src/renderer/stores/loop/hooks')
  loopHooks.registerHangoutEntry({ prefetchHangoutScene: async () => {}, startHangoutScene: async () => {} })
  game.getState().reset()
  phone.getState().reset()
  const sarah = character({ charId: 'a' })
  game.setState({ playthroughId: '1', date: 7, time: 0, chars: ['a'], characters: charactersById(sarah),
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo({ flags: { ...charInfo().flags, gaveContactInfo: true }, nameKnown: true }) }
  })
  const pending = texting.sendMessage('a', 'Come over?')
  await vi.advanceTimersByTimeAsync(10_000)
  const lastReply = () => game.getState().bunnyboard.conversations.a?.messages.filter(m => m.sender === 'contact').at(-1)
  expect(lastReply()?.text).toBe('Yes, come over.')
  expect(lastReply()?.photo).toBeUndefined()
  expect(phone.getState().armedHangout).toBeNull()
  reserve({ ok: true, data: 'sarah_chat_001.png' })
  await pending
  expect(lastReply()?.photo).toMatchObject({ file: 'sarah_chat_001.png', pending: true })
  expect(generate).toHaveBeenCalledOnce()
  expect(phone.getState().armedHangout?.charId).toBe('a')
})
