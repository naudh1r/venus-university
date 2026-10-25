import { PHOTO_FEATURE } from '@shared/mods'
import { npcFriendsOf } from '@shared/npcRelationships'
import { groupPhotoPair, type GroupPhotoPair } from '@shared/photoDuo'
import { duoPhotosOn } from '@shared/photoSwitches'
import type { Character, StructuredRequest, TimeSlot } from '@shared/types'
import {
  ownsPostComments,
  promptFields,
  promptLines,
  promptRequired,
  type SceneReplied
} from '../mods/hooks'
import { postCommentLines, postPhotoLines } from '../prompts/photoBrief'
import { useGameStore } from './gameStore'
import { canSendPhotos } from './localPhotoStore'
import { fileLatePost } from './loop/feed'
import { startHeldPostPhoto } from './photoPost'

/**
 * The group photo: two of the girls in the scene the reader just committed to, posted by one of
 * them on her feed. The scene's first call writes it beside the scene's opening lines, once the
 * cast is known; it is filed like any feed post and drawn behind the slot's own feed pictures,
 * under the scene.
 *
 * One a slot. The pair is held here between the request and its reply; a game closed in between
 * loses that one photo, and nothing else.
 */

interface AskedGroupPhoto extends GroupPhotoPair {
  /** The slot it was asked for, as {@link slotKey} writes it. */
  slot: string
}

let asked: AskedGroupPhoto | null = null

/** The slot whose group photo is settled, written or not: nothing more is asked for in it. */
let settledSlot: string | null = null

function slotKey(): string | null {
  const { playthroughId, date, time } = useGameStore.getState()
  return playthroughId ? `${playthroughId}:${date}:${time}` : null
}

/** Whether a group photo is already on somebody's feed this slot, as a reload finds the save. */
function postedThisSlot(): boolean {
  const { charInfo, date, time } = useGameStore.getState()
  return Object.values(charInfo).some((info) =>
    (info?.feed ?? []).some((post) => post.date === date && post.time === time && post.photo?.with)
  )
}

/** The rules for a post's other fields, such as its comments, from whichever mod asks for them. */
function postFieldLines(): string[] {
  if (ownsPostComments(PHOTO_FEATURE)) return postCommentLines(true)
  // Her own picture lines are for a picture of one girl, so only the other mods' are kept.
  const own = new Set(postPhotoLines(true))
  return promptLines('slot-posts', {}).filter((line) => !own.has(line))
}

/** The field the scene fills for it, carrying whatever the mods ask of every post. */
function groupPostField(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      ...promptFields('slot-posts'),
      text: { type: 'string' },
      image: { type: 'string' }
    },
    required: [...new Set(['text', 'image', ...promptRequired('slot-posts')])]
  }
}

/**
 * The scene's call, asked for the group photo's post where two or more girls are in it and the
 * slot has not had one. Every call until the slot's is settled asks for the same pair.
 */
export function withGroupPhotoRequest(
  request: StructuredRequest,
  cast: readonly Character[]
): StructuredRequest {
  if (!duoPhotosOn() || !canSendPhotos()) return request
  const slot = slotKey()
  if (!slot || settledSlot === slot) return request
  if (postedThisSlot()) {
    settledSlot = slot
    return request
  }
  const ids = cast.map((girl) => girl.charId)
  if (!asked || asked.slot !== slot || !ids.includes(asked.poster) || !ids.includes(asked.friend)) {
    const pair = groupPhotoPair(ids)
    asked = pair ? { ...pair, slot } : null
    if (!asked) return request
  }
  const characters = useGameStore.getState().characters
  const poster = characters[asked.poster]
  const friend = characters[asked.friend]
  if (!poster || !friend) return request
  console.log(`[photo] group photo asked of the scene: ${poster.firstName} with ${friend.firstName}`)

  const block = [
    'GROUP PHOTO',
    `${poster.firstName} is posting a photo of herself and ${friend.firstName}, taken here as this scene begins. Fill "groupPost": "text" is her post, one or two short lines in her own voice; "image" is one full sentence describing the photograph: where they are, "in their everyday clothes", "in their PE kit" for sport or the gym, or "in their swimsuits" at a pool or a beach, rather than what each one wears; the two of them side by side and not touching, from the waist up, looking at the camera with the faces friends pull in a photo together: smiling, laughing, a grin or a pout. Say "her and her friend" rather than either name, and never "two girls". The scene itself does not mention the photo.`,
    ...postFieldLines(),
    ''
  ].join('\n')
  const at = request.user.lastIndexOf('YOUR TURN')
  const user =
    at >= 0
      ? `${request.user.slice(0, at)}${block}\n${request.user.slice(at)}`
      : `${request.user}\n\n${block}`
  const schema = request.schema.schema as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  return {
    ...request,
    user,
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        properties: { ...(schema.properties ?? {}), groupPost: groupPostField() },
        required: [...(schema.required ?? []), 'groupPost']
      }
    }
  }
}

