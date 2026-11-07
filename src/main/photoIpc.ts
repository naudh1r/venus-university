import { registerPhotoBackup } from './localPhotoBackup'
import { registerImagePromptDraft } from '@vx/modkit/shared'
import { registerPhotoDraft } from '../shared/photoDraft'
import { BrowserWindow } from 'electron'
import type { InvokeContext, InvokeHandler } from '@vx/modkit/main'
import type { PhotoRenderOptions } from '../shared/photoTypes'
import { appError, type Character } from '@vx/modkit/shared'
import {
  carryPhotos,
  retirePhoto,
  photoInfo,
  dropPhoto,
  generateDuoPhoto,
  generatePhoto,
  photoLanded,
  readPhotoBytes,
  reservePhotoName,
  storeWebpPhoto,
  validatePhotoOverrides
} from './services/localPhotoService'

interface PhotoRender {
  controller: AbortController
  settled: Promise<string>
}
const renders = new Map<string, PhotoRender>()

/** Identifies a reserved picture within its playthrough and character folder. */
function renderKey(playthroughId: string, charId: string, file: string): string {
  return `${playthroughId}/${charId}/${file}`
}

/** Aborts one reserved picture's render and waits for its file cleanup. */
async function cancelPhoto(playthroughId: string, charId: string, file: string): Promise<void> {
  const render = renders.get(renderKey(playthroughId, charId, file))
  if (!render) return
  render.controller.abort()
  await render.settled.catch(() => {})
}

/** Calls the kit directly; each reserved picture owns its signal and window progress. */
function runPhoto(
  event: InvokeContext,
  playthroughId: string,
  charId: string,
  file: string,
  run: (options: { signal: AbortSignal; onProgress: (step: string) => void }) => Promise<string>
): Promise<string> {
  const key = renderKey(playthroughId, charId, file)
  const previous = renders.get(key)
  previous?.controller.abort()
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  event.signal.addEventListener('abort', abort, { once: true })
  if (event.signal.aborted) controller.abort()
  const jobId = `photo:${key}`
  const report = (status: 'running' | 'done' | 'error', step: string): void => {
    try {
      for (const window of BrowserWindow.getAllWindows()) {
        if (window.isDestroyed()) continue
        window.webContents.send('jobs:progress', {
          jobId, group: charId, key: `photo:${playthroughId}:${file}`, status, step
        })
      }
    } catch (error) {
      console.warn('[photo] could not report render progress:', error)
    }
  }
  const render: PhotoRender = { controller, settled: Promise.resolve('') }
  renders.set(key, render)
  render.settled = (async () => {
    try {
      // A repeated request for this file cannot outpace the cancelled writer's cleanup.
      await previous?.settled.catch(() => {})
      if (controller.signal.aborted) throw appError('CANCELLED', 'Generation was cancelled.')
      const result = await run({
        signal: controller.signal,
        onProgress: (step) => report('running', step)
      })
      report('done', 'Done')
      return result
    } catch (error) {
      report('error', controller.signal.aborted ? 'Cancelled' : 'Failed')
      throw error
    } finally {
      event.signal.removeEventListener('abort', abort)
      if (renders.get(key) === render) renders.delete(key)
    }
  })()
  return render.settled
}

/** Photo's main exports, using the same arguments as its original calls. */
export function photoInvocations(): Record<string, InvokeHandler> {
  const handlers: Record<string, InvokeHandler> = {}
  function handle<Args extends unknown[], T>(name: string,
    listener: (context: InvokeContext, ...args: Args) => T): void {
    handlers[name] = (context, ...args) => listener(context, ...args as Args)
  }
  registerPhotoBackup()
  registerPhotoDraft(registerImagePromptDraft)
  // Reserves the name the waiting bubble will carry into the save.
  handle(
    'reserve-name',
    (_event, playthroughId: string, character: Character, kind: string, inSave: unknown) =>
      reservePhotoName(playthroughId, character, kind, inSave)
  )

  // The pictures a continued semester's carried threads and feeds point at, copied across.
  handle(
    'carry',
    (_event, fromPlaythroughId: string, toPlaythroughId: string, charIds?: string[]) =>
      carryPhotos(fromPlaythroughId, toPlaythroughId, charIds)
  )

  // Finds a picture that landed after its waiting bubble was saved.
  handle('landed', (_event, playthroughId: string, charId: string, file: string) =>
    photoLanded(playthroughId, charId, file)
  )

  // A picture that just landed as PNG, read back for the renderer to encode as WebP.
  handle('read', (_event, playthroughId: string, charId: string, file: string) =>
    readPhotoBytes(playthroughId, charId, file)
  )

  // The WebP the renderer encoded from a picture that just landed as PNG.
  handle(
    'store-webp',
    (_event, playthroughId: string, charId: string, file: string, bytes: Uint8Array) =>
      storeWebpPhoto(playthroughId, charId, file, bytes)
  )

  // Reads the recorded request, or rebuilds it from today's tags and settings.
  handle(
    'info',
    (
      _event,
      playthroughId: string,
      character: Character,
      friend: Character | undefined,
      tier: string,
      scene: string,
      file: string,
      rebuild: boolean = false
    ) => photoInfo(playthroughId, character, friend, tier, scene, file, rebuild)
  )

  // Cancels an abandoned render, or removes a file once saved references permit it.
  handle(
    'drop',
    async (
      _event,
      playthroughId: string,
      charId: string,
      file: string,
      options?: { cancelOnly?: boolean; replacement?: string }
    ) => {
      await cancelPhoto(playthroughId, charId, file)
      if (options?.cancelOnly) return
      if (options?.replacement) return retirePhoto(playthroughId, charId, file, options.replacement)
      return dropPhoto(playthroughId, charId, file)
    }
  )

  // One picture she texted, rendered after her words have already landed on the thread.
  handle(
    'generate',
    (
      event,
      playthroughId: string,
      character: Character,
      tier: string,
      photoPrompt: string,
      file: string,
      overrides: PhotoRenderOptions = {}
    ) => {
      validatePhotoOverrides(overrides, false)
      return runPhoto(event, playthroughId, character.charId, file, (options) =>
        generatePhoto(playthroughId, character, tier, photoPrompt, file, options, overrides)
      )
    }
  )

  // A picture of her and a friend, queued under her: it is hers, and lands in her folder.
  handle(
    'generate-duo',
    (
      event,
      playthroughId: string,
      character: Character,
      friend: Character,
      tier: string,
      photoPrompt: string,
      file: string,
      overrides: PhotoRenderOptions = {}
    ) => {
      validatePhotoOverrides(overrides, true)
      return runPhoto(event, playthroughId, character.charId, file, (options) =>
        generateDuoPhoto(
          playthroughId,
          character,
          friend,
          tier,
          photoPrompt,
          file,
          options,
          overrides
        )
      )
    }
  )
  return handlers
}
