import { fallbackHandleOf } from '@shared/feed'
import { npcFriendsOf } from '@shared/npcRelationships'
import { globalSlotOf } from '@shared/jobs'
import type { PhotoTier } from '@shared/photoGate'
import { reachOf, rollAudienceLikes, rollCrowdCount } from '@shared/postAudience'
import type { PostComment } from '@shared/postComments'
import {
  FEED_EMOJI,
  FEED_EMOJI_BAG,
  FEED_HANDLE_BAG,
  FEED_HANDLE_POOL
} from '../prompts/feedRandoms'
import { useGameStore } from './gameStore'
import { useGrabBagStore } from './grabBagStore'

/** One reply as the model wrote it: the roster girl it is signed by, if any, and her words. */
export interface WrittenComment {
  charId?: string
  text: string
}

/**
 * Dresses the replies the model wrote for one post: a face, a handle, and the slot each one
 * turns up in. A roster girl replies as her own handle; a stranger is drawn a handle and an emoji.
 * How many are kept is read off her following and what she posted: a picture draws more than
 * words, one with skin in it more again, and a girl the campus watches more than one it does not.
 */
export function rollComments(
  charId: string,
  written: readonly WrittenComment[] | undefined,
  photoTier: PhotoTier = 'none'
): PostComment[] {
  const lines = (written ?? [])
    .map((one) => ({ ...one, text: one.text.trim() }))
    .filter((one) => one.text)
  if (lines.length === 0) return []

  const game = useGameStore.getState()
  const reach = reachOf(game.playthroughId, charId, game.characters[charId])
  const count = Math.min(lines.length, rollCrowdCount({ photoTier, reach }))
  if (count === 0) return []

  const kept = lines.slice(0, count)
  const strangers = kept.filter((one) => !(one.charId && game.characters[one.charId])).length
  const bag = useGrabBagStore.getState()
  // Through the bags, so a handle and a face are both spent before either comes round again.
  const handles = bag.drawMany(FEED_HANDLE_BAG, FEED_HANDLE_POOL, strangers, (one) => one.key)
  const emoji = bag.drawMany(FEED_EMOJI_BAG, FEED_EMOJI, strangers)

  // Three to a slot, so a loud post arrives loud and still grows; a quiet one trickles.
  const posted = globalSlotOf(game.date, game.time)
  let drawn = 0
  return kept.map((one, i) => {
    const at = posted + Math.min(2, Math.floor(i / 3))
    const replier = one.charId ? game.characters[one.charId] : undefined
    if (one.charId && replier) {
      return {
        id: crypto.randomUUID(),
        charId: one.charId,
        handle:
          game.charInfo[one.charId]?.handle ??
          fallbackHandleOf(replier.firstName, replier.lastName),
        emoji: '',
        text: one.text,
        at
      }
    }
    const n = drawn++
    return {
      id: crypto.randomUUID(),
      handle: handles[n]?.handle ?? FEED_HANDLE_POOL[0].handle,
      emoji: emoji[n] ?? FEED_EMOJI[0],
      text: one.text,
      at
    }
  })
}

/**
 * The likes on one of her posts: a slice of her following, bigger for a picture, plus everybody
 * she is actually close to.
 */
export function postLikes(charId: string, photoTier: PhotoTier = 'none'): number {
  const game = useGameStore.getState()
  return rollAudienceLikes({
    reach: reachOf(game.playthroughId, charId, game.characters[charId]),
    friends: npcFriendsOf(game.npcRelationships, charId, game.chars).length,
    photoTier
  })
}

/** The likes on the slot's random student's post: one of the four thousand, with no roster friends. */
export function strangerLikes(handle: string): number {
  const game = useGameStore.getState()
  return rollAudienceLikes({
    reach: reachOf(game.playthroughId, handle, undefined),
    friends: 0,
    photoTier: 'none'
  })
}
