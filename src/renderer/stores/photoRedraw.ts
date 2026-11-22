import { photoInvoke } from './photoInvoke'
import { useSyncExternalStore } from 'react'
import type { Character } from '@vx/modkit/shared'
import { photoGenerationOn } from '../../shared/photoSwitches'
import type { ChatPhoto, PhotoOrientation, PhotoRenderOptions } from '../../shared/photoTypes'
import { renderPhoto } from './photoWebp'
import { photoUrl } from '../../shared/photoFiles'
import { revisePhoto } from './photoRevision'
import { rememberPhotoOrientation } from './photoOrientation'

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
  orientation?: PhotoOrientation
  state: Exclude<RedrawState, 'idle'>
  /** Why the redraw was refused, where the player can act on it. */
  reason?: string
  cancel?: () => void
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
export function beginPhotoRedraw(key: string, orientation?: PhotoOrientation): object | undefined {
  const previous = redraws.get(key)
  if (previous?.state === 'drawing') return undefined
  clearTimeout(previous?.timer)
  const token = {}
  redraws.set(key, { token, state: 'drawing', orientation })
  changed()
  return token
}

/** A loaded game supersedes unfinished redraws, including a swap still in main. */
export function cancelPhotoRedraws(): void {
  for (const entry of redraws.values()) entry.cancel?.()
}

/** Clears this attempt alone, or shows its failure for four seconds over the old photo. */
export function endPhotoRedraw(key: string, token: object, failed = false, reason?: string): void {
  const entry = redraws.get(key)
  if (entry?.token !== token) return
  if (failed && entry.state === 'failed') return
  clearTimeout(entry.timer)
  if (failed) {
    entry.state = 'failed'
    entry.reason = reason
    entry.timer = setTimeout(() => endPhotoRedraw(key, token), reason ? 8000 : 4000)
  } else {
    redraws.delete(key)
  }
  changed()
}

/** The player-facing reason for a refusal they can fix, such as ComfyUI-ppm missing. */
function refusalOf(error: unknown): string | undefined {
  const message = error instanceof Error ? error.message : String(error)
  return /^PHOTO_WIDE_NEEDS_PPM: (.+)$/s.exec(message)?.[1]
}

/** The reason a redraw was refused, while its failure line shows. */
export function usePhotoRedrawReason(key: string): string | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => redraws.get(key)?.reason,
    () => undefined
  )
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

/** The requested shape lives only for this attempt; a failure keeps the old photo's shape. */
export function usePhotoRedrawOrientation(key: string): PhotoOrientation | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => {
      const entry = redraws.get(key)
      return entry?.state === 'drawing' ? entry.orientation : undefined
    },
    () => undefined
  )
}

/** The store-free access a thread or feed wrapper gives one photo's redraw. */
interface RedrawTarget {
  playthroughId: string
  character: Character
  friend?: Character
  read: () => ChatPhoto | null
  live: () => boolean
  inSave: () => readonly string[]
}

/** Replaces a landed photo only after its new render arrives, keeping failures transient. */
export async function redrawPhoto(
  { playthroughId, character, friend, read, live, inSave }: RedrawTarget,
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
  const token = beginPhotoRedraw(key, options.orientation)
  if (!token) return
  let finished = false
  let expired = false
  let temporary: string | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  const wanted = (): boolean => !expired && redraws.get(key)?.token === token && redraws.get(key)?.state === 'drawing' && live() && read()?.file === oldFile && photoGenerationOn()
  try {
    const named = await photoInvoke('reserveRedraw', [playthroughId, character, inSave()])
    if (!named.ok) throw new Error(`${named.error.code}: ${named.error.message}`)
    temporary = named.data
    if (!wanted()) return
    const entry = redraws.get(key)!
    entry.cancel = () => {
      expired = true
      endPhotoRedraw(key, token)
      void photoInvoke('drop', [playthroughId, charId, temporary!])
    }
    timer = setTimeout(() => {
      expired = true
      endPhotoRedraw(key, token, live() && read()?.file === oldFile)
      void photoInvoke('drop', [playthroughId, charId, temporary!])
    }, RENDER_PATIENCE_MS)
    const result = await renderPhoto(
      playthroughId, character, photo.tier, photo.scene, temporary, friend, options
    )
    if (!result.ok) throw new Error(`${result.error.code}: ${result.error.message}`)
    if (!wanted()) return
    clearTimeout(timer)
    // The complete temporary render is checked in main before the original name is touched.
    const replaced = await photoInvoke('replace', [playthroughId, charId, oldFile, temporary])
    if (!replaced.ok) throw new Error(`${replaced.error.code}: ${replaced.error.message}`)
    if (options.orientation) {
      rememberPhotoOrientation(photoUrl(playthroughId, charId, oldFile), options.orientation)
    }
    revisePhoto(photoUrl(playthroughId, charId, oldFile))
    finished = true
    endPhotoRedraw(key, token)
  } catch (error) {
    finished = true
    console.warn(`[photo] redraw of ${oldFile} failed:`, error)
    endPhotoRedraw(key, token, live() && read()?.file === oldFile, refusalOf(error))
  } finally {
    clearTimeout(timer)
    if (temporary) {
      const dropped = await photoInvoke('drop', [playthroughId, charId, temporary])
      if (!dropped.ok) console.warn(`[photo] could not drop ${temporary}:`, dropped.error.message)
    }
    if (!expired && !finished) endPhotoRedraw(key, token)
  }
}
