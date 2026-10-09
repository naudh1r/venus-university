import type { Character, GameSave } from './types'

/** Each mod augments this interface with only its own optional save fields. */
export interface ModCarryFields {}
export interface TermCarryContext {
  /** Zero-based outgoing semester. */
  term: number
  /** Days subtracted from native memories by the semester implementation. */
  back: number
  characters: Record<string, Character>
}
type Adapter = (save: GameSave, context: TermCarryContext) => unknown
const adapters = new Map<string, Adapter>()

/** Retention is independent of switches: disabling a feature must not erase its archive. */
export function registerTermCarry<K extends keyof ModCarryFields>(
  field: K,
  adapter: (save: GameSave, context: TermCarryContext) => ModCarryFields[K]
): void {
  adapters.set(field, adapter)
}

/** Called by a semester extension; no semester or feature mod is required by the registry. */
export function carryModFields(save: GameSave, context: TermCarryContext): Partial<ModCarryFields> {
  const result: Record<string, unknown> = {}
  for (const [field, adapter] of adapters) {
    const value = adapter(save, context)
    if (value !== undefined) result[field] = value
  }
  return result
}

/** Only registered extension fields can enter the opening save. */
export function carriedModFields(carry: Partial<ModCarryFields>): Partial<ModCarryFields> {
  const source = carry as Record<string, unknown>
  return Object.fromEntries([...adapters.keys()].filter(key =>
    Object.hasOwn(source, key) && source[key] !== undefined
  ).map(key => [key, source[key]]))
}

/** The playthroughs a semester is carried between, by id. */
export interface TermFilesContext {
  /** The finished playthrough. */
  from: string
  /** The new one, written but not yet entered. */
  to: string
}
type FileCarrier = (context: TermFilesContext) => Promise<void>
const fileCarriers = new Map<string, FileCarrier>()

/**
 * A mod's files kept per playthrough outside the save (pictures, say), copied into the new
 * playthrough's folder by the mod itself. Like the fields, independent of switches: a feature
 * off when the semester turns keeps its files for when it is turned back on.
 */
export function registerTermFiles(modId: string, carrier: FileCarrier): void {
  fileCarriers.set(modId, carrier)
}

/**
 * Called by a semester extension once the new playthrough is written, before it is entered.
 * Each carrier is awaited in turn; one that fails costs only its own files and stops no other.
 */
export async function carryModFiles(context: TermFilesContext): Promise<void> {
  for (const [modId, carrier] of fileCarriers) {
    try {
      await carrier(context)
    } catch (error) {
      console.warn(`[mods] ${modId} could not carry its files into the new playthrough`, error)
    }
  }
}
