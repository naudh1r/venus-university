import { constants } from 'fs'
import { copyFile, mkdir, readdir, readFile } from 'fs/promises'
import { join } from 'path'
import { appError } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import {
  isPhotoFile,
  isPhotoKind,
  isWebpPhoto,
  nextPhotoIndex,
  photoFileName,
  photoSlug,
  pngPhotoOf,
  type PhotoKind
} from '@shared/photoFiles'
import { photoSwitches } from '@shared/photoSwitches'
import { isPhotoTier, type PhotoTier } from '@shared/photoGate'
import { buildPhotoPrompt } from '@shared/photoPrompt'
import type { Character } from '@shared/types'
import { getPhotoPath, getPhotosPath } from '../photoProtocol'
import { withBodySetting } from '../bodySetting'
import { runGenerationJob } from './comfyService'
import { assertSafeCharId } from './characterService'
import { dropImageTwins, findImage } from './imageFiles'
import { writeAtomicBytes } from './jsonFile'
import { assertSafePlaythroughId } from './saveService'

/**
 * Rendering the pictures a character texts the reader.
 *
 * It sits beside `comfyService` rather than inside it, and asks that file for one thing only:
 * `runGenerationJob`, the submit-wait-save pipeline every render shares. The graph, the node
 * map, the folder and the naming are all this file's own, so the photo feature survives a sync
 * that replaces `comfyService` wholesale.
 *
 * Unlike a sprite, a photo is a whole picture — it keeps its background, so nothing cuts it
 * out — and it belongs to one save rather than to her: what she sends one reader in one
 * playthrough is not part of her art.
 */

/** Node ids overwritten in `assets/workflows/characterPhoto.json`. */
const PHOTO_NODE = {
  seed: '14',
  positivePrompt: '4',
  negativePrompt: '5',
  saveImage: '41'
} as const

/** Refuses a name this app would not have minted, before it is joined onto a folder path. */
function assertPhotoFile(file: string): void {
  if (!isPhotoFile(file)) {
    throw appError('PHOTO_FILE_INVALID', 'That is not a picture this game would have named.', file)
  }
}

/**
 * Names handed out but not yet on disk. Two pictures reserved in the same tick would otherwise
 * read the same folder and pick the same number; the render that finished second would land on
 * the first one's file and one bubble would show the other's picture.
 */
const reservedPhotoNames = new Map<string, Set<string>>()

/** The names already spoken for in one girl's folder: what is on disk, and what is in flight. */
async function takenPhotoNames(playthroughId: string, charId: string): Promise<string[]> {
  const folder = getPhotosPath(playthroughId, charId)
  let onDisk: string[] = []
  try {
    onDisk = await readdir(folder)
  } catch {
    // No folder yet is no pictures yet, which is the ordinary state of a new playthrough.
  }
  return [...onDisk, ...(reservedPhotoNames.get(folder) ?? [])]
}

/**
 * The name the next picture of one kind will be written under, settled now so the bubble that
 * is waiting for it can carry it into the save immediately. Nothing is written here: a reserved
 * name that is never rendered simply frees up again next time the folder is read.
 */
export async function reservePhotoName(
  playthroughId: string,
  character: Character,
  kind: string,
  inSave: unknown = []
): Promise<string> {
  assertSafeCharId(character.charId)
  assertSafePlaythroughId(playthroughId)
  if (!isPhotoKind(kind)) {
    throw appError('PHOTO_KIND_UNKNOWN', `"${String(kind)}" is not a kind of picture.`, kind)
  }

  const slug = photoSlug(character.firstName, character.charId)
  // The names the save already points at count as taken too, file or no file: a picture that
  // never reached this folder — a render cut short, a save carried over without its pictures —
  // must not have its name handed to the next one, or both bubbles show the new picture.
  const saved = Array.isArray(inSave)
    ? inSave.filter((name): name is string => typeof name === 'string' && isPhotoFile(name))
    : []
  const taken = [...(await takenPhotoNames(playthroughId, character.charId)), ...saved]
  const file = photoFileName(
    slug,
    kind as PhotoKind,
    nextPhotoIndex(taken, slug, kind as PhotoKind),
    photoSwitches().webp ? 'webp' : 'png'
  )

  const folder = getPhotosPath(playthroughId, character.charId)
  const held = reservedPhotoNames.get(folder) ?? new Set<string>()
  held.add(file)
  reservedPhotoNames.set(folder, held)
  return file
}

/**
 * Whether a picture a bubble is still waiting for actually arrived. The renderer asks on load:
 * a render that finished after the last save wrote its file and told nobody, and this is how
 * the bubble finds it again.
 */
export async function photoLanded(
  playthroughId: string,
  charId: string,
  file: string
): Promise<boolean> {
  assertSafeCharId(charId)
  assertSafePlaythroughId(playthroughId)
  if (!isPhotoFile(file)) return false
  // A WebP the renderer never got to encode is still there as its PNG.
  return (await findImage(getPhotoPath(playthroughId, charId, file))) !== null
}

