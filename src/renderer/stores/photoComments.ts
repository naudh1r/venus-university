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

/**
 * Dresses the replies the model wrote for one post: a handle, an emoji for a face, and the slot
 * each one turns up in.
 *
 * Nothing here writes a comment. The lines came back with the post — a canned pool cannot answer
 * what she actually posted, and a post whose replies do not answer it reads like a post nobody
 * read. All this decides is how many of them are kept and who appears to have said them.
 *
 * How many is read off her following and what she posted, not off who the reader has met: a
 * picture draws more than words, one with skin in it more again, and a girl the campus watches
 * more than one it does not.
 */
export function rollComments(
  charId: string,
  written: readonly string[] | undefined,
  photoTier: PhotoTier = 'none'
): PostComment[] {
  const lines = (written ?? []).map((text) => text.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const game = useGameStore.getState()
  const reach = reachOf(game.playthroughId, charId, game.characters[charId])
  const count = Math.min(lines.length, rollCrowdCount({ photoTier, reach }))
  if (count === 0) return []

  const kept = lines.slice(0, count)
  const bag = useGrabBagStore.getState()
  // Through the bags, so a handle and a face are both spent before either comes round again.
  const handles = bag.drawMany(FEED_HANDLE_BAG, FEED_HANDLE_POOL, kept.length, (one) => one.key)
  const emoji = bag.drawMany(FEED_EMOJI_BAG, FEED_EMOJI, kept.length)

  // Three to a slot, so a loud post arrives loud and still grows; a quiet one trickles.
  const posted = globalSlotOf(game.date, game.time)
  return kept.map((text, i) => ({
    id: crypto.randomUUID(),
    handle: handles[i]?.handle ?? FEED_HANDLE_POOL[0].handle,
    emoji: emoji[i] ?? FEED_EMOJI[0],
    text,
    at: posted + Math.min(2, Math.floor(i / 3))
  }))
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
