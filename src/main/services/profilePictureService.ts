import { mkdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { appError, messageOf } from '@shared/errors'
import { assertProfilePicture } from '@shared/profilePicture'
import { getProfilePicturePath } from '../paths'
import { imagePath, removeImage, writeImageFile } from './imageFiles'
import { assertSafePlaythroughId } from './saveService'

/**
 * The reader's own picture: one the player picked and the renderer cut to shape as a PNG, kept
 * as WebP in the playthrough folder beside the saves it belongs to.
 */

/** The picture already on disk, or `null` where there is none. */
export async function readProfilePicture(playthroughId: string): Promise<Buffer | null> {
  assertSafePlaythroughId(playthroughId)
  try {
    return await readFile(await imagePath(getProfilePicturePath(playthroughId)))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw appError(
      'PROFILE_PICTURE_UNREADABLE',
      'Could not read the profile picture.',
      messageOf(err)
    )
  }
}

/** Writes the picture, `png` being its base64 bytes, once they have passed the shared check. */
export async function writeProfilePicture(playthroughId: string, png: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  const bytes = Buffer.from(png, 'base64')
  assertProfilePicture(bytes)

  const path = getProfilePicturePath(playthroughId)
  const unwritable = {
    code: 'PROFILE_PICTURE_UNWRITABLE',
    message: 'Could not save the profile picture.'
  }
  try {
    await mkdir(dirname(path), { recursive: true })
  } catch (err) {
    throw appError(unwritable.code, unwritable.message, messageOf(err))
  }
  await writeImageFile(path, bytes, { error: unwritable })
}

/** Removes the picture; one that is already gone is success. */
export async function deleteProfilePicture(playthroughId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  try {
    await removeImage(getProfilePicturePath(playthroughId))
  } catch (err) {
    throw appError(
      'PROFILE_PICTURE_UNWRITABLE',
      'Could not remove the profile picture.',
      messageOf(err)
    )
  }
}
