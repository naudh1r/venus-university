import { existsSync, readFileSync, statSync } from 'fs'
import { basename, join, resolve } from 'path'
import { checkCompat, hookNameKind, modDefOf, parseManifest } from '@vx/modkit/host/shared'
import { satisfies } from '../../../packages/modkit/src/shared/range'
import { modFileUrl, type ModSessionEntry, type ModSessionTable, type ModStatus, type SafeStart } from '@shared/modSession'
import { findInstalledMods, readInstalled } from './layout'
import { orderMods, type OrderInput } from './order'
import { requireMain as requireMainFile, UndeclaredApiError, type MainContext } from './require'
import type { ServedMod } from './resolve'
import { INVOKE_NAME_RULE, type InvokeHandler } from './invoke'

/**
 * The main-process loader: finds every installed mod and developer folder, reads and checks the
 * manifests, orders the mods by what they require, decides which may run main-process code, and
 * requires each `main.js` in that order. It produces the session table the renderer reads before
 * any mod code runs, and the routes and folders the `vxmod://` protocol serves. Everything here
 * runs before `app.whenReady()`, synchronously, on plain `fs` reads.
 */

/** A handler one `main.js` exports under `protocols`, answering `vxmod://<id>/@/<route>/…`. */
export type RouteHandler = (request: Request) => Response | Promise<Response> | string | Uint8Array

export interface LoaderInput {
  /** `data/mods`. */
  readonly modsDir: string
  /** The developer folders `settings.json` names, each an unzipped release. */
  readonly devFolders: readonly string[]
  /** Whether main-process code from a source the build has not reviewed may run. */
  readonly allowUnreviewedMain: boolean
  /**
   * The ids of the mods built into this copy of the game: the list as it was before any installed
   * mod joined it. A folder with one of these ids is refused; the build's own copy runs.
   */
  readonly builtIn: readonly string[]
  /** The build's version (`BUILD.version`), which the table and the messages name as core's. */
  readonly coreVersion: string
  /** The game's version (`app.getVersion()`), which a manifest's `game` range is held against. */
  readonly gameVersion: string
  /** Why nothing is to run this session, where that is so. */
  readonly safeStart: SafeStart
  /** Where the loader's own lines go. */
  readonly log: (line: string) => void
  /** Where its warnings go: a line about something it went on without. */
  readonly warn: (line: string) => void
  /** Requires one `main.js`; the real one unless a test, or a rerun, stands in. */
  readonly requireMain?: (ctx: MainContext) => unknown
}

export interface LoaderResult {
  readonly table: ModSessionTable
  /** Each loaded mod's route handlers, by id then by route name. */
  readonly routes: ReadonlyMap<string, ReadonlyMap<string, RouteHandler>>
  /** Each mod as the protocol serves it, by id. */
  readonly served: ReadonlyMap<string, ServedMod>
  /** What each loaded `main.js` exported, by id, for a rerun to hand back without requiring it again. */
  readonly invokes: ReadonlyMap<string, ReadonlyMap<string, InvokeHandler>>
  readonly mainExports: ReadonlyMap<string, unknown>
}

/** The route names a `main.js` may export: lower case, digits, dashes. */
const ROUTE_RULE = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** One mod as the loader works on it, before it becomes a row of the table. */
interface Candidate {
  entry: ModSessionEntry
  hasMain: boolean
  approved: boolean
  /** The `hooks` names that are hooks or kit APIs; the library exports are checked apart. */
  declaredCore: string[]
}

function isFile(path: string): boolean {
  return statSync(path, { throwIfNoEntry: false })?.isFile() ?? false
}

/**
 * A row with no definition, under the folder's name: a manifest that could not be read, or a copy
 * of a mod the build already carries. It stands for no mod of the list, so a mod of that id in
 * the build keeps running.
 */
function unreadable(id: string, folder: string, dev: boolean, message: string): Candidate {
  return {
    entry: { id, manifest: null, def: null, status: 'refused', message, warnings: [], folder, dev, renderer: null, style: null },
    hasMain: isFile(join(folder, 'main.js')),
    approved: false,
    declaredCore: []
  }
}

