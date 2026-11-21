import { useSyncExternalStore } from 'react'
import type { ChatPhoto, PhotoOrientation } from '../../shared/photoTypes'
import { usePhotoPpmState } from './photoPpm'

// Shared by the feed, gallery and full view, so opening a loaded picture knows its shape.
const orientations = new Map<string, PhotoOrientation>()
const listeners = new Set<() => void>()

export function rememberPhotoOrientation(src: string, orientation: PhotoOrientation): void {
  if (orientations.get(src) === orientation) return
  orientations.set(src, orientation)
  for (const listener of listeners) listener()
}

export function usePhotoOrientation(src: string | null): PhotoOrientation | undefined {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    () => src ? orientations.get(src) : undefined,
    () => undefined
  )
}

export function loadedPhotoOrientation(image: HTMLImageElement): void {
  rememberPhotoOrientation(image.src, image.naturalWidth > image.naturalHeight ? 'wide' : 'portrait')
}

/** First photos of two use the wide ppm graph. Recorded images still use their own dimensions. */
export function useExpectedPhotoOrientation(photo: ChatPhoto, _src: string | null): PhotoOrientation {
  const state = usePhotoPpmState()
  return photo.with && (photo.pending || photo.held || photo.failed) && state === 'installed' ? 'wide' : 'portrait'
}
