import { mkdir, readdir, readFile, rm, stat } from 'fs/promises'
import { basename } from 'path'
import { randomUUID } from 'crypto'
import { readJsonFile, registerFinalRequest, writeAtomicJson } from '@vx/modkit/main'
import { appError, messageOf } from '@vx/modkit/shared'
import {
  importPresetText,
  listingOf,
  MAX_PRESET_BYTES,
  presetToKeep,
  readStoredPreset,
  repairedLibrary,
  withoutPreset,
  type PresetLibrary
} from '../../shared/presets/presetLibrary'
import {
  assertSafePresetId,
  PRESET_SCHEMA_VERSION,
  validatePresetIndex,
  type PresetFile
} from '../../shared/presets/presetRules'
import { planPresetRequest } from '../../shared/presets/request'
import { PROMPT_STUDIO_MOD, type Preset, type PresetImport, type PresetListing, type PresetRequest } from '../../shared/presets/types'
import { getPresetFilePath, getPresetIndexPath, getPresetsPath } from '../paths'

/** The presets Prompt Studio keeps: one `{id}.json` each under `data/presets`, and `index.json` naming the one in force. */

const UNREADABLE = { code: 'PRESET_UNREADABLE', message: 'Could not read the presets.' }
const UNWRITABLE = { code: 'PRESET_UNWRITABLE', message: 'Could not save the preset.' }

/** The id in force named by `index.json`, or null where it is missing or damaged. */
async function readActiveId(): Promise<string | null> {
  try {
    const read = await readJsonFile<null>(getPresetIndexPath(), {
      malformed: { code: 'PRESET_INDEX_MALFORMED', message: 'The presets index is damaged.' },
      unreadable: UNREADABLE,
      onMissing: () => null
    })
    if (read.kind === 'missing') return null
    const checked = validatePresetIndex(read.parsed)
    if (!checked.ok) {
      console.warn(`[presets] index.json was not used: ${checked.error}`)
      return null
    }
    return checked.index.active
  } catch (err) {
    console.warn('[presets] index.json could not be read:', messageOf(err))
    return null
  }
}

/** Reads one preset file, or null (with a warning) where it is missing, damaged or kept under another id. */
async function readPresetFile(id: string): Promise<PresetFile | null> {
  try {
    const read = await readJsonFile<null>(getPresetFilePath(id), {
      malformed: { code: 'PRESET_MALFORMED', message: 'A preset is damaged.' },
      unreadable: UNREADABLE,
      onMissing: () => null
    })
    if (read.kind === 'missing') return null
    const preset = readStoredPreset(read.parsed, id)
    if (!preset) console.warn(`[presets] ${id}.json is not a valid preset; leaving it unused.`)
    return preset
  } catch (err) {
    console.warn(`[presets] ${id}.json could not be read:`, messageOf(err))
    return null
  }
}

/** The ids of every preset file in the folder; a name that is no safe id is left out. */
async function storedIds(): Promise<string[]> {
  let names: string[]
  try {
    names = await readdir(getPresetsPath())
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw appError(UNREADABLE.code, UNREADABLE.message, messageOf(err))
  }
  return names
    .filter((name) => name.endsWith('.json') && name !== 'index.json')
    .map((name) => name.slice(0, -'.json'.length))
    .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))
}

/** Writes one preset file. */
async function writePreset(preset: PresetFile): Promise<void> {
  await mkdir(getPresetsPath(), { recursive: true })
  await writeAtomicJson(getPresetFilePath(preset.id), preset, UNWRITABLE)
}

/** Writes `index.json`. */
async function writeActiveId(active: string): Promise<void> {
  await mkdir(getPresetsPath(), { recursive: true })
  await writeAtomicJson(getPresetIndexPath(), { schemaVersion: PRESET_SCHEMA_VERSION, active }, UNWRITABLE)
}

/**
 * Reads every preset, repairing what is missing: Default is created into an empty folder, and an
 * active id that names nothing readable is moved. A repair is written back.
 */
async function readLibrary(): Promise<PresetLibrary> {
  const ids = await storedIds()
  const presets: PresetFile[] = []
  for (const id of ids) {
    const preset = await readPresetFile(id)
    if (preset) presets.push(preset)
  }
  const stored = await readActiveId()
  const library = repairedLibrary(presets, stored, new Set(ids))
  for (const preset of library.presets) {
    if (!presets.includes(preset)) await writePreset(preset)
  }
  if (library.active !== stored) await writeActiveId(library.active)
  return library
}

/** `presets:list` — every preset's summary, by name, and the id in force. */
export async function listPresets(): Promise<PresetListing> {
  return listingOf(await readLibrary())
}

/** `presets:get` — one preset whole; an id nothing readable is kept under is refused. */
export async function getPreset(id: string): Promise<Preset> {
  assertSafePresetId(id)
  const preset = await readPresetFile(id)
  if (!preset) throw appError('PRESET_NOT_FOUND', 'That preset is not stored.', id)
  return preset
}

/** `presets:save` — keeps a preset under its own id, replacing one already there. */
export async function savePreset(preset: Preset): Promise<void> {
  assertSafePresetId(preset.id)
  const file = presetToKeep(preset)
  // An empty folder gets its Default and index before a first preset joins them.
  await readLibrary()
  await writePreset(file)
}

/** `presets:delete` — removes one; the last preset is refused, and deleting the one in force puts another in force. */
export async function deletePreset(id: string): Promise<void> {
  assertSafePresetId(id)
  const library = await readLibrary()
  const next = withoutPreset(library, id)
  if (next === library) return
  await rm(getPresetFilePath(id), { force: true })
  if (next.active !== library.active) await writeActiveId(next.active)
}

/** `presets:setActive` — puts a preset in force; an id nothing is kept under is refused. */
export async function setActivePreset(id: string): Promise<void> {
  assertSafePresetId(id)
  const library = await readLibrary()
  if (!library.presets.some((p) => p.id === id)) {
    throw appError('PRESET_NOT_FOUND', 'That preset is not stored.', id)
  }
  await writeActiveId(id)
}

/**
 * The preset in force, read without repairing anything: null, with a warning, where there is none
 * or it is damaged, so a scene call goes on without a preset instead of failing.
 */
async function loadActivePreset(): Promise<Preset | null> {
  const active = await readActiveId()
  if (active === null) {
    console.warn('[presets] No active preset is named; sending the scene without one.')
    return null
  }
  const preset = await readPresetFile(active)
  if (!preset) console.warn('[presets] The active preset could not be read; sending the scene without one.')
  return preset
}

// A scene call the window tagged is rearranged by the active preset, and its reply's `vars` ops
// are read back into the variables the window keeps.
registerFinalRequest(PROMPT_STUDIO_MOD, async (request, { tag }) => {
  const preset = await loadActivePreset()
  return preset ? planPresetRequest(request, tag as PresetRequest, preset) : null
})

/** `presets:import` — reads the SillyTavern, Marinara or exported Prompt Studio file at `path` into a preset under a fresh id; nothing is kept. */
export async function importPresetFromFile(path: string): Promise<PresetImport> {
  let text: string
  try {
    const size = (await stat(path)).size
    if (size > MAX_PRESET_BYTES) throw appError('PRESET_TOO_LARGE', 'That preset file is too large.')
    text = await readFile(path, 'utf-8')
  } catch (err) {
    if (typeof err === 'object' && err !== null && 'code' in err && err.code === 'PRESET_TOO_LARGE') throw err
    throw appError(UNREADABLE.code, 'Could not read that file.', messageOf(err))
  }
  const { preset, warnings } = importPresetText(text, basename(path), randomUUID())
  return { preset, warnings }
}
