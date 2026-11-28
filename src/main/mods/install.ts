import { lstatSync } from 'fs'
import { mkdir, readFile, rename, rm, statfs, writeFile } from 'fs/promises'
import { isDeepStrictEqual } from 'util'
import { checkCompat, hookNameKind, parseManifest, type InstallChange, type SourceRelease } from '@vx/modkit/host/shared'
import { appError, toAppError } from '@shared/errors'
import type { FetchedModSource, ModInstallProgress, PendingModChanges } from '@shared/modInstall'
import { MAX_ZIP_BYTES } from '@shared/zipRules'
import { downloadFile, hashFile, redactUrl } from '../services/downloadService'
import { directoryExists, isModId, isModVersion, modPath, readInstalledFile, writeInstalledFile } from './installFiles'
import { INACTIVE_RELEASE, type InstallRecord } from './layout'
import { readPending, STAGING_FOLDER, withoutPendingChange, writePending } from './pending'
import { releaseManifest, unpackRelease } from './unpack'

interface InstallOptions {
  readonly builtIn: ReadonlySet<string>
  readonly allowUnreviewedMain: boolean
  readonly fetch?: typeof fetch
  readonly freeBytes?: (root: string) => Promise<bigint>
  readonly progress?: (event: ModInstallProgress) => void
}

async function diskFree(path: string): Promise<bigint> {
  const volume = await statfs(path, { bigint: true })
  return volume.bsize * volume.bavail
}

function fail(code: string, message: string, address?: string): never {
  throw appError(code, message, address === undefined ? undefined : redactUrl(address))
}

/** Checks a single listed release, before any download can take place. */
export function checkInstallRelease(source: FetchedModSource, release: SourceRelease, options: InstallOptions): boolean {
  const { manifest } = release
  if (options.builtIn.has(manifest.id)) fail('MOD_INSTALL_BUILT_IN', `${manifest.name} is part of this build.`)
  const compat = checkCompat(manifest.hooks.filter((hook) => hookNameKind(hook).kind !== 'export'))
  if (compat.status !== 'loads') fail('MOD_INSTALL_COMPAT', `${manifest.name}: ${compat.message}`)
  if (!Number.isSafeInteger(release.size) || release.size <= 0 || release.size > MAX_ZIP_BYTES) {
    fail('MOD_INSTALL_LISTING', 'The release has no valid download size.')
  }
  const pinned = typeof release.sha256 === 'string' && /^[a-f0-9]{64}$/i.test(release.sha256)
  if (source.kind === 'list' && !pinned) fail('MOD_INSTALL_LISTING', 'The list has no valid release hash.')
  const approved = source.kind === 'list' && source.approvedList && pinned
  if (manifest.main && !approved && !options.allowUnreviewedMain) {
    fail('MOD_INSTALL_UNREVIEWED_MAIN', `${manifest.name} has unreviewed main-process code.`)
  }
  return approved
}

function inactive(root: string, id: string, version: string): boolean {
  return lstatSync(modPath(root, id, version, INACTIVE_RELEASE), { throwIfNoEntry: false })?.isFile() ?? false
}

async function downloadZip(change: InstallChange, path: string, options: InstallOptions): Promise<void> {
  const { id, release } = change
  const { version, zip, size } = release
  const controller = new AbortController()
  let timer: NodeJS.Timeout | undefined
  const beat = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => controller.abort(), 60_000)
  }
  const progress = (bytesDone: number): void =>
    options.progress?.({ id, version, phase: 'downloading', bytesDone, bytesTotal: size })
  beat()
  try {
    progress(0)
    await downloadFile({
      url: zip, destPath: path, maxBytes: size, fetch: options.fetch, httpsOnlyRedirects: true,
      signal: controller.signal, onProgress: ({ bytesDone }) => {
        beat()
        progress(bytesDone)
      }
    })
  } catch (error) {
    const { code } = toAppError(error, 'MOD_INSTALL_DOWNLOAD')
    if (controller.signal.aborted) fail('MOD_INSTALL_STALLED', 'The mod download stalled.', zip)
    fail(code, `Could not download ${id} ${version}.`, zip)
  } finally {
    clearTimeout(timer)
  }
}