/**
 * Reads one folder's manifest into a candidate: refused where it cannot be read or disagrees with
 * the folder. `approved` is the installer's word on the install, read from its record beside the
 * folders; nothing inside the folder counts.
 */
function readCandidate(folder: string, expect: { id: string; version: string } | null, dev: boolean, approved: boolean, builtIn: readonly string[]): Candidate {
  const name = expect?.id ?? basename(folder)
  const manifestPath = join(folder, 'vxmod.json')
  let json: unknown
  try {
    json = JSON.parse(readFileSync(manifestPath, 'utf8'))
  } catch (err) {
    const reason = (err as NodeJS.ErrnoException).code === 'ENOENT' ? 'has no vxmod.json' : `vxmod.json cannot be read: ${(err as Error).message}`
    return unreadable(name, folder, dev, reason)
  }
  const parsed = parseManifest(json, expect)
  if (!parsed.ok) return unreadable(name, folder, dev, parsed.error)
  const manifest = parsed.manifest
  // The build's own copy is in the bundle already; a second one would answer every hook twice.
  if (builtIn.includes(manifest.id)) return unreadable(name, folder, dev, 'already part of this build')
  const hasMain = isFile(join(folder, 'main.js'))
  const candidate: Candidate = {
    entry: {
      id: manifest.id,
      manifest,
      def: modDefOf(manifest),
      status: 'loaded',
      message: null,
      warnings: [],
      folder,
      dev,
      renderer: isFile(join(folder, 'renderer.js')) ? modFileUrl(manifest.id, 'renderer.js') : null,
      style: isFile(join(folder, 'style.css')) ? modFileUrl(manifest.id, 'style.css') : null
    },
    hasMain,
    approved,
    declaredCore: manifest.hooks.filter((hook) => hookNameKind(hook).kind !== 'export')
  }
  if (manifest.main !== hasMain) {
    fail(candidate, 'refused', hasMain ? 'has a main.js but its manifest says main: false' : 'says main: true but has no main.js')
  }
  return candidate
}

function fail(candidate: Candidate, status: ModStatus, message: string): void {
  if (candidate.entry.status !== 'loaded') return
  candidate.entry.status = status
  candidate.entry.message = message
}

/** Every folder's candidate: the installed mods, then the developer folders, one entry per id. */
function findCandidates(input: LoaderInput): Candidate[] {
  const found = findInstalledMods(input.modsDir)
  const installed = readInstalled(input.modsDir)
  for (const note of [...found.notes, ...installed.notes]) input.log(`[mods] ${note}`)
  const candidates: Candidate[] = []
  for (const mod of found.mods) {
    for (const note of mod.notes) input.log(`[mods] ${note}`)
    if (mod.version === null || mod.problem !== null) {
      candidates.push(unreadable(mod.id, mod.folder, false, mod.problem ?? 'no version folder'))
      continue
    }
    candidates.push(readCandidate(mod.folder, { id: mod.id, version: mod.version }, false, installed.approved(mod.id, mod.version), input.builtIn))
  }

  const devCandidates = input.devFolders.map((folder) => readCandidate(resolve(folder), null, true, false, input.builtIn))
  for (const dev of devCandidates) {
    if (dev.entry.manifest === null) {
      candidates.push(dev)
      continue
    }
    const twin = devCandidates.find((other) => other !== dev && other.entry.manifest?.id === dev.entry.id)
    if (twin) {
      fail(dev, 'refused', `two developer folders have the id ${dev.entry.id}: ${dev.entry.folder} and ${twin.entry.folder}`)
      // One row per id in `MODS`: the second folder keeps its line, not its definition.
      if (devCandidates.indexOf(twin) < devCandidates.indexOf(dev)) dev.entry.def = null
      candidates.push(dev)
      continue
    }
    const installedAt = candidates.findIndex((one) => one.entry.manifest?.id === dev.entry.id)
    if (installedAt >= 0) {
      const installed = candidates[installedAt]
      dev.entry.warnings.push(`standing in for the installed ${installed.entry.manifest?.version ?? ''} this session`.replace(/\s+/g, ' '))
      candidates.splice(installedAt, 1)
    }
    candidates.push(dev)
  }
  return candidates
}

