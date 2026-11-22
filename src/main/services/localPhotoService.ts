import { randomBytes } from 'crypto'
import { mkdir, readdir, readFile, rm } from 'fs/promises'
import { dirname, join } from 'path'
import {
  characterLoraOf,
  SAFE_NUMERIC_ID,
  appError,
  imageTypeOf,
  type Character,
  assertSafeCharId,
  assertSafePlaythroughId
} from '@vx/modkit/shared'
import {
  isPhotoFile,
  isPhotoSidecar,
  photoSidecarOf,
  isWebpPhoto,
  pngPhotoOf,
} from '../../shared/photoFiles'
import {
  PHOTO_PROMPT_LIMIT,
  type PhotoInfo,
  type PhotoPpmState,
  type PhotoOrientation,
  type PhotoRenderOptions,
  type PhotoSidecar
} from '../../shared/photoTypes'
import { photoSwitches, PHOTO_FEATURE_ID } from '../../shared/photoSwitches'
import { isPhotoTier, type PhotoTier } from '../../shared/photoGate'
import { buildDuoPhotoPrompt, buildPhotoPrompt, faceHalfOf, soloOrientationOf } from '../../shared/photoPrompt'
import { unreadPhotoParts } from '../../shared/photoPose'
import {
  beginPhotoFile, copyPhotoFile, dropPhotoTwins, findPhotoImage, findPhotoSidecar,
  getPhotoPath, getPhotosPath, getPhotosRoot, legacyPhotosRoot, movePhotoFiles,
  photoCharacters, photoMoveSettled, photoNames, photoFileRendering, photoPlaythroughPath, photoReferences, readPhotoImage, readPhotoSidecar
} from '../photoFiles'
import { withBodySetting } from '../bodySetting'
import {
  comfyNodePackState,
  renderComfyImage,
  writeAtomicBytes,
  type ComfyRenderRequest
} from '@vx/modkit/main'
import { PPM_PACK } from '../photoNodePack'
import { recoverPhotoSwap, replacePhotoFiles } from '../photoSwap'
import soloWorkflow from '../../../assets/workflows/characterPhoto.json'
import wideDuoWorkflow from '../../../assets/photo/characterPhotoDuoWide.json'
import ppmPortraitWorkflow from '../../../assets/photo/characterPhotoDuoPpm.json'

/**
 * Photo owns its graphs, prompts and playthrough destinations. The kit queues each graph,
 * starts ComfyUI and returns checked image bytes; Photo keeps them atomically. A duo supplies
 * each girl's prompt through extra text nodes, and the renderer handles WebP encoding.
 */

/** Shared node ids filled in Photo’s solo and ppm graphs. */
const DUO_PHOTO_NODE = {
  seed: '14',
  positivePrompt: '4',
  negativePrompt: '5',
  saveImage: '41'
} as const

/** Node ids overwritten in `assets/workflows/characterPhoto.json`. */
const PHOTO_NODE = { ...DUO_PHOTO_NODE, characterLora: '100' } as const

/** The latent node in `assets/workflows/characterPhoto.json`, laid on its side for a wide one. */
const PHOTO_LATENT_NODE = '15'

/** The solo graph at 1216x832, a copy so the imported graph stays as shipped. */
function wideSoloWorkflow(): ComfyRenderRequest['workflow'] {
  const workflow = structuredClone(soloWorkflow) as ComfyRenderRequest['workflow']
  const latent = workflow[PHOTO_LATENT_NODE]
  latent.inputs = { ...latent.inputs, width: 1216, height: 832 }
  return workflow
}

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
  await movePhotoFiles(playthroughId)
  const onDisk = [...await photoNames(folder),
    ...await photoNames(join(legacyPhotosRoot(playthroughId), charId))]
  return [...onDisk, ...(reservedPhotoNames.get(folder) ?? [])]
}

/**
 * Reserves a random identity before a waiting bubble is saved. Disk files, checkpoints and
 * other reservations all count as taken, including another image format with the same stem.
 */
