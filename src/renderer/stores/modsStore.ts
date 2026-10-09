import { create } from 'zustand'
import {
  modOn,
  MODS,
  NO_SWITCHES,
  optionOn,
  withMod,
  withOption,
  type ModSwitches
} from '@shared/mods'
import type { PlaythroughRecord } from '@shared/types'
import { setHookRules } from '../mods/hooks'
import { loopState } from './loop/state'
import { useUiStore } from './uiStore'

interface ModsStoreState {
  /** What the player has set; every mod at its default until the boot's read lands. */
  switches: ModSwitches

  /** Reads the switches from disk. A failure is not fatal: the mods run at their defaults. */
  load: () => Promise<void>
  /** Turns one mod on or off and writes it; a write that fails is reported and undone. */
  setMod: (id: string, on: boolean) => Promise<void>
  /** Sets one of a mod's options and writes it, the same way. */
  setOption: (modId: string, optionId: string, on: boolean) => Promise<void>
}

/** The tail of the write lane: each write is of the switches as they stand at its turn. */
let tail: Promise<unknown> = Promise.resolve()

/** Owns `mods:*` IPC: which community mods are on, and their options. */
export const useModsStore = create<ModsStoreState>((set, get) => {
  /** Applies a change at once, then writes it behind every write already in flight. */
  function change(apply: (switches: ModSwitches) => ModSwitches): Promise<void> {
    const before = get().switches
    const after = apply(before)
    set({ switches: after })
    const write = tail.then(async () => {
      const result = await window.api.mods.set(get().switches)
      if (result.ok) return
      useUiStore.getState().showError(result.error)
      // Only where nothing has changed since: a later change has its own write coming.
      if (get().switches === after) set({ switches: before })
    })
    tail = write
    return write
  }

  return {
    switches: NO_SWITCHES,

    load: async () => {
      const result = await window.api.mods.get()
      if (!result.ok) {
        console.error('[mods] the switches could not be read; every mod is at its default', result.error)
        return
      }
      set({ switches: result.data })
    },

    setMod: (id, on) => change((switches) => withMod(switches, id, on)),
    setOption: (modId, optionId, on) =>
      change((switches) => withOption(switches, modId, optionId, on))
  }
})

// The game's hooks ask only the mods that are on, in the order the list names them. Inside a
// game, a mod scoped to the playthrough is on as the game's record says, not as the switch now
// stands; on the menus, with no game entered, the switches decide.
setHookRules({
  isOn: (modId) => modOn(useModsStore.getState().switches, modId, loopState.record),
  order: (modId) => MODS.findIndex((mod) => mod.id === modId)
})

/** Whether a mod is on, for code outside a component; see `modOn` for what a record changes. */
export function modIsOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean {
  return modOn(useModsStore.getState().switches, id, record)
}

/** Whether a mod is on, for a component: it renders again when the switch moves. */
export function useModOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean {
  return useModsStore((s) => modOn(s.switches, id, record))
}

/** Where one of a mod's options stands, for a component. */
export function useModOption(modId: string, optionId: string): boolean {
  return useModsStore((s) => optionOn(s.switches, modId, optionId))
}