/**
 * The group photo's post, off the scene's reply that was asked for it: filed on the poster's
 * feed, its picture queued behind the slot's own. A reply without it settles the slot all the
 * same, so a scene is asked once.
 */
export function fileGroupPhoto({ reply }: SceneReplied): void {
  const slot = slotKey()
  const waiting = asked
  if (!waiting || waiting.slot !== slot || settledSlot === slot) return
  settledSlot = slot
  asked = null
  const written = reply.groupPost as Record<string, unknown> | undefined
  const text = typeof written?.text === 'string' ? written.text.trim() : ''
  const image = typeof written?.image === 'string' ? written.image.trim() : ''
  if (!written || !text || !image) {
    console.log('[photo] the scene wrote no group photo')
    return
  }
  const game = useGameStore.getState()
  const char = Object.keys(game.charKeyToId).find((key) => game.charKeyToId[key] === waiting.poster)
  if (!char) return
  void fileLatePost({ ...written, char, text, image, groupWith: waiting.friend } as {
    char: string
    text: string
  }).then(() => startHeldPostPhoto())
}

/** The chance a poster with a friend posts a picture of the two of them, at most one a slot. */
const FEED_FRIEND_CHANCE = 0.25

/** The slot's feed posts that are a picture with a friend: poster to friend, by charId. */
let feedFriends: { slot: string; rolled: Set<string>; pairs: Map<string, string> } | null = null

/**
 * The friend in this poster's picture, rolled once a slot as the opening is written: one of her
 * friends, wherever either of them is. Null for a picture of her alone. The opening can be
 * written while the slot before it still plays, so the roll is filed under the slot it is for.
 */
function feedFriendOf(character: Character, date: number, time: TimeSlot): Character | null {
  if (!duoPhotosOn() || !canSendPhotos()) return null
  const { playthroughId } = useGameStore.getState()
  if (!playthroughId) return null
  const slot = `${playthroughId}:${date}:${time}`
  if (feedFriends?.slot !== slot) feedFriends = { slot, rolled: new Set(), pairs: new Map() }
  const game = useGameStore.getState()
  const known = feedFriends.pairs.get(character.charId)
  if (feedFriends.rolled.has(character.charId)) return known ? (game.characters[known] ?? null) : null
  feedFriends.rolled.add(character.charId)
  if (feedFriends.pairs.size > 0) return null
  const friends = npcFriendsOf(game.npcRelationships, character.charId, game.chars).filter(
    (id) => game.characters[id]
  )
  if (friends.length === 0 || Math.random() >= FEED_FRIEND_CHANCE) return null
  const friend = game.characters[friends[Math.floor(Math.random() * friends.length)]]
  if (!friend) return null
  feedFriends.pairs.set(character.charId, friend.charId)
  console.log(`[photo] ${character.firstName}'s post this slot is a picture with ${friend.firstName}`)
  return friend
}

/** Her entry's line for a picture with a friend, under her name in the opening. */
export function feedFriendLines(character: Character, date: number, time: TimeSlot): string[] {
  const friend = feedFriendOf(character, date, time)
  if (!friend) return []
  return [
    `  Her post is a picture of her and her friend ${friend.firstName}, so it carries an "image": the two of them side by side and not touching, from the waist up, "in their everyday clothes", "in their PE kit" for sport or the gym, or "in their swimsuits" only where they are at a pool or a beach, rather than what each one wears, and pulling the faces friends do in a photo together: smiling, laughing, a grin or a pout. Say "her and her friend", never ${friend.firstName}'s name.`
  ]
}

/** The friend rolled for this poster's picture this slot, by charId. */
export function feedFriendFor(charId: string): string | undefined {
  return feedFriends?.slot === slotKey() ? feedFriends?.pairs.get(charId) : undefined
}
