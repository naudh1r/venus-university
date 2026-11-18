import { checkCompat, CORE_SURFACE, type CoreSurface } from './compat'
import { hookNameKind } from './manifest'
import { libraryExportProblem } from './library'
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
  readonly hooks?: readonly string[]
  readonly exports?: readonly string[]
}
export interface InstallSource {
  readonly url: string
  readonly source: ModSource
}
export interface InstallRequest {
  readonly version: string
  readonly source: string
}
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
export type InstallResolution =
  | {
      readonly ok: true
      readonly install: readonly InstallChange[]
      readonly keep: readonly string[]
      readonly order: readonly string[]
      readonly optionalPresent: Readonly<Record<string, readonly string[]>>
    }
  | { readonly ok: false; readonly error: string }

/** Reads an own entry of an ID-keyed snapshot. */
const own = <T>(record: Readonly<Record<string, T>>, id: string): T | undefined =>
  Object.hasOwn(record, id) ? record[id] : undefined

/** Builds a refused install or removal result. */
const refused = (error: string): { ok: false; error: string } => ({ ok: false, error })
/** Checks the core hook and API names a release uses. */
const loads = (release: SourceRelease, core: CoreSurface): boolean =>
  checkCompat(
    release.manifest.hooks.filter((hook) => hookNameKind(hook).kind !== 'export'),
    undefined,
    core
  ).status === 'loads'

/**
 * Plans against the prospective installed graph. Each new version is chosen once: later
 * transitive constraints may refuse it, but never backtrack to a lower earlier pick.
 */
export function resolveInstall(input: InstallInput): InstallResolution {
  const core = input.core ?? CORE_SURFACE
  const selected = new Map<string, InstalledMod>()
  const choices = new Map<string, InstallChange>()
  const sources = new Map(input.sources.map((source) => [source.url, source.source]))
  if (sources.size !== input.sources.length)
    return refused('A source address is supplied more than once')
  const roots = [
    ...new Set([
      ...Object.keys(input.request),
      ...Object.keys(input.installed),
      ...Object.keys(input.builtIn)
    ])
  ]
  for (const id of roots) {
    const current = own(input.builtIn, id) ?? own(input.installed, id)
    if (current) selected.set(id, current)
  }
  /** Lists compatible releases still offered by one source. */
  function available(id: string, source: string): readonly SourceRelease[] | null {
    const mod = sources.get(source)?.mods.find((mod) => mod.id === id)
    if (!mod) return null
    return mod.releases.filter(
      (release) =>
        !mod.withdrawn?.some((w) => w.version === release.version) && loads(release, core)
    )
  }
  /** Records a chosen release and its previous installed version. */
  function pick(id: string, source: string, release: SourceRelease): void {
    const previous = own(input.installed, id)
    selected.set(id, { ...release.manifest, source })
    choices.set(id, { id, source, release, ...(previous ? { from: previous.version } : {}) })
  }
  for (const [id, request] of Object.entries(input.request)) {
    if (own(input.builtIn, id)) return refused(`${id} is already part of this build`)
    const release = available(id, request.source)?.find(
      (release) => release.version === request.version
    )
    if (!release) {
      return refused(
        `${id}@${request.version} isn't available in this source with compatible hooks`
      )
    }
    if (own(input.installed, id)?.version === request.version) continue
    pick(id, request.source, release)
  }

  /** Removes newly selected descendants no longer reached after an update. */
  function pruneUnreachable(): void {
    const reachable = new Set<string>()
    const queue = [...roots]
    for (let at = 0; at < queue.length; at++) {
      const id = queue[at]
      if (reachable.has(id)) continue
      reachable.add(id)
      queue.push(...Object.keys(selected.get(id)?.requires ?? {}))
    }
    for (const id of selected.keys()) {
      if (!reachable.has(id)) selected.delete(id)
    }
  }

  type Demand = { by: string; range: string; source?: string }

  /** Collects required ranges and source provenance in discovery order. */
  function collectDemands(): Map<string, Demand[]> {
    const demands = new Map<string, Demand[]>()
    const discovery = [...new Set([...roots, ...selected.keys()])]
    for (const by of discovery) {
      const mod = selected.get(by)
      if (!mod) continue
      const source = choices.get(by)?.source ?? own(input.request, by)?.source ?? mod.source
      for (const [id, range] of Object.entries(mod.requires ?? {})) {
        const list = demands.get(id) ?? []
        list.push({ by, range, ...(source ? { source } : {}) })
        demands.set(id, list)
      }
    }
    return demands
  }

  /** Checks a candidate library against every known dependent's declared export uses. */
  function exportProblem(id: string, library: InstalledMod, replacing: ReadonlySet<string>) {
    for (const [by, dependent] of selected) {
      if (by === id || replacing.has(by)) continue
      const problem = libraryExportProblem(dependent.hooks ?? [], (libraryId) =>
        libraryId === id ? { ...library, name: library.name ?? id } : undefined
      )
      if (problem) return { ...problem, by }
    }
    return null
  }

  /** Finds unchanged versions whose outgoing requirements will be replaced. */
  function findReplacements(demands: ReadonlyMap<string, readonly Demand[]>): Set<string> {
    const replacing = new Set<string>()
    for (const [id, ranges] of demands) {
      const current = selected.get(id)
      if (!current || choices.has(id) || own(input.request, id) || own(input.builtIn, id)) continue
      if (ranges.some((demand) => !satisfies(current.version, demand.range))) replacing.add(id)
    }
    for (const id of demands.keys()) {
      const current = selected.get(id)
      if (!current || choices.has(id) || own(input.request, id) || own(input.builtIn, id)) continue
      if (exportProblem(id, current, replacing)) replacing.add(id)
    }
    return replacing
  }

  for (;;) {
    pruneUnreachable()
    const demands = collectDemands()
    const replacing = findReplacements(demands)
    let changed = false
    for (const [id, allRanges] of demands) {
      const ranges = allRanges.filter((demand) => !replacing.has(demand.by))
      if (!ranges.length) continue
      const current = selected.get(id)
      const missingExport = current ? exportProblem(id, current, replacing) : null
      if (
        current &&
        ranges.every((demand) => satisfies(current.version, demand.range)) &&
        !missingExport
      ) {
        continue
      }
      const requirements = ranges
        .map((demand) => `${demand.by} requires ${id} ${demand.range}`)
        .join('; ')
      const need = missingExport
        ? `${requirements}; ${missingExport.by}: ${missingExport.message}`
        : requirements
      const builtIn = own(input.builtIn, id)
      if (builtIn) return refused(`${need}; built-in ${id}@${builtIn.version} cannot be replaced`)
      if (current && (choices.has(id) || own(input.request, id))) {
        return refused(
          `${need}; greedy selection ${id}@${current.version} does not meet every range`
        )
      }
      // Newly requested dependents choose provenance before unchanged installed dependents.
      const source =
        ranges.find((demand) => choices.has(demand.by) || own(input.request, demand.by))?.source ??
        ranges.find((demand) => demand.source)?.source
      if (!source) return refused(`${need}; no source is recorded for this requirement`)
      const releases = available(id, source)
      if (!releases) return refused(`${id} isn't in this source (${source}); ${need}`)
      const fitting = releases
        .filter(
          (release) =>
            ranges.every((demand) => satisfies(release.version, demand.range)) &&
            !exportProblem(id, release.manifest, replacing)
        )
        .sort((a, b) => compareVersions(parseVersion(b.version)!, parseVersion(a.version)!))
      if (!fitting.length)
        return refused(`${need}; no compatible version meets every range in this source`)
      pick(id, source, fitting[0])
      changed = true
      break
    }
    if (!changed) break
  }
  for (const [id, mod] of selected) {
    const problem = libraryExportProblem(mod.hooks ?? [], (libraryId) => {
      const library = selected.get(libraryId)
      return library ? { ...library, name: library.name ?? libraryId } : undefined
    })
    if (problem) return refused(`${id}: ${problem.message}`)
  }
  const ordered = orderMods(
    [...selected].map(([id, mod]) => ({ ...mod, id, name: mod.name ?? id, loadable: true }))
  )
  const blocked = Object.entries(ordered.blocked)[0]
  if (blocked) return refused(`${blocked[0]}: ${blocked[1]}`)
  return {
    ok: true,
    install: ordered.order.flatMap((id) => (choices.has(id) ? [choices.get(id)!] : [])),
    keep: ordered.order.filter((id) => !choices.has(id)),
    order: ordered.order,
    optionalPresent: ordered.optionalPresent
  }
}

