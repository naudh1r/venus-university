import { app, BrowserWindow, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { readFileSync } from 'fs'
import { basename, resolve } from 'path'
import type { ModSessionTable, ModStatus, SafeStart } from '@shared/modSession'
import { BUILD, MODS, setInstalledMods } from '@shared/mods'
import type { Settings } from '@shared/types'
import { getModsDirPath, getSettingsPath } from '../paths'
import { bindModSession } from '../services/modsService'
import { patchStoredSettings } from '../services/settingsService'
import { addDevFolder, devFolders, removeDevFolder, watchDevFolder, type DevChangeKind } from './devFolders'
import { loadMods, type LoaderResult } from './loader'
import { handleModProtocol } from './protocol'
import type { MainContext } from './require'
import { ModInvocations } from './invoke'

/**
 * The one mod session of this run: the loader's result, held for the protocol, the bridge and
 * the Mods screen. Started at the top of `main/index.ts`, before the schemes are registered;
 * everything it does before `ready` is synchronous.
 */

let result: LoaderResult | null = null
const invocations = new ModInvocations()

/**
 * The ids of the mods built into this copy of the game, read before the loader adds an installed one
 * to the list: what it refuses a second copy of.
 */
const BUILT_IN_IDS: readonly string[] = MODS.map((mod) => mod.id)

/**
 * Holds a loader run as the session's, and makes the installed part of `MODS` what its table carries,
 * for every status with a definition, as the window gets from its copy of the table: main's shared
 * rules ask the one list, and an installed mod the list did not hold would answer off whatever its
 * switch. A rerun replaces a definition that changed and drops one whose row lost its definition or
 * is gone, so a mod a developer folder no longer holds cannot answer on from a stale entry.
 */
function hold(next: LoaderResult): void {
  invocations.replace(next.table, next.invokes)
  result = next
  setInstalledMods(next.table.mods.flatMap((mod) => (mod.def ? [mod.def] : [])), BUILT_IN_IDS)
}

/** The export names of the host modules, as the renderer reported them once it had parked them. */
let hostNames: Readonly<Record<string, readonly string[]>> | null = null

/**
 * The two loader fields of `settings.json`, read without the settings service: the loader runs
 * before `ready`, synchronously, and a settings file that will not read is the renderer's to
 * report. Either field missing or malformed reads as its default.
 */
function loaderSettings(): { devFolders: string[]; allowUnreviewedMain: boolean } {
  try {
    const raw = JSON.parse(readFileSync(getSettingsPath(), 'utf8')) as Partial<Settings>
    const folders = Array.isArray(raw.devModFolders) ? raw.devModFolders.filter((f): f is string => typeof f === 'string') : []
    return { devFolders: folders, allowUnreviewedMain: raw.allowUnreviewedMain === true }
  } catch {
    return { devFolders: [], allowUnreviewedMain: false }
  }
}

/** `--no-mods` on the command line: the game starts as core, with the installed mods listed but not run. */
function safeStartOf(): SafeStart {
  return app.commandLine.hasSwitch('no-mods') ? 'flag' : null
}

/** Runs the loader. Called once, before the schemes are registered. */
export function startModSession(): void {
  const { devFolders, allowUnreviewedMain } = loaderSettings()
  hold(
    loadMods({
      modsDir: getModsDirPath(),
      devFolders,
      allowUnreviewedMain,
      builtIn: BUILT_IN_IDS,
      coreVersion: BUILD.version,
      gameVersion: app.getVersion(),
      safeStart: safeStartOf(),
      log: (line) => console.log(line),
      warn: (line) => console.warn(line)
    })
  )
  bindModSession(modSession)
}

/** The table as it stands; empty until {@link startModSession} has run. */
export function modSession(): ModSessionTable {
  return result?.table ?? { mods: [], order: [], safeStart: null, loaderError: null, coreVersion: BUILD.version }
}

/**
 * Re-reads the manifests and reruns every check without requiring any `main.js` again: each one
 * already required hands back what it exported the first time. What the window reads on its next
 * load is then this run's table, and `MODS` holds its definitions.
 */
export function rerunModChecks(): void {
  const before = result
  const { devFolders, allowUnreviewedMain } = loaderSettings()
  const next = loadMods({
    modsDir: getModsDirPath(),
    devFolders,
    allowUnreviewedMain,
    builtIn: BUILT_IN_IDS,
    coreVersion: BUILD.version,
    gameVersion: app.getVersion(),
    safeStart: safeStartOf(),
    log: (line) => console.log(line),
    warn: (line) => console.warn(line),
    requireMain: (ctx: MainContext) => {
      if (before?.mainExports.has(ctx.id)) return before.mainExports.get(ctx.id)
      // A mod whose main.js was not required at the first start cannot start now: main code is
      // loaded once, at start.
      throw new Error('main.js changed or was added since the start; restart to load it')
    }
  })
  // The routes a `main.js` registered at start stand for the session.
  const invokes = new Map([...next.invokes].map(([id, handlers]) => [id, before?.invokes.get(id) ?? handlers]))
  hold(before ? { ...next, routes: before.routes, invokes } : next)
}

/** Dispatches the start/result handshake; main makes the request id before the window can cancel it. */
export function invokeMod(owner: number, id: unknown, request: unknown): unknown {
  return invocations.dispatch(owner, id, request)
}

/** Cancels a checked mod's own request, without reaching the general jobs channel. */
export function cancelModInvoke(owner: number, id: unknown, requestId: unknown): void {
  invocations.cancel(owner, id, requestId)
}

/** Ends the calls a window left behind, including requests not yet claimed by the handshake. */
export function dropModInvokes(owner: number): void {
  invocations.dropOwner(owner)
}

/** Serves `vxmod://`, and watches the developer folders. Must run after `ready`. */
export function handleModSession(): void {
  handleModProtocol({
    served: () => result?.served ?? new Map(),
    routes: () => result?.routes ?? new Map(),
    hostNames: () => hostNames
  })
  for (const folder of loaderSettings().devFolders) watchDevFolder(folder, devFolderChanged)
}

/** Marks a mod the renderer could not load as off for the session, so `vxmod://<id>/…` stops serving it. */
function markFailed(id: string, status: ModStatus, message: string): void {
  if (!result) return
  const entry = result.table.mods.find((mod) => mod.id === id)
  if (!entry || entry.status !== 'loaded') return
  entry.status = status
  entry.message = message
  const served = new Map(result.served)
  const servedEntry = served.get(id)
  if (servedEntry) served.set(id, { ...servedEntry, loaded: false })
  result = { ...result, served, table: { ...result.table, order: result.table.order.filter((one) => one !== id) } }
  const invokes = new Map(result.invokes)
  invokes.delete(id)
  result = { ...result, invokes }
  invocations.replace(result.table, invokes)
  console.warn(`[mods] ${id}: ${status}: ${message}`)
}

/**
 * A developer folder changed. For a renderer-side change the checks are rerun first, so the
 * reload the window makes reads a fresh table; `main.js` cannot be swapped in place, so that is
 * only told. Every window hears of it and decides what to offer.
 */
function devFolderChanged(folder: string, kind: DevChangeKind, files: readonly string[]): void {
  const id = result?.table.mods.find((mod) => mod.dev && mod.folder === resolve(folder))?.id ?? basename(folder)
  if (kind === 'renderer') rerunModChecks()
  console.log(`[mods] ${id}: ${kind === 'main' ? 'main.js' : files.join(', ')} changed in ${folder}`)
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.webContents.isDestroyed()) window.webContents.send('mods:devChanged', { id, kind })
  }
}

