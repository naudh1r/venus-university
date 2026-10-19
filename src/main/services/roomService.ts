import { mkdir, readFile } from 'fs/promises'
import { dirname } from 'path'
import { appError, messageOf } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import { generateImage } from '@shared/llm/cloudImage'
import { LINEUP_MIME_TYPE, LINEUP_QUALITY } from '@shared/lineup'
import { dayRoomPrompt, isRoomVariant, NIGHT_ROOM_PROMPT, type RoomVariant } from '@shared/room'
import { assertRoomPicture } from '@shared/roomPicture'
import type { Character } from '@shared/types'
import { getCharacterRoomPath } from '../paths'
import { assertSafeCharId } from './characterService'
import { canEncodeWebp, findImage, openImage, writeImageFile } from './imageFiles'

/** What a room background's write raises where the disk refuses it. */
const UNWRITABLE = { code: 'ROOM_UNWRITABLE', message: 'Could not save the room background.' }

/** The day image the night render re-lights: this run's staged one if any, else the live one. */
async function readDayImage(charId: string, staged: boolean): Promise<Buffer> {
  for (const named of staged
    ? [getCharacterRoomPath(charId, 'day', true), getCharacterRoomPath(charId, 'day')]
    : [getCharacterRoomPath(charId, 'day')]) {
    const path = await findImage(named)
    if (path === null) continue
    try {
      return await readFile(path)
    } catch {
      continue
    }
  }
  throw appError(
    'ROOM_DAY_MISSING',
    'The daytime room background has to be rendered before the night one.'
  )
}

/**
 * The day picture as the night render is handed it: a JPEG, as every reference the app sends
 * is, or as it is where there is no decoder. One that will not read is `ROOM_DAY_INVALID`.
 */
async function dayReference(day: Buffer): Promise<{ bytes: Uint8Array; mimeType: string }> {
  const invalid = appError(
    'ROOM_DAY_INVALID',
    'The daytime room background could not be read as an image. Render it again.'
  )
  if (!(await canEncodeWebp())) {
    const mimeType = imageTypeOf(day)
    if (!mimeType) throw invalid
    return { bytes: day, mimeType }
  }

  try {
    const image = await openImage(day)
    const bytes = await image.jpeg({ quality: Math.round(LINEUP_QUALITY * 100) }).toBuffer()
    return { bytes, mimeType: LINEUP_MIME_TYPE }
  } catch {
    throw invalid
  }
}

/**
 * Renders one of a character's two room backgrounds and writes the image into her
 * folder.
 */
export async function generateRoomImage(
  character: Character,
  variant: RoomVariant,
  staged = false,
  signal?: AbortSignal
): Promise<void> {
  // Both halves of `room_{variant}.png` come from the renderer unchecked.
  assertSafeCharId(character.charId)
  if (!isRoomVariant(variant)) {
    throw appError('ROOM_VARIANT_UNKNOWN', `"${String(variant)}" is not a room variant.`)
  }

  let bytes: Uint8Array
  if (variant === 'night') {
    const day = await dayReference(await readDayImage(character.charId, staged))
    bytes = await generateImage(NIGHT_ROOM_PROMPT, { signal, sources: [day] })
  } else {
    if (!character.roomPrompt.trim()) {
      throw appError(
        'ROOM_PROMPT_MISSING',
        'This character has no room description. Regenerate the character to get one.'
      )
    }
    bytes = await generateImage(dayRoomPrompt(character.roomPrompt), { signal })
  }

  const path = getCharacterRoomPath(character.charId, variant, staged)
  try {
    await mkdir(dirname(path), { recursive: true })
  } catch (err) {
    throw appError(UNWRITABLE.code, UNWRITABLE.message, messageOf(err))
  }
  await writeImageFile(path, bytes, { error: UNWRITABLE })
}

/**
 * Writes a room background the player picked, `png` being its base64 bytes, once they have
 * passed the shared check. Into the live folder and never a new one: a character deleted while
 * the picture was on its way has no folder for it.
 */
export async function writeRoomUpload(
  charId: string,
  variant: RoomVariant,
  png: string
): Promise<void> {
  assertSafeCharId(charId)
  if (!isRoomVariant(variant)) {
    throw appError('ROOM_VARIANT_UNKNOWN', `"${String(variant)}" is not a room variant.`)
  }
  const bytes = Buffer.from(png, 'base64')
  assertRoomPicture(bytes)

  await writeImageFile(getCharacterRoomPath(charId, variant), bytes, { error: UNWRITABLE })
}