export type RemovalResolution =
  | { readonly ok: true; readonly remove: readonly string[]; readonly orphaned: readonly string[] }
  | { readonly ok: false; readonly error: string }

/** Refuses required removals; orphaned libraries are offers, never silently removed. */
export function resolveRemoval(
  id: string,
  installed: Readonly<Record<string, InstalledMod>>,
  builtIn: Readonly<Record<string, InstalledMod>> = {}
): RemovalResolution {
  if (own(builtIn, id)) return refused(`${id} is part of this build and cannot be removed`)
  if (!own(installed, id)) return refused(`${id} is not installed`)
  const all = { ...installed, ...builtIn }
  const dependent = Object.entries(all).find(
    ([other, mod]) => other !== id && Object.hasOwn(mod.requires ?? {}, id)
  )
  if (dependent) return refused(`${id} is required by ${dependent[1].name ?? dependent[0]}`)
  const proposed = new Set([id])
  const orphaned: string[] = []
  const queue = Object.keys(own(installed, id)!.requires ?? {})
  for (let at = 0; at < queue.length; at++) {
    const candidate = queue[at]
    const library = own(installed, candidate)
    if (proposed.has(candidate) || own(builtIn, candidate) || !library?.library) continue
    if (
      Object.entries(all).some(
        ([other, mod]) => !proposed.has(other) && Object.hasOwn(mod.requires ?? {}, candidate)
      )
    ) {
      continue
    }
    proposed.add(candidate)
    orphaned.push(candidate)
    queue.push(...Object.keys(library.requires ?? {}))
  }
  return { ok: true, remove: [id], orphaned }
}
