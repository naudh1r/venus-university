import { importMarinara } from './importMarinara'
import { importSillyTavern } from './importSillyTavern'
import type { ImportResult } from './importCommon'
import type { PresetSource } from './types'

export type { ImportResult } from './importCommon'

/** Which foreign format a parsed file is, or null when it is neither. */
export function detectPresetFormat(json: unknown): Exclude<PresetSource, 'native'> | null {
  if (typeof json !== 'object' || json === null || Array.isArray(json)) return null
  const root = json as Record<string, unknown>
  if (root.type === 'marinara_preset' || (typeof root.data === 'object' && root.data !== null && 'sections' in root.data)) {
    return 'marinara'
  }
  if (Array.isArray(root.prompts)) return 'sillytavern'
  return null
}

/** The preset's name taken from its file name, without the folder or the `.json` / `.marinara` endings. */
function nameFromFile(fileName: string): string {
  const base = fileName.split(/[\/]/).pop() ?? fileName
  const name = base.replace(/\.json$/i, '').replace(/\.marinara$/i, '').trim()
  return name === '' ? 'Imported preset' : name
}

/**
 * Reads a parsed preset file of either format into a preset with id `newId`. Never throws: a file it
 * cannot read answers with the reason.
 */
export function importPreset(json: unknown, fileName: string, newId: string): ImportResult {
  try {
    const format = detectPresetFormat(json)
    if (format === null) return { ok: false, error: 'That file is not a SillyTavern, Marinara or Prompt Studio preset.' }
    const root = json as Record<string, unknown>
    if (format === 'sillytavern') return importSillyTavern(root, nameFromFile(fileName), newId)
    const data = root.data as { preset?: { name?: unknown } } | undefined
    const named = typeof data?.preset?.name === 'string' && data.preset.name.trim() !== '' ? data.preset.name.trim() : nameFromFile(fileName)
    return importMarinara(root, named, newId)
  } catch (err) {
    return { ok: false, error: `That preset could not be read: ${err instanceof Error ? err.message : String(err)}` }
  }
}
