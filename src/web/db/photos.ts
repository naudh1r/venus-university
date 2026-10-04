import { appError } from '@shared/errors'
import { assertSafePhotoId, type PhotoEntry, type PhotoMeta } from '@shared/photos'
import { assertSafePlaythroughId } from '@shared/saveRules'
import { database, partRange, storage } from './open'

/**
 * The Bunnyboard's photos in the browser's storage: one row per photo under a
 * `[playthroughId, photoId]` key, never written where the playthrough's own row is gone.
 */

/** Every photo kept for one playthrough, newest first. */
export async function listPhotos(playthroughId: string): Promise<PhotoEntry[]> {
  assertSafePlaythroughId(playthroughId)

  const entries = await storage('read the photos', async () => {
    const db = await database()
    const keys = await db.getAllKeys('photos', partRange(playthroughId))
    const out: PhotoEntry[] = []
    for (const key of keys) {
      const row = await db.get('photos', key)
      if (!row) continue
      const entry: PhotoEntry = { photoId: key[1] }
      if (row.meta) entry.meta = row.meta
      if (row.thumb) entry.thumb = new Uint8Array(await row.thumb.arrayBuffer())
      out.push(entry)
    }
    return out
  })

  // Ids are mint timestamps, so numeric order is capture order.
  return entries.sort((a, b) => Number(b.photoId) - Number(a.photoId))
}

/** One photo's picture already stored, or `null` where it is gone. */
export async function readPhoto(playthroughId: string, photoId: string): Promise<Uint8Array | null> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)
  const row = await storage('read the photo', async () =>
    (await database()).get('photos', [playthroughId, photoId])
  )
  return row ? new Uint8Array(await row.image.arrayBuffer()) : null
}

/**
 * Keeps one photo beside a playthrough that still exists, in one transaction over both stores;
 * a playthrough already gone leaves nothing written.
 */
export async function writePhoto(
  playthroughId: string,
  photoId: string,
  image: Blob,
  thumb: Blob,
  meta: PhotoMeta
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)

  const wrote = await storage('save the photo', async () => {
    const db = await database()
    const tx = db.transaction(['playthroughs', 'photos'], 'readwrite')
    // Both are database requests, so the transaction is still open for the second.
    const exists = await tx.objectStore('playthroughs').get(playthroughId)
    if (exists) void tx.objectStore('photos').put({ image, thumb, meta }, [playthroughId, photoId])
    await tx.done
    return Boolean(exists)
  })

  if (!wrote) throw appError('PHOTO_PLAYTHROUGH_GONE', 'That playthrough no longer exists.')
}

/** Replaces one photo's thumbnail; a no-op where the photo itself is not there. */
export async function writePhotoThumb(
  playthroughId: string,
  photoId: string,
  thumb: Blob
): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)

  await storage('save the photo', async () => {
    const db = await database()
    const key: [string, string] = [playthroughId, photoId]
    const row = await db.get('photos', key)
    if (!row) return
    await db.put('photos', { ...row, thumb }, key)
  })
}

/** Removes one photo; one already gone is success. */
export async function deletePhoto(playthroughId: string, photoId: string): Promise<void> {
  assertSafePlaythroughId(playthroughId)
  assertSafePhotoId(photoId)
  await storage('delete the photo', async () =>
    (await database()).delete('photos', [playthroughId, photoId])
  )
}
