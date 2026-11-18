import { app } from 'electron'
import { createReadStream } from 'fs'
import { fileURLToPath } from 'url'
import { appError } from '@shared/errors'
import { APPROVED_MOD_SOURCE } from '@shared/modSource'
import { parseManifest, parseSource, type ModSource, type SourceMod, type SourceRelease } from '@vx/modkit/host/shared'
import { getSettings, patchStoredSettings } from '../services/settingsService'

export const MOD_SOURCE_MAX_BYTES = 2 * 1024 * 1024
export const MOD_SOURCE_TIMEOUT_MS = 30_000

export interface FetchedModSource {
  readonly url: string
  readonly kind: 'list' | 'repo'
  /** Source identity only; a release still needs its own approval and pinned hash. */
  readonly approvedList: boolean
  readonly source: ModSource
}

function fail(code: string, message: string): never { throw appError(code, message) }

/** Bound an awaited transport operation even when an injected adapter does not wire aborts. */
async function beforeDeadline<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  let abort!: () => void
  const cancelled = new Promise<never>((_resolve, reject) => {
    abort = () => reject(signal.reason)
    if (signal.aborted) abort()
    else signal.addEventListener('abort', abort, { once: true })
  })
  try { return await Promise.race([cancelled, operation]) }
  finally { signal.removeEventListener('abort', abort) }
}

/** A canonical source address. Only the development replacement may name a local file. */
export function modSourceAddress(value: string, allowFile = false): string {
  let url: URL
  try { url = new URL(value) } catch { return fail('MOD_SOURCE_ADDRESS', 'The mod source address is not a URL.') }
  if (url.username || url.password || url.hash || (url.protocol !== 'https:' && !(allowFile && url.protocol === 'file:'))) {
    fail('MOD_SOURCE_ADDRESS', 'Mod sources must use https, without credentials or a fragment.')
  }
  if (url.hostname === 'github.com' && !url.search && /^\/[^/]+\/[^/]+\/?$/.test(url.pathname)) {
    url.pathname = url.pathname.replace(/\/$/, '').toLowerCase()
  }
  return url.href
}

/** A session reader. Repo answers, including concurrent reads, share one successful fetch. */
export class ModSourceReader {
  private readonly repos = new Map<string, Promise<FetchedModSource>>()
  constructor(private readonly options: {
    fetch?: typeof fetch
    packaged?: boolean
    env?: Readonly<Record<string, string | undefined>>
    timeoutMs?: number
  } = {}) {}

  approvedAddress(): string {
    const packaged = this.options.packaged ?? app.isPackaged
    const override = !packaged ? (this.options.env ?? process.env).VU_MOD_SOURCE : undefined
    return modSourceAddress(override ?? APPROVED_MOD_SOURCE, !packaged && override !== undefined)
  }

  async readApproved(): Promise<FetchedModSource> { return this.readAddress(this.approvedAddress(), true, true) }

  /** Custom sources never gain approval from a block they supplied themselves. */
  async readCustom(address: string): Promise<FetchedModSource> { return this.readAddress(modSourceAddress(address), false, false) }

