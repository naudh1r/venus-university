import { useSyncExternalStore } from 'react'

const revisions = new Map<string, number>()
const listeners = new Set<() => void>()
export const photoIdentityUrl = (src: string): string => src.split('?')[0]

/** Every surface keeps the stored identity but reloads a landed replacement. */
export function revisePhoto(src: string): void {
  const key = photoIdentityUrl(src)
  revisions.set(key, (revisions.get(key) ?? 0) + 1)
  for (const listener of listeners) listener()
}

export function revisedPhotoUrl(src: string): string {
  const key = photoIdentityUrl(src)
  const revision = revisions.get(key)
  return revision ? `${key}?v=${revision}` : key
}

export function useRevisedPhotoUrl(src: string | null): string | null {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => src ? revisedPhotoUrl(src) : null,
    () => src
  )
}
