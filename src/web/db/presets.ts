import { PRESET_SCHEMA_VERSION, type PresetFile } from '@shared/presets/presetRules'
import { database, storage } from './open'

/** Prompt Studio's presets: one row holding every preset and the id in force, read and written whole. */

/** What the row holds. */
export interface StoredPresets {
  schemaVersion: number
  active: string
  /** Each is checked as it is read; a malformed one is left out. */
  presets: unknown[]
}

/** The stored row, or none where nothing has been kept yet. */
export async function readPresetRow(): Promise<StoredPresets | null> {
  const stored = await storage('read the presets', async () => (await database()).get('presets', 'presets'))
  return stored ?? null
}

/** Replaces the row. */
export async function writePresetRow(active: string, presets: PresetFile[]): Promise<void> {
  await storage('save the presets', async () =>
    (await database()).put('presets', { schemaVersion: PRESET_SCHEMA_VERSION, active, presets }, 'presets')
  )
}
