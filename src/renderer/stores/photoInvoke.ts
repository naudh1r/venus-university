import { invoke } from '@vx/modkit/renderer'
import type { Result, Character } from '@vx/modkit/shared'
import type { PhotoInfo, PhotoOrientation, PhotoPpmState, PhotoRenderOptions } from '../../shared/photoTypes'
import { PHOTO_FEATURE_ID } from '../../shared/photoSwitches'

export type PhotoCalls = {
      /**
       * The random name the next picture will land under, settled before it is drawn so the
       * bubble waiting for it carries that name into the save immediately. `inSave` is every
       * name the save already points at for her, which is never handed out again.
       */
      reserveName: (
        playthroughId: string,
        character: Character,
        inSave: readonly string[]
      ) => Promise<Result<string>>
      reserveRedraw: (pid: string, character: Character, saved: readonly string[]) => Promise<Result<string>>
      replace: (pid: string, charId: string, file: string, temporary: string) => Promise<Result<void>>
      sweep: (pid: string) => Promise<Result<void>>
      /**
       * Whether a picture a bubble is still waiting for is on disk after all. Asked on load: a
       * render can finish after the save that was waiting for it was written.
       */
      landed: (playthroughId: string, charId: string, file: string) => Promise<Result<boolean>>
      /** The bytes of a picture on disk, whichever of PNG or WebP it is under. */
      read: (playthroughId: string, charId: string, file: string) => Promise<Result<Uint8Array>>
      /**
       * The recorded prompt, or a current build; rebuilding retains a recorded seed. Old duo
       * halves are rebuilt for ppm while their scene and negative stay as recorded.
       */
      info: (
        playthroughId: string,
        character: Character,
        friend: Character | undefined,
        tier: string,
        scene: string,
        file: string,
        rebuild?: boolean,
        orientation?: PhotoOrientation
      ) => Promise<Result<PhotoInfo>>
      /** Whether the selected ComfyUI has the pack needed for photos of two. */
      ppmState: () => Promise<Result<PhotoPpmState>>
      /** Installs ComfyUI-ppm into the game's own ComfyUI, restarting it on the next render. */
      installPpm: () => Promise<Result<void>>
      /** Cancels one render or removes an unused picture. */
      drop: (
        playthroughId: string,
        charId: string,
        file: string,
        options?: { cancelOnly?: boolean }
      ) => Promise<Result<void>>
      /** Keeps the WebP encoded from a picture that landed as PNG, and drops the PNG. */
      storeWebp: (
        playthroughId: string,
        charId: string,
        file: string,
        bytes: Uint8Array
      ) => Promise<Result<void>>
      /**
       * Copies the pictures `charIds` sent in one playthrough into another, for a semester
       * continued from the one before: its carried threads and feeds point at them. With no
       * `charIds`, every girl who sent any.
       */
      carry: (
        fromPlaythroughId: string,
        toPlaythroughId: string,
        charIds?: string[]
      ) => Promise<Result<void>>
      /** The shape her next photo alone is drawn in, settled before it is drawn. */
      soloOrientation: (
        character: Character,
        tier: string,
        photoPrompt: string
      ) => Promise<Result<PhotoOrientation>>
      /**
       * Resolves with the file name when the queued render finishes. `tier` has already been
       * settled by `photoGate`; nothing downstream re-opens it.
       */
      generate: (
        playthroughId: string,
        character: Character,
        tier: string,
        photoPrompt: string,
        file: string,
        options?: PhotoRenderOptions
      ) => Promise<Result<string>>
      /** {@link generate} for a picture of her with `friend` beside her, in her own folder. */
      generateDuo: (
        playthroughId: string,
        character: Character,
        friend: Character,
        tier: string,
        photoPrompt: string,
        file: string,
        options?: PhotoRenderOptions
      ) => Promise<Result<string>>
    }

/** Retains Photo's browser answers through the shared invocation path. */
export async function photoInvoke<K extends keyof PhotoCalls>(name: K, args: Parameters<PhotoCalls[K]>): Promise<Awaited<ReturnType<PhotoCalls[K]>>> {
  const result = await invoke<unknown>(PHOTO_FEATURE_ID, name.replace(/[A-Z]/g, letter => '-' + letter.toLowerCase()), args)
  if (result.ok || result.error.code !== 'DESKTOP_ONLY') return result as Awaited<ReturnType<PhotoCalls[K]>>
  if (name === 'carry') return { ok: true, data: undefined } as Awaited<ReturnType<PhotoCalls[K]>>
  return { ok: false, error: { ...result.error,
    message: 'The browser build cannot render pictures; the desktop build can.' } } as Awaited<ReturnType<PhotoCalls[K]>>
}
