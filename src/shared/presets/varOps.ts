import type { VarOp } from './types'

/** Longest variable name kept. */
export const MAX_VAR_NAME = 64
/** Longest variable value kept; a longer one is cut. */
export const MAX_VAR_VALUE = 2000
/** Most ops read from one reply. */
export const MAX_OPS_PER_REPLY = 50
/** Most variables a save holds; ops that would add one past it are dropped. */
export const MAX_VARS = 200

/** The variable ops the model's `vars` field asked for and the map they produce. */
export interface VarOpsResult {
  vars: Record<string, string>
  warnings: string[]
}

/** True for a string that reads as a finite number. */
function isNumeric(text: string): boolean {
  return text.trim() !== '' && Number.isFinite(Number(text))
}

/** One raw entry as a {@link VarOp}, or the reason it was refused. */
function readOp(raw: unknown): VarOp | string {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return 'not an object'
  const entry = raw as Record<string, unknown>
  if (typeof entry.name !== 'string' || entry.name.trim() === '') return 'no name'
  const name = entry.name.trim()
  if (name.length > MAX_VAR_NAME) return `name "${name.slice(0, 16)}…" is too long`
  if (entry.op !== 'set' && entry.op !== 'add' && entry.op !== 'append') return `"${name}" has an unknown op`
  const value = typeof entry.value === 'number' && Number.isFinite(entry.value) ? String(entry.value) : entry.value
  if (typeof value !== 'string') return `"${name}" has no value`
  return { name, op: entry.op, value }
}

/**
 * Applies the model's variable ops to a copy of `vars`, in order. A malformed op, one past the
 * per-reply or per-save cap, or an `add` of a non-number is dropped with a warning; an `add` to a
 * missing or non-numeric variable starts from 0; values are cut at {@link MAX_VAR_VALUE}.
 */
export function applyVarOps(vars: Record<string, string>, rawOps: unknown): VarOpsResult {
  const map = new Map(Object.entries(vars))
  const warnings: string[] = []
  if (rawOps === undefined || rawOps === null) return { vars: Object.fromEntries(map), warnings }
  if (!Array.isArray(rawOps)) {
    warnings.push('vars was not a list; ignored')
    return { vars: Object.fromEntries(map), warnings }
  }
  if (rawOps.length > MAX_OPS_PER_REPLY) warnings.push(`vars had ${rawOps.length} ops; only the first ${MAX_OPS_PER_REPLY} were read`)

  for (const raw of rawOps.slice(0, MAX_OPS_PER_REPLY)) {
    const op = readOp(raw)
    if (typeof op === 'string') {
      warnings.push(`vars op dropped: ${op}`)
      continue
    }
    const current = map.get(op.name)
    if (current === undefined && map.size >= MAX_VARS) {
      warnings.push(`vars op dropped: "${op.name}" would pass ${MAX_VARS} variables`)
      continue
    }
    let next: string
    if (op.op === 'set') {
      next = op.value
    } else if (op.op === 'append') {
      next = (current ?? '') + op.value
    } else {
      if (!isNumeric(op.value)) {
        warnings.push(`vars op dropped: "${op.name}" add needs a number`)
        continue
      }
      next = String((current !== undefined && isNumeric(current) ? Number(current) : 0) + Number(op.value))
    }
    map.set(op.name, next.slice(0, MAX_VAR_VALUE))
  }
  return { vars: Object.fromEntries(map), warnings }
}

/**
 * A stored or returned variable map read defensively: anything but a plain object of strings is
 * empty, a non-string value is dropped, and the per-save caps hold. Always a new object.
 */
export function readPresetVars(raw: unknown): Record<string, string> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {}
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value !== 'string' || name === '' || name.length > MAX_VAR_NAME) continue
    if (Object.keys(out).length >= MAX_VARS) break
    out[name] = value.slice(0, MAX_VAR_VALUE)
  }
  return out
}

/** One scene reply that committed variables: where its lines start in the transcript and the variables from before it. */
export interface PresetVarsMark {
  at: number
  before: Record<string, string>
}

/** Marks read defensively from a saved scene; anything malformed is dropped. */
export function readPresetVarMarks(raw: unknown): PresetVarsMark[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((entry): PresetVarsMark[] => {
    if (typeof entry !== 'object' || entry === null) return []
    const { at, before } = entry as { at?: unknown; before?: unknown }
    if (typeof at !== 'number' || !Number.isInteger(at) || at < 0) return []
    return [{ at, before: readPresetVars(before) }]
  })
}

/**
 * What a cut of the transcript to `length` does to the variables: the earliest reply that began
 * at or past the cut takes the variables back to what they were before it, and every mark at or
 * past the cut goes. A reply that began before the cut was partly read and keeps its variables.
 * Null when the cut takes no reply.
 */
export function presetVarsWithin(
  marks: readonly PresetVarsMark[],
  length: number
): { vars: Record<string, string>; marks: PresetVarsMark[] } | null {
  const cut = marks.filter((mark) => mark.at >= length)
  if (cut.length === 0) return null
  const first = cut.reduce((a, b) => (b.at < a.at ? b : a))
  return { vars: { ...first.before }, marks: marks.filter((mark) => mark.at < length) }
}
