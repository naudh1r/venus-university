import { watch, type FSWatcher } from 'fs'
import { mkdir, readFile, rm } from 'fs/promises'
import { join } from 'path'
import {
  characterLoraOf,
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
  isPhotoKind,
  isWebpPhoto,
  nextPhotoIndex,
  photoFileName,
  photoSlug,
  pngPhotoOf,
  type PhotoKind
} from '../../shared/photoFiles'
import {
  PHOTO_PROMPT_LIMIT,
  type PhotoInfo,
  type PhotoRenderOptions,
  type PhotoSidecar
} from '../../shared/photoTypes'
import { photoSwitches, PHOTO_FEATURE_ID } from '../../shared/photoSwitches'
import { isPhotoTier, type PhotoTier } from '../../shared/photoGate'
import { buildDuoPhotoPrompt, buildPhotoPrompt } from '../../shared/photoPrompt'
import { unreadPhotoParts } from '../../shared/photoPose'
import {
  beginPhotoFile, copyPhotoFile, dropPhotoTwins, findPhotoImage, findPhotoSidecar,
  getPhotoPath, getPhotosPath, getPhotosRoot, legacyPhotosRoot, movePhotoFiles,
  afterOneMove, photoCharacters, photoMoveSettled, photoNames, photoPlaythroughPath, photoReferences, readPhotoImage, readPhotoSidecar
} from '../photoFiles'
import { withBodySetting } from '../bodySetting'
import { renderComfyImage, writeAtomicBytes, type ComfyRenderRequest } from '@vx/modkit/main'
import soloWorkflow from '../../../assets/workflows/characterPhoto.json'
import duoWorkflow from '../../../assets/workflows/characterPhotoDuo.json'

/**
 * Photo owns its graphs, prompts and playthrough destinations. The kit queues each graph,
 * starts ComfyUI and returns checked image bytes; Photo keeps them atomically. A duo supplies
 * each girl's prompt through extra text nodes, and the renderer handles WebP encoding.
 */

/** Node ids overwritten in `assets/workflows/characterPhotoDuo.json`. */
const DUO_PHOTO_NODE = {
  seed: '14',
  positivePrompt: '4',
  negativePrompt: '5',
  saveImage: '41'
} as const

/** Node ids overwritten in `assets/workflows/characterPhoto.json`. */
const PHOTO_NODE = { ...DUO_PHOTO_NODE, characterLora: '100' } as const

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
    throw appError('PHOTO_OVERRIDE_INVALID', 'The photo seed or prompts are invalid.')
  }
  if (!isOverrideRecord(value)) invalid()
  const overrides = value as Record<string, unknown>
  if (Object.keys(overrides).some((key) => key !== 'seed' && key !== 'prompts')) invalid()
  if (
    overrides.seed !== undefined &&
    (!Number.isSafeInteger(overrides.seed) || (overrides.seed as number) < 0)
  ) {
    invalid()
  }
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

  await renderPhotoImage(playthroughId, character.charId, file, {
    workflow: soloWorkflow,
    nodes: PHOTO_NODE,
    prompts,
    seed,
    lora
  }, { schemaVersion: 1, seed, tier, ...prompts, ...(lora ? { lora } : {}) }, options)

  // On disk now, so the folder itself says the name is taken.
  reservedPhotoNames.get(getPhotosPath(playthroughId, character.charId))?.delete(file)

  // The name, not the path: the message carries it and the mod's protocol resolves it.
  return file
}

/** The two girls' own prompt nodes in `assets/workflows/characterPhotoDuo.json`. */
const DUO_GIRL_NODE = { left: '50', right: '51' } as const

