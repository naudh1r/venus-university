import { create } from 'zustand'
import { modById, MODS } from '@shared/mods'
import { isRunning, sessionRow, type ModSessionEntry, type ModSessionTable, type ModStatus } from '@shared/modSession'
import type { PlaythroughRecord } from '@shared/types'
import { startTable } from '../installedMods'

/**
 * The installed mods this session: main's table as the window started with it, and what the
 * window itself found while importing each `renderer.js`. The hooks ask here whether a mod is
 * running before they ask its switch; the Mods screen reads each row's standing here; the notice
 * at start and the game's own notice are raised from here.
 */

/** A developer folder changed on disk; what the toast offers depends on which file. */
export interface DevChange {
  id: string
  kind: 'renderer' | 'main'
}

/**
 * What one of the notices says: its title, and a line per mod. `unversioned` alone is the quiet
 * one, a line under the game and no mods: the game being entered was started before mods
 * recorded their versions.
 */
export interface ModNotice {
  kind: 'start' | 'game' | 'unversioned'
  mods: ModSessionEntry[]
  /**
   * On the game's notice, by id: the version this game was played with, for each mod named whose
   * installed version is another.
   */
  playedWith?: Readonly<Record<string, string>>
  /** On the game's notice: the game was started before mods recorded their versions, said there too. */
  unversioned?: boolean
}

/** The line a game started before mods recorded their versions is entered with. */
export const UNVERSIONED_LINE = 'This game was started before mods recorded their versions.'

interface ModSessionState {
  table: ModSessionTable
  /** Shift was held at start: nothing installed was imported, whatever the table says. */
  shiftStart: boolean
  notice: ModNotice | null
  devChange: DevChange | null
  /** What the game being played could not do with a mod's data, by id: a line for its row. */
  dataNotes: Readonly<Record<string, string>>
  /** The playthroughs told this session that they were started before mods recorded their versions. */
  unversionedTold: ReadonlySet<string>

  /** Whether an installed mod's code is running; true for a mod that is not installed (an in-repo one). */
  running: (id: string) => boolean
  /** Turns a mod off for the session: nothing of it is asked, its files stop being served, its data is kept. */
  markFailed: (id: string, status: ModStatus, message: string) => void
  setShiftStart: () => void
  /** Raises the start notice for the mods not running that the player has not been told of at this version. */
  noticeAtStart: (seen: Readonly<Record<string, string>>) => void
  /**
   * Raises the game's notice where its record names a `playthrough` mod that is not running, and
   * says once of a playthrough whose record holds no versions that it was started before mods
   * recorded them; `seen` is the playthroughs told so in an earlier session.
   */
  gameEntered: (
    record: Pick<PlaythroughRecord, 'mods' | 'modVersions'>,
    playthroughId: string,
    seen: readonly string[]
  ) => void
  dismissNotice: () => void
  setDevChange: (change: DevChange | null) => void
  /** Puts a line about the mod's data in this game on its row. */
  noteData: (id: string, line: string) => void
  /** Takes the notes away, as a game is left or another is loaded. */
  clearDataNotes: () => void
}

/** What the start notice remembers a mod by: its version, or the fact that its manifest could not be read. */
export function noticeKeyOf(mod: ModSessionEntry): string {
  return mod.manifest?.version ?? 'unreadable'
}

/** The one line a row and the notice say of a mod that is not running. */
export function notRunningLine(mod: ModSessionEntry, table: ModSessionTable, shiftStart: boolean): string {
  if (table.loaderError) return table.loaderError
  if (shiftStart) return 'started with Shift held: no installed mod is running'
  if (table.safeStart === 'flag') return 'started with --no-mods: no installed mod is running'
  return mod.message ?? mod.status
}

export const useModSessionStore = create<ModSessionState>((set, get) => ({
  table: startTable,
  shiftStart: false,
  notice: null,
  devChange: null,
  dataNotes: {},
  unversionedTold: new Set(),

  running: (id) => {
    const { table, shiftStart } = get()
    if (!sessionRow(table, id)) return true
    return isRunning(table, id) && !shiftStart
  },

  markFailed: (id, status, message) => {
    const { table } = get()
    const mod = sessionRow(table, id)
    if (!mod || mod.status !== 'loaded') return
    console.error(`[mods] ${id}: ${status}: ${message}`)
    set({
      table: {
        ...table,
        mods: table.mods.map((one) => (one.id === id ? { ...one, status, message } : one)),
        order: table.order.filter((one) => one !== id)
      }
    })
    void window.api.mods.failed(id, status, message)
  },

  setShiftStart: () => set({ shiftStart: true }),

  noticeAtStart: (seen) => {
    const { table, running } = get()
    // A library that is not running is named by its dependents' rows, not by a line of its own.
    // A row with no definition stands for no mod, so it is named by itself.
    const silent = table.mods.filter((mod) => (mod.def === null || !running(mod.id)) && !mod.def?.library && seen[mod.id] !== noticeKeyOf(mod))
    if (silent.length === 0) return
    set({ notice: { kind: 'start', mods: silent } })
    void window.api.mods.noticesSeen(Object.fromEntries(silent.map((mod) => [mod.id, noticeKeyOf(mod)])))
  },

  gameEntered: (record, playthroughId, seen) => {
    const { table, running, notice, unversionedTold } = get()
    const missing = table.mods.filter(
      (mod) => record.mods?.includes(mod.id) && modById(mod.id, MODS)?.scope === 'playthrough' && !running(mod.id)
    )
    // No map is a record from before the versions were kept (a new one holds an empty map where
    // no mod was on); a build with no mod has nothing to say of it. Said once a playthrough,
    // however often and in however many sessions the same game is entered.
    const unversioned =
      record.modVersions === undefined &&
      MODS.some((mod) => !mod.library) &&
      !unversionedTold.has(playthroughId) &&
      !seen.includes(playthroughId)
    const told = unversioned ? { unversionedTold: new Set([...unversionedTold, playthroughId]) } : {}
    if (missing.length > 0) {
      const playedWith = Object.fromEntries(
        missing.flatMap((mod) => {
          const played = record.modVersions?.[mod.id]
          return played !== undefined && played !== modById(mod.id, MODS)?.version ? [[mod.id, played]] : []
        })
      )
      set({
        notice: {
          kind: 'game',
          mods: missing,
          ...(Object.keys(playedWith).length > 0 ? { playedWith } : {}),
          ...(unversioned ? { unversioned } : {})
        },
        ...told
      })
    } else if (unversioned && notice === null) {
      // The quiet one never stands in for a notice already up; it is said on a later entry instead.
      set({ notice: { kind: 'unversioned', mods: [] }, ...told })
    } else {
      return
    }
    // Said, so kept on disk: the next session does not say it of this playthrough again.
    if (unversioned) void window.api.mods.unversionedSeen(playthroughId)
  },

  dismissNotice: () => set({ notice: null }),

  setDevChange: (devChange) => set({ devChange }),

  noteData: (id, line) => set((state) => ({ dataNotes: { ...state.dataNotes, [id]: line } })),

  clearDataNotes: () => {
    if (Object.keys(get().dataNotes).length > 0) set({ dataNotes: {} })
  }
}))
