import { fillPronouns, genderOf } from '../../shared/photoGender'
import { postPhoto } from './photoRecords'
import { type Character, type StructuredRequest, type TimeSlot } from '@vx/modkit/shared'
import {
  groupPhotoPair,
  canSharePhoto,
  DUO_COOLDOWN_DAYS,
  type GroupPhotoPair
} from '../../shared/photoDuo'
import { duoPhotosOn, PHOTO_FEATURE_ID } from '../../shared/photoSwitches'
import {
  ownsPostComments,
  promptFields,
  promptLines,
  promptRequired,
  fileLatePost,
  type SceneReplied
} from '@vx/modkit/renderer'
import { postCommentLines, postPhotoLines } from '../prompts/photoBrief'
import { photoGame } from './photoGame'
import { canSendPhotos } from './localPhotoStore'
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

interface AskedGroupPhoto {
  /** The slot it was asked for, as {@link slotKey} writes it. */
  slot: string
  poster: string
  /** The other one in the picture; absent for a picture of the poster alone. */
  friend?: string
}

let asked: AskedGroupPhoto | null = null

/** The slot whose group photo is settled, written or not: nothing more is asked for in it. */
let settledSlot: string | null = null

function slotKey(): string | null {
  const { playthroughId, date, time } = photoGame()
  return playthroughId ? `${playthroughId}:${date}:${time}` : null
}

/** Whether a group photo is already on somebody's feed this slot, as a reload finds the save. */
function postedThisSlot(): boolean {
  const { charInfo, date, time } = photoGame()
  return Object.values(charInfo).some((info) =>
    (info?.feed ?? []).some(
      (post) => post.date === date && post.time === time && postPhoto.read(post)?.with
    )
  )
}

/**
 * Whether these two shared a picture on the feed within the cooldown, read off the duo posts
 * already filed: either one's post with the other in it.
 */
function pairedRecently(a: string, b: string): boolean {
  const { charInfo, date } = photoGame()
  const since = date - DUO_COOLDOWN_DAYS
  const together = (poster: string, other: string): boolean =>
    (charInfo[poster]?.feed ?? []).some(
      (post) => post.date > since && postPhoto.read(post)?.with === other
    )
  return together(a, b) || together(b, a)
}

