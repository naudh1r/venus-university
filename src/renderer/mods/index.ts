/**
 * Every mod that plugs into the game's hooks, registered once at boot: each file in
 * `src/renderer/modEntries/`, named for the mod's id, is loaded here and calls `registerHooks`.
 * Nothing here names a mod. The order they load in does not matter: hooks are asked in the
 * order `MODS` lists the mods.
 */

// Held in a binding of its own, not read inline: Vite turns `Object.keys(import.meta.glob(…))`
// into the file names alone and never loads the files, and loading them is the point.
const loaded = import.meta.glob('../modEntries/*.ts', { eager: true })

/** The hook files loaded, for the log and the tests. */
export const REGISTERED = Object.keys(loaded)