/** Holds each readable manifest's hooks and APIs to core, and its `game` range to the game's version. */
function checkCandidates(candidates: Candidate[], gameVersion: string): void {
  for (const candidate of candidates) {
    const manifest = candidate.entry.manifest
    if (!manifest || candidate.entry.status !== 'loaded') continue
    const compat = checkCompat(candidate.declaredCore)
    if (compat.status !== 'loads') {
      fail(candidate, compat.status === 'needs-update' ? 'needs-update' : 'refused', compat.message)
      continue
    }
    for (const hook of compat.deprecated) {
      candidate.entry.warnings.push(`uses \`${hook.name}\`, going in core ${hook.goesIn} (replaced by \`${hook.replacedBy}\`)`)
    }
    if (manifest.game !== undefined && !satisfies(gameVersion, manifest.game)) {
      candidate.entry.warnings.push(`made for Venus University ${manifest.game}; this is ${gameVersion}`)
    }
  }
}

/** Blocks what cannot load for what it requires, and answers the load order of the rest. */
function orderCandidates(candidates: Candidate[], warn: (line: string) => void): { order: readonly string[]; optionalPresent: Readonly<Record<string, readonly string[]>> } {
  const byId = new Map(candidates.filter((one) => one.entry.manifest).map((one) => [one.entry.id, one]))
  const inputs: OrderInput[] = [...byId.values()].map((one) => ({
    id: one.entry.id,
    name: one.entry.manifest?.name ?? one.entry.id,
    version: one.entry.manifest?.version ?? '0.0.0',
    loadable: one.entry.status === 'loaded',
    requires: one.entry.manifest?.requires,
    optional: one.entry.manifest?.optional
  }))
  const ordered = orderMods(inputs)
  for (const [id, message] of Object.entries(ordered.blocked)) {
    const candidate = byId.get(id)
    if (candidate) fail(candidate, 'blocked', message)
  }
  for (const [id, warnings] of Object.entries(ordered.warnings)) byId.get(id)?.entry.warnings.push(...warnings)
  for (const [id, skipped] of Object.entries(ordered.optionalSkipped)) {
    for (const dep of skipped) warn(`[mods] ${id}: optional ${dep} is installed but did not load; running without it`)
  }

  // A library's exports are a contract like a hook's: a name a dependent uses must still be there.
  for (const id of ordered.order) {
    const candidate = byId.get(id)
    const manifest = candidate?.entry.manifest
    if (!candidate || !manifest || candidate.entry.status !== 'loaded') continue
    for (const hook of manifest.hooks) {
      const kind = hookNameKind(hook)
      if (kind.kind !== 'export') continue
      const library = byId.get(kind.library)?.entry.manifest
      if (!library || library.exports?.includes(kind.name)) continue
      fail(candidate, 'needs-update', `needs \`${hook}\`, which ${library.name} ${library.version} no longer has`)
      break
    }
  }
  return { order: ordered.order, optionalPresent: ordered.optionalPresent }
}

/** Whose `main.js` may run: an approved install's, a developer folder's, or anyone's with the setting on. */
function permitCandidates(candidates: Candidate[], allowUnreviewedMain: boolean): void {
  for (const candidate of candidates) {
    if (!candidate.hasMain || candidate.entry.status !== 'loaded') continue
    if (candidate.entry.dev || candidate.approved || allowUnreviewedMain) continue
    fail(
      candidate,
      'not-permitted',
      'has main-process code from a source the build has not reviewed; it runs only with allowUnreviewedMain on in settings.json'
    )
  }
}

