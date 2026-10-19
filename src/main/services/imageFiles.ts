import { randomUUID } from 'crypto'
import { access, link, open, readdir, readFile, rm, unlink, writeFile } from 'fs/promises'
import type { FileHandle } from 'fs/promises'
import type { Sharp, WebpOptions } from 'sharp'
import { IMAGE_EXTENSION, STORED_EXTENSION } from '@shared/characterFiles'
import { appError, isAppError, messageOf } from '@shared/errors'
import { imageTypeOf } from '@shared/imageBytes'
import { WEBP_PROFILE } from '@shared/webpProfile'
import { renameWithPatience, writeAtomicBytes } from './jsonFile'

/**
 * Every picture the app keeps, on the disk edge. A path names the PNG; the file is its WebP twin,
 * which every writer makes and every reader tries first, falling back to a PNG not yet
 * converted — the WebP winning wherever both stand.
 */

/** The extensions an image may be under, in the order a reader tries them. */
const IMAGE_EXTENSIONS = [STORED_EXTENSION, IMAGE_EXTENSION] as const

/** How much of a file the sniffer reads: the longest signature plus its RIFF form tag. */
const SNIFF_BYTES = 12

/** How many times a removal is retried while Windows holds a file it just saw change. */
const RM_RETRIES = 5

/** The same path under each extension an image may be under, in read order; itself otherwise. */
function twinsOf(path: string): string[] {
  const dot = path.lastIndexOf('.')
  // A dot in a folder name is not this file's extension.
  if (dot <= Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))) return [path]

  const named = path.slice(dot).toLowerCase()
  if (!(IMAGE_EXTENSIONS as readonly string[]).includes(named)) return [path]
  const stem = path.slice(0, dot)
  return IMAGE_EXTENSIONS.map((extension) => `${stem}${extension}`)
}

/** The file holding the image `path` names, whatever extension it is under, or `null`. */
export async function findImage(path: string): Promise<string | null> {
  for (const candidate of twinsOf(path)) {
    try {
      await access(candidate)
      return candidate
    } catch {
      continue
    }
  }
  return null
}

/** As {@link findImage}, falling back to the path as named so a failed read says that name. */
export async function imagePath(path: string): Promise<string> {
  return (await findImage(path)) ?? path
}

/** Drops the other-extension twins of a file just written, so one stem is one image. */
export async function dropImageTwins(path: string): Promise<void> {
  await removeFiles(twinsOf(path).filter((twin) => !samePath(twin, path)))
}

/** Whether two paths name one file on a disk that does not tell case apart. */
function samePath(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase()
}

/** Removes the image `path` names under every extension it may be under; a missing one is fine. */
export async function removeImage(path: string): Promise<void> {
  await removeFiles(twinsOf(path))
}

/** Removes each of `paths`, waiting out a scanner's hold; one already gone is success. */
async function removeFiles(paths: readonly string[]): Promise<void> {
  for (const path of paths) await rm(path, { force: true, maxRetries: RM_RETRIES })
}

