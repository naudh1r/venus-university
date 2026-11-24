import { SAFE_CHAR_ID, SAFE_NUMERIC_ID, imageTypeOf } from '@vx/modkit/shared'
import { isPhotoFile } from '../shared/photoFiles'
import { readPhotoImage } from './photoFiles'

/** One route under the mod's namespace; old saves retain their original file names. */
export async function photoRoute(request: Request): Promise<Response> {
  const url = new URL(request.url)
  // The route prefix is followed by the three parts of the stored image identity.
  const [playthroughId, charId, file, ...rest] = decodeURIComponent(url.pathname)
    .replace(/^\/@\/photos\//, '')
    .split('/')

  // Every part is checked against its own vocabulary: an id that could climb out of the
  // folder never reaches the filesystem, and nothing but a photo is served.
  if (
    rest.length > 0 ||
    !SAFE_NUMERIC_ID.test(playthroughId ?? '') ||
    !SAFE_CHAR_ID.test(charId ?? '') ||
    !isPhotoFile(file ?? '')
  ) {
    console.warn(`[photo-route] refused ${request.url}`)
    return new Response('Not found', { status: 404 })
  }

  // A WebP the renderer has not encoded yet, or never did, is served from its PNG.
  try {
    const bytes = await readPhotoImage(playthroughId, charId, file)
    return new Response(bytes as BodyInit, {
      headers: { 'Content-Type': imageTypeOf(bytes) ?? 'application/octet-stream' }
    })
  } catch (err) {
    console.warn(`[photo-route] ${playthroughId}/${charId}/${file}: ${String(err)}`)
    return new Response('Not found', { status: 404 })
  }
}
