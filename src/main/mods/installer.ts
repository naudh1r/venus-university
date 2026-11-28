import { isDeepStrictEqual } from 'util'
import { parseManifest, resolveInstall, resolveRemoval, type InstalledMod, type InstallRequest } from '@vx/modkit/host/shared'
import { appError, toAppError } from '@shared/errors'
import type {
  FetchedModSource, ModInstallPlan, ModInstallProgress, ModPlan, ModPlanRequest, ModSourceResult,
  PendingModChanges
} from '@shared/modInstall'
import type { ModSessionTable } from '@shared/modSession'
import { satisfies } from '../../../packages/modkit/src/shared/range'
import { redactUrl } from '../services/downloadService'
import { checkInstallRelease, installPlan, revokeWithdrawn } from './install'
import { isModId, isModVersion, isRecord, modPath, readInstalledFile, readModText } from './installFiles'
import { findInstalledMods } from './layout'
import { queueRollback, readPending, scheduleOldVersionCleanup, withoutPendingChange, writePending } from './pending'

interface InstallerOptions {
  root: () => string
  builtIn: () => Readonly<Record<string, InstalledMod>>
  dev: () => Readonly<Record<string, InstalledMod>>
  allowUnreviewedMain: () => boolean
  readSources: () => Promise<ModSourceResult[]>
}

function fail(code: string, message: string): never {
  throw appError(code, message)
}

function installRequest(value: unknown): Extract<ModPlanRequest, { kind: 'install' }> {
  if (!isRecord(value) || value.kind !== 'install' || !isRecord(value.mods)) {
    fail('MOD_PLAN_REQUEST', 'Expected a mod install request.')
  }
  const mods = Object.entries(value.mods).map(([id, request]): [string, InstallRequest] => {
    if (!isModId(id) || !isRecord(request) || !isModVersion(request.version) || typeof request.source !== 'string') {
      fail('MOD_PLAN_REQUEST', 'A mod install request has an invalid id, version or source.')
    }
    return [id, { version: request.version, source: request.source }]
  })
  if (!mods.length) fail('MOD_PLAN_REQUEST', 'Choose at least one mod to install.')
  return { kind: 'install', mods: Object.fromEntries(mods) }
}

/** The disk versions that would be active if the app restarted now. */
function installedSnapshot(root: string, pending: PendingModChanges): Record<string, InstalledMod> {
  const { mods: records } = readInstalledFile(root)
  const versions = new Map(findInstalledMods(root).mods.flatMap(({ id, version }) =>
    isModId(id) && version ? [[id, version] as const] : []))
  for (const [id, version] of Object.entries(pending.current)) versions.set(id, version)
  for (const id of pending.remove) versions.delete(id)

  return Object.fromEntries([...versions].map(([id, version]) => {
    const text = readModText(modPath(root, id, version, 'vxmod.json'))
    const record = Object.hasOwn(records, id) ? records[id][version] : undefined
    let manifest
    if (text !== undefined) {
      try {
        const parsed = parseManifest(JSON.parse(text), { id, version })
        if (parsed.ok) manifest = parsed.manifest
      } catch {
        // A malformed manifest has no usable requirements. It can still be removed.
      }
    }
    return [id, { ...manifest, version, source: record?.source }]
  }))
}

function requiredBy(installed: Readonly<Record<string, InstalledMod>>, removed: ReadonlySet<string>): InstalledMod | undefined {
  return Object.values(installed).find((mod) => Object.keys(mod.requires ?? {}).some((id) => removed.has(id)))
}

/** Owns the shared write queue across installs, removals, undo, revocation and boot cleanup. */
export class ModInstaller {
  private last: Promise<unknown> = Promise.resolve()

  constructor(private readonly options: InstallerOptions) {}

  private queue<T>(work: () => T | Promise<T>): Promise<T> {
    const next = this.last.then(work)
    this.last = next.catch(() => {})
    return next
  }

  async idle(): Promise<void> {
    for (;;) {
      const last = this.last
      await last
      if (last === this.last) return
    }
  }

  private async fetchSources(): Promise<ModSourceResult[]> {
    const results = await this.options.readSources()
    for (const [index, result] of results.entries()) {
      if (!result.ok || !result.data.approvedList) continue
      try {
        await revokeWithdrawn(this.options.root(), result.data)
      } catch (error) {
        const failure = toAppError(error, 'MOD_INSTALL_RECORD')
        results[index] = {
          ok: false, approvedList: true, url: redactUrl(result.data.url),
          error: appError(failure.code, 'Could not update withdrawn mod approvals.')
        }
      }
    }
    return results
  }

  sources(): Promise<ModSourceResult[]> {
    return this.queue(() => this.fetchSources())
  }

  private protectedMods(): Readonly<Record<string, InstalledMod>> {
    return { ...this.options.dev(), ...this.options.builtIn() }
  }

  private installOptions() {
    return {
      builtIn: new Set(Object.keys(this.protectedMods())),
      allowUnreviewedMain: this.options.allowUnreviewedMain()
    }
  }