export async function reservePhotoName(
  playthroughId: string,
  character: Character,
  inSave: unknown = []
): Promise<string> {
  assertSafeCharId(character.charId)
  assertSafePlaythroughId(playthroughId)
  // The names the save already points at count as taken too, file or no file: a picture that
  // never reached this folder — a render cut short, a save carried over without its pictures —
  // must not have its name handed to the next one, or both bubbles show the new picture.
  const saved = Array.isArray(inSave)
    ? inSave.filter((name): name is string => typeof name === 'string' && isPhotoFile(name))
    : []
  const taken = new Set([...(await takenPhotoNames(playthroughId, character.charId)), ...saved,
    ...(await photoReferences(playthroughId)).all].map(name => pngPhotoOf(name.replace(/\.json$/, '.png'))))
  const folder = getPhotosPath(playthroughId, character.charId)
  const held = reservedPhotoNames.get(folder) ?? new Set<string>()
  reservedPhotoNames.set(folder, held)
  let file: string
  do {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
    let id = ''
    while (id.length < 10) {
      for (const byte of randomBytes(16)) {
        if (byte < 252 && id.length < 10) id += alphabet[byte % 36]
      }
    }
    file = `${id}.${photoSwitches().webp ? 'webp' : 'png'}`
  } while (taken.has(pngPhotoOf(file)) || [...held].some(name => pngPhotoOf(name) === pngPhotoOf(file)))
  held.add(file)
  return file
}

const redrawTemps = new Set<string>()

/** Holds a throwaway render until its replacement or cancellation has finished. */
export async function reserveRedrawName(pid: string, character: Character, saved: readonly string[]): Promise<string> {
  const file = await reservePhotoName(pid, character, saved)
  redrawTemps.add(getPhotoPath(pid, character.charId, file))
  return file
}

/** Commits a complete temporary render under the original identity, without changing a save. */
export async function replacePhoto(pid: string, charId: string, file: string, temporary: string, signal?: AbortSignal): Promise<void> {
  assertSafePlaythroughId(pid)
  assertSafeCharId(charId)
  assertPhotoFile(file)
  assertPhotoFile(temporary)
  if (!redrawTemps.has(getPhotoPath(pid, charId, temporary))) {
    throw appError('PHOTO_FILE_INVALID', 'That redraw is no longer waiting.')
  }
  const release = beginPhotoFile(pid, charId, file)
  try {
    await movePhotoFiles(pid)
    await replacePhotoFiles(pid, charId, file, temporary, signal)
  } finally { release() }
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
  return (await findPhotoImage(playthroughId, charId, file)) !== null
}

/**
 * The bytes of a picture that just landed, for the renderer to encode as WebP: the page may not
 * fetch the mod's own protocol, and a picture drawn from it would taint the canvas it is encoded on.
 */
export async function readPhotoBytes(
  playthroughId: string,
  charId: string,
  file: string
): Promise<Uint8Array> {
  assertSafeCharId(charId)
  assertSafePlaythroughId(playthroughId)
  assertPhotoFile(file)
  return readPhotoImage(playthroughId, charId, file)
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
  await movePhotoFiles(playthroughId)
  await mkdir(getPhotosPath(playthroughId, charId), { recursive: true })
  const path = getPhotoPath(playthroughId, charId, file)
  await writeAtomicBytes(path, bytes, {
    code: 'PHOTO_WRITE_FAILED',
    message: 'Could not save the photo as WebP.'
  })
  await dropPhotoTwins(path)
}

/**
 * Copies the pictures each of `charIds` sent in one playthrough into another: a semester
 * continued from the one before carries its threads and feeds over, and the pictures on them
 * are files in the old playthrough's folder. A girl who sent none has nothing to copy, and a
 * picture already there is left as it is. With no `charIds`, every girl with a folder there.
 */
