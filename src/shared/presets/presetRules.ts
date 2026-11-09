import { assertSafeId } from '@vx/modkit/shared'
import { GAME_MARKERS, type GameMarker, type Preset } from './types'

/** The one version of a preset file and of the presets index this build reads and writes. */
export const PRESET_SCHEMA_VERSION = 1

/** A preset as it is stored: the preset itself plus its schema version. */
export type PresetFile = Preset & { schemaVersion: number }

/** `data/presets/index.json`: which preset is in use. */
export interface PresetIndex {
  schemaVersion: number
  active: string
}

/** A preset file name is its id, so an id is limited to what cannot leave the folder. */
const SAFE_PRESET_ID = /^[A-Za-z0-9_-]{1,64}$/

/** True for an id that is safe to use as a file name. */
export function isSafePresetId(id: unknown): id is string {
  return typeof id === 'string' && SAFE_PRESET_ID.test(id)
}

/** Rejects an id that could escape the presets folder. */
export function assertSafePresetId(id: string): void {
  assertSafeId(id, SAFE_PRESET_ID, 'PRESET_ID_INVALID', 'That preset id is not valid.')
}

/** The preset as it is written to disk. */
export function toPresetFile(preset: Preset): PresetFile {
  return { ...preset, schemaVersion: PRESET_SCHEMA_VERSION }
}

type Json = Record<string, unknown>

/** True for a plain object. */
function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** The reason one block is malformed, or null when it is fine. */
function blockProblem(block: unknown, index: number): string | null {
  const where = `blocks[${index}]`
  if (!isObject(block)) return `${where} is not an object.`
  if (typeof block.id !== 'string' || block.id === '') return `${where} has no id.`
  if (typeof block.name !== 'string') return `${where} has no name.`
  if (block.role !== 'system' && block.role !== 'user' && block.role !== 'assistant') return `${where} has an unknown role.`
  if (typeof block.enabled !== 'boolean') return `${where} has no enabled flag.`
  if (block.position !== 'ordered' && block.position !== 'depth') return `${where} has an unknown position.`
  if (typeof block.depth !== 'number' || !Number.isFinite(block.depth)) return `${where} has no depth.`
  if (typeof block.content !== 'string') return `${where} has no content.`
  if (block.marker !== undefined && !GAME_MARKERS.includes(block.marker as GameMarker)) return `${where} names an unknown game part.`
  if (block.wrapXml !== undefined && typeof block.wrapXml !== 'string') return `${where} has a bad XML tag.`
  if (block.conflict !== undefined && typeof block.conflict !== 'string') return `${where} has a bad conflict note.`
  return null
}

/** The reason the optional fields are malformed, or null when they are fine. */
function optionalProblem(preset: Json): string | null {
  if (preset.overrides !== undefined && !isObject(preset.overrides)) return 'overrides is not an object.'
  if (preset.mainReplacesPersona !== undefined && typeof preset.mainReplacesPersona !== 'boolean') return 'mainReplacesPersona is not a boolean.'
  if (preset.mainBlockId !== undefined && typeof preset.mainBlockId !== 'string') return 'mainBlockId is not a string.'
  if (preset.notes !== undefined && typeof preset.notes !== 'string') return 'notes is not a string.'
  if (preset.sampling !== undefined) {
    if (!isObject(preset.sampling)) return 'sampling is not an object.'
    for (const key of ['temperature', 'topP', 'topK', 'repetitionPenalty']) {
      const value = preset.sampling[key]
      if (value !== undefined && (typeof value !== 'number' || !Number.isFinite(value))) return `sampling.${key} is not a number.`
    }
  }
  if (preset.regex !== undefined) {
    if (!Array.isArray(preset.regex)) return 'regex is not a list.'
    const bad = preset.regex.some(
      (r) => !isObject(r) || typeof r.name !== 'string' || typeof r.find !== 'string' || typeof r.replace !== 'string' || typeof r.enabled !== 'boolean'
    )
    if (bad) return 'regex has a malformed script.'
  }
  return null
}

/**
 * Checks a parsed preset file. The object comes back as it was read, so keys this build does not know
 * survive a rewrite; a malformed one answers with the reason and never throws.
 */
export function validatePreset(json: unknown): { ok: true; preset: PresetFile } | { ok: false; error: string } {
  if (!isObject(json)) return { ok: false, error: 'The preset file does not contain an object.' }
  if (json.schemaVersion !== PRESET_SCHEMA_VERSION) {
    return { ok: false, error: `The preset has unsupported schemaVersion ${String(json.schemaVersion)}; this build expects ${PRESET_SCHEMA_VERSION}.` }
  }
  if (!isSafePresetId(json.id)) return { ok: false, error: 'The preset has no valid id.' }
  if (typeof json.name !== 'string' || json.name.trim() === '') return { ok: false, error: 'The preset has no name.' }
  if (json.source !== 'sillytavern' && json.source !== 'marinara' && json.source !== 'native') {
    return { ok: false, error: 'The preset has an unknown source.' }
  }
  if (!Array.isArray(json.blocks)) return { ok: false, error: 'The preset has no blocks.' }

  const ids = new Set<string>()
  for (let i = 0; i < json.blocks.length; i++) {
    const problem = blockProblem(json.blocks[i], i)
    if (problem) return { ok: false, error: problem }
    const id = (json.blocks[i] as Json).id as string
    if (ids.has(id)) return { ok: false, error: `Two blocks share the id "${id}".` }
    ids.add(id)
  }
  const optional = optionalProblem(json)
  if (optional) return { ok: false, error: `The preset's ${optional}` }
  return { ok: true, preset: json as unknown as PresetFile }
}

/** Checks a parsed `index.json`; the object comes back as it was read. */
export function validatePresetIndex(json: unknown): { ok: true; index: PresetIndex } | { ok: false; error: string } {
  if (!isObject(json)) return { ok: false, error: 'The presets index does not contain an object.' }
  if (json.schemaVersion !== PRESET_SCHEMA_VERSION) {
    return { ok: false, error: `The presets index has unsupported schemaVersion ${String(json.schemaVersion)}; this build expects ${PRESET_SCHEMA_VERSION}.` }
  }
  if (!isSafePresetId(json.active)) return { ok: false, error: 'The presets index names no valid active preset.' }
  return { ok: true, index: json as unknown as PresetIndex }
}
