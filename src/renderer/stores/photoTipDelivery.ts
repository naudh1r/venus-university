import { BUNNYBOT_CHAT_ID, FRIENDS_INTRO_SLOT } from '../prompts/bunnybot'
import {
  bunnybotDmPhotoTexts,
  bunnybotFeedPhotoTexts,
  DM_PHOTO_TIP_MARK,
  FEED_PHOTO_TIP_MARK
} from '../prompts/photoTips'
import { useGameStore } from './gameStore'
import { deliverBunnybotNow } from './textingLoop'

/**
 * Whether the tip `line` belongs to is not to be said now: BunnyBot's thread already holds it, or
 * BunnyBot has not introduced himself yet — the same wait his first-post nudge keeps, and the tip
 * comes with a later picture instead.
 */
function notNow(line: string): boolean {
  const game = useGameStore.getState()
  if (game.bunnybotThrough < FRIENDS_INTRO_SLOT) return true
  const thread = game.bunnyboard.conversations[BUNNYBOT_CHAT_ID]
  return thread?.messages.some((message) => message.text === line) ?? false
}

/** BunnyBot's DM photo tip, the first time a girl sends the reader a picture. */
export function tellAboutDmPhotos(firstName: string): void {
  if (notNow(DM_PHOTO_TIP_MARK)) return
  deliverBunnybotNow(bunnybotDmPhotoTexts(firstName))
}

/**
 * BunnyBot's feed photo tip, the first time a post with a picture is on the Updates tab —
 * whoever posted it, a contact or a stranger the feed was filled out with.
 */
export function tellAboutFeedPhotos(charId: string): void {
  if (notNow(FEED_PHOTO_TIP_MARK)) return
  const firstName = useGameStore.getState().characters[charId]?.firstName
  if (!firstName) return
  deliverBunnybotNow(bunnybotFeedPhotoTexts(firstName))
}