  private readAddress(address: string, approvedList: boolean, allowFile: boolean): Promise<FetchedModSource> {
    const url = new URL(address)
    const repo = url.hostname === 'github.com' && !url.search
      ? /^\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)\/?$/.exec(url.pathname) : null
    if (repo && !approvedList) {
      const key = `https://github.com/${repo[1].toLowerCase()}/${repo[2].toLowerCase()}`
      let answer = this.repos.get(key)
      if (!answer) {
        answer = this.readRepo(key, repo[1], repo[2]).catch(error => { this.repos.delete(key); throw error })
        this.repos.set(key, answer)
      }
      return answer.then(result => structuredClone(result))
    }
    return this.readList(address, approvedList, allowFile)
  }

  /** One deadline and byte budget cover the entire source, including repo pages and manifests. */
  private reader(): (address: string, allowFile?: boolean) => Promise<{ json: unknown; response?: Response }> {
    const signal = AbortSignal.timeout(this.options.timeoutMs ?? MOD_SOURCE_TIMEOUT_MS)
    const fetcher = this.options.fetch ?? fetch
    let remaining = MOD_SOURCE_MAX_BYTES
    return async (address, allowFile = false) => {
      const chunks: Uint8Array[] = []
      const take = (chunk: Uint8Array): void => {
        remaining -= chunk.byteLength
        if (remaining < 0) fail('MOD_SOURCE_SIZE', 'The mod source exceeds the 2 MB limit.')
        chunks.push(chunk)
      }
      let response: Response | undefined
      try {
        let url = new URL(modSourceAddress(address, allowFile))
        if (url.protocol === 'file:') {
          for await (const chunk of createReadStream(fileURLToPath(url), { signal })) take(chunk)
        } else {
          for (let redirects = 0; ; redirects++) {
            response = await beforeDeadline(fetcher(url.href, { redirect: 'manual', signal, headers: { Accept: 'application/json', 'User-Agent': 'VenusUniversity-mod-sources' } }), signal)
            if (![301, 302, 303, 307, 308].includes(response.status)) break
            await response.body?.cancel()
            const location = response.headers.get('location')
            if (!location || redirects >= 5) fail('MOD_SOURCE_REDIRECT', 'The mod source redirected too many times or without an address.')
            url = new URL(modSourceAddress(new URL(location, url).href))
          }
          // A fetch adapter must not conceal an insecure redirect of its own.
          if (response.url) modSourceAddress(response.url)
          if (!response.ok) fail('MOD_SOURCE_HTTP', `Could not read the mod source (HTTP ${response.status}).`)
          if (!response.body) fail('MOD_SOURCE_EMPTY', 'The mod source has no response body.')
          const size = Number(response.headers.get('content-length'))
          if (Number.isFinite(size) && size > remaining) {
            await response.body.cancel()
            fail('MOD_SOURCE_SIZE', 'The mod source exceeds the 2 MB limit.')
          }
          const body = response.body.getReader()
          try {
            for (;;) {
              signal.throwIfAborted()
              const { done, value } = await beforeDeadline(body.read(), signal)
              if (done) break
              take(value)
            }
          } finally { await body.cancel() }
        }
        signal.throwIfAborted()
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && String(error.code).startsWith('MOD_SOURCE_')) throw error
        fail(signal.aborted ? 'MOD_SOURCE_TIMEOUT' : 'MOD_SOURCE_FETCH', signal.aborted ? 'The mod source took too long to answer.' : 'Could not read the mod source.')
      }
      try { return { json: JSON.parse(Buffer.concat(chunks).toString('utf8')), ...(response ? { response } : {}) } }
      catch { return fail('MOD_SOURCE_JSON', 'The mod source is not valid JSON.') }
    }
  }

  private async readList(address: string, approvedList: boolean, allowFile: boolean): Promise<FetchedModSource> {
    const { json } = await this.reader()(address, allowFile)
    const parsed = parseSource(json)
    if (!parsed.ok) fail('MOD_SOURCE_FORMAT', parsed.error)
    const source = approvedList ? parsed.source : { ...parsed.source, mods: parsed.source.mods.map(mod => ({ ...mod,
      releases: mod.releases.map(({ approved: _approved, ...release }) => release) })) }
    return { url: address, kind: 'list', approvedList, source }
  }

  private async readRepo(address: string, owner: string, repo: string): Promise<FetchedModSource> {
    const read = this.reader()
    const mods = new Map<string, SourceMod>()
    for (let page = 1; ; page++) {
      const { json } = await read(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100&page=${page}`)
      if (!Array.isArray(json)) fail('MOD_SOURCE_FORMAT', 'The GitHub releases response is not a list.')
      for (const raw of json) {
        if (!raw || typeof raw !== 'object' || raw.draft !== false || raw.prerelease !== false || !Array.isArray(raw.assets)) continue
        const assets: Record<string, unknown>[] = raw.assets.filter((asset: unknown): asset is Record<string, unknown> => !!asset && typeof asset === 'object')
        const manifestAsset = assets.filter(asset => asset.name === 'vxmod.json')
        if (manifestAsset.length !== 1 || !assets.some(asset => typeof asset.name === 'string' && /^.+-\d+\.\d+\.\d+\.zip$/.test(asset.name))) continue
        if (typeof manifestAsset[0].browser_download_url !== 'string') fail('MOD_SOURCE_FORMAT', 'A GitHub manifest asset has no download address.')
        const { json: manifestJson } = await read(modSourceAddress(manifestAsset[0].browser_download_url))
        const parsed = parseManifest(manifestJson)
        if (!parsed.ok) fail('MOD_SOURCE_FORMAT', `GitHub release manifest: ${parsed.error}`)
        const manifest = parsed.manifest
        const zips = assets.filter(asset => asset.name === `${manifest.id}-${manifest.version}.zip`)
        if (!zips.length) continue
        if (zips.length !== 1) fail('MOD_SOURCE_FORMAT', `${manifest.id}@${manifest.version} has duplicate zip assets.`)
        const zip = zips[0]
        if (typeof zip.browser_download_url !== 'string' || !Number.isSafeInteger(zip.size) || (zip.size as number) <= 0) fail('MOD_SOURCE_FORMAT', `${manifest.id}@${manifest.version} has an invalid zip asset.`)
        const release: SourceRelease = { version: manifest.version, manifest, zip: modSourceAddress(zip.browser_download_url), size: zip.size as number }
        const mod = mods.get(manifest.id) ?? { id: manifest.id, repo: address, releases: [] }
        if (mod.releases.some(one => one.version === manifest.version)) fail('MOD_SOURCE_FORMAT', `${manifest.id}@${manifest.version} is listed twice.`)
        mods.set(manifest.id, { ...mod, releases: [...mod.releases, release] })
      }
      if (json.length < 100) break
    }
    return { url: address, kind: 'repo', approvedList: false, source: { source: 1, name: `${owner}/${repo}`, mods: [...mods.values()] } }
  }
}

/** Shared by future IPC callers for the lifetime of the main process. Nothing fetches at boot. */
export const modSourceReader = new ModSourceReader()

function storedSources(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || !value.every(one => typeof one === 'string')) fail('MOD_SOURCE_SETTINGS', 'The stored mod sources are not a list of addresses.')
  return [...new Set(value.map(one => modSourceAddress(one)))]
}
export async function modSources(): Promise<string[]> { return storedSources((await getSettings()).modSources) }
export async function addModSource(address: string): Promise<void> {
  const source = modSourceAddress(address)
  if (source === APPROVED_MOD_SOURCE) return
  await patchStoredSettings(settings => ({ ...settings, modSources: [...new Set([...storedSources(settings.modSources), source])] }))
}
export async function removeModSource(address: string): Promise<void> {
  const source = modSourceAddress(address)
  await patchStoredSettings(settings => ({ ...settings, modSources: storedSources(settings.modSources).filter(one => one !== source) }))
}
