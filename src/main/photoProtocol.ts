import { net, protocol } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { SAFE_CHAR_ID } from '@shared/characterRules'
import { isPhotoFile } from '@shared/photoFiles'
import { SAFE_NUMERIC_ID } from '@shared/saveRules'
import { getPlaythroughPath } from './paths'
import { imagePath } from './services/imageFiles'

/**
 * Disk-backed URLs for the pictures a character has texted the reader: the host is a constant
 * and the path is `{playthroughId}/{charId}/{file}`. The sibling of `charimg://`, kept apart
 * because these belong to one save rather than to the character — leave the playthrough and
 * they are gone with it.
 *
 * The two path helpers below would sit more naturally in `paths.ts` beside the rest of the
 * save's folders, and in the build this was ported from they did. They live here so that
 * `paths.ts` needs no edit: a feature that can be dropped in whole files is a feature whose
 * folders are its own business.
 */
const SCHEME = 'playimg'

/** `/data/saves/{playthroughId}/photos/{charId}` — the pictures she has sent in this save. */
export function getPhotosPath(playthroughId: string, charId: string): string {
  return join(getPhotosRoot(playthroughId), charId)
}

/** The playthrough's photo folder, one folder in it per girl who sent any. */
export function getPhotosRoot(playthroughId: string): string {
  return join(getPlaythroughPath(playthroughId), 'photos')
}

/** One picture on a thread; `file` is the name the message carries. */
export function getPhotoPath(playthroughId: string, charId: string, file: string): string {
  return join(getPhotosPath(playthroughId, charId), file)
}

/**
 * This scheme's entry for `registerImageSchemes`, which is the only place a scheme may be
 * privileged: Electron takes one such registration and a second replaces the first, so this is
 * handed to that call rather than registered on its own.
 */
export const PHOTO_SCHEME: Electron.CustomScheme = {
  scheme: SCHEME,
  privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
}

/** Must run **after** `app.whenReady()`. Serves one save's photo folder and nothing else. */
export function handlePhotoProtocol(): void {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url)
    // The host is a constant (see `photoUrl`); the path carries all three parts.
    const [playthroughId, charId, file, ...rest] = decodeURIComponent(url.pathname)
      .replace(/^\//, '')
      .split('/')

    // Every part is checked against its own vocabulary: an id that could climb out of the
    // folder never reaches the filesystem, and nothing but a photo is served.
    if (
      rest.length > 0 ||
      !SAFE_NUMERIC_ID.test(playthroughId ?? '') ||
      !SAFE_CHAR_ID.test(charId ?? '') ||
      !isPhotoFile(file ?? '')
    ) {
      console.warn(`[playimg] refused ${request.url}`)
      return new Response('Not found', { status: 404 })
    }

    // A WebP the renderer has not encoded yet, or never did, is served from its PNG.
    const path = await imagePath(getPhotoPath(playthroughId, charId, file))
    try {
      return await net.fetch(pathToFileURL(path).toString())
    } catch (err) {
      console.warn(`[playimg] ${path}: ${String(err)}`)
      return new Response('Not found', { status: 404 })
    }
  })
}