  private async resolve(request: Extract<ModPlanRequest, { kind: 'install' }>): Promise<{
    plan: ModInstallPlan; sources: FetchedModSource[]
  }> {
    const root = this.options.root()
    const sources = (await this.fetchSources()).flatMap((one) => one.ok ? [one.data] : [])
    const protectedMods = this.protectedMods()
    const options = this.installOptions()
    for (const [id, desired] of Object.entries(request.mods)) {
      if (options.builtIn.has(id)) fail('MOD_INSTALL_BUILT_IN', `${id} is part of this build or a developer folder.`)
      const source = sources.find((one) => one.url === desired.source)
      const mod = source?.source.mods.find((one) => one.id === id)
      const release = mod?.releases.find((one) => one.version === desired.version)
      if (source && release && !mod?.withdrawn?.some((one) => one.version === desired.version)) {
        checkInstallRelease(source, release, options)
      }
    }
    const result = resolveInstall({
      installed: installedSnapshot(root, readPending(root)), builtIn: protectedMods, request: request.mods, sources
    })
    if (!result.ok) {
      const message = sources.reduce((line, source) => line.replaceAll(source.url, redactUrl(source.url)), result.error)
      fail('MOD_INSTALL_PLAN', message)
    }

    const trusted = new Map(result.install.map((change) => [
      change.id, checkInstallRelease(sources.find((source) => source.url === change.source)!, change.release, options)
    ]))
    for (const change of result.install) {
      if (!trusted.get(change.id)) continue
      const dependency = Object.keys(change.release.manifest.requires ?? {}).find((id) => trusted.get(id) === false)
      if (dependency) fail('MOD_INSTALL_PLAN', `${change.id} requires an approved release of ${dependency}.`)
    }
    return { plan: { kind: 'install', request, changes: result.install }, sources }
  }

  plan(request: unknown): Promise<ModPlan> {
    return this.queue(async () => {
      if (isRecord(request) && request.kind === 'remove') return this.removalPlan(request.id)
      return (await this.resolve(installRequest(request))).plan
    })
  }

  install(value: unknown, progress?: (event: ModInstallProgress) => void): Promise<PendingModChanges> {
    return this.queue(async () => {
      if (!isRecord(value) || value.kind !== 'install') fail('MOD_PLAN_REQUEST', 'Expected a mod install plan.')
      const { plan, sources } = await this.resolve(installRequest(value.request))
      if (!isDeepStrictEqual(value.changes, plan.changes)) {
        fail('MOD_INSTALL_CHANGED', 'The mods or their source listings have changed. Plan the install again.')
      }
      return installPlan(this.options.root(), plan.changes, sources, { ...this.installOptions(), progress })
    })
  }

  private removalPlan(id: unknown): Extract<ModPlan, { kind: 'remove' }> {
    if (!isModId(id)) fail('MOD_PLAN_REQUEST', 'Expected a mod id.')
    if (Object.hasOwn(this.options.dev(), id)) fail('MOD_REMOVE_DEV', `${id} is a developer folder.`)
    const root = this.options.root()
    const result = resolveRemoval(id, installedSnapshot(root, readPending(root)), this.protectedMods())
    if (!result.ok) fail('MOD_REMOVE_PLAN', result.error)
    return { kind: 'remove', id, orphaned: result.orphaned }
  }

  remove(id: unknown, orphaned: unknown = []): Promise<PendingModChanges> {
    return this.queue(async () => {
      const plan = this.removalPlan(id)
      if (!Array.isArray(orphaned) || orphaned.some((one) => !plan.orphaned.includes(one))) {
        fail('MOD_REMOVE_PLAN', 'The selected libraries are no longer orphaned.')
      }
      const root = this.options.root()
      const pending = readPending(root)
      const removal = new Set([plan.id, ...orphaned] as string[])
      const installed = { ...installedSnapshot(root, pending), ...this.protectedMods() }
      const remaining = Object.fromEntries(Object.entries(installed).filter(([one]) => !removal.has(one)))
      const dependent = requiredBy(remaining, removal)
      if (dependent) fail('MOD_REMOVE_PLAN', `${dependent.name ?? 'An installed mod'} still requires a selected library.`)
      let next = pending
      for (const one of removal) {
        modPath(root, one)
        next = withoutPendingChange(next, one)
      }
      next = { ...next, remove: [...next.remove, ...removal] }
      await writePending(root, next)
      return next
    })
  }

  undo(id: unknown): Promise<PendingModChanges> {
    return this.queue(async () => {
      if (!isModId(id)) fail('MOD_PLAN_REQUEST', 'Expected a mod id.')
      const root = this.options.root()
      const before = readPending(root)
      const next = withoutPendingChange(before, id)
      const protectedMods = this.protectedMods()
      const previous = { ...installedSnapshot(root, before), ...protectedMods }
      const changed = { ...installedSnapshot(root, next), ...protectedMods }
      for (const [one, mod] of Object.entries(changed)) {
        for (const [dep, range] of Object.entries(mod.requires ?? {})) {
          if (one !== id && dep !== id) continue
          const old = Object.hasOwn(previous, dep) ? previous[dep] : undefined
          const after = Object.hasOwn(changed, dep) ? changed[dep] : undefined
          if ((!after || !satisfies(after.version, range)) && (one === id || (old && satisfies(old.version, range)))) {
            fail('MOD_UNDO_REQUIRED', `${mod.name ?? one} would be missing ${dep} ${range}.`)
          }
        }
      }
      await writePending(root, next)
      return next
    })
  }

  rollback(id: string, version: string): Promise<PendingModChanges> {
    return this.queue(() => {
      if (Object.hasOwn(this.protectedMods(), id)) fail('MOD_ROLLBACK_VERSION', 'This mod cannot be rolled back.')
      return queueRollback(this.options.root(), id, version)
    })
  }

  booted(table: ModSessionTable): Promise<void> {
    return this.queue(() => scheduleOldVersionCleanup(this.options.root(), table))
  }
}
