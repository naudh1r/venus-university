import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { BUNNYBOT_CHAT_ID, FRIENDS_INTRO_SLOT } from '../prompts/bunnybot'
import { useGameStore } from '../stores/gameStore'
import { deliverBunnybotNow } from '../stores/textingLoop'

/**
 * Says a mod's lines as BunnyBot once he has introduced himself. An exact message in his saved
 * thread matching `once` keeps them from being said again; include that line among `lines`.
 * Answers whether the lines were delivered. The caller owns its switch and when it asks.
 */
export function bunnybotSays(
  modId: string,
  lines: readonly string[],
  options: { once?: string } = {}
): boolean {
  if (!MOD_ID_RULE.test(modId) || lines.length === 0) return false
  const game = useGameStore.getState()
  if (game.bunnybotThrough < FRIENDS_INTRO_SLOT) return false
  const messages = game.bunnyboard.conversations[BUNNYBOT_CHAT_ID]?.messages
  if (options.once !== undefined && messages?.some((message) => message.text === options.once)) {
    return false
  }
  deliverBunnybotNow(lines)
  return true
}
