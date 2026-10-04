import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises'
import { dirname } from 'path'
import { appError, messageOf } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import { generateImage } from '@shared/llm/cloudImage'
import { dayRoomPrompt, isRoomVariant, NIGHT_ROOM_PROMPT, type RoomVariant } from '@shared/room'
import { assertRoomPicture } from '@shared/roomPicture'
import type { Character } from '@shared/types'
import { getCharacterRoomPath } from '../paths'
import { assertSafeCharId } from './characterService'
import { dropImageTwins, findImage } from './imageFiles'
import { writeAtomicBytes } from './jsonFile'

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
    const day = await readDayImage(character.charId, staged)
    const mimeType = imageTypeOf(day)
    if (!mimeType) {
      throw appError(
        'ROOM_DAY_INVALID',
        'The daytime room background could not be read as an image. Render it again.'
      )
    }
    bytes = await generateImage(NIGHT_ROOM_PROMPT, {
      signal,
      sources: [{ bytes: day, mimeType }]
    })
  } else {
    if (!character.roomPrompt.trim()) {
      throw appError(
        'ROOM_PROMPT_MISSING',
        'This character has no room description. Regenerate the character to get one.'
      )
    }
    bytes = await generateImage(dayRoomPrompt(character.roomPrompt), { signal })
  }

  // Atomic like every other write.
  const path = getCharacterRoomPath(character.charId, variant, staged)
  const temp = `${path}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(temp, bytes)
    await rename(temp, path)
    await dropImageTwins(path)
  } catch (err) {
    await unlink(temp).catch(() => {})
    throw appError('ROOM_UNWRITABLE', 'Could not save the room background.', messageOf(err))
  }
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

  const path = getCharacterRoomPath(charId, variant)
  await writeAtomicBytes(path, bytes, {
    code: 'ROOM_UNWRITABLE',
    message: 'Could not save the room background.'
  })
  await dropImageTwins(path)
}
