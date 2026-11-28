import { readdirSync, rmSync } from 'fs'
import { mkdir, rm } from 'fs/promises'
import { appError, toAppError } from '@shared/errors'
import type { ModSessionTable } from '@shared/modSession'
import type { PendingModChanges } from '@shared/modInstall'
import { writeAtomicJson, writeAtomicTextSync } from '../services/jsonFile'
import { CURRENT_FILE, INACTIVE_RELEASE } from './layout'
import {
  directoryExists, isModId, isModVersion, isRecord, modPath, readInstalledFile, readModText,
  writeInstalledFileSync
} from './installFiles'

const PENDING_FILE = 'pending.json'
export const STAGING_FOLDER = '.staging'
const empty = (): PendingModChanges => ({ pending: 1, current: {}, remove: [] })

/** Reads the whole journal before any entry can be used as a path. */
export function readPending(root: string): PendingModChanges {
  const text = readModText(modPath(root, PENDING_FILE))
  if (text === undefined) return empty()
  let file: unknown
  try {
    file = JSON.parse(text)
  } catch {
    throw appError('MOD_PENDING_FORMAT', 'pending.json is not readable JSON.')
  }
  if (!isRecord(file) || file.pending !== 1 || !isRecord(file.current) || !Array.isArray(file.remove)
      || Object.keys(file).some((key) => !['pending', 'current', 'remove', 'cleanup'].includes(key))
      || !Object.entries(file.current).every(([id, version]) => isModId(id) && isModVersion(version))
      || !file.remove.every((id) => isModId(id) && !Object.hasOwn(file.current as object, id))
      || !validCleanup(file.cleanup)) {
    throw appError('MOD_PENDING_FORMAT', 'pending.json has an unsupported format.')
  }
  return file as unknown as PendingModChanges
}

function validCleanup(cleanup: unknown): boolean {
  return cleanup === undefined || (isRecord(cleanup) && Object.entries(cleanup).every(([id, job]) =>
    isModId(id) && isRecord(job) && isModVersion(job.keep)
    && Array.isArray(job.versions) && job.versions.every((version) => isModVersion(version) && version !== job.keep)))
}

export async function writePending(root: string, file: PendingModChanges): Promise<void> {
  const path = modPath(root, PENDING_FILE)
  if (!Object.keys(file.current).length && !file.remove.length && !Object.keys(file.cleanup ?? {}).length) {
    await rm(path, { force: true })
    return
  }
  await mkdir(modPath(root), { recursive: true })
  await writeAtomicJson(path, file, { code: 'MOD_PENDING_WRITE', message: 'Could not write pending.json.' })
}

/** Removes an id's requested change. Scheduled housekeeping is independent of player actions. */
export function withoutPendingChange(file: PendingModChanges, id: string): PendingModChanges {
  const current = { ...file.current }
  delete current[id]
  return { ...file, current, remove: file.remove.filter((one) => one !== id) }
}

function idFolders(root: string): string[] {
  if (!directoryExists(modPath(root))) return []
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && isModId(entry.name)).map((entry) => entry.name)
}

/** Old versions are eligible only while the version confirmed at boot is still current. */
function oldVersions(root: string, pending: PendingModChanges): [string, readonly string[]][] {
  return Object.entries(pending.cleanup ?? {}).flatMap(([id, job]) => {
    if (pending.remove.includes(id) || (Object.hasOwn(pending.current, id) && pending.current[id] !== job.keep)) return []
    if (readModText(modPath(root, id, CURRENT_FILE))?.trim() !== job.keep) return []
    if (!directoryExists(modPath(root, id, job.keep))) return []
    return [[id, job.versions]]
  })
}

type ApplyPhase = 'current' | 'remove' | 'cleanup'

