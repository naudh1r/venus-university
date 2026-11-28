import { MOD_ID_RULE, RESERVED_MOD_IDS } from '@vx/modkit/host/shared'
import { randomUUID } from 'crypto'
import { lstatSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'fs'
import { isAbsolute, join, relative, resolve, sep } from 'path'
import type { InstalledFile } from './layout'

export const INSTALL_RECORD = 'installed.json'

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

export function readInstallRecord(root: string): InstalledFile {
  const rootEntry = lstatSync(root, { throwIfNoEntry: false })
  if (rootEntry && !rootEntry.isDirectory()) throw new Error('The mods folder cannot be safely updated.')
  const path = join(root, INSTALL_RECORD)
  const entry = lstatSync(path, { throwIfNoEntry: false })
  if (!entry) return { schemaVersion: 1, mods: {} }
  if (!entry.isFile()) throw new Error('installed.json cannot be safely updated.')
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'))
  if (!object(raw) || raw.schemaVersion !== 1 || !object(raw.mods) ||
      (raw.pendingRemoval !== undefined &&
        (!Array.isArray(raw.pendingRemoval) || !raw.pendingRemoval.every((id) => typeof id === 'string')))) {
    throw new Error('installed.json cannot be safely updated.')
  }
  return raw as unknown as InstalledFile
}

export function recordedInstall(record: InstalledFile, id: string): boolean {
  return Object.hasOwn(record.mods, id) && object(record.mods[id]) && Object.keys(record.mods[id]).length > 0
}

export function removableId(id: unknown, builtIn: readonly string[]): id is string {
  return typeof id === 'string' && MOD_ID_RULE.test(id) &&
    !RESERVED_MOD_IDS.includes(id) && !builtIn.includes(id)
}

/** Reject links and junctions at the installation root or mod folder before removing anything. */
export function removalFolder(root: string, id: string): string {
  const folder = join(root, id)
  const rootEntry = lstatSync(root, { throwIfNoEntry: false })
  if (!rootEntry) return folder
  const entry = lstatSync(folder, { throwIfNoEntry: false })
  if (!rootEntry.isDirectory() ||
      (entry && (!entry.isDirectory() || realpathSync(folder) !== join(realpathSync(root), id)))) {
    throw new Error('That mod folder cannot be safely removed.')
  }
  return folder
}

/** A developer folder inside an installed release belongs to the developer-folder controls. */
export function hasDeveloperFolder(root: string, id: string, folders: readonly string[]): boolean {
  const install = join(realpathSync(root), id)
  return folders.some((folder) => {
    let path = resolve(folder)
    try {
      path = realpathSync(path)
    } catch {
      // A missing folder still has its configured location.
    }
    const within = relative(install, path)
    return !isAbsolute(within) && within !== '..' && !within.startsWith(`..${sep}`)
  })
}

/** Runs before the loader. Keep unresolved removals out of this session and retry next start. */
export function finishPendingRemovals(
  root: string,
  builtIn: readonly string[] = [],
  warn: (message: string) => void = console.warn,
  devFolders: readonly string[] = []
): ReadonlySet<string> {
  let record: InstalledFile
  try {
    record = readInstallRecord(root)
  } catch (error) {
    warn(`[mods] Could not read pending removals: ${String(error)}`)
    return new Set()
  }
  const requests = new Set(record.pendingRemoval ?? [])
  const blocked = new Set<string>()
  const mods = { ...record.mods }
  for (const id of requests) {
    if (!removableId(id, builtIn) || !recordedInstall(record, id)) continue
    try {
      const folder = removalFolder(root, id)
      if (hasDeveloperFolder(root, id, devFolders))
        throw new Error('A developer folder is inside this mod folder.')
      rmSync(folder, { recursive: true, force: true })
      delete mods[id]
    } catch (error) {
      blocked.add(id)
      warn(`[mods] Could not remove ${id}. Will retry at next start: ${String(error)}`)
    }
  }
  if (requests.size === blocked.size) return blocked

  // The loader is synchronous. Replace the record from a temporary file in the same directory.
  const temp = join(root, `.installed-${randomUUID()}.tmp`)
  try {
    writeFileSync(temp, JSON.stringify({ ...record, mods, pendingRemoval: [...blocked] }, null, 2), { flag: 'wx' })
    renameSync(temp, join(root, INSTALL_RECORD))
  } catch (error) {
    warn(`[mods] Could not save completed removals: ${String(error)}`)
  } finally {
    try {
      rmSync(temp, { force: true })
    } catch (error) {
      warn(`[mods] Could not clean up removal record: ${String(error)}`)
    }
  }
  return blocked
}
