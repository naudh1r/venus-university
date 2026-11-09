import type { Manifest } from '@vx/modkit/host/shared'
import type { ModDef } from './mods'

/**
 * The session table: what the main-process loader found under `data/mods/` and in the developer
 * folders at this start, and what became of each mod. Built once before the window opens, read
 * by the preload synchronously, and the one thing the renderer knows about installed mods
 * before their code runs. Plain data, so it crosses the bridge as it is.
 */

/**
 * Where an installed mod stands this session. Only `loaded` runs; every other status carries a
 * one-line `message` for the Mods screen's row and the notice at start.
 *
 * - `loaded`: running this session.
 * - `needs-update`: it uses a hook or kit API this core does not have, or a library export that is gone.
 * - `refused`: its manifest is unreadable or wrong, its folder disagrees with it, it registered a
 *   hook it did not declare, or its code read a kit API it did not declare.
 * - `failed`: its code threw while loading.
 * - `blocked`: something it requires is missing, out of range or not loaded, or it is in a cycle.
 * - `not-permitted`: it has main-process code and its source is not trusted to run it.
 */
export type ModStatus = 'loaded' | 'needs-update' | 'refused' | 'failed' | 'blocked' | 'not-permitted'

/** One installed mod, or one folder whose manifest could not be read (then `manifest` is null). */
export interface ModSessionEntry {
  /** The manifest's id, or the folder's name while the manifest could not be read. */
  id: string
  manifest: Manifest | null
  /** The manifest as `MODS` lists it; null where the manifest could not be read. */
  def: ModDef | null
  status: ModStatus
  /** Why it is not running, in one line; null while `loaded`. */
  message: string | null
  /** Quieter notes for the row: deprecated hooks, a `game` range this version is outside of, a dev folder standing in for the installed copy. */
  warnings: string[]
  /** The folder the mod runs from: its version folder, or the developer folder. */
  folder: string
  /** From a developer folder rather than `data/mods/`. */
  dev: boolean
  /** `vxmod://<id>/renderer.js` where the file exists. */
  renderer: string | null
  /** `vxmod://<id>/style.css` where the file exists. */
  style: string | null
}

/** Why no installed mod's code is running this session, where none is. */
export type SafeStart = 'flag' | 'shift' | null

export interface ModSessionTable {
  /** Every mod found, by id. */
  mods: ModSessionEntry[]
  /** The ids whose status is `loaded`, in load order: dependencies before the mods that require them. */
  order: string[]
  /** Started with `--no-mods`: nothing under `data/mods/` was read past its manifest, and nothing runs. */
  safeStart: SafeStart
  /** The loader itself threw: every installed mod is off for the session, and this says why. */
  loaderError: string | null
  /**
   * The build's version (`BUILD.version`), which the messages name as core's. A manifest's `game`
   * range is held to the game's own version instead.
   */
  coreVersion: string
}

/** The table a build with no installed mods has; the web build's too. */
export const EMPTY_SESSION: ModSessionTable = {
  mods: [],
  order: [],
  safeStart: null,
  loaderError: null,
  coreVersion: ''
}

/**
 * The table's row standing for the mod of that id: the one with a definition. A row without one
 * (a manifest that could not be read, a copy of a mod the build already carries) is listed by its
 * folder and stands for no mod.
 */
export function sessionRow(table: ModSessionTable, id: string): ModSessionEntry | undefined {
  return table.mods.find((mod) => mod.id === id && mod.def !== null)
}

/** A built-in's row: the build's own, with no manifest and no folder. */
export function isBuiltInRow(row: ModSessionEntry): boolean {
  return row.manifest === null && row.folder === ''
}

/**
 * Whether a mod's code is running this session: true for one the table does not hold (an in-repo
 * one), else only while its row is `loaded` and nothing stopped every installed mod.
 */
export function isRunning(table: ModSessionTable, id: string): boolean {
  const row = sessionRow(table, id)
  if (!row) return true
  // A built-in's row is the build's own: only its own status counts.
  if (isBuiltInRow(row)) return row.status === 'loaded'
  return row.status === 'loaded' && table.loaderError === null && table.safeStart === null
}

/** The mods that are running this session, by id. */
export function loadedIds(table: ModSessionTable): Set<string> {
  return new Set(table.mods.filter((mod) => mod.status === 'loaded').map((mod) => mod.id))
}

/**
 * The modules a mod's `renderer.js` keeps external, by the file `vxmod://host/` serves each under.
 * The page's import map (`index.html`) names the same files, and `renderer/mods/host.ts` exposes
 * the same modules; a test holds the three together. `@vx/modkit/main` is served too, as a module
 * that throws: it runs in the main process only.
 */
export const HOST_MODULES = {
  'react.js': 'react',
  'react-jsx-runtime.js': 'react/jsx-runtime',
  'react-dom.js': 'react-dom',
  'react-dom-client.js': 'react-dom/client',
  'motion-react.js': 'motion/react',
  'kit-shared.js': '@vx/modkit/shared',
  'kit-renderer.js': '@vx/modkit/renderer'
} as const

/** The file `@vx/modkit/main` maps to, which refuses to load in the window. */
export const MAIN_SHIM_FILE = 'kit-main.js'

/** The key the renderer parks the live host modules under on `globalThis`, for the shims to read. */
export const HOST_SYMBOL = 'vx.host'

/** The address a mod's file is served from. */
export function modFileUrl(id: string, file: string): string {
  return `vxmod://${id}/${file}`
}

/** The address a mod's route answers at: `vxmod://<id>/@/<route>`. */
export function modRouteUrl(id: string, route: string): string {
  return `vxmod://${id}/@/${route}`
}