/** Stages one release. The loader ignores the marker until startup activates the release. */
async function stageRelease(root: string, change: InstallChange, approved: boolean, options: InstallOptions): Promise<InstallRecord> {
  const { id, release } = change
  const { version, zip } = release
  const partial = modPath(root, id, version + '.partial')
  const target = modPath(root, id, version)
  const archive = modPath(root, STAGING_FOLDER, `${id}-${version}.zip`)
  modPath(root, STAGING_FOLDER, `${id}-${version}.zip.partial`)
  const report = (phase: 'checking' | 'unpacking'): void => options.progress?.({ id, version, phase })

  try {
    await downloadZip(change, archive, options)
    report('checking')
    const { sha256 } = await hashFile(archive)
    if (release.sha256 && sha256 !== release.sha256.toLowerCase()) {
      fail('MOD_INSTALL_HASH', 'The file is not the one that was reviewed.', zip)
    }
    const bytes = await readFile(archive)
    let manifest: unknown
    try {
      manifest = releaseManifest(bytes)
    } catch {
      fail('MOD_INSTALL_MANIFEST', 'The release zip has no readable vxmod.json.', zip)
    }
    if (!parseManifest(manifest, { id, version }).ok || !isDeepStrictEqual(manifest, release.manifest)) {
      fail('MOD_INSTALL_MANIFEST', 'The zip manifest does not match the listed manifest.', zip)
    }
    report('unpacking')
    await rm(partial, { recursive: true, force: true })
    await mkdir(partial, { recursive: true })
    try {
      unpackRelease(bytes, modPath(root, id, version + '.partial'))
    } catch {
      fail('MOD_INSTALL_UNPACK', 'The release zip could not be unpacked.', zip)
    }
    await writeFile(modPath(root, id, version + '.partial', INACTIVE_RELEASE), '', { flag: 'wx' })
    if (inactive(root, id, version)) await rm(target, { recursive: true, force: true })
    await rename(partial, target)
    return { source: change.source, sha256, approved, installedAt: new Date().toISOString() }
  } finally {
    await rm(archive, { force: true }).catch(() => {})
  }
}

/** The caller serializes this with all other installer writes. */
export async function installPlan(
  root: string,
  changes: readonly InstallChange[],
  sources: readonly FetchedModSource[],
  options: InstallOptions
): Promise<PendingModChanges> {
  const pending = readPending(root)
  if (changes.length === 0) return pending
  const records = readInstalledFile(root)
  const ids = new Set<string>()
  const plan = changes.map((change) => {
    const { id, release } = change
    const { version } = release
    const source = sources.find((one) => one.url === change.source)
    const mod = source?.source.mods.find((entry) => entry.id === id)
    const listed = mod?.releases.find((entry) => entry.version === version)
    if (!isModId(id) || !isModVersion(version) || ids.has(id) || !source || !listed
        || mod?.withdrawn?.some((entry) => entry.version === version)
        || !isDeepStrictEqual(release, listed) || release.manifest.id !== id || release.manifest.version !== version) {
      fail('MOD_INSTALL_LISTING', 'The install plan no longer matches the source listing.')
    }
    ids.add(id)
    const approved = checkInstallRelease(source, listed, options)
    const target = modPath(root, id, version)
    if (lstatSync(target, { throwIfNoEntry: false })
        && (!directoryExists(target) || !inactive(root, id, version)
          || (Object.hasOwn(pending.current, id) && pending.current[id] === version))) {
      fail('MOD_INSTALL_EXISTS', `${id} ${version} already exists in the mods folder.`)
    }
    modPath(root, id, version + '.partial')
    return { change, approved }
  })
  await mkdir(modPath(root), { recursive: true })
  const required = plan.reduce((bytes, { change }) => bytes + BigInt(change.release.size) * 3n, 0n)
  if (await (options.freeBytes ?? diskFree)(root) < required) {
    fail('MOD_INSTALL_DISK_FULL', 'There is not enough free space to download and unpack these mods.')
  }
  await mkdir(modPath(root, STAGING_FOLDER), { recursive: true })

  const mods = new Map(Object.entries(records.mods))
  let next = pending
  for (const { change, approved } of plan) {
    const { id, release } = change
    const record = await stageRelease(root, change, approved, options)
    mods.set(id, { ...mods.get(id), [release.version]: record })
    next = withoutPendingChange(next, id)
    next = { ...next, current: { ...next.current, [id]: release.version } }
  }
  await writeInstalledFile(root, { ...records, mods: Object.fromEntries(mods) })
  await writePending(root, next)
  for (const { change } of plan) {
    options.progress?.({ id: change.id, version: change.release.version, phase: 'recorded' })
  }
  return next
}

/** Revokes approval from withdrawn releases only when the designated approved list supplied them. */
export async function revokeWithdrawn(root: string, source: FetchedModSource): Promise<void> {
  if (!source.approvedList || source.kind !== 'list') return
  if (!source.source.mods.some((mod) => mod.withdrawn?.length)) return
  const installed = readInstalledFile(root)
  let changed = false
  const mods = { ...installed.mods }
  for (const mod of source.source.mods) {
    if (!mod.withdrawn?.length || !Object.hasOwn(mods, mod.id)) continue
    const records = { ...mods[mod.id] }
    for (const { version } of mod.withdrawn) {
      const record = records[version]
      if (record?.approved === true) {
        records[version] = { ...record, approved: false }
        changed = true
      }
    }
    mods[mod.id] = records
  }
  if (changed) await writeInstalledFile(root, { ...installed, mods })
}
