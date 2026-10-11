import { fallbackHandleOf } from '@shared/feed'
import { globalSlotOf } from '@shared/jobs'
import { npcFriendsOf, type NpcRelationshipMap } from '@shared/npcRelationships'
import type { PhotoTier } from '@shared/photoGate'
import { reachOf, rollCrowdCount } from '@shared/postAudience'
import type { PostComment } from '@shared/postComments'
import { shuffle } from '@shared/shuffle'
import { charKeyOf, type Character, type CharInfo } from '@shared/types'
import {
  FEED_EMOJI,
  FEED_EMOJI_BAG,
  FEED_HANDLE_BAG,
  FEED_HANDLE_POOL
} from '../prompts/feedRandoms'
import { useGameStore } from './gameStore'
import { useGrabBagStore } from './grabBagStore'

/** Feed Comments' side of a post's replies: who may write them, and how they are filed. */

/** A roster girl who may reply under one poster's post, and whether the two are friends. */
export interface Replier {
  character: Character
  charKey: string
  friend: boolean
  /** What the game knows of her, for how she stands with the reader. */
  info?: CharInfo
}

/** How many of her friends may reply under a post, and how many randoms stand in for none. */
const MAX_FRIEND_REPLIERS = 3
const MAX_RANDOM_REPLIERS = 2

/**
 * The roster girls who may reply under one girl's post: a few of her friends, or a random few
 * of the roster where she has none.
 */
export function repliersFor(posterId: string, relationships: NpcRelationshipMap | undefined): Replier[] {
  const game = useGameStore.getState()
  const friends = npcFriendsOf(relationships, posterId, game.chars)
  const picked =
    friends.length > 0
      ? shuffle(friends).slice(0, MAX_FRIEND_REPLIERS)
      : shuffle(game.chars.filter((id) => id !== posterId)).slice(0, MAX_RANDOM_REPLIERS)
  return picked.flatMap((charId) => {
    const character = game.characters[charId]
    return character
      ? [
          {
            character,
            charKey: charKeyOf(character.firstName, character.lastName),
            friend: friends.length > 0,
            info: game.charInfo[charId]
          }
        ]
      : []
  })
}

/**
 * The replies a post came back with, each signed by the roster girl its "from" names. A key
 * nobody holds, or the poster's own, leaves the reply to a stranger.
 */
export function writtenComments(raw: unknown, posterId: string): WrittenComment[] {
  if (!Array.isArray(raw)) return []
  const game = useGameStore.getState()
  return raw.flatMap((one): WrittenComment[] => {
    if (typeof one === 'string') return [{ text: one }]
    if (!one || typeof one !== 'object') return []
    const { from, text } = one as { from?: unknown; text?: unknown }
    if (typeof text !== 'string') return []
    const charId = typeof from === 'string' && from ? game.charKeyToId[from.trim()] : undefined
    if (from && !charId) console.warn(`[feed comments] reply from unknown key "${String(from)}"`)
    return [charId && charId !== posterId ? { charId, text } : { text }]
  })
}

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
export function rollFeedComments(
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
