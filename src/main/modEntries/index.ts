import screenCompanion from './screen-companion'
import sceneNotes from './scene-notes'
import { photoMainEntry } from './photo-feature'
import type { InvokeHandler } from '../mods/invoke'
import type { RouteHandler } from '../mods/loader'

/** The exports returned by one built-in entry function, as an installed main.js would export. */
interface MainEntry {
  readonly invoke?: Readonly<Record<string, InvokeHandler>>
  readonly protocols?: readonly { readonly route: string; readonly handle: RouteHandler }[]
}

/**
 * Built-in main entry functions, keyed by a mod id from MODS. Statically import each function
 * from `./<id>` and list it here. Each synchronously returns `{ invoke?, protocols? }`.
 * Keep setup inside the function: the loader catches a throw and switches off only its mod.
 */
export const BUILT_IN_MAIN_ENTRIES: Readonly<Record<string, () => MainEntry>> = { 'photo-feature': photoMainEntry, 'scene-notes': sceneNotes, 'screen-companion': screenCompanion }
