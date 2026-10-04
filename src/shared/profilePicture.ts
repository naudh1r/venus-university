import { appError } from './errors'
import { imageTypeOf } from './imageBytes'

/**
 * The reader's own picture: the shape every build cuts one to, what the picker will take off
 * the player, and the check the bytes pass before either build writes them.
 */

/** The archway's own proportions, at a size a card and a rail tile both read well from. */
export const PROFILE_PICTURE_SIZE = { width: 400, height: 480 } as const

/** The file types the picker accepts. */
export const PROFILE_PICTURE_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp']

/** The largest file the picker will decode. */
export const PROFILE_PICTURE_MAX_SOURCE_BYTES = 8 * 1024 * 1024

/** The largest encoded picture either build will write. */
export const PROFILE_PICTURE_MAX_BYTES = 2 * 1024 * 1024

/** Refuses bytes that are not a PNG within the cap, before either build writes them. */
export function assertProfilePicture(bytes: Uint8Array): void {
  if (imageTypeOf(bytes) !== 'image/png') {
    throw appError(
      'PROFILE_PICTURE_INVALID',
      'That picture could not be used.',
      'The encoded picture is not a PNG.'
    )
  }
  if (bytes.length > PROFILE_PICTURE_MAX_BYTES) {
    throw appError(
      'PROFILE_PICTURE_INVALID',
      'That picture could not be used.',
      `The encoded picture is ${String(bytes.length)} bytes, past the ${String(PROFILE_PICTURE_MAX_BYTES)} a profile picture may be.`
    )
  }
}
