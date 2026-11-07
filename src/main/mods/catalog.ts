import { MOD_ID_RULE, RESERVED_MOD_IDS, parseManifest } from '@vx/modkit/host/shared'
import { KIT_VERSION } from '../../../packages/modkit/src/shared/version'
import { parseRange, parseVersion, satisfies } from '../../../packages/modkit/src/shared/range'
import type { CatalogMod, CatalogRelease } from '@shared/modCatalog'
import { appError } from '@shared/errors'
import { randomUUID } from 'crypto'
import { existsSync } from 'fs'
import { mkdir, readFile, rename, rm } from 'fs/promises'
import { join } from 'path'
import {
  downloadFile,
  type DownloadOptions,
  type DownloadOutcome
} from '../services/downloadService'
import { writeAtomicBytes, writeAtomicJson } from '../services/jsonFile'
import { findInstalledMods, type InstalledFile } from './layout'
import { unpackRelease } from './unpack'

export const DEFAULT_CATALOG_URL =
  'https://raw.githubusercontent.com/naudh1r/venus-university/notes/standalone-mods/catalog.json'
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const https = (v: unknown): v is string => {
  try {
    return text(v) && new URL(v).protocol === 'https:'
  } catch {
    return false
  }
}

/** Invalid entries are isolated; only an unreadable index envelope fails the fetch. */
export function parseCatalog(
  raw: unknown,
  log: (line: string) => void = console.warn
): CatalogMod[] {
  if (!object(raw) || raw.schemaVersion !== 1 || !Array.isArray(raw.mods))
    throw new Error('The mod catalogue format is not supported.')
  const mods: CatalogMod[] = []
  for (const entry of raw.mods) {
    try {
      if (
        !object(entry) ||
        !text(entry.id) ||
        !MOD_ID_RULE.test(entry.id) ||
        RESERVED_MOD_IDS.includes(entry.id) ||
        !text(entry.name) ||
        !text(entry.author) ||
        !text(entry.blurb) ||
        !https(entry.source) ||
        !Array.isArray(entry.releases) ||
        mods.some((m) => m.id === entry.id)
      )
        throw new Error('invalid mod or duplicate id')
      const releases: CatalogRelease[] = []
      for (const r of entry.releases) {
        if (
          !object(r) ||
          !text(r.version) ||
          !parseVersion(r.version) ||
          releases.some((one) => one.version === r.version) ||
          !https(r.url) ||
          typeof r.sha256 !== 'string' ||
          !/^[a-f0-9]{64}$/i.test(r.sha256) ||
          !text(r.kit) ||
          !parseRange(r.kit) ||
          (r.game !== undefined && (!text(r.game) || !parseRange(r.game))) ||
          typeof r.main !== 'boolean' ||
          typeof r.reviewed !== 'boolean' ||
          !text(r.released) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(r.released) ||
          !Array.isArray(r.changes) ||
          !r.changes.every(text)
        ) {
          log(`[mods catalogue] dropped a release of ${entry.id}: invalid release`)
          continue
        }
        releases.push({
          version: r.version,
          url: r.url,
          sha256: r.sha256,
          kit: r.kit,
          game: r.game as string | undefined,
          main: r.main,
          reviewed: r.reviewed,
          released: r.released,
          changes: [...r.changes] as string[],
          incompatible: satisfies(KIT_VERSION, r.kit)
            ? null
            : `Needs kit ${r.kit}; this build has ${KIT_VERSION}.`
        })
      }
      if (!releases.length) throw new Error('no valid releases')
      mods.push({
        id: entry.id,
        name: entry.name,
        author: entry.author,
        blurb: entry.blurb,
        source: entry.source,
        releases,
        installedVersion: null
      })
    } catch (error) {
      log(`[mods catalogue] dropped an entry: ${String(error)}`)
    }
  }
  return mods
}

/** One owner for the last index and a serialized install queue, including record updates. */
export class ModCatalog {
  private mods: CatalogMod[] = []
  private queue: Promise<unknown> = Promise.resolve()
  constructor(
    private readonly root: string,
    private readonly download: (
      options: DownloadOptions
    ) => Promise<DownloadOutcome> = downloadFile,
    private readonly builtIn: readonly string[] = []
  ) {}

