import { create } from 'zustand'
import { subscribeLocalImageSource } from '@vx/modkit/renderer'
import { bindPhotoPpmReader } from '../../shared/photoSwitches'
import type { PhotoPpmState } from '../../shared/photoTypes'
import { photoInvoke } from './photoInvoke'

/** One pack answer shared by gameplay gates and the Mods screen, unknown until first checked. */
const usePpm = create<{ state: PhotoPpmState | null }>(() => ({ state: null }))
let revision = 0
let started = false

/** Reads the latest answer synchronously when deciding whether to ask for a photo of two. */
export function usePhotoPpmState(): PhotoPpmState | null {
  return usePpm(state => state.state)
}

/** Refreshes the pack state, ignoring an answer overtaken by another refresh or source change. */
export async function refreshPhotoPpm(): Promise<void> {
  const at = ++revision
  try {
    const result = await photoInvoke('ppmState', [])
    if (at === revision) usePpm.setState({ state: result.ok ? result.data : null })
  } catch {
    if (at === revision) usePpm.setState({ state: null })
  }
}

/** Binds Photo's gate and clears a previous server's answer before asking the new source. */
export function startPhotoPpm(): void {
  bindPhotoPpmReader(() => usePpm.getState().state)
  if (started) return
  started = true
  subscribeLocalImageSource(() => {
    usePpm.setState({ state: null })
    void refreshPhotoPpm()
  })
  void refreshPhotoPpm()
}
