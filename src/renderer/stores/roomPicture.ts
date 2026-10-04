import { coverCrop } from '@shared/coverCrop'
import { appError, messageOf } from '@shared/errors'
import {
  assertRoomPicture,
  ROOM_ASPECT,
  ROOM_PICTURE_MAX,
  ROOM_PICTURE_MAX_SOURCE_BYTES,
  ROOM_PICTURE_TYPES
} from '@shared/roomPicture'
import { cropToPng } from './pngCanvas'

/**
 * The picked file cut to its centred 16:9 window, shrunk to the stage where it is larger, and
 * encoded as the PNG the bridge is handed; a file of another type or past the size the picker
 * takes is refused unread.
 */
export async function cutRoomPicture(file: File): Promise<Uint8Array<ArrayBuffer>> {
  if (!ROOM_PICTURE_TYPES.includes(file.type) || file.size > ROOM_PICTURE_MAX_SOURCE_BYTES) {
    throw appError(
      'ROOM_PICTURE_INVALID',
      'That has to be a PNG, JPEG or WebP under 20 MB.',
      `${file.name} is ${file.type || 'of no declared type'} and ${String(file.size)} bytes.`
    )
  }
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch (err) {
    throw appError('ROOM_PICTURE_INVALID', 'That picture could not be read.', messageOf(err))
  }
  try {
    const crop = coverCrop(bitmap.width, bitmap.height, ROOM_ASPECT)
    const scale = Math.min(
      1,
      ROOM_PICTURE_MAX.width / crop.width,
      ROOM_PICTURE_MAX.height / crop.height
    )
    const width = Math.round(crop.width * scale)
    const height = Math.round(crop.height * scale)
    if (width < 1 || height < 1) {
      throw appError(
        'ROOM_PICTURE_INVALID',
        'That picture is too small to use.',
        `${file.name} is ${String(bitmap.width)}×${String(bitmap.height)}.`
      )
    }
    const bytes = await cropToPng(bitmap, crop, width, height)
    if (!bytes) throw appError('ROOM_PICTURE_INVALID', 'That picture could not be encoded.')
    assertRoomPicture(bytes)
    return bytes
  } finally {
    bitmap.close()
  }
}
