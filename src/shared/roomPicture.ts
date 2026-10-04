import { appError } from './errors'
import { imageTypeOf } from './imageBytes'

/**
 * A room background the player brings instead of rendering: the shape it is cut to, what the
 * picker will take off the player, and the check the bytes pass before either build writes them.
 */

/** The stage's own proportions, which a rendered room is drawn in too. */
export const ROOM_ASPECT = 16 / 9

/** The stage's size; a larger picture is shrunk to it, a smaller one kept at its own. */
export const ROOM_PICTURE_MAX = { width: 1920, height: 1080 } as const

/** The file types the picker accepts. */
export const ROOM_PICTURE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

/** The largest file the picker will decode. */
export const ROOM_PICTURE_MAX_SOURCE_BYTES = 20 * 1024 * 1024

/** The largest encoded picture either build will write. */
export const ROOM_PICTURE_MAX_BYTES = 12 * 1024 * 1024

/** Refuses bytes that are not a PNG within the cap, before either build writes them. */
export function assertRoomPicture(bytes: Uint8Array): void {
  if (imageTypeOf(bytes) !== 'image/png') {
    throw appError(
      'ROOM_PICTURE_INVALID',
      'That picture could not be used.',
      'The encoded picture is not a PNG.'
    )
  }
  if (bytes.length > ROOM_PICTURE_MAX_BYTES) {
    throw appError(
      'ROOM_PICTURE_INVALID',
      'That picture could not be used.',
      `The encoded picture is ${String(bytes.length)} bytes, past the ${String(ROOM_PICTURE_MAX_BYTES)} a room background may be.`
    )
  }
}
