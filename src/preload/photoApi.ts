import { ipcRenderer } from 'electron'
import type { Character } from '@shared/types'

/**
 * The renderer's half of the photo channels.
 *
 * It hangs off `api.photo` rather than joining `api.comfy`, where the build this was ported from
 * kept it, for one reason: `comfy` in `api.d.ts` is an inline object literal, and an inline type
 * cannot be reached by declaration merging — every method would have to be written inside that
 * literal by hand, and re-written there after every sync. A top-level key is its own interface
 * member, so it can be declared from outside and `api.d.ts` never learns the feature exists.
 *
 * The declaration itself is in `shared/photoTypes.ts`, which is the one folder both the main and
 * renderer tsconfig projects include — this file is in neither's reach from the renderer side.
 */

/** Spread into the preload's `api` object; one line there, everything else here. */
export const photoApi = {
  photo: {
    reserveName: (
      playthroughId: string,
      character: Character,
      kind: string,
      inSave: readonly string[]
    ) => ipcRenderer.invoke('comfy:reservePhotoName', playthroughId, character, kind, inSave),
    landed: (playthroughId: string, charId: string, file: string) =>
      ipcRenderer.invoke('comfy:photoLanded', playthroughId, charId, file),
    generate: (
      playthroughId: string,
      character: Character,
      tier: string,
      photoPrompt: string,
      file: string
    ) =>
      ipcRenderer.invoke('comfy:generatePhoto', playthroughId, character, tier, photoPrompt, file)
  }
}
