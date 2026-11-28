import { lstatSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { MOD_ID_RULE, RESERVED_MOD_IDS } from '@vx/modkit/host/shared'
import { appError } from '@shared/errors'
import { isWindowsDeviceName } from '@shared/zipRules'
import { parseVersion } from '../../../packages/modkit/src/shared/range'
import { writeAtomicJson } from '../services/jsonFile'
import { INSTALLED_FILE, type InstalledFile } from './layout'

export function isModId(id: unknown): id is string {
  return typeof id === 'string' && MOD_ID_RULE.test(id)
    && !RESERVED_MOD_IDS.includes(id) && !isWindowsDeviceName(id)
}

export function isModVersion(version: unknown): version is string {
  return typeof version === 'string' && parseVersion(version) !== null
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Checks the root and each child before handing a path to an installer operation. */
export function modPath(root: string, ...segments: string[]): string {
  let path = resolve(root)
  for (const segment of [...segments, null]) {
    const entry = lstatSync(path, { throwIfNoEntry: false })
    if (entry?.isSymbolicLink() || (segment !== null && entry && !entry.isDirectory())) {
      throw appError('MOD_INSTALL_PATH', 'A path in the mods folder is a link or has the wrong type.', path)
    }
    if (segment === null) break
    if (!segment || /^[.]{1,2}$|[\\/:\x00-\x1f]|[. ]$/.test(segment) || isWindowsDeviceName(segment)) {
      throw appError('MOD_INSTALL_PATH', 'An invalid path was supplied for the mods folder.')
    }
    path = join(path, segment)
  }
  return path
}

export function directoryExists(path: string): boolean {
  return lstatSync(path, { throwIfNoEntry: false })?.isDirectory() ?? false
}

export function readModText(path: string): string | undefined {
  const entry = lstatSync(path, { throwIfNoEntry: false })
  if (!entry) return undefined
  if (!entry.isFile()) throw appError('MOD_INSTALL_PATH', 'Expected a file in the mods folder.', path)
  return readFileSync(path, 'utf8')
}

export function readInstalledFile(root: string): InstalledFile {
  const contents = readModText(modPath(root, INSTALLED_FILE))
  if (contents === undefined) return { schemaVersion: 1, mods: {} }
  let file: unknown
  try {
    file = JSON.parse(contents)
  } catch {
    throw appError('MOD_INSTALL_RECORD', 'installed.json is not readable JSON.')
  }
  if (!isRecord(file) || file.schemaVersion !== 1 || !isRecord(file.mods)
      || !Object.values(file.mods).every(isRecord)) {
    throw appError('MOD_INSTALL_RECORD', 'installed.json has an unsupported format.')
  }
  return file as unknown as InstalledFile
}

export function writeInstalledFile(root: string, file: InstalledFile): Promise<void> {
  return writeAtomicJson(modPath(root, INSTALLED_FILE), file, {
    code: 'MOD_INSTALL_RECORD', message: 'Could not write installed.json.'
  })
}
