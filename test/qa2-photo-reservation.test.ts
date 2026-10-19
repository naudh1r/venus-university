import { afterEach, expect, it, vi } from 'vitest'
import type { ChatMessage, Result } from '@shared/types'
import { setPhotoSwitches } from '@shared/photoSwitches'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { sendPhoto } from '../src/renderer/stores/photoTurn'
import * as localPhoto from '../src/renderer/stores/localPhotoStore'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

afterEach(() => { restoreApi(); vi.restoreAllMocks(); useGameStore.getState().reset() })

it.each(['replacement', 'reload', 'disabled'] as const)('never renders a photo when %s overtakes its name reservation', async change => {
  useGameStore.getState().reset()
  const girl = character({ charId: 'a' })
  const message: ChatMessage = { id: 'first', sender: 'contact', text: 'My coffee.', date: 0, time: 0 }
  useGameStore.setState(s => ({ playthroughId: '123', characters: { a: girl }, charInfo: { a: charInfo({ flags: { ...charInfo().flags, gaveContactInfo: true } }) },
    bunnyboard: { ...s.bunnyboard, conversations: { a: { charId: 'a', unread: 0, summary: null, messages: [message] } } } }))
  setPhotoSwitches({ photos: true })
  const allowed = vi.spyOn(localPhoto, 'canSendPhotos').mockReturnValue(true)
  let finish!: (value: Result<string>) => void
  const reserve = vi.fn(() => new Promise<Result<string>>(resolve => { finish = resolve }))
  const generate = vi.fn()
  stubApi({ jobs: { onProgress: () => () => {} }, photo: { reserveName: reserve, generate } })
  const pending = sendPhoto('a', girl, { messages: [message.text], summary: '', blocked: false,
    sendPhoto: true, photoPrompt: 'A cup of coffee', photoTier: 'everyday' })
  expect(reserve).toHaveBeenCalledOnce()
  if (change === 'replacement') useGameStore.setState(s => ({ bunnyboard: { ...s.bunnyboard, conversations: {
    a: { ...s.bunnyboard.conversations.a, messages: [{ ...message, id: 'replacement' }] }
  } } }))
  if (change === 'reload') useGameStore.setState(s => ({ loads: s.loads + 1 }))
  if (change === 'disabled') allowed.mockReturnValue(false)
  finish({ ok: true, data: 'girl_chat_001.png' })
  await pending
  expect(generate).not.toHaveBeenCalled()
  expect(useGameStore.getState().bunnyboard.conversations.a.messages[0].photo).toBeUndefined()
})
