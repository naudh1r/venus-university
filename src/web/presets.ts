import { appError } from '@shared/errors'
import {
  importPresetText,
  listingOf,
  MAX_PRESET_BYTES,
  presetToKeep,
  readStoredPreset,
  repairedLibrary,
  withoutPreset,
  withPreset,
  type PresetLibrary
} from '@shared/presets/presetLibrary'
import { assertSafePresetId, isSafePresetId, type PresetFile } from '@shared/presets/presetRules'
import type { Preset, PresetImport, PresetListing } from '@shared/presets/types'
import { readPresetRow, writePresetRow } from './db/presets'
import { pickFile } from './transfer'

/** Prompt Studio's presets on the browser build: the same rules as the desktop's folder, over one row of the database. */

/** Every readable preset and the id in force, repaired the way the desktop's folder is; a repair is written back. */
async function readLibrary(): Promise<PresetLibrary> {
  const row = await readPresetRow()
  const stored = Array.isArray(row?.presets) ? row.presets : []
  const presets: PresetFile[] = []
  for (const item of stored) {
    const preset = readStoredPreset(item)
    if (preset) presets.push(preset)
    else console.warn('[presets] A stored preset was not valid; leaving it unused.')
  }
  const active = typeof row?.active === 'string' && isSafePresetId(row.active) ? row.active : null
  const library = repairedLibrary(presets, active)
  if (library.active !== active || library.presets.length !== presets.length) {
    await writePresetRow(library.active, library.presets)
  }
  return library
}

/** `presets.list` — every preset's summary, by name, and the id in force. */
export async function listPresets(): Promise<PresetListing> {
  return listingOf(await readLibrary())
}

/** `presets.get` — one preset whole. */
export async function getPreset(id: string): Promise<Preset> {
  assertSafePresetId(id)
  const found = (await readLibrary()).presets.find((p) => p.id === id)
  if (!found) throw appError('PRESET_NOT_FOUND', 'That preset is not stored.', id)
  return found
}

/** `presets.save` — keeps a preset under its own id, replacing one already there. */
export async function savePreset(preset: Preset): Promise<void> {
  assertSafePresetId(preset.id)
  const file = presetToKeep(preset)
  const library = withPreset(await readLibrary(), file)
  await writePresetRow(library.active, library.presets)
}

/** `presets.delete` — removes one; the last preset is refused, and deleting the one in force puts another in force. */
export async function deletePreset(id: string): Promise<void> {
  assertSafePresetId(id)
  const library = await readLibrary()
  const next = withoutPreset(library, id)
  if (next !== library) await writePresetRow(next.active, next.presets)
}

/** `presets.setActive` — puts a preset in force. */
export async function setActivePreset(id: string): Promise<void> {
  assertSafePresetId(id)
  const library = await readLibrary()
  if (!library.presets.some((p) => p.id === id)) {
    throw appError('PRESET_NOT_FOUND', 'That preset is not stored.', id)
  }
  await writePresetRow(id, library.presets)
}

/** `presets.import` — reads the SillyTavern, Marinara or exported Prompt Studio file the player picks into a preset under a fresh id; nothing is kept, and null where nothing was picked. */
export async function importPreset(): Promise<PresetImport | null> {
  const file = await pickFile('.json,.marinara,application/json')
  if (!file) return null
  if (file.size > MAX_PRESET_BYTES) throw appError('PRESET_TOO_LARGE', 'That preset file is too large.')
  const { preset, warnings } = importPresetText(await file.text(), file.name, crypto.randomUUID())
  return { preset, warnings }
}
