import { hasTrait, type Character } from '@vx/modkit/shared'

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

/** How many of every hundred who follow her say something under a post of words, and a picture. */
const TALKERS_PER_HUNDRED = { words: 1.0, picture: 1.6 }

/** How many say something under one post: a picture draws a crowd where words do not. */
export function rollCrowd(
  input: { picture: boolean; following: number },
  rand: () => number = Math.random
): number {
  const rate = input.picture ? TALKERS_PER_HUNDRED.picture : TALKERS_PER_HUNDRED.words
  const talkers = (input.following / 100) * rate
  // Long-tailed: a quiet post stays quiet where a loud one can run to the cap.
  const drawn = Math.floor(rand() * (talkers + 1) + rand() * talkers * 0.6)
  return Math.min(drawn, MAX_CROWD)
}

/**
 * Her post's crowd rolled before it is written, both ways, since whether it carries a picture is
 * only known once it is: a picture never draws fewer than the same post in words.
 */
export function planCrowd(
  following: number,
  rand: () => number = Math.random
): { words: number; picture: number } {
  const words = rollCrowd({ picture: false, following }, rand)
  return { words, picture: Math.max(words, rollCrowd({ picture: true, following }, rand)) }
}

/**
 * Who joins a post's thread besides its poster, rolled by the game so the model is never handed
 * a crowd to use. Only her friends among the roster join on their own; the rest of the campus
 * are her followers.
 */

/** The chance one of her friends is among the replies a new post arrives with. */
export const OPENING_FRIEND_CHANCE = 0.35

/** The chance a friend of hers who is also on the reader's contacts joins a round he started. */
export const MUTUAL_FRIEND_CHANCE = 0.6

/** The chance one of her other friends joins instead, when no mutual friend does. */
export const FRIEND_CHANCE = 0.2

/** The chance a girl whose comment the reader answered answers him back. */
export const ADDRESSED_GIRL_CHANCE = 0.7

/** The chance a follower whose comment the reader answered answers him back. */
export const ADDRESSED_FOLLOWER_CHANCE = 0.5

/** The chance one of her followers chimes in on a round: from 30% to 60% as her following grows. */
export function followerChance(following: number): number {
  const reach = Math.min(1, Math.max(0, (following - REACH_FLOOR) / REACH_SPAN))
  return 0.3 + 0.3 * reach
}

/** One of `ids`, or nothing when there are none. */
function oneOf(ids: readonly string[], rand: () => number): string | null {
  return ids.length > 0 ? ids[Math.floor(rand() * ids.length)] : null
}

/** The friend of hers, if any, whose reply a new post arrives with. */
export function pickOpeningFriend(
  friends: readonly string[],
  rand: () => number = Math.random
): string | null {
  return friends.length > 0 && rand() < OPENING_FRIEND_CHANCE ? oneOf(friends, rand) : null
}

/**
 * The friend of hers, if any, who joins a round of answers to the reader: one he knows too
 * first, and failing that one he does not. At most one a round.
 */
export function pickJoiningFriend(
  mutuals: readonly string[],
  others: readonly string[],
  rand: () => number = Math.random
): string | null {
  if (mutuals.length > 0 && rand() < MUTUAL_FRIEND_CHANCE) return oneOf(mutuals, rand)
  if (others.length > 0 && rand() < FRIEND_CHANCE) return oneOf(others, rand)
  return null
}
