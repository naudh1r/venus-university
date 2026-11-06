import { photoInvoke } from './photoInvoke'
import { useSyncExternalStore } from 'react'
import type { Character } from '@vx/modkit/shared'
import type { PhotoKind } from '../../shared/photoFiles'
import { photoGenerationOn } from '../../shared/photoSwitches'
import type { ChatPhoto, PhotoRenderOptions } from '../../shared/photoTypes'
import { renderPhoto } from './photoWebp'

/**
 * How long a render may go unanswered before its post comes out without it. A picture takes
 * about half a minute; the first after ComfyUI starts, or after the checkpoint changes, loads the
 * model first, and any of them can wait behind a sprite. Three minutes is past all of that, so
 * what this catches is a render that has stopped answering rather than a slow one — and a
 * picture that lands after it still fills the frame in.
 */
export const RENDER_PATIENCE_MS = 3 * 60 * 1000

type RedrawState = 'idle' | 'drawing' | 'failed'
interface RedrawEntry {
  token: object
  state: Exclude<RedrawState, 'idle'>
  timer?: ReturnType<typeof setTimeout>
}
const redraws = new Map<string, RedrawEntry>()
const listeners = new Set<() => void>()

/** The same photo has one redraw state wherever it is shown. */
export function photoRedrawKey(
  playthroughId: string | null,
  charId: string,
  file?: string
): string {
  return `${playthroughId}:${charId}:${file}`
}

/** Tells every view that a photo's temporary state changed. */
function changed(): void {
  for (const listener of listeners) listener()
}

/** Reserves the redraw synchronously, including while its new file name is being reserved. */
export function beginPhotoRedraw(key: string): object | undefined {
  const previous = redraws.get(key)
  if (previous?.state === 'drawing') return undefined
  clearTimeout(previous?.timer)
  const token = {}
  redraws.set(key, { token, state: 'drawing' })
  changed()
  return token
}

/** Clears this attempt alone, or shows its failure for four seconds over the old photo. */
export function endPhotoRedraw(key: string, token: object, failed = false): void {
  const entry = redraws.get(key)
  if (entry?.token !== token) return
  if (failed && entry.state === 'failed') return
  clearTimeout(entry.timer)
  if (failed) {
    entry.state = 'failed'
    entry.timer = setTimeout(() => endPhotoRedraw(key, token), 4000)
  } else {
    redraws.delete(key)
  }
  changed()
}

/** Subscribes a photo's view to its redraw and short-lived failure line. */
export function usePhotoRedraw(key: string): RedrawState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    () => redraws.get(key)?.state ?? 'idle',
    () => 'idle'
  )
}

/** The store-free access a thread or feed wrapper gives one photo's redraw. */
interface RedrawTarget {
  playthroughId: string
  character: Character
  friend?: Character
  kind: PhotoKind
  read: () => ChatPhoto | null
  write: (photo: ChatPhoto) => Promise<void>
  live: () => boolean
  inSave: () => readonly string[]
}

/** Replaces a landed photo only after its new render arrives, keeping failures transient. */
export async function redrawPhoto(
  { playthroughId, character, friend, kind, read, write, live, inSave }: RedrawTarget,
  options: PhotoRenderOptions
): Promise<void> {
  const photo = read()
  if (
    !live() ||
    !photoGenerationOn() ||
    !photo?.file ||
    !photo.scene ||
    photo.pending ||
    photo.failed ||
    photo.held ||
    (photo.with && !friend)
  ) {
    return
  }
  const charId = character.charId
  const oldFile = photo.file
  const key = photoRedrawKey(playthroughId, charId, oldFile)
  const token = beginPhotoRedraw(key)
  if (!token) return
  let settled = false
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const named = await photoInvoke('reserveName', [playthroughId, character, kind, inSave()])
    if (!named.ok) throw new Error(`${named.error.code}: ${named.error.message}`)
    if (!live() || read()?.file !== oldFile || !photoGenerationOn()) return
    const newFile = named.data
    timer = setTimeout(() => {
      console.warn(`[photo] redraw of ${oldFile} has not answered in time`)
      settled = true
      endPhotoRedraw(key, token, live() && read()?.file === oldFile)
    }, RENDER_PATIENCE_MS)
    const result = await renderPhoto(
      playthroughId,
      character,
      photo.tier,
      photo.scene,
      newFile,
      friend,
      options
    )
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    const now = read()
    const replace = live() && now?.file === oldFile
    if (replace) await write({ ...now, file: newFile })
    // A render overtaken by a load, replacement or deleted photo belongs to nothing.
    const dropped = replace
      ? await photoInvoke('drop', [playthroughId, charId, oldFile, { replacement: newFile }])
      : await photoInvoke('drop', [playthroughId, charId, newFile])
    if (!dropped.ok) {
      console.warn(`[photo] could not drop ${replace ? oldFile : newFile}:`, dropped.error.message)
    }
    settled = true
    endPhotoRedraw(key, token)
  } catch (error) {
    console.warn(`[photo] redraw of ${oldFile} failed:`, error)
    settled = true
    endPhotoRedraw(key, token, live() && read()?.file === oldFile)
  } finally {
    clearTimeout(timer)
    if (!settled) endPhotoRedraw(key, token)
  }
}
