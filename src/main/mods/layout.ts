import { lstatSync, readdirSync, readFileSync, statSync, type Dirent } from 'fs'
import { join, resolve } from 'path'
import { compareVersions, parseVersion, type Version } from '../../../packages/modkit/src/shared/range'

/**
 * Where the installed mods are on disk, and which version of each is in use:
 *
 *     data/mods/installed.json             the installer's record of each install, by id and version
 *     data/mods/<id>/current               one line, the version in use (optional)
 *     data/mods/<id>/<version>/vxmod.json  a release, unpacked
 *
 * Reads folder listings, the `current` files and the installer's record only: no manifest is
 * opened, and nothing is written, moved or deleted.
 */

/** The shape a folder under `data/mods/` must be named in to be read as a mod id. */
const MOD_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/

/** The file in an id folder that names the version in use. */
export const CURRENT_FILE = 'current'

/** A release unpacked by the installer and waiting for activation. */
export const INACTIVE_RELEASE = '.vx-inactive'

/** The installer's record, beside the id folders. */
export const INSTALLED_FILE = 'installed.json'

/** One install as the installer recorded it. */
export interface InstallRecord {
  /** Where the zip came from. */
  readonly source: string
  /** The zip's hash. */
  readonly sha256: string
  /** Whether the source is on the build's approved list, which lets the mod's `main.js` run. */
  readonly approved: boolean
  readonly installedAt: string
}

/**
 * `data/mods/installed.json`: the installer's records by id, then by version. The installer alone
 * writes it, outside every mod's folder, so a record inside a folder says nothing.
 */
export interface InstalledFile {
  readonly schemaVersion: 1
  readonly mods: Readonly<Record<string, Readonly<Record<string, InstallRecord>>>>
}

export interface InstalledRecords {
  /** Whether the installer recorded this id at this version as coming from an approved source. */
  readonly approved: (id: string, version: string) => boolean
  /** Lines for the log where the file is there but not readable. */
  readonly notes: readonly string[]
}

export interface ModFolder {
  /** The folder's name under `data/mods/`, which the manifest's id must match. */
  readonly id: string
  /** The version folder picked, or null where none could be. */
  readonly version: string | null
  /** The absolute path of the version folder picked (or of the id's folder when `version` is null). */
  readonly folder: string
  /** Why no version folder could be picked; null where one was. */
  readonly problem: string | null
  /** Lines for the log: a `current` that is missing with several versions present, folders skipped. */
  readonly notes: readonly string[]
}

export interface InstalledMods {
  /** One entry per id folder, sorted by id. */
  readonly mods: readonly ModFolder[]
  /** Lines for the log about folders under `data/mods/` that are not mods at all. */
  readonly notes: readonly string[]
}

/** True for a directory, or a link (a junction, say) to one. */
function isDirectory(parent: string, entry: Dirent): boolean {
  if (entry.isDirectory()) return true
  if (!entry.isSymbolicLink()) return false
  return statSync(join(parent, entry.name), { throwIfNoEntry: false })?.isDirectory() ?? false
}

/** A folder's entries, sorted by name; a folder that is not there has none. */
function listFolder(path: string): Dirent[] {
  try {
    return readdirSync(path, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code === 'ENOENT' || code === 'ENOTDIR') return []
    throw error
  }
}

/** The version `current` names, trimmed; null where the file is absent or blank. */
function readCurrent(folder: string, entries: readonly Dirent[]): string | null {
  const file = entries.find((entry) => entry.name === CURRENT_FILE && entry.isFile())
  if (!file) return null
  const text = readFileSync(join(folder, CURRENT_FILE), 'utf8').trim()
  return text === '' ? null : text
}

/** The highest of several version folder names. */
function highest(versions: readonly string[]): string {
  const parsed = (name: string): Version => parseVersion(name) as Version
  return versions.reduce((best, name) => (compareVersions(parsed(name), parsed(best)) > 0 ? name : best))
}

/**
 * Picks the version folder of one mod: the one `current` names, else the only one, else the
 * highest. Subdirectories that are not versions are noted and ignored, as are files.
 */
function pickVersion(id: string, idFolder: string): ModFolder | null {
  const entries = listFolder(idFolder)
  const notes: string[] = []
  const versions: string[] = []
  let staging = false
  for (const entry of entries) {
    if (!isDirectory(idFolder, entry)) continue
    if (parseVersion(entry.name)) {
      const inactive = lstatSync(join(idFolder, entry.name, INACTIVE_RELEASE), { throwIfNoEntry: false })
      if (inactive) staging = true
      else versions.push(entry.name)
    } else {
      if (entry.name.endsWith('.partial') && parseVersion(entry.name.slice(0, -8))) staging = true
      notes.push(`${id}: ignored folder "${entry.name}"`)
    }
  }

  const picked = (version: string): ModFolder => ({ id, version, folder: join(idFolder, version), problem: null, notes })
  const unpicked = (problem: string): ModFolder => ({ id, version: null, folder: idFolder, problem, notes })

  const current = readCurrent(idFolder, entries)
  if (current !== null) {
    return versions.includes(current) ? picked(current) : unpicked(`current names ${current}, which is not there`)
  }
  if (versions.length === 0) return staging ? null : unpicked('no version folder')
  if (versions.length === 1) return picked(versions[0])
  const version = highest(versions)
  notes.push(`${id}: several versions and no "current"; using ${version}`)
  return picked(version)
}

/** Reads the installer's record under `modsDir`. No file, or one that cannot be read, approves nothing. */
export function readInstalled(modsDir: string): InstalledRecords {
  const path = join(resolve(modsDir), INSTALLED_FILE)
  const notes: string[] = []
  let mods: Record<string, Record<string, { approved?: unknown } | undefined> | undefined> = {}
  try {
    if (!lstatSync(path).isFile()) {
      notes.push(`${INSTALLED_FILE} is not a plain file; no install counts as approved`)
      return { approved: () => false, notes }
    }
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as { mods?: unknown } | null
    if (parsed && typeof parsed === 'object' && parsed.mods && typeof parsed.mods === 'object') mods = parsed.mods as typeof mods
    else notes.push(`${INSTALLED_FILE} has no "mods"; no install counts as approved`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      notes.push(`${INSTALLED_FILE} cannot be read: ${(error as Error).message}; no install counts as approved`)
    }
  }
  return { approved: (id, version) => Object.hasOwn(mods, id) && mods[id]?.[version]?.approved === true, notes }
}

/** Lists the mods installed under `modsDir`, one entry per id folder, sorted by id. A missing `modsDir` is no mods. */
export function findInstalledMods(modsDir: string): InstalledMods {
  const root = resolve(modsDir)
  const mods: ModFolder[] = []
  const notes: string[] = []
  for (const entry of listFolder(root)) {
    if (!isDirectory(root, entry)) continue
    if (!MOD_ID.test(entry.name)) {
      notes.push(`skipped "${entry.name}": not a mod id`)
      continue
    }
    const picked = pickVersion(entry.name, join(root, entry.name))
    if (picked) mods.push(picked)
  }
  return { mods, notes }
}
