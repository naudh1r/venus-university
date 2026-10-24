import { fallbackHandleOf } from '@shared/feed'
import { globalSlotOf } from '@shared/jobs'
import {
  areNpcFriends,
  npcFriendsOf,
  npcPairOf,
  zoneOf,
  type NpcRelationshipMap
} from '@shared/npcRelationships'
import {
  followingOf,
  pickJoiningFriend,
  pickOpeningFriend,
  planCrowd,
  rollCrowd
} from '@shared/bunnyfeedsCrowd'
import type { PostComment } from '@shared/postComments'
import { charKeyOf, type Character, type CharInfo } from '@shared/types'
import {
  FEED_EMOJI,
  FEED_EMOJI_BAG,
  FEED_HANDLE_BAG,
  FEED_HANDLE_POOL
} from '../prompts/feedRandoms'
import { isFeedContact } from './feedView'
import { useGameStore } from './gameStore'
import { useGrabBagStore } from './grabBagStore'

/** Bunnyfeeds' side of a post's replies: who may write them, and how they are filed. */

/** The crowd each of the slot's posters was told to draw, rolled before her post was written. */
const plannedCrowds = new Map<string, { words: number; picture: number }>()

/**
 * Rolls the crowd under each of the slot's posts before they are written, so the call writes as
 * many replies as are kept and no more; the ones planned for the slot before are forgotten.
 */
export function planSlotCrowds(charIds: readonly string[]): Map<string, { words: number; picture: number }> {
  const game = useGameStore.getState()
  plannedCrowds.clear()
  for (const charId of charIds) {
    plannedCrowds.set(
      charId,
      planCrowd(followingOf(game.playthroughId, charId, game.characters[charId]))
    )
  }
  return plannedCrowds
}

/** How a roster girl stands with the poster whose post she replies under. */
export type PosterStanding = 'friend' | 'enemy' | 'barely'

/** A roster girl who may reply under one poster's post, and how the two stand. */
export interface Replier {
  character: Character
  charKey: string
  standing: PosterStanding
  /** What the game knows of her, for how she stands with the reader. */
  info?: CharInfo
}

/** How `charId` stands with `posterId`, read off the game's pairs. */
function standingOf(
  relationships: NpcRelationshipMap | undefined,
  posterId: string,
  charId: string
): PosterStanding {
  const pair = npcPairOf(relationships, posterId, charId)
  if (!pair) return 'barely'
  const zone = zoneOf(pair.affinity)
  return zone === 'friends' ? 'friend' : zone === 'enemies' ? 'enemy' : 'barely'
}

/** One roster girl as a replier under `posterId`'s post; null for one the game does not hold. */
export function replierOf(
  charId: string,
  posterId: string,
  relationships: NpcRelationshipMap | undefined
): Replier | null {
  const game = useGameStore.getState()
  const character = game.characters[charId]
  if (!character) return null
  return {
    character,
    charKey: charKeyOf(character.firstName, character.lastName),
    standing: standingOf(relationships, posterId, charId),
    info: game.charInfo[charId]
  }
}

/** The friend of hers, if the roll offers one, who may reply under a post as it is written. */
export function repliersFor(posterId: string, relationships: NpcRelationshipMap | undefined): Replier[] {
  const friends = npcFriendsOf(relationships, posterId, useGameStore.getState().chars)
  const picked = pickOpeningFriend(friends)
  const replier = picked ? replierOf(picked, posterId, relationships) : null
  return replier ? [replier] : []
}

/**
 * The friend of hers, if the roll offers one, who may join a round of answers to the reader:
 * a friend he has on his contacts too is likelier than one he does not.
 */
export function joiningFriendOf(
  posterId: string,
  relationships: NpcRelationshipMap | undefined
): Replier | null {
  const game = useGameStore.getState()
  const friends = npcFriendsOf(relationships, posterId, game.chars)
  const mutuals = friends.filter((id) => isFeedContact(game.charInfo[id]))
  const others = friends.filter((id) => !mutuals.includes(id))
  const picked = pickJoiningFriend(mutuals, others)
  return picked ? replierOf(picked, posterId, relationships) : null
}

/**
 * The replies a post came back with, each signed by the roster girl its "from" names. A key
 * nobody holds, or the poster's own, leaves the reply to a follower; one from a girl who is not
 * the poster's friend is dropped, since only her friends reply under a post as it is written.
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
    if (from && !charId) console.warn(`[bunnyfeeds] reply from unknown key "${String(from)}"`)
    if (charId && charId !== posterId) {
      return areNpcFriends(game.npcRelationships, posterId, charId) ? [{ charId, text }] : []
    }
    return [{ text }]
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
 * words, and a girl the campus watches more than one it does not.
 */
export function rollFeedComments(
  charId: string,
  written: readonly WrittenComment[] | undefined,
  picture = false
): PostComment[] {
  const lines = (written ?? [])
    .map((one) => ({ ...one, text: one.text.trim() }))
    .filter((one) => one.text)
  if (lines.length === 0) return []

  const game = useGameStore.getState()
  // As many as she was told to draw; a post nobody planned for, rolled now.
  const planned = plannedCrowds.get(charId)
  plannedCrowds.delete(charId)
  const allowed = planned
    ? planned[picture ? 'picture' : 'words']
    : rollCrowd({
        picture,
        following: followingOf(game.playthroughId, charId, game.characters[charId])
      })
  // The followers counted, and the friend of hers named under the post on top of them.
  const isFriend = (one: WrittenComment): boolean => Boolean(one.charId && game.characters[one.charId])
  let followers = 0
  let friends = 0
  const kept = lines.filter((one) =>
    isFriend(one) ? friends++ < 1 : followers++ < allowed
  )
  if (kept.length === 0) return []
  const strangers = kept.filter((one) => !isFriend(one)).length
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
