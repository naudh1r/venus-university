import { appError } from '@vx/modkit/shared'
import { nativeDefaultPreset } from './gameParts'
import { importPreset, type ImportResult } from './detect'
import { isSafePresetId, toPresetFile, validatePreset, type PresetFile } from './presetRules'
import { presetFromBackup } from './studioBackup'
import type { Preset, PresetListing, PresetSummary } from './types'

/**
 * The rules every store of presets keeps, whether it is a folder of files or a row of the
 * browser's database: what a library holds, how it repairs itself and what may be deleted.
 */

/** The largest preset file read; a longer one is refused unread. */
export const MAX_PRESET_BYTES = 8 * 1024 * 1024

/** Every preset a store holds and which is in force. */
export interface PresetLibrary {
  active: string
  presets: PresetFile[]
}

/** A preset as the list shows it. */
export function summaryOf(preset: Preset): PresetSummary {
  return { id: preset.id, name: preset.name, source: preset.source }
}

/** The library as the list channel answers it, by name. */
export function listingOf(library: PresetLibrary): PresetListing {
  const presets = library.presets.map(summaryOf).sort((a, b) => a.name.localeCompare(b.name))
  return { active: library.active, presets }
}

/** The id Default is created under: `default` unless that is taken, then `default-2` and so on. */
function freeDefaultId(taken: ReadonlySet<string>): string {
  if (!taken.has('default')) return 'default'
  let n = 2
  while (taken.has(`default-${n}`)) n++
  return `default-${n}`
}

/**
 * The library with Default created when it holds nothing and an active preset that exists: the
 * named one if it is there, else `default`, else the first by name. `taken` names ids a file
 * already sits under that could not be read, which Default must not overwrite.
 */
export function repairedLibrary(
  presets: readonly PresetFile[],
  active: string | null,
  taken: ReadonlySet<string> = new Set()
): PresetLibrary {
  const held = [...presets]
  if (held.length === 0) {
    held.push(toPresetFile(nativeDefaultPreset(freeDefaultId(new Set([...taken])))))
  }
  const chosen =
    held.find((p) => p.id === active) ??
    held.find((p) => p.id === 'default') ??
    [...held].sort((a, b) => a.name.localeCompare(b.name))[0]
  return { active: chosen.id, presets: held }
}

/** Reads a stored preset object, or null where it is malformed or its id is not the one it is kept under. */
export function readStoredPreset(json: unknown, expectedId?: string): PresetFile | null {
  const checked = validatePreset(json)
  if (!checked.ok) return null
  if (expectedId !== undefined && checked.preset.id !== expectedId) return null
  return checked.preset
}

/** The preset checked for keeping; refuses a malformed one or an unsafe id. */
export function presetToKeep(preset: Preset): PresetFile {
  if (!isSafePresetId(preset.id)) throw appError('PRESET_ID_INVALID', 'That preset id is not valid.', String(preset.id))
  const file = toPresetFile(preset)
  const checked = validatePreset(file)
  if (!checked.ok) throw appError('PRESET_INVALID', 'That preset could not be saved.', checked.error)
  return checked.preset
}

/** The library without `id`, with the active preset moved when it was the one removed; refuses to empty it. */
export function withoutPreset(library: PresetLibrary, id: string): PresetLibrary {
  if (!library.presets.some((p) => p.id === id)) return library
  if (library.presets.length <= 1) {
    throw appError('PRESET_LAST', 'The last preset cannot be deleted.')
  }
  return repairedLibrary(
    library.presets.filter((p) => p.id !== id),
    library.active === id ? null : library.active
  )
}

/** The library with `preset` kept over the one of its id or beside the others. */
export function withPreset(library: PresetLibrary, preset: PresetFile): PresetLibrary {
  const others = library.presets.filter((p) => p.id !== preset.id)
  return { active: library.active, presets: [...others, preset] }
}

/** Reads a preset file's text into a preset under `newId`; every way it can be refused is an app error. */
export function importPresetText(text: string, fileName: string, newId: string): Extract<ImportResult, { ok: true }> {
  if (text.length > MAX_PRESET_BYTES) throw appError('PRESET_TOO_LARGE', 'That preset file is too large.')
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw appError('PRESET_IMPORT_FAILED', 'That file is not valid JSON.')
  }
  // A preset exported from Prompt Studio comes in as a copy, as a foreign one does.
  const own = presetFromBackup(text, newId)
  if (own) {
    if (!own.ok) throw appError('PRESET_IMPORT_FAILED', own.error)
    return { ok: true, preset: own.preset, warnings: [] }
  }
  const result = importPreset(json, fileName, newId)
  if (!result.ok) throw appError('PRESET_IMPORT_FAILED', result.error)
  return result
}
