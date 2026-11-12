import { expect, it, vi } from 'vitest'
import { BUNNYBOT_CHAT_ID, FRIENDS_INTRO_SLOT } from '../src/renderer/prompts/bunnybot'

const { game, deliver } = vi.hoisted(() => ({
  game: {
    date: 0, time: 0, bunnybotThrough: -1,
    bunnyboard: { conversations: {} as Record<string, { messages: { text: string; date: number; time: 0 }[] }> }
  },
  deliver: vi.fn()
}))
vi.mock('../src/renderer/stores/gameStore', () => ({ useGameStore: { getState: () => game } }))
vi.mock('../src/renderer/stores/textingLoop', () => ({ deliverBunnybotNow: deliver }))
import { bunnybotSays } from '../src/renderer/mods/bunnybot'

it('waits for the introduction and uses the saved thread for an exact once mark', () => {
  const lines = ['A tip.', 'Already said.']
  game.bunnybotThrough = FRIENDS_INTRO_SLOT - 1
  expect(bunnybotSays('photo-feature', lines, { once: lines[1] })).toBe(false)
  expect(deliver).not.toHaveBeenCalled()

  game.bunnybotThrough = FRIENDS_INTRO_SLOT
  expect(bunnybotSays('photo-feature', lines, { once: lines[1] })).toBe(true)
  expect(deliver).toHaveBeenLastCalledWith(lines)
  game.bunnyboard.conversations[BUNNYBOT_CHAT_ID] = { messages: [{ text: lines[1], date: 0, time: 0 }] }
  expect(bunnybotSays('photo-feature', lines, { once: lines[1] })).toBe(false)
  expect(deliver).toHaveBeenCalledTimes(1)

  game.bunnyboard.conversations[BUNNYBOT_CHAT_ID].messages = [{ text: `Before ${lines[1]} after`, date: 0, time: 0 }]
  expect(bunnybotSays('photo-feature', lines, { once: lines[1] })).toBe(true)
  expect(bunnybotSays('photo-feature', lines)).toBe(true)
  expect(bunnybotSays('not:a:mod', lines)).toBe(false)
  expect(bunnybotSays('photo-feature', [])).toBe(false)
  expect(deliver).toHaveBeenCalledTimes(3)
})
