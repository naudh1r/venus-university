import { access, copyFile, mkdir, readdir, readFile, rm } from 'fs/promises'
import { base64ToBytes } from '@shared/base64'
import { appError, messageOf } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import { validateRecord } from '@shared/jsonValidate'
import {
  assertSafePhotoId,
  photoIdOfImage,
  photoMetaName,
  PHOTO_META_READ,
  type PhotoEntry,
  type PhotoMeta
} from '@shared/photos'
import {
  getPhotoMetaPath,
  getPhotoPath,
  getPhotosPath,
  getPhotoThumbPath,
  getPlaythroughPath
} from '../paths'
import { writeAtomicBytes, writeAtomicJson } from './jsonFile'
import { assertSafePlaythroughId } from './saveService'

/**
 * The Bunnyboard's photos on disk: one picture, one thumbnail and one sidecar per photo, kept
 * under a playthrough's own `photos` folder and never minted before that folder's playthrough
 * exists.
 */

/** Every photo kept beside `playthroughId`, newest first; a missing folder holds none. */
export async function listPhotos(playthroughId: string): Promise<PhotoEntry[]> {
  assertSafePlaythroughId(playthroughId)

  let names: string[]
  try {
    names = await readdir(getPhotosPath(playthroughId))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError('PHOTO_UNREADABLE', 'Could not read the photos.', messageOf(err))
  }

  const ids = names.map(photoIdOfImage).filter((id): id is string => id !== null)

  const entries = await Promise.all(
    ids.map(async (photoId): Promise<PhotoEntry> => {
      const entry: PhotoEntry = { photoId }

      try {
        const raw = await readFile(getPhotoMetaPath(playthroughId, photoId), 'utf-8')
        entry.meta = validateRecord<PhotoMeta>(
          JSON.parse(raw),
          photoMetaName(photoId),
          PHOTO_META_READ
        )
      } catch (err) {
        // A photo restored without one simply has none.
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`[photos] ${playthroughId}/${photoId}'s sidecar could not be read:`, err)
        }
      }

      try {
        entry.thumb = await readFile(getPhotoThumbPath(playthroughId, photoId))
      } catch {
        // No thumbnail yet is not worth a warning.
      }

      return entry
    })
  )

  // Ids are mint timestamps, so numeric order is capture order.
  return entries.sort((a, b) => Number(b.photoId) - Number(a.photoId))
}

/** One photo's picture, or `null` where it is gone. */
export async function readPhoto(playthroughId: string, photoId: string): Promise<Buffer | null> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)
  try {
    return await readFile(getPhotoPath(playthroughId, photoId))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw appError('PHOTO_UNREADABLE', 'Could not read the photo.', messageOf(err))
  }
}

/** Whether `playthroughId`'s own folder is on disk — never made by a photo write. */
async function playthroughExists(playthroughId: string): Promise<boolean> {
  try {
    await access(getPlaythroughPath(playthroughId))
    return true
  } catch {
    return false
  }
}

/**
 * Keeps one photo beside a playthrough that still exists: the sidecar and the thumbnail first,
 * the picture last, each written atomically, so a photo is listed only once it is whole.
 */
export async function writePhoto(
  playthroughId: string,
  photoId: string,
  image: string,
  thumb: string,
  meta: PhotoMeta
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)

  const imageBytes = base64ToBytes(image)
  const thumbBytes = base64ToBytes(thumb)
  if (!imageTypeOf(imageBytes)) {
    throw appError(
      'PHOTO_REQUEST_INVALID',
      'That photo could not be sent.',
      'The picture is not an image.'
    )
  }
  if (imageTypeOf(thumbBytes) !== 'image/jpeg') {
    throw appError(
      'PHOTO_REQUEST_INVALID',
      'That photo could not be sent.',
      'The thumbnail is not a JPEG.'
    )
  }
  const record = validateRecord<PhotoMeta>(meta, photoMetaName(photoId), PHOTO_META_READ)

  if (!(await playthroughExists(playthroughId))) {
    throw appError('PHOTO_PLAYTHROUGH_GONE', 'That playthrough no longer exists.')
  }

  try {
    await mkdir(getPhotosPath(playthroughId))
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw appError('PHOTO_PLAYTHROUGH_GONE', 'That playthrough no longer exists.')
    }
    if (code !== 'EEXIST') {
      throw appError('PHOTO_UNWRITABLE', 'Could not save the photo.', messageOf(err))
    }
  }

  const failure = { code: 'PHOTO_UNWRITABLE', message: 'Could not save the photo.' }
  await writeAtomicJson(getPhotoMetaPath(playthroughId, photoId), record, failure)
  await writeAtomicBytes(getPhotoThumbPath(playthroughId, photoId), thumbBytes, failure)
  await writeAtomicBytes(getPhotoPath(playthroughId, photoId), imageBytes, failure)
}

/** Replaces one photo's thumbnail; a no-op where the photo itself is not there. */
export async function writePhotoThumb(
  playthroughId: string,
  photoId: string,
  thumb: string
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)

  try {
    await access(getPhotoPath(playthroughId, photoId))
  } catch {
    return
  }

  const thumbBytes = base64ToBytes(thumb)
  if (imageTypeOf(thumbBytes) !== 'image/jpeg') {
    throw appError(
      'PHOTO_REQUEST_INVALID',
      'That photo could not be sent.',
      'The thumbnail is not a JPEG.'
    )
  }

  await writeAtomicBytes(getPhotoThumbPath(playthroughId, photoId), thumbBytes, {
    code: 'PHOTO_UNWRITABLE',
    message: 'Could not save the photo.'
  })
}

/** Removes one photo — its picture, thumbnail and sidecar; one already gone is success. */
export async function deletePhoto(playthroughId: string, photoId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)
  try {
    await rm(getPhotoPath(playthroughId, photoId), { force: true })
    await rm(getPhotoThumbPath(playthroughId, photoId), { force: true })
    await rm(getPhotoMetaPath(playthroughId, photoId), { force: true })
  } catch (err) {
    throw appError('PHOTO_UNDELETABLE', 'Could not delete the photo.', messageOf(err))
  }
}

/** Copies the picture to `to`, where the native save dialog pointed. */
export async function copyPhotoTo(
  playthroughId: string,
  photoId: string,
  to: string
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)
  try {
    await copyFile(getPhotoPath(playthroughId, photoId), to)
  } catch (err) {
    throw appError('PHOTO_UNEXPORTABLE', 'Could not save the photo.', messageOf(err))
  }
}
