import { create } from 'zustand'
import { comfySourceOf } from '@shared/comfyModels'
import type { AppError, InstallProgress, RendererSettings, SetupStatus } from '@shared/types'
import { isWebBuild } from '../platform'
import { useUiStore } from './uiStore'

/**
 * Whether characters can be rendered at all: never in the browser; with the player's own ComfyUI
 * named, always (whether it answers is a job's to find); with the app's own, once its install
 * verified and was not deferred.
 */
export function comfyAvailable(
  settings: RendererSettings | null,
  status: SetupStatus | null
): boolean {
  if (isWebBuild() || !settings) return false
  if (comfySourceOf(settings) === 'external') return true
  return Boolean(status?.comfyReady) && !settings.comfyDeferred
}

/**
 * Whether the first run's image stage, and a boot, owe the player nothing about ComfyUI: their
 * own one is named, or the app's own install is finished or deferred.
 */
export function comfySettled(
  settings: RendererSettings | null,
  status: SetupStatus | null
): boolean {
  if (!settings) return false
  return (
    comfySourceOf(settings) === 'external' ||
    settings.comfyDeferred ||
    Boolean(status?.comfyReady)
  )
}

/** Live per-component install state, keyed by `SetupComponent.id`. */
export interface ComponentProgress {
  step: string
  percent?: number
  bytesDone?: number
  bytesTotal?: number
  done?: boolean
  error?: AppError
}

/** One progress event as the row holds it; both listeners below map alike. */
function progressOf(event: InstallProgress): ComponentProgress {
  return {
    step: event.step,
    percent: event.percent,
    bytesDone: event.bytesDone,
    bytesTotal: event.bytesTotal,
    done: event.done,
    error: event.error
  }
}

interface SetupStoreState {
  status: SetupStatus | null
  checking: boolean
  installing: boolean
  progress: Record<string, ComponentProgress>

  /**
   * Runs the startup verify pipeline. Called on boot and on user refresh; `quiet` logs a
   * failure rather than raising the fatal screen, for a check nothing is waiting on.
   */
  refresh: (quiet?: boolean) => Promise<void>
  /** Runs the install pipeline; per-component failures surface in progress. */
  install: () => Promise<void>
  /** Reveals the folder a hand-downloaded model belongs in. */
  openModelFolder: (componentId: string) => Promise<void>
  /**
   * Hashes what the player put in that folder and adopts it if it is the pinned file.
   * Reports through the row, never an error modal.
   */
  verifyModel: (componentId: string) => Promise<void>
}

/**
 * Owns every `setup:*` channel. There is no install to speak of in the browser, so every
 * action here answers nothing there and the status stays null: no screen offers one, and a
 * stray caller reaches no channel.
 */
export const useSetupStore = create<SetupStoreState>((set, get) => ({
  status: null,
  checking: false,
  installing: false,
  progress: {},

  refresh: async (quiet = false) => {
    if (isWebBuild()) return
    set({ checking: true })
    const result = await window.api.setup.getStatus()
    // A fresh verify supersedes the previous run's telemetry.
    set({ checking: false, progress: {} })
    if (!result.ok) {
      if (quiet) console.warn(`Could not verify the ComfyUI install: ${result.error.message}`)
      else useUiStore.getState().showFatalError(result.error)
      return
    }
    set({ status: result.data })
  },

  install: async () => {
    if (isWebBuild() || get().installing) return

    // Cleared so the view can tell "installed earlier" from "installing now".
    set({ installing: true, progress: {} })

    const unsubscribe = window.api.setup.onInstallProgress((event: InstallProgress) => {
      set((state) => ({
        progress: { ...state.progress, [event.componentId]: progressOf(event) }
      }))
    })

    try {
      const result = await window.api.setup.runInstall()
      if (!result.ok) {
        useUiStore.getState().showError(result.error)
        return
      }

      set({ status: result.data.status })
    } finally {
      unsubscribe()
      set({ installing: false })
    }
  },

  openModelFolder: async (componentId) => {
    if (isWebBuild()) return
    const result = await window.api.setup.openModelFolder(componentId)
    if (!result.ok) useUiStore.getState().showError(result.error)
  },

  verifyModel: async (componentId) => {
    if (isWebBuild() || get().installing) return
    // Rides `installing`: hashing a 6.46 GiB weight needs the same lockout an install does.
    set((state) => ({
      installing: true,
      progress: { ...state.progress, [componentId]: { step: 'Verifying' } }
    }))

    const unsubscribe = window.api.setup.onInstallProgress((event: InstallProgress) => {
      set((state) => ({
        progress: { ...state.progress, [event.componentId]: progressOf(event) }
      }))
    })

    try {
      const result = await window.api.setup.verifyModel(componentId)
      if (!result.ok) {
        set((state) => ({
          progress: {
            ...state.progress,
            [componentId]: { step: 'Failed', done: true, error: result.error }
          }
        }))
        return
      }

      // The row now answers from the fresh status, so its progress entry is dropped.
      set((state) => {
        const { [componentId]: _cleared, ...progress } = state.progress
        return { status: result.data, progress }
      })
    } finally {
      unsubscribe()
      set({ installing: false })
    }
  }
}))
