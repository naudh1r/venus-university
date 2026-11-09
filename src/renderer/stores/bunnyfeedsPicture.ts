import { character, modIsOn } from '@vx/modkit/renderer'

/** The mod that puts pictures on posts, read only as plain data so Bunnyfeeds never imports it. */
const PHOTO_FEATURE = 'photo-feature'

/**
 * What the picture on a post shows, where another mod put one there and described it: read off
 * the post as plain data, so the feed can speak of the picture without that mod being installed.
 * Only a picture the feed is showing counts: none while that mod is off, still drawing, failed
 * or held back.
 */
export function pictureOf(post: object): { picture?: string; pictureWith?: string } {
  if (!modIsOn(PHOTO_FEATURE)) return {}
  const record = post as {
    ex?: Record<string, { v?: unknown; data?: unknown }>
    photo?: unknown
  }
  const slice = record.ex?.[PHOTO_FEATURE]
  // Photo keeps its picture (or an explicitly cleared null) as its slice's data.
  const photo = (slice && slice.data !== undefined ? slice.data : record.photo) as {
    scene?: unknown; with?: unknown; file?: unknown; pending?: unknown; failed?: unknown; held?: unknown
  } | null | undefined
  if (!photo || typeof photo.file !== 'string' || !photo.file) return {}
  if (photo.pending || photo.failed || photo.held) return {}
  if (typeof photo.scene !== 'string' || !photo.scene.trim()) return {}
  const other = typeof photo.with === 'string' ? character(photo.with) : undefined
  return {
    picture: photo.scene.replace(/\s+/g, ' ').trim(),
    ...(other ? { pictureWith: other.firstName } : {})
  }
}
