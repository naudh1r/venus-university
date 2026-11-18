import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { pathToFileURL } from 'url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { APPROVED_MOD_SOURCE } from '@shared/modSource'
import { defaultSettings, mergePatch } from '@shared/settingsRules'
import type { Settings, SettingsPatch } from '@shared/types'
import { sourceList, sourceManifest, sourceRelease } from './sourceFixtures'

const storage = vi.hoisted(() => ({ settings: {} as Settings }))
vi.mock('electron', () => ({ app: { isPackaged: true } }))
vi.mock('../../src/main/services/settingsService', () => ({
  getSettings: async () => storage.settings,
  patchStoredSettings: async (change: (settings: Settings) => Settings) => {
    storage.settings = change(storage.settings)
    return storage.settings
  }
}))
const { ModSourceReader, MOD_SOURCE_MAX_BYTES, addModSource, removeModSource, modSources } =
  await import('../../src/main/mods/sources')
const response = (json: unknown, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(json), { headers })
const list = () => sourceList(sourceRelease())
const folders: string[] = []
afterEach(async () => {
  await Promise.all(folders.splice(0).map((folder) => rm(folder, { recursive: true, force: true })))
})

describe('bounded source fetching', () => {
  it('fetches the fixed approved list and ignores custom approval claims', async () => {
    const json: any = list()
    json.mods[0].releases[0].approved = { by: 'tester', pr: 1, at: '2026-11-10' }
    const fetcher = vi.fn(async () => response(json))
    const reader = new ModSourceReader({
      fetch: fetcher,
      packaged: true,
      env: { VU_MOD_SOURCE: 'file:///ignored' }
    })
    expect(reader.approvedAddress()).toBe(APPROVED_MOD_SOURCE)
    const approved = await reader.readApproved()
    expect(approved.approvedList).toBe(true)
    expect(approved.source.mods[0].releases[0].approved).toBeDefined()
    const custom = await reader.readCustom('https://example.com/list')
    expect(custom.approvedList).toBe(false)
    expect(custom.source.mods[0].releases[0]).not.toHaveProperty('approved')
  })
  it('allows a file override only in development, never as a custom source', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'vu-source-'))
    folders.push(folder)
    const file = join(folder, 'vxsource.json')
    await writeFile(file, JSON.stringify(list()))
    const url = pathToFileURL(file).href
    const fetcher = vi.fn()
    const reader = new ModSourceReader({
      fetch: fetcher,
      packaged: false,
      env: { VU_MOD_SOURCE: url }
    })
    expect((await reader.readApproved()).source.mods[0].id).toBe('hello-mod')
    expect(fetcher).not.toHaveBeenCalled()
    await expect(reader.readCustom(url)).rejects.toMatchObject({ code: 'MOD_SOURCE_ADDRESS' })
    const packaged = new ModSourceReader({ packaged: true, env: { VU_MOD_SOURCE: url } })
    expect(packaged.approvedAddress()).toBe(APPROVED_MOD_SOURCE)
  })
  it('honors a development https replacement', async () => {
    const fetcher = vi.fn(async (_address: string | URL | Request) => response(list()))
    const reader = new ModSourceReader({
      fetch: fetcher,
      packaged: false,
      env: { VU_MOD_SOURCE: 'https://dev.example/list' }
    })
    await reader.readApproved()
    expect(fetcher.mock.calls[0][0]).toBe('https://dev.example/list')
  })
  it.each(['http://example.com/list', 'https://secret@example.com/list', 'ftp://example.com/list'])(
    'refuses an unsafe custom address before fetching: %s',
    async (address) => {
      const fetcher = vi.fn()
      await expect(
        new ModSourceReader({ fetch: fetcher }).readCustom(address)
      ).rejects.toMatchObject({ code: 'MOD_SOURCE_ADDRESS' })
      expect(fetcher).not.toHaveBeenCalled()
    }
  )
  it('refuses an https redirect to http before making the next request', async () => {
    const fetcher = vi.fn(
      async () =>
        new Response(null, { status: 302, headers: { location: 'http://example.com/plain' } })
    )
    await expect(
      new ModSourceReader({ fetch: fetcher }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_ADDRESS' })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('follows bounded https redirects and refuses a redirect loop', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: '/actual' } }))
      .mockResolvedValueOnce(response(list()))
    expect(
      (await new ModSourceReader({ fetch: fetcher }).readCustom('https://example.com/list')).kind
    ).toBe('list')
    const looping = vi.fn(
      async () => new Response(null, { status: 302, headers: { location: '/again' } })
    )
    await expect(
      new ModSourceReader({ fetch: looping }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_REDIRECT' })
  })
  it('rejects both a declared oversize and an oversize streamed body, cancelling the stream', async () => {
    const declared = vi.fn(async () =>
      response({}, { 'content-length': String(MOD_SOURCE_MAX_BYTES + 1) })
    )
    await expect(
      new ModSourceReader({ fetch: declared }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_SIZE' })
    const cancel = vi.fn()
    let chunks = 0
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        chunks++
        controller.enqueue(new Uint8Array(1024 * 1024))
      },
      cancel
    })
    const streamed = vi.fn(async () => new Response(body))
    await expect(
      new ModSourceReader({ fetch: streamed }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_SIZE' })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(chunks).toBeLessThanOrEqual(4)
  })
  it('bounds a local development source too', async () => {
    const folder = await mkdtemp(join(tmpdir(), 'vu-source-'))
    folders.push(folder)
    const file = join(folder, 'large.json')
    await writeFile(file, ' '.repeat(MOD_SOURCE_MAX_BYTES + 1))
    const reader = new ModSourceReader({
      packaged: false,
      env: { VU_MOD_SOURCE: pathToFileURL(file).href }
    })
    await expect(reader.readApproved()).rejects.toMatchObject({ code: 'MOD_SOURCE_SIZE' })
  })
  it('aborts a request that exceeds its deadline', async () => {
    const fetcher: typeof fetch = (_address, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener('abort', () => reject(init!.signal!.reason), { once: true })
      })
    await expect(
      new ModSourceReader({ fetch: fetcher, timeoutMs: 10 }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_TIMEOUT' })
  })
  it('bounds stalled response bodies and cancels them on timeout', async () => {
    const cancel = vi.fn()
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ cancel })))
    await expect(
      new ModSourceReader({ fetch: fetcher, timeoutMs: 10 }).readCustom('https://example.com/list')
    ).rejects.toMatchObject({ code: 'MOD_SOURCE_TIMEOUT' })
    expect(cancel).toHaveBeenCalledTimes(1)
  })
  it('times out even when cancelling the stalled body never settles', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const fetcher = vi.fn(async () => new Response(new ReadableStream({ cancel })))
    const reader = new ModSourceReader({ fetch: fetcher, timeoutMs: 10 })

    await expect(reader.readCustom('https://example.com/list')).rejects.toMatchObject({
      code: 'MOD_SOURCE_TIMEOUT'
    })
    expect(cancel).toHaveBeenCalledTimes(1)
  })

  it.each(['declared', 'streamed'] as const)(
    'preserves the %s size refusal when cancellation never settles',
    async (kind) => {
      const cancel = vi.fn(() => new Promise<void>(() => {}))
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          if (kind === 'streamed') controller.enqueue(new Uint8Array(MOD_SOURCE_MAX_BYTES + 1))
        },
        cancel
      })
      const headers =
        kind === 'declared' ? { 'content-length': String(MOD_SOURCE_MAX_BYTES + 1) } : undefined
      const fetcher = vi.fn(async () => new Response(body, { headers }))
      const reader = new ModSourceReader({ fetch: fetcher, timeoutMs: 10 })

      await expect(reader.readCustom('https://example.com/list')).rejects.toMatchObject({
        code: 'MOD_SOURCE_SIZE'
      })
      expect(cancel).toHaveBeenCalledTimes(1)
    }
  )

  it('follows a redirect even when cancelling its body never settles', async () => {
    const cancel = vi.fn(() => new Promise<void>(() => {}))
    const redirect = new Response(new ReadableStream({ cancel }), {
      status: 302,
      headers: { location: '/actual' }
    })
    const fetcher = vi.fn().mockResolvedValueOnce(redirect).mockResolvedValueOnce(response(list()))
    const reader = new ModSourceReader({ fetch: fetcher })

    const result = await reader.readCustom('https://example.com/list')
    expect(result.kind).toBe('list')
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('preserves a size refusal when cancellation rejects', async () => {
    const body = new ReadableStream({ cancel: () => Promise.reject(new Error('cleanup failed')) })
    const fetcher = vi.fn(
      async () =>
        new Response(body, { headers: { 'content-length': String(MOD_SOURCE_MAX_BYTES + 1) } })
    )
    const reader = new ModSourceReader({ fetch: fetcher })

    await expect(reader.readCustom('https://example.com/list')).rejects.toMatchObject({
      code: 'MOD_SOURCE_SIZE'
    })
  })

  it('refuses HTTP and JSON errors without disclosing a signed address', async () => {
    for (const answer of [new Response('', { status: 503 }), new Response('not json')]) {
      const fetcher = vi.fn(async () => answer)
      await expect(
        new ModSourceReader({ fetch: fetcher }).readCustom('https://example.com/list?secret=token')
      ).rejects.not.toHaveProperty('message', expect.stringContaining('token'))
    }
  })
})