  async read(url: string): Promise<CatalogMod[]> {
    if (!https(url)) throw new Error('The mod catalogue address must use https.')
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok)
      throw new Error(`Could not fetch the mod catalogue (HTTP ${response.status}).`)
    if (!https(response.url)) throw new Error('The mod catalogue address must use https.')
    this.mods = parseCatalog(await response.json())
    return this.list()
  }

  /** Also used by offline tests, with the same parser as a fetched index. */
  setIndex(raw: unknown): void {
    this.mods = parseCatalog(raw)
  }

  list(): CatalogMod[] {
    const installed = findInstalledMods(this.root).mods
    return this.mods.map((mod) => ({
      ...mod,
      installedVersion: installed.find((one) => one.id === mod.id)?.version ?? null
    }))
  }

  installRelease(id: string, version: string, approved = false): Promise<void> {
    // Capture only a release main has read, never an address supplied by the window.
    const mod = this.mods.find((one) => one.id === id)
    const release = mod?.releases.find((one) => one.version === version)
    const run = this.queue.then(async () => {
      if (!release) throw new Error('That release is not in the catalogue. Try again.')
      if (this.builtIn.includes(id))
        throw new Error('This mod is already built into this copy of the game.')
      if (release.incompatible) throw new Error(`Not compatible: ${release.incompatible}`)
      if (release.main && approved !== true)
        throw new Error('Installing code outside the game window needs your approval.')
      await this.install(id, release, approved === true)
    })
    this.queue = run.catch(() => {})
    return run
  }

  private async install(id: string, release: CatalogRelease, approved: boolean): Promise<void> {
    const folder = join(this.root, id)
    const target = join(folder, release.version)
    if (existsSync(target))
      throw new Error('That version folder is already there; it will not be overwritten.')
    const token = randomUUID()
    const zip = join(this.root, '.downloads', `${token}.zip`)
    // Beside the target, but created only after the download's hash has passed.
    const temp = join(folder, `.install-${token}`)
    let moved = false
    let selected = false
    let committed = false
    let previousCurrent: Buffer | null = null
    try {
      await this.download({ url: release.url, destPath: zip, expectedSha256: release.sha256 })
      unpackRelease(await readFile(zip), temp)
      const parsed = parseManifest(JSON.parse(await readFile(join(temp, 'vxmod.json'), 'utf8')), {
        id,
        version: release.version
      })
      if (!parsed.ok) throw new Error(`Release manifest refused: ${parsed.error}`)
      if (
        parsed.manifest.main !== release.main ||
        existsSync(join(temp, 'main.js')) !== release.main
      )
        throw new Error('Release main code does not match the catalogue and manifest.')
      // Refuse a malformed existing record rather than replace somebody's history.
      let records: InstalledFile = { schemaVersion: 1, mods: {} }
      try {
        records = JSON.parse(await readFile(join(this.root, 'installed.json'), 'utf8'))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      if (!object(records) || records.schemaVersion !== 1 || !object(records.mods))
        throw new Error('installed.json cannot be safely updated.')
      try {
        previousCurrent = await readFile(join(folder, 'current'))
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      }
      if (existsSync(target))
        throw new Error('That version folder is already there; it will not be overwritten.')
      await mkdir(folder, { recursive: true })
      await rename(temp, target)
      moved = true
      await writeAtomicBytes(join(folder, 'current'), Buffer.from(`${release.version}\n`), {
        code: 'MOD_INSTALL_CURRENT',
        message: 'Could not select the installed release.'
      })
      selected = true
      await writeAtomicJson(
        join(this.root, 'installed.json'),
        {
          ...records,
          mods: {
            ...records.mods,
            [id]: {
              ...records.mods[id],
              [release.version]: {
                source: release.url,
                sha256: release.sha256,
                installedAt: new Date().toISOString(),
                approved: release.main && approved
              }
            }
          }
        },
        { code: 'MOD_INSTALL_RECORD', message: 'Could not save the install record.' }
      )
      committed = true
    } catch (error) {
      if (moved && !committed) {
        // Keep the old selection and folders intact if recording the new install fails.
        // If restoring current itself fails, retain the new folder so current never dangles.
        if (selected) {
          if (previousCurrent === null) await rm(join(folder, 'current'), { force: true })
          else
            await writeAtomicBytes(join(folder, 'current'), previousCurrent, {
              code: 'MOD_INSTALL_ROLLBACK',
              message: 'Could not restore the previous mod selection.'
            })
        }
        await rm(target, { recursive: true, force: true })
      }
      if (object(error) && error.code === 'DOWNLOAD_HASH_MISMATCH')
        throw appError(
          'DOWNLOAD_HASH_MISMATCH',
          'Hash mismatch: the downloaded mod failed its integrity check.'
        )
      throw error
    } finally {
      await rm(zip, { force: true })
      await rm(`${zip}.partial`, { force: true })
      await rm(temp, { recursive: true, force: true })
    }
  }
}