export async function carryPhotos(
  fromPlaythroughId: string,
  toPlaythroughId: string,
  charIds?: readonly string[]
): Promise<void> {
  assertSafePlaythroughId(fromPlaythroughId)
  assertSafePlaythroughId(toPlaythroughId)
  await movePhotoFiles(fromPlaythroughId)
  await movePhotoFiles(toPlaythroughId)
  const roots = [getPhotosRoot(fromPlaythroughId), legacyPhotosRoot(fromPlaythroughId)]
  const who = charIds ?? [...new Set((await Promise.all(roots.map(photoCharacters))).flat())]
  for (const charId of who) {
    assertSafeCharId(charId)
    const sources = new Map<string, string>()
    for (const root of roots) {
      for (const file of await photoNames(join(root, charId))) {
        if (!sources.has(file)) sources.set(file, join(root, charId, file))
      }
    }
    for (const [file, source] of sources) {
      if (!isPhotoSidecar(file)) {
        await copyPhotoFile(source, getPhotoPath(toPlaythroughId, charId, file), true)
      }
    }
    for (const [file, source] of sources) {
      if (!isPhotoSidecar(file) || !(await readPhotoSidecar(source))) continue
      const stem = file.replace(/\.json$/, '')
      const targetImage = await findPhotoImage(toPlaythroughId, charId, `${stem}.png`)
      if (!targetImage) continue
      let matched = false
      for (const name of [`${stem}.webp`, `${stem}.png`]) {
        const sourceImage = sources.get(name)
        if (sourceImage && (await readFile(sourceImage)).equals(await readFile(targetImage))) {
          matched = true
          break
        }
      }
      if (matched) await copyPhotoFile(source, getPhotoPath(toPlaythroughId, charId, file), true)
    }
  }
}

/** Whether an override value is a plain record of fields. */
function isOverrideRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** Refuses malformed redraw overrides before a render is queued or started. */
export function validatePhotoOverrides(
  value: unknown,
  duo: boolean
): asserts value is PhotoRenderOptions {
  const invalid = (): never => {
    throw appError('PHOTO_OVERRIDE_INVALID', 'The photo seed, prompts, orientation or couple method are invalid.')
  }
  if (!isOverrideRecord(value)) invalid()
  const overrides = value as Record<string, unknown>
  if (Object.keys(overrides).some((key) => !['seed', 'prompts', 'orientation', 'couple'].includes(key))) {
    invalid()
  }
  if (
    overrides.seed !== undefined &&
    (!Number.isSafeInteger(overrides.seed) || (overrides.seed as number) < 0)
  ) {
    invalid()
  }
  if (
    overrides.orientation !== undefined &&
    overrides.orientation !== 'portrait' &&
    overrides.orientation !== 'wide'
  ) {
    invalid()
  }
  if (overrides.couple !== undefined &&
      (!duo || overrides.couple !== 'ppm')) invalid()
  if (overrides.prompts === undefined) return
  if (!isOverrideRecord(overrides.prompts)) invalid()
  const prompts = overrides.prompts as Record<string, unknown>
  const keys = duo ? ['positive', 'negative', 'left', 'right'] : ['positive', 'negative']
  if (Object.keys(prompts).some((key) => !keys.includes(key))) invalid()
  for (const key of keys) {
    if (typeof prompts[key] !== 'string' || prompts[key].length > PHOTO_PROMPT_LIMIT) invalid()
  }
  if (!(prompts.positive as string).trim()) invalid()
}

/**
 * The shape a new photo of her alone is drawn in, settled before it is drawn so the screen can
 * hold its place in that shape. Read off the prompt the photo will be drawn from.
 */
export async function soloPhotoOrientation(
  character: Character,
  tier: string,
  photoPrompt: string
): Promise<PhotoOrientation> {
  if (!isPhotoTier(tier) || !photoPrompt.trim()) return 'portrait'
  const { positive } = buildPhotoPrompt(await withBodySetting(character), tier, photoPrompt)
  return soloOrientationOf(positive, Math.random())
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
  options: { signal?: AbortSignal; onProgress?: (step: string) => void } = {},
  overrides: PhotoRenderOptions = {}
): Promise<string> {
  validatePhotoOverrides(overrides, false)
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
  // Each photo gets its own seed; her tags and LoRA hold her together.
  const seed = overrides.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)

  const lora = characterLoraOf(character)
  const prompts = overrides.prompts
    ? { positive: overrides.prompts.positive, negative: overrides.prompts.negative }
    : buildPhotoPrompt(await withBodySetting(character), tier as PhotoTier, photoPrompt)
  if (!overrides.prompts) {
    const unread = unreadPhotoParts(photoPrompt, tier as PhotoTier)
    if (unread.length > 0) console.log(`[photo] no tags read for ${unread.join(' or ')}: "${photoPrompt}"`)
  }

  // A new photo takes its shape off its prompt; a redraw keeps the one asked for, or the
  // portrait every redraw had before shapes, when its prompts come without one.
  const wide = overrides.orientation
    ? overrides.orientation === 'wide'
    : !overrides.prompts && soloOrientationOf(prompts.positive, Math.random()) === 'wide'
  await renderPhotoImage(playthroughId, character.charId, file, {
    workflow: wide ? wideSoloWorkflow() : soloWorkflow,
    nodes: PHOTO_NODE,
    prompts,
    seed,
    lora
  }, {
    schemaVersion: 1, seed, tier, ...prompts, ...(lora ? { lora } : {}),
    ...(wide ? { orientation: 'wide' as const } : {})
  }, options)

  // On disk now, so the folder itself says the name is taken.
  if (!redrawTemps.has(getPhotoPath(playthroughId, character.charId, file))) {
    reservedPhotoNames.get(getPhotosPath(playthroughId, character.charId))?.delete(file)
  }

  // The name, not the path: the message carries it and the mod's protocol resolves it.
  return file
}