/** Registers `ipcMain.handle` for one channel, answering a `Result` as the rest of the bridge does. */
type Handle = <Args extends unknown[], T>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
) => void

/** The session's channels: the table, read synchronously by the preload, and the rest through `handle`. */
export function registerModIpc(handle: Handle): void {
  // Synchronous: `MODS` has to hold the installed mods before any module in the window reads it.
  ipcMain.on('mods:session', (event) => {
    event.returnValue = modSession()
  })
  handle('mods:exposeHost', (_event, names: Record<string, string[]>) => {
    hostNames = names
  })
  handle('mods:failed', (_event, id: string, status: ModStatus, message: string) => {
    markFailed(id, status, typeof message === 'string' ? message : String(message))
  })
  handle('mods:noticesSeen', async (_event, seen: Record<string, string>) => {
    await patchStoredSettings((settings) => ({ ...settings, modNoticesSeen: { ...settings.modNoticesSeen, ...seen } }))
  })
  handle('mods:addDevFolder', async (event) => {
    const folder = await addDevFolder(event)
    if (folder) watchDevFolder(folder, devFolderChanged)
    return folder
  })
  handle('mods:removeDevFolder', (_event, folder: string) => removeDevFolder(folder))
  handle('mods:devFolders', () => devFolders())
  handle('mods:restart', () => {
    app.relaunch()
    app.exit(0)
  })
}
