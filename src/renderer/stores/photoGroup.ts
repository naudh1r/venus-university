import { PHOTO_FEATURE } from '@shared/mods'
import { groupPhotoPair, type GroupPhotoPair } from '@shared/photoDuo'
import { duoPhotosOn } from '@shared/photoSwitches'
import type { Character, StructuredRequest } from '@shared/types'
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
    `${poster.firstName} is posting a photo of herself and ${friend.firstName}, taken here as this scene begins. Fill "groupPost": "text" is her post, one or two short lines in her own voice; "image" is one full sentence describing the photograph: where they are, what they are wearing for being there, the two of them side by side and not touching, from the waist up, looking at the camera. Say "her and her friend" rather than either name, and never "two girls". The scene itself does not mention the photo.`,
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
