import type { PlaythroughRecord } from './types'

/**
 * The community mods built into this copy of the game, and the switches a player turns them on
 * and off with. Every mod's code is always in the build; a switch decides whether that code
 * acts. A mod registers here once, and asks {@link modOn} wherever it would do something.
 *
 * This is not Venus Dev's own build, and nothing found in it should be reported to him as if it
 * were: the main menu and the log both say so (`buildLine`, `modNames`).
 */

/** The build these mods ship in, as the main menu and the log name it. */
export const BUILD = { name: 'Venus Extracurriculars', version: '0.1.0' } as const

/**
 * When a mod's switch takes effect.
 *
 * - `anytime`: read where the mod acts, so it can be turned on or off whenever the player likes.
 * - `playthrough`: fixed when a playthrough starts, for a mod whose saves depend on it. The
 *   switch is what a new playthrough gets; one already started keeps what it started with.
 */
export type ModScope = 'anytime' | 'playthrough'

/** One yes-or-no setting of a mod's own. */
export interface ModOption {
  id: string
  label: string
  /** What the other position does, in a line. */
  hint: string
  default: boolean
  /**
   * Options of one mod that share a group are one choice: one of them is on at a time. Turning
   * one on turns the others off, and the one that is on stays on until another is picked. The
   * Mods screen shows them together, under the group's own label and hint.
   */
  group?: string
}

/** What a group of options is, shown once above them. */
export interface ModOptionGroup {
  id: string
  label: string
  hint: string
}

export interface ModDef {
  /** Stable, lower case with dashes: it is written to disk, so it never changes once shipped. */
  id: string
  name: string
  author: string
  version: string
  scope: ModScope
  /** Whether the mod is on for a player who has never touched its switch. */
  defaultOn: boolean
  /** What the mod does, in a sentence or two. */
  blurb: string
  /** What switching it off leaves alone, where a player might fear otherwise. */
  offNote?: string
  /** Mods this one cannot act without, by id. */
  requires?: readonly string[]
  options?: readonly ModOption[]
  /** The groups its options name, by id. */
  optionGroups?: readonly ModOptionGroup[]
}

/**
 * Each mod's entry, found rather than listed: every file in `src/shared/modEntries/`, named for
 * the mod's id, whose default export is its {@link ModDef}. Nothing here names a mod, so two
 * mods added side by side never touch the same line (see MODDING.md).
 */
const ENTRIES = import.meta.glob<ModDef>('./modEntries/*.ts', { eager: true, import: 'default' })

/**
 * Every mod in this build, in the order the Mods screen lists them and the hooks are asked: by
 * id. None yet in `core`: this is the frame alone.
 */
export const MODS: readonly ModDef[] = Object.keys(ENTRIES)
  .sort()
  .map((file) => ENTRIES[file])

/**
 * What the player has set, as `data/mods.json` holds it. A mod or an option that is not in
 * either map is at its default, so a mod added by an update needs nothing written for it.
 */
export interface ModSwitches {
  /** By mod id. */
  on: Record<string, boolean>
  /** By {@link optionKey}. */
  options: Record<string, boolean>
}

export const NO_SWITCHES: ModSwitches = { on: {}, options: {} }

/** The key one mod's option is stored under. */
export function optionKey(modId: string, optionId: string): string {
  return `${modId}:${optionId}`
}

export function modById(id: string, mods: readonly ModDef[] = MODS): ModDef | undefined {
  return mods.find((mod) => mod.id === id)
}

/** Where the player has left a mod's own switch, whatever the mods it requires are doing. */
export function switchedOn(
  switches: ModSwitches,
  id: string,
  mods: readonly ModDef[] = MODS
): boolean {
  const mod = modById(id, mods)
  if (!mod) return false
  return switches.on[id] ?? mod.defaultOn
}

/**
 * The first mod `id` requires that is not on, or `null`. A switch left on stays on while what
 * it requires is off, so turning that back on brings the mod back with it.
 */
export function missingRequirement(
  switches: ModSwitches,
  id: string,
  mods: readonly ModDef[] = MODS,
  seen: readonly string[] = []
): ModDef | null {
  const mod = modById(id, mods)
  for (const needed of mod?.requires ?? []) {
    const required = modById(needed, mods)
    // A requirement this build does not carry is never met, and has no name to show: the mod
    // names itself as the thing that cannot run.
    if (!required) return mod ?? null
    // A circle of requirements is a mistake in the list, not a reason to hang.
    if (seen.includes(needed)) continue
    if (!switchedOn(switches, needed, mods)) return required
    const further = missingRequirement(switches, needed, mods, [...seen, id])
    if (further) return further
  }
  return null
}

