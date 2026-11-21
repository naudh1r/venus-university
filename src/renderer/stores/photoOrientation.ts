import { useEffect, useState, useSyncExternalStore } from 'react'
import type { ChatPhoto, PhotoOrientation } from '../../shared/photoTypes'
import { photoInvoke } from './photoInvoke'
import { usePhotoSwitches } from './photoSwitchHooks'

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

/** Only an installed pack promises a wide first duo; an unmanaged server may fall back. */
export function useExpectedPhotoOrientation(photo: ChatPhoto, src: string | null): PhotoOrientation {
  const duo = Boolean(photo.with && (photo.pending || photo.held || photo.failed))
  const ppm = usePhotoSwitches().ppm
  const [expected, setExpected] = useState<{ src: string | null; ppm: boolean; orientation: PhotoOrientation }>()
  useEffect(() => {
    if (!duo) return
    let live = true
    void photoInvoke('ppmState', []).then((result) => {
      if (!live) return
      const wide = result.ok && result.data === 'installed'
      setExpected({ src, ppm, orientation: wide ? 'wide' : 'portrait' })
    }).catch(() => { if (live) setExpected({ src, ppm, orientation: 'portrait' }) })
    return () => { live = false }
  }, [duo, src, ppm])
  return expected?.src === src && expected.ppm === ppm ? expected.orientation : 'portrait'
}