function githubRelease(version = '1.0.0', over: Record<string, unknown> = {}): any {
  return {
    draft: false,
    prerelease: false,
    assets: [
      {
        name: `hello-mod-${version}.zip`,
        browser_download_url: `https://github.com/test/repo/releases/download/${version}/hello-mod-${version}.zip`,
        size: 100
      },
      {
        name: 'vxmod.json',
        browser_download_url: `https://github.com/test/repo/releases/download/${version}/vxmod.json`,
        size: 200
      }
    ],
    ...over
  }
}
describe('GitHub repo sources', () => {
  it('keeps only complete stable releases and shares a detached cached answer for the session', async () => {
    const releases = [
      githubRelease(),
      githubRelease('2.0.0', { draft: true }),
      githubRelease('3.0.0', { prerelease: true }),
      githubRelease('4.0.0', { assets: [] }),
      githubRelease('5.0.0', { assets: [githubRelease().assets[0]] })
    ]
    const fetcher = vi.fn(async (address: string | URL | Request) =>
      String(address).includes('api.github.com') ? response(releases) : response(sourceManifest())
    )
    const reader = new ModSourceReader({ fetch: fetcher })
    const [first, second] = await Promise.all([
      reader.readCustom('https://github.com/test/repo'),
      reader.readCustom('https://github.com/test/repo/')
    ])
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(first.kind).toBe('repo')
    expect(first.source.mods[0].repo).toBe('https://github.com/test/repo')
    expect(first.source.mods[0].releases.map((release) => release.version)).toEqual(['1.0.0'])
    expect(first.source.mods[0].releases[0]).not.toHaveProperty('sha256')
    ;(first.source.mods as any[]).length = 0
    expect(second.source.mods).toHaveLength(1)
    expect((await reader.readCustom('https://github.com/test/repo')).source.mods).toHaveLength(1)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('skips a manifest without its matching zip, refuses a bad manifest, and retries failed reads', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response([githubRelease()]))
      .mockResolvedValueOnce(response(sourceManifest('other')))
    expect(
      (await new ModSourceReader({ fetch: fetcher }).readCustom('https://github.com/test/repo'))
        .source.mods
    ).toEqual([])
    const retry = vi
      .fn()
      .mockResolvedValueOnce(response([githubRelease()]))
      .mockResolvedValueOnce(response({}))
      .mockResolvedValueOnce(response([githubRelease()]))
      .mockResolvedValueOnce(response(sourceManifest()))
    const reader = new ModSourceReader({ fetch: retry })
    await expect(reader.readCustom('https://github.com/test/repo')).rejects.toMatchObject({
      code: 'MOD_SOURCE_FORMAT'
    })
    expect((await reader.readCustom('https://github.com/test/repo')).source.mods).toHaveLength(1)
  })
  it('reads subsequent pages instead of silently losing older releases', async () => {
    const firstPage = Array.from({ length: 100 }, () => githubRelease('1.0.0', { draft: true }))
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response(firstPage))
      .mockResolvedValueOnce(response([githubRelease()]))
      .mockResolvedValueOnce(response(sourceManifest()))
    expect(
      (await new ModSourceReader({ fetch: fetcher }).readCustom('https://github.com/test/repo'))
        .source.mods
    ).toHaveLength(1)
    expect(fetcher.mock.calls[1][0]).toContain('page=2')
  })
  it('shares one byte budget across GitHub pages', async () => {
    const page = Array.from({ length: 100 }, () => ({ draft: true, padding: 'x'.repeat(12000) }))
    const pageBytes = Buffer.byteLength(JSON.stringify(page))
    const fetcher = vi.fn(async () => response(page))
    const reader = new ModSourceReader({ fetch: fetcher })

    await expect(reader.readCustom('https://github.com/test/repo')).rejects.toMatchObject({
      code: 'MOD_SOURCE_SIZE'
    })
    expect(pageBytes).toBeLessThan(MOD_SOURCE_MAX_BYTES)
    expect(pageBytes * 2).toBeGreaterThan(MOD_SOURCE_MAX_BYTES)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('uses the same deadline on subsequent GitHub pages', async () => {
    const deadline = new AbortController()
    const timeout = vi.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal)
    const page = Array.from({ length: 100 }, () => ({ draft: true }))
    const signals: (AbortSignal | null | undefined)[] = []
    const fetcher: typeof fetch = vi.fn(async (_address, init) => {
      signals.push(init?.signal)
      if (signals.length === 1) return response(page)
      deadline.abort(new DOMException('Expired', 'TimeoutError'))
      return new Promise<Response>(() => {})
    })
    const reader = new ModSourceReader({ fetch: fetcher })

    try {
      await expect(reader.readCustom('https://github.com/test/repo')).rejects.toMatchObject({
        code: 'MOD_SOURCE_TIMEOUT'
      })
      expect(timeout).toHaveBeenCalledTimes(1)
      expect(signals).toEqual([deadline.signal, deadline.signal])
    } finally {
      timeout.mockRestore()
    }
  })
})

describe('main-owned modSources', () => {
  it('deduplicates additions, removes sources, and preserves them across renderer patches', async () => {
    storage.settings = defaultSettings()
    expect(await modSources()).toEqual([])
    await addModSource('https://example.com/list')
    await addModSource('https://example.com/list')
    await addModSource(APPROVED_MOD_SOURCE)
    expect(await modSources()).toEqual(['https://example.com/list'])
    const patch = {
      ...defaultSettings(),
      modSources: ['https://untrusted.example/replace']
    } as SettingsPatch
    expect(mergePatch(storage.settings, patch).modSources).toEqual(['https://example.com/list'])
    await removeModSource('https://example.com/list')
    expect(await modSources()).toEqual([])
    await addModSource('https://github.com/Tester/Repo/')
    await addModSource('https://github.com/tester/repo')
    expect(await modSources()).toEqual(['https://github.com/tester/repo'])
    await expect(addModSource('file:///not-allowed')).rejects.toMatchObject({
      code: 'MOD_SOURCE_ADDRESS'
    })
  })
})