/**
 * The bytes of a picture that just landed, for the renderer to encode as WebP: the page may not
 * fetch `playimg://`, and a picture drawn from it would taint the canvas it is encoded on.
 */
export async function readPhotoBytes(
  playthroughId: string,
  charId: string,
  file: string
): Promise<Uint8Array> {
  assertSafeCharId(charId)
  assertSafePlaythroughId(playthroughId)
  assertPhotoFile(file)
  const path = await findImage(getPhotoPath(playthroughId, charId, file))
  if (!path) throw appError('PHOTO_MISSING', 'That picture is not on disk.', file)
  return new Uint8Array(await readFile(path))
}

/**
 * Keeps the WebP the renderer encoded from a picture's PNG, and drops the PNG. Only for a name
 * that asked to be WebP, and only bytes that are one: anything else leaves the PNG standing.
 */
export async function storeWebpPhoto(
  playthroughId: string,
  charId: string,
  file: string,
  bytes: Uint8Array
): Promise<void> {
  assertSafeCharId(charId)
  assertSafePlaythroughId(playthroughId)
  if (!isWebpPhoto(file)) {
    throw appError('PHOTO_FILE_INVALID', 'That picture was not meant to be WebP.', file)
  }
  if (!(bytes instanceof Uint8Array) || imageTypeOf(bytes) !== 'image/webp') {
    throw appError('PHOTO_NOT_WEBP', 'The encoded picture is not a WebP.', file)
  }
  const path = getPhotoPath(playthroughId, charId, file)
  await writeAtomicBytes(path, bytes, {
    code: 'PHOTO_WRITE_FAILED',
    message: 'Could not save the photo as WebP.'
  })
  await dropImageTwins(path)
}

/**
 * Copies the pictures each of `charIds` sent in one playthrough into another: a semester
 * continued from the one before carries its threads and feeds over, and the pictures on them
 * are files in the old playthrough's folder. A girl who sent none has nothing to copy, and a
 * picture already there is left as it is.
 */
export async function carryPhotos(
  fromPlaythroughId: string,
  toPlaythroughId: string,
  charIds: readonly string[]
): Promise<void> {
  assertSafePlaythroughId(fromPlaythroughId)
  assertSafePlaythroughId(toPlaythroughId)
  for (const charId of charIds) {
    assertSafeCharId(charId)
    const source = getPhotosPath(fromPlaythroughId, charId)
    let files: string[]
    try {
      files = (await readdir(source)).filter(isPhotoFile)
    } catch {
      continue
    }
    if (files.length === 0) continue
    const target = getPhotosPath(toPlaythroughId, charId)
    await mkdir(target, { recursive: true })
    for (const file of files) {
      await copyFile(join(source, file), join(target, file), constants.COPYFILE_EXCL).catch(
        (err: unknown) => {
          if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
        }
      )
    }
  }
}

/**
 * Renders one picture she texted the reader, into the playthrough's own photo folder.
 *
 * The tier has already been settled against the save by `photoGate`; nothing here re-opens it.
 *
 * `file` is the name {@link reservePhotoName} already handed the bubble that is waiting for
 * this picture, so the two agree before the render starts rather than after it lands.
 */
export async function generatePhoto(
  playthroughId: string,
  character: Character,
  tier: string,
  photoPrompt: string,
  file: string,
  options: { signal?: AbortSignal; onProgress?: (step: string) => void } = {}
): Promise<string> {
  assertSafeCharId(character.charId)
  assertSafePlaythroughId(playthroughId)
  if (!isPhotoTier(tier)) {
    throw appError('PHOTO_TIER_UNKNOWN', `"${String(tier)}" is not a photo tier.`, tier)
  }
  if (!photoPrompt.trim()) {
    throw appError('PHOTO_PROMPT_MISSING', 'There is nothing to take a picture of.')
  }
  if (options.signal?.aborted) throw appError('CANCELLED', 'Generation was cancelled.')
  options.onProgress?.('Preparing')

  assertPhotoFile(file)
  // Her own seed would make every picture the same picture; only her tags hold her together.
  const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

  await runGenerationJob(
    {
      workflowFile: 'characterPhoto.json',
      nodes: PHOTO_NODE,
      // Her body only while the body switch is on, as her sprites are drawn.
      prompts: buildPhotoPrompt(await withBodySetting(character), tier as PhotoTier, photoPrompt),
      seed,
      // Rendered as PNG either way; a WebP name is encoded by the renderer once it lands.
      destPath: getPhotoPath(playthroughId, character.charId, pngPhotoOf(file)),
      label: `${character.charId} / photo:${tier}`,
      logContext: `seed=${seed} file=${file}`
    },
    options
  )

  // On disk now, so the folder itself says the name is taken.
  reservedPhotoNames.get(getPhotosPath(playthroughId, character.charId))?.delete(file)

  // The name, not the path: the message carries it and `playimg://` resolves it.
  return file
}
