import { locationLabel, ROOM_LOCATION } from '@shared/locations'
import { groupPhotoPair, type GroupPhotoPair } from '@shared/photoDuo'
import { duoPhotosOn } from '@shared/photoSwitches'
import type { SlotIntroResponse, StructuredRequest } from '@shared/types'
import type { SlotSettled } from '../mods/hooks'
import { useGameStore } from './gameStore'
import { canSendPhotos } from './localPhotoStore'

/**
 * The group photo: two of the girls who shared the scene that just ended, posted by one of them
 * in the next slot's opening, beside the posts the slot rolled.
 *
 * Held here between the end of one slot and the opening of the next, which follow each other at
 * once; a game closed in between loses that one photo, and nothing else.
 */

interface PendingGroupPhoto extends GroupPhotoPair {
  /** Where they were: a location id, `'room'`, or null where the scene had no place. */
  location: string | null
}

let pending: PendingGroupPhoto | null = null

/** As a slot settles: two of its scene's girls, if it had two, for the next opening to post. */
export function noteGroupPhoto({ before, closingCast }: SlotSettled): void {
  pending = null
  if (!duoPhotosOn() || !canSendPhotos()) return
  const pair = groupPhotoPair(closingCast.map((girl) => girl.charId))
  if (!pair) return
  pending = { ...pair, location: before.sceneLocation }
  const names = useGameStore.getState().characters
  console.log(
    `[photo] group photo for the next opening: ${names[pair.poster]?.firstName} with ${names[pair.friend]?.firstName}`
  )
}

/** Where the two of them were, as the post's request says it. */
function placeOf(location: string | null): string {
  if (!location) return ''
  if (location === ROOM_LOCATION) return ' in her room'
  return ` at ${locationLabel(location)}`
}

/** The field the opening fills for it: always asked for, so the call stays the same shape. */
const GROUP_POST_FIELD = {
  type: 'object',
  properties: { text: { type: 'string' }, image: { type: 'string' } },
  required: ['text', 'image']
}

/**
 * The slot's opening, asked for the group photo's post where one is waiting, and told to leave it
 * empty where none is. The field is there either way while the option is on.
 */
export function withGroupPhotoRequest(request: StructuredRequest): StructuredRequest {
  if (!duoPhotosOn() || !canSendPhotos()) return request
  const characters = useGameStore.getState().characters
  const poster = pending ? characters[pending.poster] : undefined
  const friend = pending ? characters[pending.friend] : undefined
  const ask =
    pending && poster && friend
      ? [
          'GROUP PHOTO',
          `${poster.firstName} and ${friend.firstName} were together${placeOf(pending.location)} just now, and ${poster.firstName} is posting a photo of the two of them. Fill "groupPost": "text" is her post, one or two short lines in her own voice, like her other posts; "image" is one full sentence describing the photograph: where they are, what they are wearing for being there, the two of them side by side and not touching, from the waist up, looking at the camera. Say "her and her friend" rather than either name, and never "two girls".`
        ]
      : ['Return "groupPost" with "text" and "image" both empty.']
  const schema = request.schema.schema as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  return {
    ...request,
    user: [request.user, '', ...ask].join('\n'),
    schema: {
      ...request.schema,
      schema: {
        ...schema,
        properties: { ...(schema.properties ?? {}), groupPost: GROUP_POST_FIELD },
        required: [...(schema.required ?? []), 'groupPost']
      }
    }
  }
}

/** The group photo's post, from the opening's reply, filed beside the posters' own. */
export function groupPhotoPost(
  reply: Readonly<Record<string, unknown>>
): NonNullable<SlotIntroResponse['posts']> {
  const waiting = pending
  pending = null
  if (!waiting) return []
  const written = reply.groupPost as { text?: unknown; image?: unknown } | undefined
  const text = typeof written?.text === 'string' ? written.text.trim() : ''
  const image = typeof written?.image === 'string' ? written.image.trim() : ''
  if (!text || !image) return []
  const game = useGameStore.getState()
  const char = Object.keys(game.charKeyToId).find((key) => game.charKeyToId[key] === waiting.poster)
  if (!char) return []
  return [{ char, text, image, groupWith: waiting.friend } as { char: string; text: string }]
}