/** The routes a `main.js` exported, checked; a scheme of its own, or a route named twice, refuses the mod. */
function routesOf(exported: unknown, id: string, log: (line: string) => void): Map<string, RouteHandler> {
  const routes = new Map<string, RouteHandler>()
  if (typeof exported !== 'object' || exported === null) return routes
  for (const key of Object.keys(exported)) {
    if (key !== 'protocols' && key !== 'invoke' && key !== '__esModule') log(`[mods] ${id}: main.js exports \`${key}\`, which this core does not read`)
  }
  const protocols = (exported as { protocols?: unknown }).protocols
  if (protocols === undefined) return routes
  if (!Array.isArray(protocols)) throw new Error('`protocols` is not a list')
  for (const entry of protocols as unknown[]) {
    if (typeof entry !== 'object' || entry === null) throw new Error('`protocols` has an entry that is not an object')
    const { scheme, route, handle } = entry as { scheme?: unknown; route?: unknown; handle?: unknown }
    if (scheme !== undefined) throw new Error(`\`protocols\` asks for a scheme of its own (${String(scheme)}); a mod has routes under vxmod://${id}/@/… only`)
    if (typeof route !== 'string' || !ROUTE_RULE.test(route)) throw new Error(`\`protocols\` has a route that is not lower-case words with dashes: ${String(route)}`)
    if (typeof handle !== 'function') throw new Error(`\`protocols\` route ${route} has no handle function`)
    if (routes.has(route)) throw new Error(`\`protocols\` names the route ${route} twice`)
    routes.set(route, handle as RouteHandler)
  }
  return routes
}

/** The named invoke handlers exported by one main.js, validated before either registry is installed. */
function invokesOf(exported: unknown, declared: readonly string[]): Map<string, InvokeHandler> {
  const handlers = new Map<string, InvokeHandler>()
  if (typeof exported !== 'object' || exported === null) return handlers
  const invoke = (exported as { invoke?: unknown }).invoke
  if (invoke === undefined) return handlers
  if (!declared.includes('invoke')) throw new UndeclaredApiError('invoke')
  if (typeof invoke !== 'object' || invoke === null || Array.isArray(invoke) ||
      (Object.getPrototypeOf(invoke) !== Object.prototype && Object.getPrototypeOf(invoke) !== null)) {
    throw new Error('`invoke` is not an object of handler functions')
  }
  for (const key of Reflect.ownKeys(invoke)) {
    const value = Object.getOwnPropertyDescriptor(invoke, key)
    if (typeof key !== 'string' || !INVOKE_NAME_RULE.test(key) || typeof value?.value !== 'function') {
      throw new Error('`invoke` needs lower-case method names and handler functions')
    }
    handlers.set(key, value.value as InvokeHandler)
  }
  return handlers
}

/**
 * Requires each loaded mod's `main.js` in load order. A throw is `failed`; a read of an undeclared
 * kit API is `refused`; either way the whole mod is off, and whatever requires it is blocked.
 */
