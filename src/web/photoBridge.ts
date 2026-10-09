import { appError } from '@shared/errors'
import type { Result } from '@shared/types'

/**
 * The photo half of the browser bridge: refusals, since a photo is rendered on a local ComfyUI
 * the browser build has no way to reach. Spread into `buildApi`'s object, one line there.
 *
 * `bridge.ts` keeps its own `desktopOnly` for this, but it is private to that file, so this
 * repeats the one line it is rather than asking for it to be exported — the feature's own
 * stubs, in the feature's own file.
 */

/** The note a browser build gives when asked for something only the desktop build has. */
const DESKTOP_ONLY_NOTE = 'The browser build cannot render pictures; the desktop build can.'

function desktopOnly<T>(what: string): Promise<Result<T>> {
  return Promise.resolve({ ok: false, error: appError('DESKTOP_ONLY', DESKTOP_ONLY_NOTE, what) })
}

/** Spread into the browser bridge's `api` object. */
export const photoBridge = {
  photo: {
    reserveName: () => desktopOnly<string>('photo.reserveName'),
    landed: () => desktopOnly<boolean>('photo.landed'),
    // The browser build has never drawn one, so there is nothing to carry.
    carry: (): Promise<Result<void>> => Promise.resolve({ ok: true, data: undefined }),
    generate: () => desktopOnly<string>('photo.generate')
  }
}