/**
 * Renders one picture of her and a friend side by side, into her own photo folder: the picture is
 * hers, sent by her, and the friend is only in it. `friend` has already been settled against the
 * save; nothing here re-opens whether she may be in it.
 */
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
  const built = overrides.prompts
    ? {
        scene: overrides.prompts.positive,
        negative: overrides.prompts.negative,
        left: overrides.prompts.left ?? '',
        right: overrides.prompts.right ?? ''
      }
    : buildDuoPhotoPrompt(
        await withBodySetting(character),
        await withBodySetting(friend),
        tier as PhotoTier,
        photoPrompt
      )
  const prompts = {
    positive: built.scene,
    negative: built.negative,
    left: built.left,
    right: built.right
  }

  await renderPhotoImage(playthroughId, character.charId, file, {
    workflow: duoWorkflow,
    nodes: DUO_PHOTO_NODE,
    prompts: { positive: prompts.positive, negative: prompts.negative },
    texts: { [DUO_GIRL_NODE.left]: prompts.left, [DUO_GIRL_NODE.right]: prompts.right },
    seed
  }, { schemaVersion: 1, seed, tier, ...prompts }, options)

  reservedPhotoNames.get(getPhotosPath(playthroughId, character.charId))?.delete(file)
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
  rebuild = false
): Promise<PhotoInfo> {
  assertSafePlaythroughId(playthroughId)
  assertSafeCharId(character.charId)
  if (friend) assertSafeCharId(friend.charId)
  assertPhotoFile(file)
  if (!isPhotoTier(tier))
    throw appError('PHOTO_TIER_UNKNOWN', `"${String(tier)}" is not a photo tier.`, tier)
  const saved = await recordedPhotoInfo(playthroughId, character.charId, file)
  if (saved && !rebuild) return { ...saved, recorded: true }
  const seed = saved?.seed
  if (friend) {
    const prompts = buildDuoPhotoPrompt(
      await withBodySetting(character),
      await withBodySetting(friend),
      tier,
      scene
    )
    return {
      recorded: false,
      seed,
      tier,
      positive: prompts.scene,
      negative: prompts.negative,
      left: prompts.left,
      right: prompts.right
    }
  }
  const lora = characterLoraOf(character)
  return {
    recorded: false,
    seed,
    tier,
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

interface RetiredPhoto {
  charId: string
  oldFile: string
  newFile: string
}
interface PhotoCleanup {
  pending: Map<string, RetiredPhoto>
  watcher: FSWatcher
  revision: number
  running?: Promise<void>
  timer?: ReturnType<typeof setTimeout>
}
const photoCleanups = new Map<string, PhotoCleanup>()

/** Retries after a completed save write; uncertainty always leaves both pictures on disk. */
export async function flushRetiredPhotos(playthroughId: string): Promise<void> {
  const cleanup = photoCleanups.get(playthroughId)
  if (!cleanup) return
  if (cleanup.running) return cleanup.running
  const revision = cleanup.revision
  cleanup.running = (async () => {
    try {
      const refs = await photoReferences(playthroughId)
      // One move with the references just read; the landing checks below read no saves again.
      await afterOneMove(playthroughId, refs, async () => {
        for (const [key, photo] of cleanup.pending) {
          if (cleanup.revision !== revision) break
          if (
            !refs.saved.has(pngPhotoOf(photo.newFile)) ||
            refs.all.has(pngPhotoOf(photo.oldFile))
          ) continue
          if (!(await photoLanded(playthroughId, photo.charId, photo.newFile))) continue
          if (cleanup.revision !== revision) break
          await removePhotoFiles(playthroughId, photo.charId, photo.oldFile)
          cleanup.pending.delete(key)
        }
      })
    } catch {
      // A missing, changing or unreadable checkpoint cannot prove a file is unreferenced.
    }
    if (cleanup.pending.size === 0) {
      cleanup.watcher.close()
      clearTimeout(cleanup.timer)
      photoCleanups.delete(playthroughId)
    }
  })()
  try {
    await cleanup.running
  } finally {
    cleanup.running = undefined
    if (cleanup.pending.size > 0 && cleanup.revision !== revision) schedulePhotoCleanup(playthroughId)
  }
}

/** Debounces checkpoint changes, including those that overtake a running reference scan. */
function schedulePhotoCleanup(playthroughId: string): void {
  const cleanup = photoCleanups.get(playthroughId)
  if (!cleanup) return
  clearTimeout(cleanup.timer)
  cleanup.timer = setTimeout(() => void flushRetiredPhotos(playthroughId), 100)
  cleanup.timer.unref()
}

/** Save files, replay files and replay-folder changes can change a picture's saved references. */
function photoCheckpointChanged(file: string | null): boolean {
  if (file === null) return true
  const parts = file.replaceAll('\\', '/').split('/')
  if (parts.length === 1) return parts[0] === 'replays' || parts[0].endsWith('.json')
  return parts.length === 2 && parts[0] === 'replays' && parts[1].endsWith('.json')
}

/** Watches this playthrough's atomic save writes, retaining originals across skipped saves. */
export async function retirePhoto(
  playthroughId: string,
  charId: string,
  oldFile: string,
  newFile: string
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafeCharId(charId)
  assertPhotoFile(oldFile)
  assertPhotoFile(newFile)
  if (pngPhotoOf(oldFile) === pngPhotoOf(newFile)) return
  let cleanup = photoCleanups.get(playthroughId)
  if (!cleanup) {
    try {
      const watcher = watch(
        photoPlaythroughPath(playthroughId),
        { recursive: true, persistent: false },
        (_event, file) => {
          if (!photoCheckpointChanged(file)) return
          const current = photoCleanups.get(playthroughId)
          if (!current) return
          current.revision += 1
          schedulePhotoCleanup(playthroughId)
        }
      )
      watcher.on('error', () => {
        watcher.close()
        photoCleanups.delete(playthroughId)
      })
      cleanup = { watcher, pending: new Map(), revision: 0 }
      photoCleanups.set(playthroughId, cleanup)
    } catch {
      // Without a reliable save notification, retaining the original costs only disk space.
      return
    }
  }
  cleanup.pending.set(`${charId}/${oldFile}`, { charId, oldFile, newFile })
  await flushRetiredPhotos(playthroughId)
}
