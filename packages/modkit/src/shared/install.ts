import { checkCompat, CORE_SURFACE, type CoreSurface } from './compat'
import { hookNameKind } from './manifest'
import { orderMods } from './order'
import { compareVersions, parseVersion, satisfies } from './range'
import type { ModSource, SourceRelease } from './source'

/** A current installed or built-in version. Source is needed only when its requirements need fetching. */
export interface InstalledMod {
  readonly version: string
  readonly name?: string
  readonly source?: string
  readonly requires?: Readonly<Record<string, string>>
  readonly optional?: Readonly<Record<string, string>>
  readonly library?: boolean
}
export interface InstallSource { readonly url: string; readonly source: ModSource }
export interface InstallRequest { readonly version: string; readonly source: string }
export interface InstallInput {
  readonly installed: Readonly<Record<string, InstalledMod>>
  readonly builtIn: Readonly<Record<string, InstalledMod>>
  readonly request: Readonly<Record<string, InstallRequest>>
  readonly sources: readonly InstallSource[]
  readonly core?: CoreSurface
}
export interface InstallChange {
  readonly id: string
  readonly source: string
  readonly release: SourceRelease
  readonly from?: string
}
export type InstallResolution = { readonly ok: true; readonly install: readonly InstallChange[];
  readonly keep: readonly string[]; readonly order: readonly string[];
  readonly optionalPresent: Readonly<Record<string, readonly string[]>> }
  | { readonly ok: false; readonly error: string }

const own = <T>(record: Readonly<Record<string, T>>, id: string): T | undefined =>
  Object.hasOwn(record, id) ? record[id] : undefined

const refused = (error: string): { ok: false; error: string } => ({ ok: false, error })
const loads = (release: SourceRelease, core: CoreSurface): boolean =>
  checkCompat(release.manifest.hooks.filter(hook => hookNameKind(hook).kind !== 'export'), undefined, core).status === 'loads'

/**
 * Plans against the prospective installed graph. Each new version is chosen once: later
 * transitive constraints may refuse it, but never backtrack to a lower earlier pick.
 */