/** The journal is removed last so a stopped boot can repeat each completed step. */
export function applyPending(
  root: string,
  warn: (line: string) => void = console.warn,
  afterPhase?: (phase: ApplyPhase) => void
): boolean {
  let replaying = false
  try {
    const pending = readPending(root)
    const old = oldVersions(root, pending)
    // Check the referenced paths and records before starting the replay.
    const current = Object.entries(pending.current).flatMap(([id, version]) => {
      if (!directoryExists(modPath(root, id, version))) return []
      return [{
        version,
        path: modPath(root, id, CURRENT_FILE),
        marker: modPath(root, id, version, INACTIVE_RELEASE)
      }]
    })
    const removals = pending.remove.map((id) => modPath(root, id))
    const cleanup = old.flatMap(([id, versions]) => versions.map((version) => modPath(root, id, version)))
    const staging = modPath(root, STAGING_FOLDER)
    const installed = removals.length || cleanup.length ? readInstalledFile(root) : undefined

    replaying = true
    for (const entry of current) {
      writeAtomicTextSync(entry.path, entry.version + '\n', {
        code: 'MOD_PENDING_WRITE', message: 'Could not set a current mod version.'
      })
      rmSync(entry.marker, { force: true })
    }
    afterPhase?.('current')

    for (const path of removals) rmSync(path, { recursive: true, force: true })
    afterPhase?.('remove')

    for (const path of cleanup) rmSync(path, { recursive: true, force: true })
    for (const id of idFolders(root)) {
      for (const entry of readdirSync(modPath(root, id), { withFileTypes: true })) {
        if (entry.isDirectory() && entry.name.endsWith('.partial') && isModVersion(entry.name.slice(0, -8))) {
          rmSync(modPath(root, id, entry.name), { recursive: true, force: true })
        }
      }
    }
    rmSync(staging, { recursive: true, force: true })
    if (installed) {
      const mods = { ...installed.mods }
      for (const id of pending.remove) delete mods[id]
      for (const [id, versions] of old) {
        if (!Object.hasOwn(mods, id)) continue
        const records = { ...mods[id] }
        for (const version of versions) delete records[version]
        mods[id] = records
      }
      writeInstalledFileSync(root, { ...installed, mods })
    }
    afterPhase?.('cleanup')

    rmSync(modPath(root, PENDING_FILE), { force: true })
    return true
  } catch (error) {
    const failure = toAppError(error)
    warn(`[mods] pending changes could not be applied: ${failure.message}`)
    return !replaying
  }
}

/** Called after the renderer finishes loading mods on a normal start. */
export async function scheduleOldVersionCleanup(root: string, table: ModSessionTable): Promise<void> {
  if (table.safeStart || table.loaderError) return
  const pending = readPending(root)
  const installed = readInstalledFile(root)
  const cleanup = { ...pending.cleanup }
  for (const row of table.mods) {
    const { id, manifest } = row
    if (row.status !== 'loaded' || row.dev || !manifest || !isModId(id)) continue
    const records = Object.hasOwn(installed.mods, id) ? installed.mods[id] : undefined
    if (!records || !Object.hasOwn(records, manifest.version)) continue
    if (readModText(modPath(root, id, CURRENT_FILE))?.trim() !== manifest.version) continue
    const versions = readdirSync(modPath(root, id), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && isModVersion(entry.name) && entry.name !== manifest.version)
      .map((entry) => entry.name)
      .filter((version) => !lstatMarker(root, id, version))
    if (versions.length) cleanup[id] = { keep: manifest.version, versions }
  }
  if (Object.keys(cleanup).length) await writePending(root, { ...pending, cleanup })
}

/** Queues a return to an existing release and cancels its previously scheduled cleanup. */
export async function queueRollback(root: string, id: string, version: string): Promise<PendingModChanges> {
  const pending = readPending(root)
  if (!isModId(id) || !isModVersion(version) || !directoryExists(modPath(root, id, version))
      || lstatMarker(root, id, version)) {
    throw appError('MOD_ROLLBACK_VERSION', 'The previous mod version is unavailable.')
  }
  const cleanup = { ...pending.cleanup }
  delete cleanup[id]
  const next = withoutPendingChange({ ...pending, cleanup }, id)
  const changed = { ...next, current: { ...next.current, [id]: version } }
  await writePending(root, changed)
  return changed
}

function lstatMarker(root: string, id: string, version: string): boolean {
  return readModText(modPath(root, id, version, INACTIVE_RELEASE)) !== undefined
}
