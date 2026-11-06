import { constants } from 'fs'
import { copyFile, lstat, mkdir, readdir, readFile, rm, rmdir } from 'fs/promises'
import { basename, dirname, join } from 'path'
import { modDataPath, sniffImageFile, writeAtomicBytes } from '@vx/modkit/main'
import { SAFE_CHAR_ID, assertSafeCharId, assertSafePlaythroughId, appError } from '@vx/modkit/shared'
import { isPhotoFile, isPhotoSidecar, pngPhotoOf } from '../shared/photoFiles'
import { isPhotoTier } from '../shared/photoGate'
import type { PhotoSidecar } from '../shared/photoTypes'
import { PHOTO_FEATURE_ID } from '../shared/photoSwitches'

/** Photo's own files, and the per-character folders older builds left beside native photos. */

/** The playthrough's Photo-owned data root. */
export function getPhotosRoot(pid: string): string {
  return modDataPath(PHOTO_FEATURE_ID, pid)
}

/**
 * The playthrough folder containing checkpoints and replays: two levels above its mod data. When
 * that folder cannot be made, the saves folder is found beside the global mod data instead, so
 * older photos stay readable.
 */
export function photoPlaythroughPath(pid: string): string {
  assertSafePlaythroughId(pid)
  try {
    return join(modDataPath(PHOTO_FEATURE_ID, pid), '..', '..')
  } catch {
    return join(modDataPath(PHOTO_FEATURE_ID), '..', '..', 'saves', pid)
  }
}

/** The legacy parent also contains native camera-roll files, which Photo never enumerates as its own. */
export function legacyPhotosRoot(pid: string): string {
  return join(photoPlaythroughPath(pid), 'photos')
}

/** One character's new photo folder. */
export function getPhotosPath(pid: string, charId: string): string {
  assertSafeCharId(charId)
  return join(getPhotosRoot(pid), charId)
}

/** One image or sidecar in Photo's data. Callers check the filename before writing. */
export function getPhotoPath(pid: string, charId: string, file: string): string {
  return join(getPhotosPath(pid, charId), file)
}

/** Includes physical WebP twins of the oldest, PNG-named photos. */
export function isPhotoImage(file: string): boolean {
  return isPhotoFile(file) || (file.endsWith('.webp') && isPhotoFile(file.replace(/\.webp$/, '.png')))
}