export function resolveInstall(input: InstallInput): InstallResolution {
  const core = input.core ?? CORE_SURFACE
  const selected = new Map<string, InstalledMod>()
  const choices = new Map<string, InstallChange>()
  const sources = new Map(input.sources.map(source => [source.url, source.source]))
  if (sources.size !== input.sources.length) return refused('A source address is supplied more than once')
  const roots = [...new Set([...Object.keys(input.request), ...Object.keys(input.installed), ...Object.keys(input.builtIn)])]
  for (const id of roots) {
    const current = own(input.builtIn, id) ?? own(input.installed, id)
    if (current) selected.set(id, current)
  }
  function available(id: string, source: string): readonly SourceRelease[] | null {
    const mod = sources.get(source)?.mods.find(mod => mod.id === id)
    if (!mod) return null
    return mod.releases.filter(release => !mod.withdrawn?.some(w => w.version === release.version) && loads(release, core))
  }
  function pick(id: string, source: string, release: SourceRelease): void {
    const previous = own(input.installed, id)
    selected.set(id, { ...release.manifest, source })
    choices.set(id, { id, source, release, ...(previous ? { from: previous.version } : {}) })
  }
  for (const [id, request] of Object.entries(input.request)) {
    if (own(input.builtIn, id)) return refused(`${id} is already part of this build`)
    const release = available(id, request.source)?.find(release => release.version === request.version)
    if (!release) return refused(`${id}@${request.version} isn't available in this source with compatible hooks`)
    if (own(input.installed, id)?.version === request.version) continue
    pick(id, request.source, release)
  }

  for (;;) {
    // An update can drop requirements. Do not install libraries picked only for the old graph.
    const reachable = new Set<string>()
    const queue = [...roots]
    for (let at = 0; at < queue.length; at++) {
      const id = queue[at]
      if (reachable.has(id)) continue
      reachable.add(id)
      queue.push(...Object.keys(selected.get(id)?.requires ?? {}))
    }
    for (const id of selected.keys()) if (!reachable.has(id)) selected.delete(id)
    const demands = new Map<string, { by: string; range: string; source?: string }[]>()
    const discovery = [...new Set([...roots, ...selected.keys()])]
    for (const by of discovery) for (const [id, range] of Object.entries(selected.get(by)?.requires ?? {})) {
      const mod = selected.get(by)!
      const source = choices.get(by)?.source ?? own(input.request, by)?.source ?? mod.source
      const list = demands.get(id) ?? []
      list.push({ by, range, ...(source ? { source } : {}) })
      demands.set(id, list)
    }
    // A version already known to need replacement cannot constrain the new graph with its
    // obsolete requirements. Its chosen replacement contributes its own edges next pass.
    const replacing = new Set([...demands].filter(([id, ranges]) => {
      const current = selected.get(id)
      return current && !choices.has(id) && !own(input.request, id) && !own(input.builtIn, id) &&
        ranges.some(demand => !satisfies(current.version, demand.range))
    }).map(([id]) => id))
    let changed = false
    for (const [id, allRanges] of demands) {
      const ranges = allRanges.filter(demand => !replacing.has(demand.by))
      if (!ranges.length) continue
      const current = selected.get(id)
      if (current && ranges.every(demand => satisfies(current.version, demand.range))) continue
      const need = ranges.map(demand => `${demand.by} requires ${id} ${demand.range}`).join('; ')
      const builtIn = own(input.builtIn, id)
      if (builtIn) return refused(`${need}; built-in ${id}@${builtIn.version} cannot be replaced`)
      if (current && (choices.has(id) || own(input.request, id))) return refused(`${need}; greedy selection ${id}@${current.version} does not meet every range`)
      // Newly requested dependents choose provenance before unchanged installed dependents.
      const source = ranges.find(demand => choices.has(demand.by) || own(input.request, demand.by))?.source
        ?? ranges.find(demand => demand.source)?.source
      if (!source) return refused(`${need}; no source is recorded for this requirement`)
      const releases = available(id, source)
      if (!releases) return refused(`${id} isn't in this source; ${need}`)
      const fitting = releases.filter(release => ranges.every(demand => satisfies(release.version, demand.range)))
        .sort((a, b) => compareVersions(parseVersion(b.version)!, parseVersion(a.version)!))
      if (!fitting.length) return refused(`${need}; no compatible version meets every range in this source`)
      pick(id, source, fitting[0])
      changed = true
      break
    }
    if (!changed) break
  }
  const ordered = orderMods([...selected].map(([id, mod]) => ({ ...mod, id, name: mod.name ?? id, loadable: true })))
  const blocked = Object.entries(ordered.blocked)[0]
  if (blocked) return refused(`${blocked[0]}: ${blocked[1]}`)
  return { ok: true,
    install: ordered.order.flatMap(id => choices.has(id) ? [choices.get(id)!] : []),
    keep: ordered.order.filter(id => !choices.has(id)),
    order: ordered.order, optionalPresent: ordered.optionalPresent }
}

export type RemovalResolution = { readonly ok: true; readonly remove: readonly string[]; readonly orphaned: readonly string[] }
  | { readonly ok: false; readonly error: string }

/** Refuses required removals; orphaned libraries are offers, never silently removed. */
export function resolveRemoval(id: string, installed: Readonly<Record<string, InstalledMod>>,
  builtIn: Readonly<Record<string, InstalledMod>> = {}): RemovalResolution {
  if (own(builtIn, id)) return refused(`${id} is part of this build and cannot be removed`)
  if (!own(installed, id)) return refused(`${id} is not installed`)
  const all = { ...installed, ...builtIn }
  const dependent = Object.entries(all).find(([other, mod]) => other !== id && Object.hasOwn(mod.requires ?? {}, id))
  if (dependent) return refused(`${id} is required by ${dependent[1].name ?? dependent[0]}`)
  const proposed = new Set([id])
  const orphaned: string[] = []
  const queue = Object.keys(own(installed, id)!.requires ?? {})
  for (let at = 0; at < queue.length; at++) {
    const candidate = queue[at]
    const library = own(installed, candidate)
    if (proposed.has(candidate) || own(builtIn, candidate) || !library?.library) continue
    if (Object.entries(all).some(([other, mod]) => !proposed.has(other) && Object.hasOwn(mod.requires ?? {}, candidate))) continue
    proposed.add(candidate)
    orphaned.push(candidate)
    queue.push(...Object.keys(library.requires ?? {}))
  }
  return { ok: true, remove: [id], orphaned }
}
