import { readFile } from 'fs/promises'
import type { Sharp } from 'sharp'
import { expressionRel, faceRel, profileRel } from '@shared/characterFiles'
import { appError, messageOf } from '@shared/errors'
import { alphaBounds, type LineupBox } from '@shared/lineup'
import { activeProfileCrop, clampProfileCrop, defaultProfileCrop } from '@shared/profileCrop'
import type { Character, ProfileCrop, ProfileCropInfo } from '@shared/types'
import {
  getCharacterExpressionPath,
  getCharacterFacePath,
  getCharacterProfilePath,
  getStagedPath
} from '../paths'
import { imagePath, openImage, writeImageFile } from './imageFiles'

/**
 * Her portrait, cut from her neutral sprite. Main owns it because sharp decodes, crops and
 * re-encodes the picture here, which is all this needs — the renderer's canvas is still the only
 * thing that can *composite*.
 */

/** How opaque a mask pixel must be to count as face; the mask is drawn white on black. */
const MASK_FLOOR = 128

/** Where the sprite and its mask live for one wardrobe pass, live or staged. */
function paths(
  charId: string,
  staged: boolean
): { sprite: string; face: string; profile: string } {
  return staged
    ? {
        sprite: getStagedPath(charId, expressionRel('neutral')),
        face: getStagedPath(charId, faceRel()),
        profile: getStagedPath(charId, profileRel())
      }
    : {
        sprite: getCharacterExpressionPath(charId, 'neutral'),
        face: getCharacterFacePath(charId),
        profile: getCharacterProfilePath(charId)
      }
}

/** One image off disk and its size, opened for reading its pixels. */
interface Decoded {
  image: Sharp
  width: number
  height: number
}

/** One image off disk, whichever extension it is under, or `null` where there is no readable one. */
async function decode(path: string): Promise<Decoded | null> {
  try {
    const image = await openImage(await readFile(await imagePath(path)))
    const { width, height } = await image.metadata()
    return width > 0 && height > 0 ? { image, width, height } : null
  } catch {
    return null
  }
}

/** The sprite a portrait is cut from, or `PROFILE_SOURCE_MISSING` where there is no readable one. */
async function decodeSpriteOrThrow(path: string): Promise<Decoded> {
  const sprite = await decode(path)
  if (!sprite) {
    throw appError(
      'PROFILE_SOURCE_MISSING',
      'Could not read the neutral sprite.',
      `${path} is missing or not a readable picture.`
    )
  }
  return sprite
}

/**
 * The box the face mask marks out, in the sprite's own pixels. The mask is greyscale, so any
 * one channel says what the whole pixel does and the first one is read.
 */
async function faceBoxOf(maskPath: string): Promise<LineupBox | null> {
  const mask = await decode(maskPath)
  if (!mask) return null

  try {
    // One byte a pixel: the single channel extracted, unpacked.
    const { data, info } = await mask.image
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true })
    return alphaBounds(data, info.width, info.height, MASK_FLOOR)
  } catch {
    return null
  }
}

/**
 * Cuts `profile.png` out of her neutral sprite and answers with the frame it used: the crop she
 * is wearing where it is still hers, the one her face asks for otherwise.
 */
export async function cutProfile(
  charId: string,
  character: Character,
  staged = false
): Promise<ProfileCrop> {
  const at = paths(charId, staged)
  const sprite = await decodeSpriteOrThrow(at.sprite)

  const { width, height } = sprite
  const stored = activeProfileCrop(character)
  const crop = stored
    ? clampProfileCrop(stored, width, height)
    : defaultProfileCrop(await faceBoxOf(at.face), width, height, character.generationSeed)

  let cut: Buffer
  try {
    cut = await sprite.image
      .extract({ left: crop.x, top: crop.y, width: crop.width, height: crop.height })
      .png({ compressionLevel: 1 })
      .toBuffer()
  } catch (err) {
    // The header read, but the pixels behind it did not.
    throw appError('PROFILE_SOURCE_MISSING', 'Could not read the neutral sprite.', messageOf(err))
  }
  await writeImageFile(at.profile, cut, {
    error: { code: 'PROFILE_UNWRITABLE', message: 'Could not save the portrait.' }
  })

  return crop
}

/**
 * {@link cutProfile} on the render path, where a portrait that cannot be cut costs only the
 * icon and never the sprite the job is actually for.
 */
export async function tryCutProfile(
  charId: string,
  character: Character,
  staged = false
): Promise<void> {
  try {
    await cutProfile(charId, character, staged)
  } catch (err) {
    console.warn(`[profile] ${charId}: no portrait — ${messageOf(err)}`)
  }
}

/** What the crop modal opens on: her stored frame, the one her face asks for, and the sprite. */
export async function profileCropOf(
  charId: string,
  character: Character
): Promise<ProfileCropInfo> {
  const at = paths(charId, false)
  const { width, height } = await decodeSpriteOrThrow(at.sprite)

  const stored = activeProfileCrop(character)
  return {
    stored: stored ? clampProfileCrop(stored, width, height) : null,
    suggested: defaultProfileCrop(
      await faceBoxOf(at.face),
      width,
      height,
      character.generationSeed
    ),
    width,
    height
  }
}
