import { hasTrait } from './traits'
import type { Character } from './types'

/**
 * How many people answer one of her posts when Bunnyfeeds files its replies: read off how many
 * follow her, and whether the post carries a picture.
 */

/** The smallest following anybody has, and how far above it the curve can reach. */
const REACH_FLOOR = 40
const REACH_SPAN = 460

/** Nobody gets more than this under one post, however popular she is. */
const MAX_CROWD = 8

/** A stable number in [0, 1) for a string: FNV-1a, which is plenty for a follower count. */
function hashUnit(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return ((hash >>> 0) % 100000) / 100000
}

/**
 * How many people see anything she posts: stable for a whole playthrough and different in the
 * next, so the girl everybody watches is the same all semester and changes with the game.
 */
export function followingOf(
  playthroughId: string | null,
  charId: string,
  character: Pick<Character, 'traits'> | undefined
): number {
  const roll = hashUnit(`${playthroughId ?? 'unsaved'}:${charId}`)
  // Skewed low: most people have a modest following and a few have a large one.
  const reach = REACH_FLOOR + Math.round(REACH_SPAN * roll * roll)
  return hasTrait(character, 'Terminally Online') ? reach * 2 : reach
}

/** How many say something under one post: a picture draws a crowd where words do not. */
export function rollCrowd(
  input: { picture: boolean; following: number },
  rand: () => number = Math.random
): number {
  const talkers = (input.following / 100) * (input.picture ? 0.9 : 0.35)
  // Long-tailed: a quiet post stays quiet where a loud one can run to the cap.
  const drawn = Math.floor(rand() * (talkers + 1) + rand() * talkers * 0.6)
  return Math.min(drawn, MAX_CROWD)
}
