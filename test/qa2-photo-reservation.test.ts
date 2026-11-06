import { savedPhoto } from '../src/shared/photoTypes'
import { photoCalls } from './fixtures/photoCalls'
import { afterEach, expect, it, vi } from 'vitest'
import type { ChatMessage, Result } from '@shared/types'
import { setPhotoSwitches } from '@shared/photoSwitches'
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { sendPhoto } = await import('../src/renderer/stores/photoTurn')
const localPhoto = await import('../src/renderer/stores/localPhotoStore')
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// These overtaken reservations never reach a photo tip.
vi.mock('../src/renderer/stores/photoTipDelivery', () => ({ tellAboutDmPhotos: vi.fn() }))

afterEach(() => { restoreApi(); vi.restoreAllMocks(); useGameStore.getState().reset() })

it.each(['replacement', 'reload', 'disabled'] as const)('never renders a photo when %s overtakes its name reservation', async change => {
  useGameStore.getState().reset()
  const girl = character({ charId: 'a' })
  const message: ChatMessage = { id: 'first', sender: 'contact', text: 'My coffee.', date: 0, time: 0 }
  useGameStore.setState(s => ({ playthroughId: '123', chars: ['a'], characters: { a: girl }, charInfo: { a: charInfo({ flags: { ...charInfo().flags, gaveContactInfo: true } }) },
    bunnyboard: { ...s.bunnyboard, conversations: { a: { charId: 'a', unread: 0, summary: null, messages: [message] } } } }))
  setPhotoSwitches({ photos: true })
  const allowed = vi.spyOn(localPhoto, 'canSendPhotos').mockReturnValue(true)
  let finish!: (value: Result<string>) => void
  const reserve = vi.fn(() => new Promise<Result<string>>(resolve => { finish = resolve }))
  const generate = vi.fn()
  stubApi({ jobs: { onProgress: () => () => {} }, ...photoCalls({ reserveName: reserve, generate }) })
  const pending = sendPhoto('a', girl, { messages: [message.text], summary: '', blocked: false,
    sendPhoto: true, photoPrompt: 'A cup of coffee', photoTier: 'everyday' })
  expect(reserve).toHaveBeenCalledOnce()
  if (change === 'replacement') useGameStore.setState(s => ({ bunnyboard: { ...s.bunnyboard, conversations: {
    a: { ...s.bunnyboard.conversations.a, messages: [{ ...message, id: 'replacement' }] }
  } } }))
  if (change === 'reload') (await import('../src/renderer/stores/loop/state')).resetLoopState()
  if (change === 'disabled') allowed.mockReturnValue(false)
  finish({ ok: true, data: 'girl_chat_001.png' })
  await pending
  expect(generate).not.toHaveBeenCalled()
  expect(savedPhoto(useGameStore.getState().bunnyboard.conversations.a.messages[0] ?? {})).toBeNull()
})
