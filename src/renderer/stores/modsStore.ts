import { setSharedModRules } from '@shared/modRules'
import { setEchoBonusEnabled } from '@shared/echo'
import { CITY_LIFE_LOCATIONS_MOD, CITY_LIFE_JOBS_MOD, setCityLifeEnabled } from '@shared/cityLife'
import { useGameStore } from './gameStore'
import { create } from 'zustand'
import { toAppError } from '@shared/errors'
import {
  modById,
  MODS,
  modOn,
  NO_SWITCHES,
  optionOn,
  withMod,
  withOption,
  type ModSwitches
} from '@shared/mods'
import type { PlaythroughRecord } from '@shared/types'
import { setHookRules } from '../mods/hooks'
import { loopState, subscribeLoopRecord } from './loop/state'
import { useModSessionStore } from './modSessionStore'
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

/** The registrar uses the same choices that produced its saved jobs, haunts and setup. */
let enrollmentRecord: Pick<PlaythroughRecord, 'mods'> | null = null
export function setEnrollmentMods(mods: readonly string[] | null): void {
  enrollmentRecord = mods === null ? null : { mods: [...mods] }
  syncCityLife()
}

/** Owns `mods:*` IPC: which community mods are on, and their options. */
export const useModsStore = create<ModsStoreState>((set, get) => {
  let persisted = NO_SWITCHES
  /** Applies a change at once, then writes it behind every write already in flight. */
  function change(apply: (switches: ModSwitches) => ModSwitches): Promise<void> {
    const before = get().switches
    const after = apply(before)
    set({ switches: after })
    const write = tail.then(async () => {
      const snapshot = get().switches
      try {
        const result = await window.api.mods.set(snapshot)
        if (!result.ok) throw result.error
        persisted = snapshot
      } catch (error) {
        useUiStore.getState().showError(toAppError(error))
        // A later queued edit owns its own attempt. When the lane is caught up,
        // restore what storage actually acknowledged, not an unpersisted click.
        if (get().switches === after) set({ switches: persisted })
      }
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
      persisted = result.data
      set({ switches: result.data })
    },

    setMod: (id, on) => change((switches) => withMod(switches, id, on)),
    setOption: (modId, optionId, on) =>
      change((switches) => withOption(switches, modId, optionId, on))
  }
})

/**
 * Rules that live in shared code, which holds no switches of its own, are told theirs here:
 * at once, and again whenever a switch moves.
 */
function tellSharedRules(switches: ModSwitches): void {
  setEchoBonusEnabled(modOn(switches, 'echo'))
}
tellSharedRules(useModsStore.getState().switches)
useModsStore.subscribe((state) => tellSharedRules(state.switches))

// The game's hooks ask only the mods that are on, in the order the list names them. Inside a
// game, a mod scoped to the playthrough is on as the game's record says, not as the switch now
// stands; on the menus, with no game entered, the switches decide. So either one moving is a
// change: a switch, or the record as a game is entered or left.
//
// An installed mod is also on only while it is running this session: one that is not (it needs
// an update, something it requires is missing, its code failed) is asked nothing, wherever its
// switch stands, and nothing is written. A library has no switch: it is on while a mod that is
// on requires it.
function isOn(modId: string, seen: readonly string[] = []): boolean {
  if (!useModSessionStore.getState().running(modId)) return false
  const mod = modById(modId)
  if (mod?.library) {
    return MODS.some(
      (other) => other.requires?.includes(modId) && !seen.includes(other.id) && isOn(other.id, [...seen, modId])
    )
  }
  return modOn(useModsStore.getState().switches, modId, enrollmentRecord ?? loopState.record)
}

const rules = {
  isOn: (modId: string) => isOn(modId),
  order: (modId: string) => MODS.findIndex((mod) => mod.id === modId),
  subscribe: (onChange: () => void) => {
    const stopSwitches = useModsStore.subscribe((state, before) => {
      if (state.switches !== before.switches) onChange()
    })
    const stopRecord = subscribeLoopRecord(onChange)
    const stopSession = useModSessionStore.subscribe((state, before) => {
      if (state.table !== before.table || state.shiftStart !== before.shiftStart) onChange()
    })
    return () => {
      stopSwitches()
      stopRecord()
      stopSession()
    }
  }
}
setHookRules(rules)
setSharedModRules(rules.isOn)

/** Whether a mod is on, for code outside a component; see `modOn` for what a record changes. */
export function modIsOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean {
  return useModSessionStore.getState().running(id) && modOn(useModsStore.getState().switches, id, record === undefined ? enrollmentRecord : record)
}

/** Whether a mod is on, for a component: it renders again when the switch moves. */
export function useModOn(id: string, record?: Pick<PlaythroughRecord, 'mods'> | null): boolean {
  const running = useModSessionStore((s) => s.running(id))
  return useModsStore((s) => running && modOn(s.switches, id, record))
}

/** Where a mod's option stands outside a component, using its declared default when unset. */
export function modOptionOn(modId: string, optionId: string): boolean {
  return optionOn(useModsStore.getState().switches, modId, optionId)
}

/** Where one of a mod's options stands, for a component. */
export function useModOption(modId: string, optionId: string): boolean {
  return useModsStore((s) => optionOn(s.switches, modId, optionId))
}

/** Bind shared catalogs to the current record, or to the switches while creating a game. */
function syncCityLife(): void {
  const game = useGameStore.getState()
  const record = enrollmentRecord ?? (game.playthroughId ? { mods: [...game.playthroughMods] } : null)
  setCityLifeEnabled(modIsOn(CITY_LIFE_LOCATIONS_MOD, record), modIsOn(CITY_LIFE_JOBS_MOD, record))
}
useModsStore.subscribe(syncCityLife)
useGameStore.subscribe((state, previous) => {
  if (state.playthroughId !== previous.playthroughId || state.playthroughMods !== previous.playthroughMods) syncCityLife()
})
syncCityLife()