/** The two people's own prompt nodes, the same ids in the portrait and the wide graph. */
const DUO_GIRL_NODE = { left: '50', right: '51' } as const

/** The ppm graphs' face-pass prompt nodes, one per person. */
const DUO_FACE_NODE = { left: '80', right: '81' } as const

/** Where the pack needed for every photo of two stands on the selected ComfyUI. */
export async function photoPpmState(): Promise<PhotoPpmState> {
  return comfyNodePackState(PHOTO_FEATURE_ID, PPM_PACK.id)
}

/** Draws two people with ppm, retaining edited ppm halves and converting older halves first. */
export async function generateDuoPhoto(
  playthroughId: string,
  character: Character,
  friend: Character,
  tier: string,
  photoPrompt: string,
  file: string,
  options: { signal?: AbortSignal; onProgress?: (step: string) => void } = {},
  overrides: PhotoRenderOptions = {}
): Promise<string> {
  validatePhotoOverrides(overrides, true)
  assertSafeCharId(character.charId)
  assertSafeCharId(friend.charId)
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
  const seed = overrides.seed ?? Math.floor(Math.random() * Number.MAX_SAFE_INTEGER)
  if (await photoPpmState() !== 'installed') {
    throw appError(
      'PHOTO_WIDE_NEEDS_PPM',
      'This photo of two needs the ComfyUI-ppm node pack. Install it from Mods under Two in one photo, or on your own ComfyUI if you use one.'
    )
  }
  const recorded = await recordedPhotoInfo(playthroughId, character.charId, file)
  const supplied = overrides.prompts ?? recorded
  const suppliedPpm = (overrides.couple ?? recorded?.couple) === 'ppm'
  const built = !supplied || !suppliedPpm
    ? buildDuoPhotoPrompt(
        await withBodySetting(character), await withBodySetting(friend), tier, photoPrompt, 'ppm'
      )
    : undefined
  const prompts = {
    positive: supplied?.positive ?? built!.scene,
    negative: supplied?.negative ?? built!.negative,
    left: suppliedPpm && supplied ? supplied.left ?? '' : built!.left,
    right: suppliedPpm && supplied ? supplied.right ?? '' : built!.right
  }
  // A saved photo without an orientation is portrait, as every photo of two was before ppm. Only a
  // brand-new photo of two starts wide.
  const orientation = overrides.orientation ?? (recorded ? recorded.orientation ?? 'portrait' : 'wide')
  const wide = orientation === 'wide'
  await renderPhotoImage(playthroughId, character.charId, file, {
    workflow: wide ? wideDuoWorkflow : ppmPortraitWorkflow,
    nodes: DUO_PHOTO_NODE,
    prompts: { positive: prompts.positive, negative: prompts.negative },
    texts: {
      [DUO_GIRL_NODE.left]: prompts.left,
      [DUO_GIRL_NODE.right]: prompts.right,
      [DUO_FACE_NODE.left]: faceHalfOf(prompts.left, character),
      [DUO_FACE_NODE.right]: faceHalfOf(prompts.right, friend)
    },
    seed
  }, {
    schemaVersion: 1, seed, tier, ...prompts, couple: 'ppm',
    ...(wide ? { orientation: 'wide' as const } : {})
  }, options)

  if (!redrawTemps.has(getPhotoPath(playthroughId, character.charId, file))) {
    reservedPhotoNames.get(getPhotosPath(playthroughId, character.charId))?.delete(file)
  }
  return file
}

