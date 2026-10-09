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
