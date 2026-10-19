import { create } from 'zustand'
import {
  comfySourceOf,
  comfyUrlOf,
  type ComfyModelLists,
  type ComfyModelRole,
  type ComfyProbe
} from '@shared/comfyModels'
import type { AppError, ComfyRuntimeState, Result } from '@shared/types'
import { isWebBuild, DESKTOP_ONLY_NOTE } from '../platform'
import { useSettingsStore } from './settingsStore'
import { useUiStore } from './uiStore'

interface ComfyStoreState {
  state: ComfyRuntimeState
  error?: AppError
  /** Asks main to start ComfyUI unless it is already up; concurrent callers share one boot. */
  ensureStarted: () => Promise<void>
  /** Kills the server; it stays down until someone starts it again or a render job needs it. */
  stop: () => Promise<void>
  /** Each model slot's files in the app's own install; a failure is the form's to read. */
  listLocalModels: () => Promise<Result<ComfyModelLists>>
  /** What the player's own ComfyUI at `url` has; a failure is the form's to read. */
  probe: (url: string) => Promise<Result<ComfyProbe>>
  /**
   * Opens one slot's model folder, the app's own install's where `url` is null; on a player's
   * own server, the one holding `pick` where one does.
   */
  openModelFolder: (role: ComfyModelRole, url: string | null, pick?: string) => Promise<void>
  /**
   * The LoRAs the ComfyUI the settings name can draw with, asked afresh: the app's own install's
   * folder, or the player's own server's list. Null where that cannot be told.
   */
  listLoras: () => Promise<string[] | null>
}

/** What the browser answers a ComfyUI question with: there is no ComfyUI there to ask. */
function desktopOnly<T>(): Result<T> {
  return { ok: false, error: { code: 'DESKTOP_ONLY', message: DESKTOP_ONLY_NOTE } }
}

/**
 * ComfyUI's *runtime* state, kept apart from `setupStore`'s *install* state:
 * one answers "is the server up", the other "are the files on disk". Main owns the answer
 * and broadcasts it, so nothing here sets the state from what a call returned.
 */
export const useComfyStore = create<ComfyStoreState>((_set, get) => ({
  state: 'idle',

  ensureStarted: async () => {
    // There is no local server in the browser, so the state stays idle and no start is asked for.
    if (isWebBuild()) return
    await window.api.comfy.start()
  },

  stop: async () => {
    await window.api.comfy.stop()
  },

  listLocalModels: async () =>
    isWebBuild() ? desktopOnly() : window.api.comfy.listLocalModels(),

  probe: async (url) => (isWebBuild() ? desktopOnly() : window.api.comfy.probe(url)),

  openModelFolder: async (role, url, pick) => {
    if (isWebBuild()) return
    const result = await window.api.comfy.openModelFolder(role, url, pick)
    if (!result.ok) useUiStore.getState().showError(result.error)
  },

  listLoras: async () => {
    const settings = useSettingsStore.getState().settings
    if (isWebBuild() || !settings) return null
    const result =
      comfySourceOf(settings) === 'external'
        ? await get()
            .probe(comfyUrlOf(settings))
            .then((probed) => (probed.ok ? { ok: true as const, data: probed.data.models } : probed))
        : await get().listLocalModels()
    if (!result.ok) {
      console.warn(`[comfy] could not list the LoRAs: ${result.error.message}`)
      return null
    }
    return result.data.lora
  }
}))

/** Subscribes to `comfy:state` at module scope, so a start this window never asked for lands. */
window.api.comfy.onState((status) => {
  useComfyStore.setState({ state: status.state, error: status.error })
})