/** The path `path`'s picture is stored under once it is WebP: its last extension swapped. */
function webpPathOf(path: string): string {
  const dot = path.lastIndexOf('.')
  if (dot <= Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'))) return `${path}${STORED_EXTENSION}`
  return `${path.slice(0, dot)}${STORED_EXTENSION}`
}

/** Why a picture was kept as it came, for the log line: the error's message and its detail. */
export function reasonOf(err: unknown): string {
  if (!isAppError(err)) return messageOf(err)
  return err.detail ? `${err.message} (${err.detail})` : err.message
}

/** What a loaded encoder is called with, which is all of sharp this file uses. */
type Encoder = (input: Uint8Array) => Sharp

/** The encoder, loaded once on first use; `null` once it has failed to load. */
let encoderLoad: Promise<Encoder | null> | null = null

/**
 * sharp, loaded on first use rather than with this module: a native library the machine will not
 * load costs the WebP encoding, said once, and never the app's start.
 */
function loadEncoder(): Promise<Encoder | null> {
  encoderLoad ??= import('sharp').then(
    (module) => {
      const sharp = module.default
      // Every picture is encoded once; libvips' operation cache would only hold them in memory.
      sharp.cache(false)
      return (input: Uint8Array) => sharp(input)
    },
    (err: unknown) => {
      console.warn('[images] no WebP encoder; pictures are kept as they come:', messageOf(err))
      return null
    }
  )
  return encoderLoad
}

/** Whether pictures can be encoded as WebP on this machine. */
export async function canEncodeWebp(): Promise<boolean> {
  return (await loadEncoder()) !== null
}

/**
 * One picture opened for reading its pixels or writing it out in another format — a crop, a
 * staged PNG, a JPEG reference. Throws `IMAGE_UNREADABLE` where there is no encoder; a picture
 * that will not decode throws when its pipeline runs.
 */
export async function openImage(bytes: Uint8Array): Promise<Sharp> {
  const encode = await loadEncoder()
  if (!encode) throw appError('IMAGE_UNREADABLE', 'That picture could not be read.', 'no image decoder')
  return encode(bytes)
}

/** The options a picture is encoded under: the shared profile, or exact lossless for the editor's. */
function webpOptions(lossless: boolean): WebpOptions {
  return lossless
    ? { lossless: true, exact: true, effort: WEBP_PROFILE.effort }
    : { quality: WEBP_PROFILE.quality, alphaQuality: WEBP_PROFILE.alphaQuality, effort: WEBP_PROFILE.effort }
}

/**
 * `bytes` as the WebP they are kept as: a WebP as it came, never decoded; a PNG or a JPEG — the
 * JPEG turned upright first — encoded under {@link webpOptions}. Throws for bytes that are not a
 * readable picture, and where there is no encoder.
 */
export async function encodeStored(bytes: Uint8Array, lossless: boolean): Promise<Uint8Array> {
  const type = imageTypeOf(bytes)
  if (type === 'image/webp') return bytes
  if (type === null) {
    throw appError('IMAGE_UNREADABLE', 'That picture could not be read.', 'not a PNG, JPEG or WebP')
  }

  const encode = await loadEncoder()
  if (!encode) throw appError('IMAGE_UNREADABLE', 'That picture could not be read.', 'no WebP encoder')
  const image = encode(bytes)
  const upright = type === 'image/jpeg' ? image.autoOrient() : image
  return new Uint8Array(await upright.webp(webpOptions(lossless)).toBuffer())
}

/** Where one picture is about to be written, what is written there, and the twin it retires. */
export interface StoredImage {
  path: string
  bytes: Uint8Array
  retired: string[]
}

/**
 * Decides how the picture `path` names is kept: as WebP under its `.webp` twin, or — where the
 * bytes will not encode — as they came under the PNG name, warned about, for the boot's pass to
 * try again. Either way the other twin is retired, so the picture written is the one read.
 */
export async function storedImage(
  path: string,
  bytes: Uint8Array,
  lossless: boolean
): Promise<StoredImage> {
  const twins = twinsOf(path)
  try {
    const encoded = await encodeStored(bytes, lossless)
    const target = webpPathOf(path)
    return { path: target, bytes: encoded, retired: twins.filter((twin) => !samePath(twin, target)) }
  } catch (err) {
    console.warn(`[images] kept ${path} as it came: ${reasonOf(err)}`)
    const target = twins[twins.length - 1]
    return { path: target, bytes, retired: twins.filter((twin) => !samePath(twin, target)) }
  }
}

/** Retires the twins a written picture replaced. */
export async function retireTwins(stored: StoredImage): Promise<void> {
  await removeFiles(stored.retired)
}

/**
 * Writes one picture atomically as {@link storedImage} decides, raising `error` where the disk
 * refuses it, and answers with the file written. Never makes a folder: each caller keeps its own
 * rule about which folders may be made.
 */
export async function writeImageFile(
  path: string,
  bytes: Uint8Array,
  opts: { lossless?: boolean; error: { code: string; message: string } }
): Promise<string> {
  const stored = await storedImage(path, bytes, opts.lossless === true)
  await writeAtomicBytes(stored.path, stored.bytes, opts.error)
  await retireTwins(stored)
  return stored.path
}

/** What converting one file did, and the bytes it moved. */
export interface ImageConversion {
  outcome: 'converted' | 'dropped' | 'left'
  before: number
  after: number
}

/**
 * Converts one picture still kept under a PNG or a JPEG name into its WebP twin, then removes
 * the old file. A WebP already standing there — written since, or by another instance of the
 * app — is never overwritten: the old file is the stale one and is only removed. A picture that
 * will not encode is left as it is, warned about.
 */
export async function convertImageFile(path: string, lossless: boolean): Promise<ImageConversion> {
  // Already the WebP, in whatever case: there is nothing older beside it to convert.
  if (path.toLowerCase().endsWith(STORED_EXTENSION)) return { outcome: 'left', before: 0, after: 0 }
  const target = webpPathOf(path)
  const bytes = await readFile(path)

  if (await exists(target)) {
    await removeFiles([path])
    return { outcome: 'dropped', before: bytes.length, after: 0 }
  }

  let encoded: Uint8Array
  try {
    encoded = await encodeStored(bytes, lossless)
  } catch (err) {
    console.warn(`[images] left ${path} as it is: ${reasonOf(err)}`)
    return { outcome: 'left', before: 0, after: 0 }
  }

  const placed = await placeIfAbsent(target, encoded)
  await removeFiles([path])
  return placed
    ? { outcome: 'converted', before: bytes.length, after: encoded.length }
    : { outcome: 'dropped', before: bytes.length, after: 0 }
}

/**
 * Puts `bytes` at `target` only if nothing is there, and says whether it did: a hard link from a
 * temp file, which the filesystem refuses over an existing file, or — on a volume without hard
 * links — an existence check before the rename.
 */
async function placeIfAbsent(target: string, bytes: Uint8Array): Promise<boolean> {
  const temp = `${target}.${process.pid}.${randomUUID().slice(0, 8)}.tmp`
  await writeFile(temp, bytes)
  try {
    await link(temp, target)
    return true
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EEXIST') return false
    if (await exists(target)) return false
    await renameWithPatience(temp, target)
    return true
  } finally {
    await unlink(temp).catch(() => {})
  }
}

/** Whether anything is at `path`. */
async function exists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/** What an image file's first bytes say it is, or `null` for one that cannot be read. */
export async function sniffImageFile(path: string): Promise<ReturnType<typeof imageTypeOf>> {
  let handle: FileHandle
  try {
    handle = await open(path, 'r')
  } catch {
    return null
  }

  try {
    const head = Buffer.alloc(SNIFF_BYTES)
    const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0)
    return imageTypeOf(head.subarray(0, bytesRead))
  } catch {
    return null
  } finally {
    await handle.close().catch(() => {})
  }
}

/** True for a name this vocabulary would read as an image. */
function isImageName(name: string): boolean {
  return IMAGE_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))
}

/** The stem of an image file name, whichever extension it carries. */
function imageStemOf(name: string): string {
  return name.slice(0, name.lastIndexOf('.'))
}

/** The stems of the images in `dir`, or none where it does not exist. */
export async function imageStemsIn(dir: string): Promise<Set<string>> {
  return new Set((await imageNamesIn(dir)).map(imageStemOf))
}

/** The image file names in `dir`, or none where it does not exist. */
export async function imageNamesIn(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(isImageName)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw err
  }
}