/** Reads only regular files; a link never makes a file outside Photo's folders its own. */
async function regularFile(path: string): Promise<boolean> {
  try { return (await lstat(path)).isFile() }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

/** The real character folders under a root, excluding the native camera roll's files. */
export async function photoCharacters(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && SAFE_CHAR_ID.test(entry.name))
      .map(entry => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** The regular Photo image and sidecar files in a character folder. */
export async function photoNames(folder: string): Promise<string[]> {
  try {
    return (await readdir(folder, { withFileTypes: true }))
      .filter(entry => entry.isFile() && (isPhotoImage(entry.name) || isPhotoSidecar(entry.name)))
      .map(entry => entry.name)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
}

/** Validates the request recorded next to a finished image. */
export async function readPhotoSidecar(path: string): Promise<PhotoSidecar | undefined> {
  try {
    if (!(await regularFile(path)) || (await lstat(path)).size >= 256 * 1024) return undefined
    const info = JSON.parse(await readFile(path, 'utf8'))
    if (!info || info.schemaVersion !== 1 || !Number.isSafeInteger(info.seed) || info.seed < 0 ||
        !isPhotoTier(info.tier) || typeof info.positive !== 'string' ||
        typeof info.negative !== 'string' ||
        (info.left !== undefined && typeof info.left !== 'string') ||
        (info.right !== undefined && typeof info.right !== 'string') ||
        (info.left === undefined) !== (info.right === undefined) ||
        (info.lora !== undefined && (!info.lora || typeof info.lora.name !== 'string' ||
          typeof info.lora.weight !== 'number' || !Number.isFinite(info.lora.weight)))) return undefined
    return info as PhotoSidecar
  } catch { return undefined }
}

/** Each file must keep its bytes and remain a readable image or sidecar after copying. */
export async function validPhotoFile(path: string): Promise<boolean> {
  if (!(await regularFile(path))) return false
  return isPhotoSidecar(path.split(/[\\/]/).at(-1)!)
    ? (await readPhotoSidecar(path)) !== undefined
    : (await sniffImageFile(path)) !== null
}

/** Copies and verifies before a caller may retire its source; conflicting valid copies are kept. */
export async function copyPhotoFile(source: string, dest: string, keepExisting = false): Promise<void> {
  if (!(await validPhotoFile(source))) {
    throw appError('PHOTO_FILE_INVALID', 'The photo file is unreadable.', basename(source))
  }
  await mkdir(dirname(dest), { recursive: true })
  if (await regularFile(dest)) {
    if (keepExisting) return
    if (!(await validPhotoFile(dest))) {
      await writeAtomicBytes(dest, await readFile(source), {
        code: 'PHOTO_COPY_FAILED', message: 'Could not copy the photo.'
      })
    }
  } else {
    // An interrupted copy is repaired on the next attempt after its validation fails.
    await copyFile(source, dest, constants.COPYFILE_EXCL)
  }
  const before = await lstat(source), after = await lstat(dest)
  if (before.size !== after.size || !(await validPhotoFile(dest)) ||
      !(await readFile(source)).equals(await readFile(dest))) {
    throw appError('PHOTO_COPY_FAILED', 'The photo copy could not be verified.')
  }
}

/** Every checkpoint and replay naming an image; an unreadable record refuses retirement. */
export async function photoReferences(pid: string): Promise<{ saved: Set<string>; all: Set<string> }> {
  const root = photoPlaythroughPath(pid)
  const saved = new Set<string>(), all = new Set<string>()
  const collect = (value: unknown, target: Set<string>): void => {
    if (!value || typeof value !== 'object') return
    if ('file' in value && typeof value.file === 'string' && isPhotoFile(value.file)) {
      target.add(pngPhotoOf(value.file))
    }
    for (const child of Object.values(value)) collect(child, target)
  }
  for (const name of await readdir(root)) {
    if (name.endsWith('.json')) collect(JSON.parse(await readFile(join(root, name), 'utf8')), saved)
  }
  for (const name of saved) all.add(name)
  let replays: string[] = []
  try { replays = await readdir(join(root, 'replays')) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  for (const name of replays) {
    if (name.endsWith('.json')) {
      collect(JSON.parse(await readFile(join(root, 'replays', name), 'utf8')), all)
    }
  }
  return { saved, all }
}

const moves = new Map<string, Promise<void>>()
/** Playthroughs whose last pass found nothing it could move: later reads skip the move. */
const idleMoves = new Set<string>()

/** Forgets which playthroughs had nothing to move, after a restore may have brought old folders back. */
export function forgetPhotoMoves(): void {
  idleMoves.clear()
}

/** Resolves once any move running for this playthrough has finished. */
export async function photoMoveSettled(pid: string): Promise<void> {
  await moves.get(legacyPhotosRoot(pid))?.catch(() => {})
}
/** Playthroughs whose move already ran in the caller's current pass; later reads skip it. */
const settledMoves = new Set<string>()

/** Runs `work` after one move, so its many file lookups do not each re-read every save. */
export async function afterOneMove<T>(
  pid: string,
  known: { saved: Set<string>; all: Set<string> },
  work: () => Promise<T>
): Promise<T> {
  await movePhotoFiles(pid, known)
  if (settledMoves.has(pid)) return work()
  settledMoves.add(pid)
  try { return await work() }
  finally { settledMoves.delete(pid) }
}

/** Retries while old character folders exist, retaining every unverified or uncertain original. */
export async function movePhotoFiles(
  pid: string,
  known?: { saved: Set<string>; all: Set<string> }
): Promise<void> {
  assertSafePlaythroughId(pid)
  if (settledMoves.has(pid) || idleMoves.has(pid)) return
  const oldRoot = legacyPhotosRoot(pid)
  const running = moves.get(oldRoot)
  if (running) return running
  const moving = (async () => {
    const who = await photoCharacters(oldRoot)
    const waiting = new Map<string, string[]>()
    for (const charId of who) {
      const names = await photoNames(join(oldRoot, charId))
      if (names.length > 0) waiting.set(charId, names)
    }
    // Nothing of Photo's left to move: no save is read, and later reads skip the move.
    if (waiting.size === 0) {
      idleMoves.add(pid)
      return
    }
    const refs = known ?? await photoReferences(pid).catch(() => null)
    let moved = 0
    for (const [charId, names] of waiting) {
      const folder = join(oldRoot, charId)
      // Referenced images reach the new root first; every source still requires verification.
      names.sort((a, b) => Number(refs?.all.has(pngPhotoOf(b))) - Number(refs?.all.has(pngPhotoOf(a))))
      for (const file of names) {
        try {
          await copyPhotoFile(join(folder, file), getPhotoPath(pid, charId, file))
          if (refs) {
            await rm(join(folder, file))
            moved += 1
          }
        } catch (error) {
          console.warn('[photo] kept an unmoved legacy file:', file, error)
        }
      }
      // rmdir only succeeds when no unknown, invalid or conflicting files remain.
      await rmdir(folder).catch(() => {})
    }
    // A pass that moved nothing would move nothing again: what is left stays for this session.
    if (moved === 0) idleMoves.add(pid)
  })()
  moves.set(oldRoot, moving)
  try { await moving }
  finally { if (moves.get(oldRoot) === moving) moves.delete(oldRoot) }
}

/** Legacy reads remain available when the new per-playthrough directory cannot be created. */
function photoReadRoots(pid: string): string[] {
  const legacy = legacyPhotosRoot(pid)
  try { return [getPhotosRoot(pid), legacy] }
  catch { return [legacy] }
}

/** Finds the new-root image first, then a legacy image, with WebP preferred in each folder. */
export async function findPhotoImage(pid: string, charId: string, file: string): Promise<string | null> {
  assertSafeCharId(charId)
  await movePhotoFiles(pid).catch(error => console.warn('[photo] legacy move will retry:', error))
  for (const root of photoReadRoots(pid)) {
    for (const name of [file.replace(/\.(png|webp)$/, '.webp'), pngPhotoOf(file)]) {
      const path = join(root, charId, name)
      if (await regularFile(path)) return path
    }
  }
  return null
}

/** Retries a read if a concurrent verified move retired the legacy pathname. */
export async function readPhotoImage(pid: string, charId: string, file: string): Promise<Uint8Array> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const path = await findPhotoImage(pid, charId, file)
    if (!path) break
    try { return new Uint8Array(await readFile(path)) }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  throw appError('PHOTO_MISSING', 'That picture is not on disk.', file)
}

/** Reads an optional sidecar from the new folder, falling back to its legacy copy. */
export async function findPhotoSidecar(
  pid: string, charId: string, file: string
): Promise<PhotoSidecar | undefined> {
  await movePhotoFiles(pid).catch(error => console.warn('[photo] legacy move will retry:', error))
  for (const root of photoReadRoots(pid)) {
    const info = await readPhotoSidecar(join(root, charId, file))
    if (info) return info
  }
  return undefined
}

/** Removes the other physical image format after its replacement has been written. */
export async function dropPhotoTwins(path: string): Promise<void> {
  const twin = path.endsWith('.webp') ? path.replace(/\.webp$/, '.png') : path.replace(/\.png$/, '.webp')
  if (twin !== path) await rm(twin, { force: true })
}

const rendering = new Map<string, number>()

/** Marks both image formats and the sidecar as belonging to one unfinished render. */
export function beginPhotoFile(pid: string, charId: string, file: string): () => void {
  const key = `${pid}/${charId}/${pngPhotoOf(file)}`
  rendering.set(key, (rendering.get(key) ?? 0) + 1)
  return () => {
    const count = (rendering.get(key) ?? 1) - 1
    if (count) rendering.set(key, count)
    else rendering.delete(key)
  }
}

/** Whether a backup should leave this image and its sidecar out until rendering settles. */
export function photoFileRendering(pid: string, charId: string, file: string): boolean {
  return rendering.has(`${pid}/${charId}/${pngPhotoOf(file.replace(/\.json$/, '.png'))}`)
}