function requireCandidates(
  candidates: Candidate[],
  order: readonly string[],
  optionalPresent: Readonly<Record<string, readonly string[]>>,
  input: LoaderInput
): { routes: Map<string, Map<string, RouteHandler>>; invokes: Map<string, Map<string, InvokeHandler>>; mainExports: Map<string, unknown> } {
  const byId = new Map(candidates.map((one) => [one.entry.id, one]))
  const routes = new Map<string, Map<string, RouteHandler>>()
  const invokes = new Map<string, Map<string, InvokeHandler>>()
  const mainExports = new Map<string, unknown>()
  const requireMain = input.requireMain ?? requireMainFile
  for (const id of order) {
    const candidate = byId.get(id)
    const manifest = candidate?.entry.manifest
    if (!candidate || !manifest || candidate.entry.status !== 'loaded') continue
    const required = Object.keys(manifest.requires ?? {})
    const gone = required.find((dep) => byId.get(dep)?.entry.status !== 'loaded')
    if (gone) {
      fail(candidate, 'blocked', `needs ${byId.get(gone)?.entry.manifest?.name ?? gone}, which did not load`)
      continue
    }
    // An optional dependency that was ordered first but whose main.js then failed is as if absent.
    const optional = (optionalPresent[id] ?? []).filter((dep) => {
      if (byId.get(dep)?.entry.status === 'loaded') return true
      input.warn(`[mods] ${id}: optional ${dep} is installed but did not load; running without it`)
      return false
    })
    const dependencies = new Set([...required, ...optional])
    if (!candidate.hasMain) continue
    try {
      const exported = requireMain({
        id,
        folder: candidate.entry.folder,
        file: join(candidate.entry.folder, 'main.js'),
        declared: new Set(manifest.hooks),
        dependencies,
        libraries: mainExports
      })
      const modRoutes = routesOf(exported, id, input.log)
      const modInvokes = invokesOf(exported, manifest.hooks)
      routes.set(id, modRoutes)
      invokes.set(id, modInvokes)
      mainExports.set(id, exported)
    } catch (err) {
      if (err instanceof UndeclaredApiError) fail(candidate, 'refused', `main.js reads ${err.message}`)
      else fail(candidate, 'failed', `main.js threw: ${err instanceof Error ? err.message : String(err)}`)
      input.log(`[mods] ${id}: ${candidate.entry.message}`)
      if (err instanceof Error && err.stack) input.log(err.stack)
    }
  }
  return { routes, invokes, mainExports }
}

function tableOf(candidates: Candidate[], order: readonly string[], input: LoaderInput, loaderError: string | null): ModSessionTable {
  const mods = candidates.map((one) => one.entry)
  return {
    mods,
    order: order.filter((id) => mods.some((mod) => mod.id === id && mod.status === 'loaded')),
    safeStart: input.safeStart,
    loaderError,
    coreVersion: input.coreVersion
  }
}

function servedOf(table: ModSessionTable): Map<string, ServedMod> {
  const served = new Map<string, ServedMod>()
  for (const mod of table.mods) {
    if (mod.manifest === null) continue
    served.set(mod.id, { id: mod.id, folder: mod.folder, dev: mod.dev, loaded: mod.status === 'loaded' && table.loaderError === null && table.safeStart === null })
  }
  return served
}

/**
 * Runs the loader once. Its own failure turns every installed mod off for the session, with the
 * table saying why, and the game starts as core; nothing here ever writes to disk.
 */
export function loadMods(input: LoaderInput): LoaderResult {
  let candidates: Candidate[] = []
  try {
    candidates = findCandidates(input)
    checkCandidates(candidates, input.gameVersion)
    const { order, optionalPresent } = orderCandidates(candidates, input.warn)
    permitCandidates(candidates, input.allowUnreviewedMain)
    if (input.safeStart !== null) {
      input.log(`[mods] started without mods (${input.safeStart}): nothing installed runs this session`)
      const table = tableOf(candidates, order, input, null)
      return { table, routes: new Map(), invokes: new Map(), served: servedOf(table), mainExports: new Map() }
    }
    const { routes, invokes, mainExports } = requireCandidates(candidates, order, optionalPresent, input)
    const table = tableOf(candidates, order, input, null)
    for (const mod of table.mods) {
      const line = mod.status === 'loaded' ? 'loaded' : `${mod.status}: ${mod.message ?? ''}`
      input.log(`[mods] ${mod.id} ${mod.manifest?.version ?? ''}${mod.dev ? ' (dev folder)' : ''}: ${line}`)
      for (const warning of mod.warnings) input.log(`[mods] ${mod.id}: ${warning}`)
    }
    return { table, routes, invokes, served: servedOf(table), mainExports }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    input.log(`[mods] the mod loader failed: ${message}`)
    if (err instanceof Error && err.stack) input.log(err.stack)
    const table = tableOf(candidates, [], input, `the mod loader failed: ${message}`)
    return { table, routes: new Map(), invokes: new Map(), served: servedOf(table), mainExports: new Map() }
  }
}

/** True where a folder holds a manifest at all: what the Mods screen's folder picker checks before adding one. */
export function looksLikeMod(folder: string): boolean {
  return existsSync(join(folder, 'vxmod.json'))
}
