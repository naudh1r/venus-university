import { satisfies } from './range'

/**
 * The order the installed mods load in, and which of them may not load because of what they
 * depend on. Pure: the caller hands in what each manifest declares and whether the mod can run
 * at all, and gets back the load order and a one-line reason for every mod left out.
 *
 * A mod depends on each id in its `requires`, and on each id in its `optional` that is installed
 * at a version in range. Dependencies load first; among mods free to load at the same moment the
 * lowest id goes first, so the order is the same on every machine.
 */

export interface OrderInput {
  readonly id: string
  readonly name: string
  readonly version: string
  /** Whether the mod can run at all before ordering: false for one already refused or needing an update. */
  readonly loadable: boolean
  /** Id to version range. */
  readonly requires?: Readonly<Record<string, string>>
  /** Id to version range. */
  readonly optional?: Readonly<Record<string, string>>
}

export interface Ordered {
  /** Every mod that may load, dependencies before the mods that need them, ties broken by id. */
  readonly order: readonly string[]
  /** The mods that may not: the one-line reason, by id. */
  readonly blocked: Readonly<Record<string, string>>
  /** Per mod, the ids of its `optional` dependencies that are present and in range (and so loaded before it). */
  readonly optionalPresent: Readonly<Record<string, readonly string[]>>
  /** Per mod, quieter notes: an optional dependency present but out of range, left out. */
  readonly warnings: Readonly<Record<string, readonly string[]>>
  /** Per mod, the ids of its `optional` dependencies present and in range that did not load, left out. */
  readonly optionalSkipped: Readonly<Record<string, readonly string[]>>
}

type ById = ReadonlyMap<string, OrderInput>

/** The ids a mod's `optional` names that are installed at a version in range. */
function optionalInRange(mod: OrderInput, byId: ById): string[] {
  return Object.entries(mod.optional ?? {})
    .filter(([id, range]) => {
      const dep = byId.get(id)
      return dep !== undefined && satisfies(dep.version, range)
    })
    .map(([id]) => id)
}

/** The installed ids a mod must load after: its requirements first, in the order it lists them, then its optionals in range. */
function dependenciesOf(mod: OrderInput, byId: ById): string[] {
  const required = Object.keys(mod.requires ?? {}).filter((id) => byId.has(id))
  return [...new Set([...required, ...optionalInRange(mod, byId)])]
}

/** A note per optional dependency installed outside its range. */
function optionalWarnings(mod: OrderInput, byId: ById): string[] {
  const warnings: string[] = []
  for (const [id, range] of Object.entries(mod.optional ?? {})) {
    const dep = byId.get(id)
    if (dep && !satisfies(dep.version, range)) warnings.push(`optional ${id} ${range}: ${dep.version} is installed, left out`)
  }
  return warnings
}

/**
 * The path from `start` back to itself along dependencies among `among`, or null where there is
 * none; searched depth first, dependencies in the order the mod lists them.
 */
function cycleThrough(start: string, among: ReadonlySet<string>, deps: ReadonlyMap<string, readonly string[]>): string[] | null {
  const visited = new Set<string>()
  const walk = (id: string, path: string[]): string[] | null => {
    for (const next of deps.get(id) ?? []) {
      if (next === start) return [...path, next]
      if (!among.has(next) || visited.has(next)) continue
      visited.add(next)
      const found = walk(next, [...path, next])
      if (found) return found
    }
    return null
  }
  return walk(start, [start])
}

interface Sorted {
  /** Every mod not on a cycle, each after its dependencies, the lowest ready id first at every step. */
  readonly sorted: readonly string[]
  /** The mods on a cycle, each with its path back to itself. */
  readonly cycles: ReadonlyMap<string, readonly string[]>
}

/**
 * Kahn's algorithm, taking the lowest ready id at each step. When nothing is ready the mods left
 * are on a cycle or behind one: those on a cycle are set aside, which frees the ones behind to
 * be sorted after them.
 */
function sortByDependencies(ids: readonly string[], deps: ReadonlyMap<string, readonly string[]>): Sorted {
  const remaining = new Set(ids)
  const sorted: string[] = []
  const cycles = new Map<string, string[]>()
  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) => (deps.get(id) ?? []).every((dep) => !remaining.has(dep))).sort()
    if (ready.length > 0) {
      sorted.push(ready[0])
      remaining.delete(ready[0])
      continue
    }
    const onCycle = [...remaining].flatMap((id) => {
      const path = cycleThrough(id, remaining, deps)
      return path ? [[id, path] as const] : []
    })
    for (const [id, path] of onCycle) {
      cycles.set(id, path)
      remaining.delete(id)
    }
  }
  return { sorted, cycles }
}

/**
 * Why a mod may not load, given the mods before it that did: the first requirement, in the order
 * it lists them, that is not installed, is out of range, or did not load. Null where it may.
 */
function requirementProblem(mod: OrderInput, byId: ById, loaded: ReadonlySet<string>): string | null {
  for (const [id, range] of Object.entries(mod.requires ?? {})) {
    const dep = byId.get(id)
    if (!dep) return `needs ${id}, which is not installed`
    if (!satisfies(dep.version, range)) return `needs ${dep.name} ${range}, ${dep.version} is installed`
    if (!loaded.has(id)) return `needs ${dep.name}, which did not load`
  }
  return null
}

export function orderMods(mods: readonly OrderInput[]): Ordered {
  const byId: ById = new Map(mods.map((mod) => [mod.id, mod]))
  const deps = new Map(mods.map((mod) => [mod.id, dependenciesOf(mod, byId)]))
  const { sorted, cycles } = sortByDependencies([...byId.keys()], deps)

  const order: string[] = []
  const loaded = new Set<string>()
  const blocked: Record<string, string> = {}
  const optionalPresent: Record<string, string[]> = {}
  const warnings: Record<string, string[]> = {}
  const optionalSkipped: Record<string, string[]> = {}

  for (const [id, path] of cycles) {
    if (byId.get(id)?.loadable) blocked[id] = `requires itself through ${path.join(' → ')}`
  }
  for (const id of sorted) {
    const mod = byId.get(id) as OrderInput
    if (!mod.loadable) continue
    const found = optionalWarnings(mod, byId)
    if (found.length > 0) warnings[id] = found
    const problem = requirementProblem(mod, byId, loaded)
    if (problem) {
      blocked[id] = problem
      continue
    }
    order.push(id)
    loaded.add(id)
    const inRange = optionalInRange(mod, byId)
    const present = inRange.filter((dep) => loaded.has(dep))
    const skipped = inRange.filter((dep) => !loaded.has(dep))
    if (present.length > 0) optionalPresent[id] = present
    if (skipped.length > 0) optionalSkipped[id] = skipped
  }
  return { order, blocked, optionalPresent, warnings, optionalSkipped }
}
