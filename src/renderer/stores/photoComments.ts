import { npcFriendsOf } from '@shared/npcRelationships'
import type { PhotoTier } from '@shared/photoGate'
import { reachOf, rollAudienceLikes } from '@shared/postAudience'
import { useGameStore } from './gameStore'

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
