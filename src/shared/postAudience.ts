import type { PhotoTier } from './photoGate'
import { hasTrait } from './traits'
import type { Character } from './types'

/**
 * Who sees a post on the feed, and what they do about it.
 *
 * A post is public to four thousand students, so her audience is mostly strangers and has nothing
 * to do with whether the reader has met her. Likes and the crowd in the comments are both read off
 * the same following, since they are the same people: a picture draws more than words, and a
 * picture with skin in it draws more again.
 */

/** The smallest following anybody has, and how far above it the curve can reach. */
const REACH_FLOOR = 40
const REACH_SPAN = 460

/** A stable number in [0, 1) for a string — FNV-1a, which is plenty for a follower count. */
function hashUnit(seed: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return ((hash >>> 0) % 100000) / 100000
}

/**
 * How many people see anything she posts.
 *
 * Derived rather than stored, from the playthrough and her id together: stable for a whole run, so
 * the same girl is the one everybody watches all semester, and different in the next run, so who
 * that is changes with the game. Nothing migrates and nothing can drift.
 */
export function reachOf(
  playthroughId: string | null,
  charId: string,
  character: Pick<Character, 'traits'> | undefined
): number {
  const roll = hashUnit(`${playthroughId ?? 'unsaved'}:${charId}`)
  // Skewed low: most people have a modest following and a few have a large one.
  const reach = REACH_FLOOR + Math.round(REACH_SPAN * roll * roll)
  return hasTrait(character, 'Terminally Online') ? reach * 2 : reach
}

/** What a picture does to a post's traffic: skin travels, and words mostly do not. */
const ENGAGEMENT: Readonly<Record<PhotoTier, number>> = {
  none: 0.02,
  everyday: 0.045,
  suggestive: 0.11,
  explicit: 0.11
}

/**
 * What a post is liked by: a slice of everyone who follows her, bigger for a picture, plus
 * everybody she is actually close to. Rolled once when the post is written, never recomputed.
 */
export function rollAudienceLikes(
  input: { reach: number; friends: number; photoTier: PhotoTier },
  rand: () => number = Math.random
): number {
  const share = ENGAGEMENT[input.photoTier] * (0.6 + rand() * 0.8)
  return input.friends + Math.round(input.reach * share)
}

/** Nobody gets more than this under one post, however popular she is. */
export const MAX_COMMENTS = 8

/**
 * How many strangers say something under one post.
 *
 * Three things decide it. A post with a picture draws a crowd where words do not. A girl the
 * campus follows draws one where an unknown does not. And a picture with skin in it draws the kind
 * of crowd that has nothing to say and says it anyway, which is what a public feed is.
 */
export function rollCrowdCount(
  input: { photoTier: PhotoTier; reach: number },
  rand: () => number = Math.random
): number {
  const { photoTier, reach } = input

  // A share of the room, and a picture is what gets somebody to type at all.
  const talkers =
    (reach / 100) * (photoTier === 'none' ? 0.35 : photoTier === 'suggestive' ? 2.2 : 0.9)

  // Long-tailed: a quiet post stays quiet where a loud one can run to the cap.
  const drawn = Math.floor(rand() * (talkers + 1) + rand() * talkers * 0.6)
  return Math.min(drawn, MAX_COMMENTS)
}
