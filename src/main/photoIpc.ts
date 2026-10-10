import type { IpcMainInvokeEvent } from 'electron'
import { enqueue } from '@shared/jobQueue'
import type { Character } from '@shared/types'
import { start as startComfy } from './services/comfyService'
import {
  carryPhotos,
  generatePhoto,
  photoLanded,
  readPhotoBytes,
  reservePhotoName,
  storeWebpPhoto
} from './services/localPhotoService'

/**
 * The three channels the photo feature adds, registered from here rather than written into
 * `ipc.ts`: that file is handed this module's `registerPhotoIpc` and its own `handle`, so the
 * hook it carries is an import and a call.
 */

/**
 * A render queued under her charId, without the `assertEditableChar` gate every sprite channel
 * runs first.
 *
 * That gate is there because a sprite is written **into the character's folder**, and a shipped
 * character's folder is read-only. A photo is written into the playthrough's folder instead, so
 * the gate would refuse — with `CHARACTER_READ_ONLY` — every picture the shipped cast might ever
 * send, which is most of the cast in most playthroughs. Photographing her edits nothing of hers.
 */
function queuePhoto<T>(
  character: Character,
  key: string,
  run: (options: { signal: AbortSignal; onProgress: (step: string) => void }) => Promise<T>
): Promise<T> {
  return enqueue({
    group: character.charId,
    key,
    run: async ({ signal, report }) => {
      // The job starts ComfyUI itself; the queue is serial, so only the first pays the boot.
      report('Waiting for ComfyUI')
      await startComfy((step) => report(step))
      return run({ signal, onProgress: (step) => report(step) })
    }
  })
}

/** How `ipc.ts` wraps a listener into its own `Result` envelope. */
type Handle = <Args extends unknown[], T>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
) => void

/** Registers the photo channels. Called from `registerIpcHandlers` with its own `handle`. */
export function registerPhotoIpc(handle: Handle): void {
  // The name the next picture will land under, settled before it is drawn so the bubble that
  // is waiting for it can carry that name into the save straight away.
  handle(
    'comfy:reservePhotoName',
    (_event, playthroughId: string, character: Character, kind: string, inSave: unknown) =>
      reservePhotoName(playthroughId, character, kind, inSave)
  )

  // The pictures a continued semester's carried threads and feeds point at, copied across.
  handle(
    'comfy:carryPhotos',
    (_event, fromPlaythroughId: string, toPlaythroughId: string, charIds?: string[]) =>
      carryPhotos(fromPlaythroughId, toPlaythroughId, charIds)
  )

  // Whether a picture a bubble is still waiting for is on disk after all — asked on load, for
  // a render that finished after the save that was waiting for it was written.
  handle('comfy:photoLanded', (_event, playthroughId: string, charId: string, file: string) =>
    photoLanded(playthroughId, charId, file)
  )

  // A picture that just landed as PNG, read back for the renderer to encode as WebP.
  handle('comfy:readPhoto', (_event, playthroughId: string, charId: string, file: string) =>
    readPhotoBytes(playthroughId, charId, file)
  )

  // The WebP the renderer encoded from a picture that just landed as PNG.
  handle(
    'comfy:storeWebpPhoto',
    (_event, playthroughId: string, charId: string, file: string, bytes: Uint8Array) =>
      storeWebpPhoto(playthroughId, charId, file, bytes)
  )

  // One picture she texted, rendered after her words have already landed on the thread.
  handle(
    'comfy:generatePhoto',
    (
      _event,
      playthroughId: string,
      character: Character,
      tier: string,
      photoPrompt: string,
      file: string
    ) =>
      queuePhoto(character, `photo:${tier}`, (options) =>
        generatePhoto(playthroughId, character, tier, photoPrompt, file, options)
      )
  )
}