/** Keeps returned image bytes and their request, removing a cancelled write before it settles. */
async function renderPhotoImage(
  playthroughId: string,
  charId: string,
  file: string,
  request: ComfyRenderRequest,
  sidecar: PhotoSidecar,
  options: { signal?: AbortSignal; onProgress?: (step: string) => void }
): Promise<void> {
  const release = beginPhotoFile(playthroughId, charId, file)
  try {
    await movePhotoFiles(playthroughId)
    const signal = options.signal ?? new AbortController().signal
    const check = (): void => {
      if (signal.aborted) throw appError('CANCELLED', 'Generation was cancelled.')
    }
    const bytes = await renderComfyImage(PHOTO_FEATURE_ID, request, {
      signal,
      onProgress: options.onProgress
    })
    check()
    const dest = getPhotoPath(playthroughId, charId, pngPhotoOf(file))
    await mkdir(getPhotosPath(playthroughId, charId), { recursive: true })
    check()
    let written = false
    try {
      await writeAtomicBytes(dest, bytes, {
        code: 'PHOTO_WRITE_FAILED',
        message: 'Could not save the photo.'
      })
      written = true
      check()
      await dropPhotoTwins(dest)
      check()
      await keepPhotoSidecar(playthroughId, charId, file, sidecar)
      check()
    } catch (error) {
      if (written && signal.aborted) {
        await rm(dest, { force: true })
        await rm(getPhotoPath(playthroughId, charId, photoSidecarOf(file)), { force: true })
      }
      check()
      throw error
    }
  } finally {
    release()
  }
}

/** Keeps the request next to its landed picture; metadata failure leaves the picture usable. */
async function keepPhotoSidecar(
  playthroughId: string,
  charId: string,
  file: string,
  info: PhotoSidecar
): Promise<void> {
  try {
    await writeAtomicBytes(
      getPhotoPath(playthroughId, charId, photoSidecarOf(file)),
      Buffer.from(JSON.stringify(info)),
      {
        code: 'PHOTO_SIDECAR_WRITE_FAILED',
        message: 'Could not save the photo prompt.'
      }
    )
  } catch (error) {
    console.warn(`[photo] could not keep the prompt for ${file}:`, error)
  }
}

/** Reads only the complete versioned shape; old or broken metadata falls back to a build. */
async function recordedPhotoInfo(
  playthroughId: string,
  charId: string,
  file: string
): Promise<PhotoSidecar | undefined> {
  return findPhotoSidecar(playthroughId, charId, photoSidecarOf(file))
}

/** The recorded request, or today's prompt built from her current tags and body setting. */
export async function photoInfo(
  playthroughId: string,
  character: Character,
  friend: Character | undefined,
  tier: string,
  scene: string,
  file: string,
  rebuild = false,
  orientation?: PhotoOrientation
): Promise<PhotoInfo> {
  assertSafePlaythroughId(playthroughId)
  assertSafeCharId(character.charId)
  if (friend) assertSafeCharId(friend.charId)
  assertPhotoFile(file)
  if (!isPhotoTier(tier))
    throw appError('PHOTO_TIER_UNKNOWN', `"${String(tier)}" is not a photo tier.`, tier)
  if (orientation !== undefined && orientation !== 'portrait' && orientation !== 'wide') {
    throw appError('PHOTO_OVERRIDE_INVALID', 'The photo seed, prompts, orientation or couple method are invalid.')
  }
  const saved = await recordedPhotoInfo(playthroughId, character.charId, file)
  const savedOrientation: PhotoOrientation = saved?.orientation ?? 'portrait'
  if (saved && !rebuild && (!friend || saved.couple === 'ppm')) {
    const { orientation: _shape, ...request } = saved
    return { ...request, recorded: true, orientation: orientation ?? savedOrientation }
  }
  const seed = saved?.seed
  const shape = orientation ?? savedOrientation
  if (friend) {
    const prompts = buildDuoPhotoPrompt(
      await withBodySetting(character),
      await withBodySetting(friend),
      tier,
      scene,
      'ppm'
    )
    return {
      recorded: false,
      seed,
      tier,
      orientation: shape,
      couple: 'ppm',
      positive: !rebuild && saved ? saved.positive : prompts.scene,
      negative: !rebuild && saved ? saved.negative : prompts.negative,
      left: prompts.left,
      right: prompts.right
    }
  }
  const lora = characterLoraOf(character)
  return {
    recorded: false,
    seed,
    tier,
    orientation: shape,
    ...buildPhotoPrompt(await withBodySetting(character), tier, scene),
    ...(lora ? { lora } : {})
  }
}