/** Whether a mod is on for the game as a whole: its switch, and everything it requires. */
function globallyOn(switches: ModSwitches, id: string, mods: readonly ModDef[]): boolean {
  return switchedOn(switches, id, mods) && missingRequirement(switches, id, mods) === null
}

/**
 * **The one question a mod asks before it acts.**
 *
 * An `anytime` mod is on where its switch and its requirements are. A `playthrough` mod asked
 * about a playthrough answers from that playthrough's own record, which named the mods it
 * started with; asked with no record, it answers what a new playthrough would get. A record
 * written before this list existed names none, so no `playthrough` mod is on for it.
 */
export function modOn(
  switches: ModSwitches,
  id: string,
  record?: Pick<PlaythroughRecord, 'mods'> | null,
  mods: readonly ModDef[] = MODS
): boolean {
  const mod = modById(id, mods)
  if (!mod) return false
  if (mod.scope === 'playthrough' && record) return record.mods?.includes(id) ?? false
  return globallyOn(switches, id, mods)
}

/** Where one of a mod's options stands. An option nobody declared is off. */
export function optionOn(
  switches: ModSwitches,
  modId: string,
  optionId: string,
  mods: readonly ModDef[] = MODS
): boolean {
  const option = modById(modId, mods)?.options?.find((o) => o.id === optionId)
  if (!option) return false
  return switches.options[optionKey(modId, optionId)] ?? option.default
}

export function withMod(switches: ModSwitches, id: string, on: boolean): ModSwitches {
  return { ...switches, on: { ...switches.on, [id]: on } }
}

export function withOption(
  switches: ModSwitches,
  modId: string,
  optionId: string,
  on: boolean,
  mods: readonly ModDef[] = MODS
): ModSwitches {
  const options = modById(modId, mods)?.options ?? []
  const group = options.find((o) => o.id === optionId)?.group
  if (!group) {
    return { ...switches, options: { ...switches.options, [optionKey(modId, optionId)]: on } }
  }
  // One of a group is always picked: turning the picked one off picks nothing else.
  if (!on) return switches
  const picked = Object.fromEntries(
    options
      .filter((o) => o.group === group)
      .map((o) => [optionKey(modId, o.id), o.id === optionId])
  )
  return { ...switches, options: { ...switches.options, ...picked } }
}

/**
 * The `playthrough` mods a playthrough starting now gets, for its record to name. Empty in a
 * build with none, and the record then carries no list at all.
 */
export function playthroughMods(
  switches: ModSwitches,
  mods: readonly ModDef[] = MODS
): string[] {
  return mods
    .filter((mod) => mod.scope === 'playthrough' && globallyOn(switches, mod.id, mods))
    .map((mod) => mod.id)
}

/** The mods that are on for the game as a whole, in list order. */
export function modsOn(switches: ModSwitches, mods: readonly ModDef[] = MODS): ModDef[] {
  return mods.filter((mod) => globallyOn(switches, mod.id, mods))
}

/** `"Continuing Semesters 0.2.0"`, or several joined with commas: the log's list. */
export function modNames(mods: readonly ModDef[] = MODS): string {
  if (mods.length === 0) return 'no mods'
  return mods.map((mod) => `${mod.name} ${mod.version}`).join(', ')
}

/**
 * The line the main menu prints under the version, so a screenshot of the menu says whose build
 * this is. It counts the mods that are on rather than naming them; the Mods screen names them.
 */
export function buildLine(switches: ModSwitches, mods: readonly ModDef[] = MODS): string {
  const count = modsOn(switches, mods).length
  return `${BUILD.name} ${BUILD.version} · ${count} ${count === 1 ? 'mod' : 'mods'} on · unofficial`
}

/**
 * What a stored value holds of the switches' shape, for a file a player may have edited by
 * hand. Ids this build does not know are kept: a mod a later build adds, or one an earlier
 * build had, keeps its setting across the builds between.
 */
export function cleanSwitches(value: unknown): ModSwitches {
  const flags = (from: unknown): Record<string, boolean> => {
    if (typeof from !== 'object' || from === null || Array.isArray(from)) return {}
    return Object.fromEntries(
      Object.entries(from).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean')
    )
  }
  const held = typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  return { on: flags(held.on), options: flags(held.options) }
}

/**
 * What the switches add to the on-disk shapes, added from outside them the way `termTypes.ts`
 * adds terms: the field means exactly what it would inside `types.ts`, and an update that
 * replaces that file carries nothing of this away.
 */
declare module './types' {
  interface PlaythroughRecord {
    /**
     * The `playthrough` mods this playthrough started with, by id. Absent where none were on,
     * and on every record written before the list existed.
     */
    mods?: string[]
  }
}
