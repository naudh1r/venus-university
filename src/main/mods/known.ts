import { mkdir, readFile } from 'fs/promises'
import { join, resolve } from 'path'
import { switchedOn, type ModDef, type ModScope, type ModSwitches } from '@shared/mods'
import { isBuiltInRow, type ModSessionTable } from '@shared/modSession'
import { toAppError } from '@shared/errors'
import { writeAtomicJson } from '../services/jsonFile'

/**
 * `data/mods/known.json`: the mods this build had at its last start, and whether each one's switch
 * was on. Written by main at every start, once the session table is settled, so that a mod which
 * later leaves the build can still be told apart: `mods.json` holds only the switches a player
 * changed, and a default-on mod nobody touched has no entry there.
 *
 *     { "schemaVersion": 1, "mods": { "<id>": { id, version, scope, defaultOn, switchedOn, builtIn } } }
 *
 * By id, as `installed.json` is, so a later field on one mod's entry needs no new format.
 */

/** The file, beside the id folders and `installed.json`. */
export const KNOWN_FILE = 'known.json'

/** One mod as this build had it. */
export interface KnownMod {
  readonly id: string
  readonly version: string
  readonly scope: ModScope
  readonly defaultOn: boolean
  /** The player's own switch where they set one, else the mod's default; playthroughs are not asked. */
  readonly switchedOn: boolean
  /** Part of this build, rather than installed under `data/mods/`. */
  readonly builtIn: boolean
}

export interface KnownFile {
  readonly schemaVersion: 1
  readonly mods: Readonly<Record<string, KnownMod>>
}

export interface KnownInputs {
  /** The mods built into this copy of the game, rows or not. */
  readonly builtIn: readonly ModDef[]
  /** The settled session table: its installed rows with a definition count, developer folders do not. */
  readonly table: ModSessionTable
  /** `mods.json` as it stands. */
  readonly switches: ModSwitches
  /** The file as the last start left it, parsed; anything not of this shape is ignored. */
  readonly previous: unknown
}

/** Whether a value has every field of one entry, with the right types. */
function isKnownMod(value: unknown): value is KnownMod {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const mod = value as Record<string, unknown>
  return typeof mod.id === 'string' && typeof mod.version === 'string'
    && (mod.scope === 'anytime' || mod.scope === 'playthrough')
    && typeof mod.defaultOn === 'boolean' && typeof mod.switchedOn === 'boolean' && typeof mod.builtIn === 'boolean'
}

/** The entries of a previous file of this shape; none for a file of any other. */
function previousMods(previous: unknown): Record<string, KnownMod> {
  if (typeof previous !== 'object' || previous === null) return {}
  const file = previous as { schemaVersion?: unknown; mods?: unknown }
  if (file.schemaVersion !== 1 || typeof file.mods !== 'object' || file.mods === null || Array.isArray(file.mods)) return {}
  return Object.fromEntries(Object.entries(file.mods).filter((entry): entry is [string, KnownMod] => isKnownMod(entry[1]) && entry[1].id === entry[0]))
}

/**
 * The record for this start. Every mod of this build is written afresh. An entry the last file
 * held for a mod this build no longer has is kept as it was: that mod's last known state is what
 * the record is for once it has left.
 */
export function knownModsOf(inputs: KnownInputs): KnownFile {
  const entryOf = (def: ModDef, builtIn: boolean): KnownMod => ({
    id: def.id,
    version: def.version,
    scope: def.scope,
    defaultOn: def.defaultOn,
    switchedOn: switchedOn(inputs.switches, def.id, [def]),
    builtIn
  })
  const mods: Record<string, KnownMod> = previousMods(inputs.previous)
  for (const def of inputs.builtIn) mods[def.id] = entryOf(def, true)
  for (const row of inputs.table.mods) {
    // A row with no definition stands for no mod, and a developer folder is not an install.
    if (row.def === null || row.dev || isBuiltInRow(row)) continue
    if (inputs.builtIn.some((def) => def.id === row.id)) continue
    mods[row.id] = entryOf(row.def, false)
  }
  const sorted = Object.keys(mods).sort().map((id) => [id, mods[id]] as const)
  return { schemaVersion: 1, mods: Object.fromEntries(sorted) }
}

/**
 * Writes this start's record under `modsDir`, atomically. A previous file that will not read or
 * parse is replaced; one a newer build wrote is left as it is, since this build would drop what
 * it cannot read. Never throws: a failed write is warned of and the start goes on.
 */
export async function writeKnownMods(modsDir: string, inputs: Omit<KnownInputs, 'previous'>, warn: (line: string) => void): Promise<void> {
  const path = join(resolve(modsDir), KNOWN_FILE)
  try {
    let previous: unknown = null
    try {
      previous = JSON.parse(await readFile(path, 'utf8'))
    } catch {
      // No file, or one that is not JSON: nothing carries over.
    }
    const version = (previous as { schemaVersion?: unknown } | null)?.schemaVersion
    if (typeof version === 'number' && version > 1) {
      warn(`[mods] ${KNOWN_FILE} not written: the file is from a newer build`)
      return
    }
    await mkdir(resolve(modsDir), { recursive: true })
    await writeAtomicJson(path, knownModsOf({ ...inputs, previous }), { code: 'KNOWN_UNWRITABLE', message: `Could not save ${KNOWN_FILE}.` })
  } catch (err) {
    const failure = toAppError(err)
    warn(`[mods] ${KNOWN_FILE} not written: ${failure.detail ?? failure.message}`)
  }
}