/** Deletes both image formats and the request that belongs to this photo name. */
export async function dropPhoto(
  playthroughId: string,
  charId: string,
  file: string
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafeCharId(charId)
  assertPhotoFile(file)
  // A move running now could copy the old file across after this drop: let it finish first.
  await photoMoveSettled(playthroughId)
  try {
    if ((await photoReferences(playthroughId)).all.has(pngPhotoOf(file))) return
  } catch {
    return
  }
  await removePhotoFiles(playthroughId, charId, file)
  reservedPhotoNames.get(getPhotosPath(playthroughId, charId))?.delete(file)
  redrawTemps.delete(getPhotoPath(playthroughId, charId, file))
}

/** Removes the image formats and sidecar after saved references have been checked. */
async function removePhotoFiles(playthroughId: string, charId: string, file: string): Promise<void> {
  const png = pngPhotoOf(file)
  for (const root of [getPhotosRoot(playthroughId), legacyPhotosRoot(playthroughId)]) {
    for (const name of [png, png.replace(/\.png$/, '.webp'), photoSidecarOf(file)]) {
      await rm(join(root, charId, name), { force: true })
    }
  }
}

const sweeps = new Map<string, Promise<number>>()

/** Removes only files no checkpoint or replay names, after migration has finished. */
export async function sweepPhotos(pid: string): Promise<number> {
  assertSafePlaythroughId(pid)
  const previous = sweeps.get(pid)
  if (previous) return previous
  const running = sweepPhotoFiles(pid)
  sweeps.set(pid, running)
  try { return await running }
  finally { if (sweeps.get(pid) === running) sweeps.delete(pid) }
}

async function sweepPhotoFiles(pid: string): Promise<number> {
  await movePhotoFiles(pid)
  const refs = await photoReferences(pid)
  let removed = 0
  for (const root of [getPhotosRoot(pid), legacyPhotosRoot(pid)]) {
    for (const charId of await photoCharacters(root)) {
      const folder = join(root, charId)
      for (const entry of await readdir(folder, { withFileTypes: true })) {
        const sidecar = entry.name.replace(/^\.redraw-/, '')
        if (entry.isFile() && entry.name.startsWith('.redraw-') && isPhotoSidecar(sidecar)) {
          await recoverPhotoSwap(folder, sidecar.replace(/\.json$/, '.png'))
        }
      }
      for (const file of await photoNames(folder)) {
        const png = pngPhotoOf(file.replace(/\.json$/, '.png'))
        if (refs.all.has(png) || photoFileRendering(pid, charId, file)) continue
        const held = reservedPhotoNames.get(getPhotosPath(pid, charId))
        if (held && [...held].some(name => pngPhotoOf(name) === png)) continue
        try {
          await rm(join(folder, file))
          removed++
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
        }
      }
    }
  }
  console.info(`[photo] orphan sweep ${pid}: removed ${removed} files`)
  return removed
}

let launchSweepStarted = false

/** One background pass per launch, including playthroughs the player never opens. */
export function sweepAllPhotos(): void {
  if (launchSweepStarted) return
  launchSweepStarted = true
  void (async () => {
    const root = dirname(photoPlaythroughPath('1'))
    for (const entry of await readdir(root, { withFileTypes: true })) {
      if (!entry.isDirectory() || !SAFE_NUMERIC_ID.test(entry.name)) continue
      await sweepPhotos(entry.name).catch(error => console.warn('[photo] sweep skipped:', entry.name, error))
    }
  })().catch(error => console.warn('[photo] launch sweep skipped:', error))
}
