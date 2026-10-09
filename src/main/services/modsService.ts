import { mkdir, readFile } from 'fs/promises'
import {
  cleanSwitches,
  NO_SWITCHES,
  photoSwitchesOf,
  withPhotoSettingsCarried,
  type ModSwitches
} from '@shared/mods'
import { setPhotoSwitches } from '@shared/photoSwitches'
import { getDataPath, getModsPath, getSettingsPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'

/** Schema version this build reads and writes. */
const SCHEMA_VERSION = 1

/** `data/mods.json` as it is on disk. */
interface ModsFile extends ModSwitches {
  schemaVersion: number
}

/**
 * Reads `/data/mods.json`: which community mods the player has switched on and off, and their
 * options. With no file yet, every mod is at its default.
 */
export async function getModSwitches(): Promise<ModSwitches> {
  const file = await readValidatedJson<ModsFile>(getModsPath(), {
    label: 'mods.json',
    unreadable: { code: 'MODS_UNREADABLE', message: 'Could not read mods.json.' },
    malformed: {
      code: 'MODS_MALFORMED',
      message: 'mods.json is not valid JSON. Fix or delete the file to continue.'
    },
    schemaVersion: { code: 'MODS_SCHEMA_VERSION' },
    expects: SCHEMA_VERSION,
    required: { schemaVersion: true },
    onMissing: () => ({ schemaVersion: SCHEMA_VERSION, ...NO_SWITCHES })
  })
  const stored = cleanSwitches(file)
  const switches = withPhotoSettingsCarried(stored, await settingsToCarry())
  // Carried once and kept here: the game's next settings save drops what it does not know.
  if (switches !== stored) await setModSwitches(switches)
  // Main's own copy of Photo Feature's switches, for the renders it draws (body details).
  setPhotoSwitches(photoSwitchesOf(switches))
  return switches
}

/** Writes every switch and option atomically. */
export async function setModSwitches(switches: ModSwitches): Promise<void> {
  await mkdir(getDataPath(), { recursive: true })
  await writeAtomicJson(
    getModsPath(),
    { schemaVersion: SCHEMA_VERSION, ...cleanSwitches(switches) },
    { code: 'MODS_UNWRITABLE', message: 'Could not save mods.json.' }
  )
  setPhotoSwitches(photoSwitchesOf(switches))
}

/**
 * What 1.1.3 left in the game's `settings.json` for Photo Feature, read straight off the file:
 * the game's settings no longer know these keys. None where the file cannot be read.
 */
async function settingsToCarry(): Promise<Record<string, unknown>> {
  try {
    const raw: unknown = JSON.parse(await readFile(getSettingsPath(), 'utf-8'))
    if (!raw || typeof raw !== 'object') return {}
    const { photos, photoLoader, bodyDetails } = raw as Record<string, unknown>
    return { photos, photoLoader, bodyDetails }
  } catch {
    return {}
  }
}
