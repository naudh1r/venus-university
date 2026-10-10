import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { isCharFileRel } from '@shared/characterFiles'
import { SAFE_CHAR_ID } from '@shared/characterRules'
import { BG_VARIANTS, customBackgroundFileName, isSafeBgName } from '@shared/customBackgrounds'
import { getCharacterImagePath, getCustomBackgroundImagePath } from './paths'
import { imagePath } from './services/imageFiles'
import { PHOTO_SCHEME } from './photoProtocol'

/** Disk-backed image URLs: the host is the charId and the path is the image's own. */
const CHAR_SCHEME = 'charimg'

/**
 * The player's own backgrounds: `bgimg://custom/{name}/{file}`. The name rides the path rather
 * than the host, which a standard scheme would read as an address where it looks like one.
 */
const BG_SCHEME = 'bgimg'

/** The one host a background URL is served under. */
const BG_HOST = 'custom'

/**
 * Must run **before** `app.whenReady()`, and only once, so both schemes are registered here;
 * `standard` makes host/path parse, while `supportFetchAPI`/`secure` keep renderer CSP from
 * blocking them.
 */
export function registerImageSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    ...[CHAR_SCHEME, BG_SCHEME].map((scheme) => ({
      scheme,
      privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true }
    })),
    // A second `registerSchemesAsPrivileged` replaces the first, so `playimg://` is
    // privileged from here rather than registering itself.
    PHOTO_SCHEME
  ])
}

/** The file a background URL names, or null where it names none of a background's pictures. */
function backgroundFileOf(url: URL): string | null {
  if (url.hostname !== BG_HOST) return null
  const parts = decodeURIComponent(url.pathname).replace(/^\//, '').split('/')
  if (parts.length !== 2 || !isSafeBgName(parts[0])) return null
  const [name, file] = parts
  const variant = BG_VARIANTS.find((each) => customBackgroundFileName(name, each) === file)
  return variant ? getCustomBackgroundImagePath(name, variant) : null
}

/**
 * Must run **after** `app.whenReady()`. Serves files from a character's own folder, and the
 * pictures of the player's own backgrounds.
 */
export function handleImageProtocols(): void {
  protocol.handle(CHAR_SCHEME, async (request) => {
    const url = new URL(request.url)
    const charId = url.hostname
    // The renderer's cache-busting `?v=` is ignored here.
    const rel = decodeURIComponent(url.pathname).replace(/^\//, '')
    if (!SAFE_CHAR_ID.test(charId) || !isCharFileRel(rel)) {
      return new Response('Not found', { status: 404 })
    }

    // The URL always names the PNG; the shipped cast is the same image under `.webp`.
    const path = await imagePath(getCharacterImagePath(charId, rel))
    return net.fetch(pathToFileURL(path).toString())
  })

  protocol.handle(BG_SCHEME, (request) => {
    // The `?v=` is the background's creation time, which only the renderer's cache reads.
    const path = backgroundFileOf(new URL(request.url))
    if (!path) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(path).toString())
  })
}
