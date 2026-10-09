import { mkdir } from 'fs/promises'
import {
  cleanSwitches,
  NO_SWITCHES,
  photoSwitchesOf,
  withPhotoSettingsCarried,
  type ModSwitches
} from '@shared/mods'
import { setPhotoSwitches } from '@shared/photoSwitches'
import { getDataPath, getModsPath } from '../paths'
import { readValidatedJson, writeAtomicJson } from './jsonFile'
import { getSettings } from './settingsService'

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
  const switches = withPhotoSettingsCarried(cleanSwitches(file), await settingsToCarry())
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

/** Settings Photo Feature's options carry over from; none where they cannot be read. */
async function settingsToCarry(): Promise<{ photos?: boolean; photoLoader?: string }> {
  try {
    const { photos, photoLoader } = await getSettings()
    return { photos, photoLoader }
  } catch {
    return {}
  }
}