/** The rules for a post's other fields, such as its comments, from whichever mod asks for them. */
function postFieldLines(): string[] {
  if (ownsPostComments(PHOTO_FEATURE_ID)) return postCommentLines(true)
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
  if (!canSendPhotos()) return request
  const slot = slotKey()
  if (!slot || settledSlot === slot) return request
  if (postedThisSlot()) {
    settledSlot = slot
    return request
  }
  const ids = [...new Set(cast.map((one) => one.charId))]
  if (ids.length < 2) return request
  const stale =
    !asked ||
    asked.slot !== slot ||
    !ids.includes(asked.poster) ||
    (asked.friend !== undefined && !ids.includes(asked.friend))
  if (stale) {
    // Two of them who have not shared a picture lately, else one of them alone.
    const pair: GroupPhotoPair | null = duoPhotosOn()
      ? groupPhotoPair(ids, photoGame().npcRelationships, Math.random, pairedRecently)
      : null
    asked = pair ? { ...pair, slot } : { slot, poster: ids[Math.floor(Math.random() * ids.length)] }
  }
  const current = asked
  if (!current) return request
  const characters = photoGame().characters
  const poster = characters[current.poster]
  const friend = current.friend ? characters[current.friend] : null
  if (!poster || (current.friend && !friend)) return request
  console.log(
    friend
      ? `[photo] group photo asked of the scene: ${poster.firstName} with ${friend.firstName}`
      : `[photo] a picture of ${poster.firstName} alone asked of the scene`
  )

  const block = [
    'GROUP PHOTO',
    friend
      ? fillPronouns(
      `${poster.firstName} is posting a photo of {themself} and ${friend.firstName}, taken here as this scene begins. Fill "groupPost": "text" is {their} post, one or two short lines in {their} own voice; "image" is one full sentence describing the photograph: where they are, "in their everyday clothes", "in their PE kit" for sport or the gym, or "in their swimsuits" at a pool or a beach, rather than what each one wears; the two of them side by side and not touching, from the waist up, looking at the camera each with their own face and their own hands, the way two people pose together — one might flash a peace sign while the other winks, or both just laugh — written as "{their} … while {their} friend …". A hand that holds something makes no gesture. It can be a photo somebody took of them, or a selfie {they} holds out at arm's length, whichever fits the moment. Say "{them} and {their} friend" rather than either name, and never a count of people. The scene itself does not mention the photo.`,
      genderOf(poster)
    )
      : fillPronouns(
          `${poster.firstName} is posting a photo of {themself} alone, taken here as this scene begins. Fill "groupPost": "text" is {their} post, one or two short lines in {their} own voice; "image" is one full sentence describing the photograph: where {they} is, what {they} is wearing, how {they} is standing or sitting, what {their} hands are doing, the light and the shot. Only {they} is in it. The scene itself does not mention the photo.`,
          genderOf(poster)
        ),
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
  const game = photoGame()
  const char = Object.keys(game.charKeyToId).find((key) => game.charKeyToId[key] === waiting.poster)
  if (!char) return
  void fileLatePost({
    ...written,
    char,
    text,
    image,
    ...(waiting.friend ? { groupWith: waiting.friend } : {})
  } as {
    char: string
    text: string
  }).then(() => startHeldPostPhoto())
}

/** The slot's feed post that is a picture with a friend: poster to friend, by charId. */
let feedFriends: { slot: string; pairs: Map<string, string> } | null = null

/** One poster as the slot's opening is given it, with whoever it places them with. */
interface FeedPoster {
  character: Character
  charKey: string
  whereabouts?: { companions: { knownNames: readonly string[] } }
}

/** The posters in a fresh random order. */
function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Who this poster is with right now that a picture could show: somebody the slot's opening names
 * beside them, whose name the reader knows, and who is their friend or partner.
 */
function companionFor(poster: FeedPoster): Character | null {
  const names = poster.whereabouts?.companions.knownNames ?? []
  if (names.length === 0) return null
  const { characters, charInfo, npcRelationships } = photoGame()
  const friends = Object.values(characters).filter(
    (one): one is Character =>
      !!one &&
      one.charId !== poster.character.charId &&
      names.includes(one.firstName) &&
      charInfo[one.charId]?.nameKnown === true &&
      canSharePhoto(npcRelationships, poster.character.charId, one.charId) &&
      !pairedRecently(poster.character.charId, one.charId)
  )
  return friends.length > 0 ? friends[Math.floor(Math.random() * friends.length)] : null
}

/** The entry for a picture of a poster and the friend they are with. */
function duoPictureLine(poster: Character, friend: Character): string {
  return fillPronouns(
    `{Their} post is a picture of {them} and {their} friend ${friend.firstName}, who {they} is with right now, so it carries an "image": the two of them side by side and not touching, from the waist up, "in their everyday clothes", "in their PE kit" for sport or the gym, or "in their swimsuits" only where they are at a pool or a beach, rather than what each one wears, each with their own face and their own hands, the way two people pose together — one might flash a peace sign while the other winks, or both just laugh — written as "{their} … while {their} friend …". A hand that holds something makes no gesture. It can be a photo somebody took of them, or a selfie {they} holds out at arm's length, whichever fits the moment. Say "{them} and {their} friend", never ${friend.firstName}'s name.`,
    genderOf(poster)
  )
}

/**
 * The slot's feed pictures, decided by the game rather than the model, which pictured girls
 * posting selfies and boys posting words: one post carries a picture of its poster with a friend
 * they are with right now, and one other a picture of its poster alone. Without such a pair, both
 * are pictures alone. Every other post is just words. Told to the slot's opening call.
 */
export function withFeedPicturesRequest(
  request: StructuredRequest,
  input: { posters: readonly FeedPoster[]; date: number; time: TimeSlot }
): StructuredRequest {
  if (!canSendPhotos() || input.posters.length === 0) return request
  const { playthroughId } = photoGame()
  if (!playthroughId) return request
  const slot = `${playthroughId}:${input.date}:${input.time}`
  const order = shuffled(input.posters)
  let duo: { poster: FeedPoster; friend: Character } | null = null
  if (duoPhotosOn()) {
    for (const poster of order) {
      const friend = companionFor(poster)
      if (friend) {
        duo = { poster, friend }
        break
      }
    }
  }
  const alone = order
    .filter((poster) => poster !== duo?.poster)
    .slice(0, duo ? 1 : 2)
  feedFriends = {
    slot,
    pairs: new Map(duo ? [[duo.poster.character.charId, duo.friend.charId]] : [])
  }
  if (duo) {
    console.log(
      `[photo] ${duo.poster.character.firstName}'s post this slot is a picture with ${duo.friend.firstName}`
    )
  }
  if (alone.length > 0) {
    console.log(
      `[photo] a picture alone this slot: ${alone.map((one) => one.character.firstName).join(', ')}`
    )
  }
  const block = [
    'FEED PICTURES',
    ...(duo ? [`- ${duo.poster.charKey}: ${duoPictureLine(duo.poster.character, duo.friend)}`] : []),
    ...alone.map(({ character, charKey }) =>
      fillPronouns(
        `- ${charKey}: {their} post carries a picture of {them} alone: describe it in "image".`,
        genderOf(character)
      )
    ),
    'Every other post is just words: leave its "image" empty.',
    ''
  ].join('\n')
  const at = request.user.lastIndexOf('YOUR TURN')
  const user =
    at >= 0
      ? `${request.user.slice(0, at)}${block}\n${request.user.slice(at)}`
      : `${request.user}\n\n${block}`
  return { ...request, user }
}

/** The friend rolled for this poster's picture this slot, by charId. */
export function feedFriendFor(charId: string): string | undefined {
  const friend = feedFriends?.slot === slotKey() ? feedFriends.pairs.get(charId) : undefined
  return friend && canSharePhoto(photoGame().npcRelationships, charId, friend) ? friend : undefined
}
