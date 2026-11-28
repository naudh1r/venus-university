import { createHash } from 'crypto'
import { existsSync, readFileSync } from 'fs'
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { zipSync } from 'fflate'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { InstallChange, Manifest, SourceRelease } from '@vx/modkit/host/shared'
import type { FetchedModSource, ModInstallProgress } from '@shared/modInstall'
import type { ModSessionTable } from '@shared/modSession'
import { installPlan, revokeWithdrawn } from '../../src/main/mods/install'
import { readInstalledFile } from '../../src/main/mods/installFiles'
import { ModInstaller } from '../../src/main/mods/installer'
import { findInstalledMods, INACTIVE_RELEASE } from '../../src/main/mods/layout'
import { applyPending, readPending, scheduleOldVersionCleanup, writePending } from '../../src/main/mods/pending'
import { sourceList, sourceManifest } from './sourceFixtures'

let data: string
let root: string
const url = 'https://example.com/vxsource.json'
const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

function bundle(id = 'hello-mod', version = '1.0.0', over: Partial<Manifest> = {}) {
  const manifest = sourceManifest(id, version, over)
  const zip = zipSync({
    'vxmod.json': Buffer.from(JSON.stringify(manifest)),
    ...(manifest.main ? { 'main.js': Buffer.from('module.exports = {}') } : {})
  })
  const release: SourceRelease = {
    manifest, version, size: zip.length, sha256: sha256(zip),
    zip: `https://example.com/${id}-${version}.zip`
  }
  return { release, zip }
}

type Bundle = ReturnType<typeof bundle>

function listing(releases: readonly SourceRelease[], over: Partial<FetchedModSource> = {}): FetchedModSource {
  return { url, approvedList: true, kind: 'list', source: sourceList(...releases), ...over }
}

function transaction(bundles: readonly Bundle[], source = listing(bundles.map((one) => one.release))) {
  const progress: ModInstallProgress[] = []
  const changes = bundles.map(({ release }): InstallChange => ({
    id: release.manifest.id, source: source.url, release
  }))
  const fetcher = vi.fn<typeof fetch>(async (address) => {
    const item = bundles.find((one) => one.release.zip === address)
    if (!item) throw new Error('Unexpected download')
    return new Response(Buffer.from(item.zip))
  })
  const builtIn = new Set<string>()
  const freeBytes = async () => 100_000_000n
  return {
    fetcher, progress, builtIn,
    run: (over: Partial<Parameters<typeof installPlan>[3]> = {}) => installPlan(root, changes, [source], {
      builtIn, freeBytes, allowUnreviewedMain: false, fetch: fetcher, progress: (event) => progress.push(event), ...over
    })
  }
}

async function put(manifest: Manifest): Promise<void> {
  const folder = join(root, manifest.id, manifest.version)
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, 'vxmod.json'), JSON.stringify(manifest))
}

function service(sources: readonly FetchedModSource[] = []) {
  return new ModInstaller({
    root: () => root, builtIn: () => ({}), dev: () => ({}), allowUnreviewedMain: () => false,
    readSources: async () => sources.map((item) => ({ ok: true, data: item }))
  })
}

beforeEach(async () => {
  data = await mkdtemp(join(tmpdir(), 'vu-install-'))
  root = join(data, 'mods')
})
afterEach(() => rm(data, { recursive: true, force: true }))

describe('install transaction', () => {
  it('records approval and progress only after unpack, with activation deferred', async () => {
    const item = bundle('hello-mod', '1.0.0', { main: true, game: '<0.0.1' })
    const tx = transaction([item])
    const pending = await tx.run({
      progress(event) {
        if (event.phase === 'unpacking') expect(existsSync(join(root, 'installed.json'))).toBe(false)
        if (event.phase === 'recorded') {
          expect(existsSync(join(root, 'hello-mod', '1.0.0', 'vxmod.json'))).toBe(true)
          expect(readPending(root).current).toEqual({ 'hello-mod': '1.0.0' })
        }
        tx.progress.push(event)
      }
    })
    expect(pending.current).toEqual({ 'hello-mod': '1.0.0' })
    expect(findInstalledMods(root).mods).toEqual([])
    expect(readInstalledFile(root).mods['hello-mod']['1.0.0']).toMatchObject({
      source: url, sha256: item.release.sha256, approved: true, installedAt: expect.any(String)
    })
    expect(tx.progress.map((event) => event.phase)).toEqual(['downloading', 'downloading', 'checking', 'unpacking', 'recorded'])
    applyPending(root)
    expect(findInstalledMods(root).mods[0].version).toBe('1.0.0')
    expect(existsSync(join(root, 'hello-mod', '1.0.0', INACTIVE_RELEASE))).toBe(false)
  })

  it('deletes a zip with a mismatching pinned hash', async () => {
    const original = bundle()
    const item = { ...original, release: { ...original.release, sha256: '0'.repeat(64) } }
    await expect(transaction([item]).run()).rejects.toMatchObject({ code: 'MOD_INSTALL_HASH' })
    expect(await readdir(join(root, '.staging'))).toEqual([])
    expect(existsSync(join(root, 'installed.json'))).toBe(false)
  })

  it('refuses a different zip manifest even when the pinned hash matches', async () => {
    const original = bundle()
    const wrong = bundle('hello-mod', '1.0.0', { blurb: 'Different content.' })
    const item = { zip: wrong.zip, release: { ...original.release, size: wrong.zip.length, sha256: sha256(wrong.zip) } }
    await expect(transaction([item]).run()).rejects.toMatchObject({ code: 'MOD_INSTALL_MANIFEST' })
    expect(existsSync(join(root, 'hello-mod'))).toBe(false)
  })

  it('stops an oversized streaming response without keeping its partial file', async () => {
    const item = bundle()
    const tx = transaction([item])
    const cancel = vi.fn()
    tx.fetcher.mockImplementation(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(item.zip.length + 1)) },
      cancel
    })))
    await expect(tx.run()).rejects.toMatchObject({ code: 'DOWNLOAD_SIZE_LIMIT' })
    expect(cancel).toHaveBeenCalled()
    expect(await readdir(join(root, '.staging'))).toEqual([])
  })

  it('checks three times the total size before requesting any zip', async () => {
    const items = [bundle(), bundle('lib')]
    const tx = transaction(items)
    const required = items.reduce((size, item) => size + BigInt(item.release.size) * 3n, 0n)
    await expect(tx.run({ freeBytes: async () => required - 1n })).rejects.toMatchObject({ code: 'MOD_INSTALL_DISK_FULL' })
    expect(tx.fetcher).not.toHaveBeenCalled()
  })

  it('leaves the first unpacked release inactive when the second fails, including after a restart', async () => {
    await put(sourceManifest('hello-mod', '1.0.0'))
    const tx = transaction([bundle('hello-mod', '1.1.0'), bundle('second')])
    tx.fetcher.mockImplementationOnce(async () => new Response(Buffer.from(bundle('hello-mod', '1.1.0').zip)))
    tx.fetcher.mockImplementationOnce(async () => {
      expect(existsSync(join(root, 'hello-mod', '1.1.0', 'vxmod.json'))).toBe(true)
      expect(existsSync(join(root, 'installed.json'))).toBe(false)
      return new Response(null, { status: 500 })
    })
    await expect(tx.run()).rejects.toMatchObject({ code: 'DOWNLOAD_HTTP' })
    expect(existsSync(join(root, 'pending.json'))).toBe(false)
    expect(findInstalledMods(root).mods[0].version).toBe('1.0.0')
    applyPending(root)
    expect(findInstalledMods(root).mods[0].version).toBe('1.0.0')
    expect(existsSync(join(root, 'hello-mod', '1.1.0', INACTIVE_RELEASE))).toBe(true)
  })

  it('refuses custom main code, built-ins and missing hooks before fetching', async () => {
    const item = bundle('hello-mod', '1.0.0', { main: true })
    const unreviewed = transaction([item], listing([item.release], { approvedList: false }))
    await expect(unreviewed.run()).rejects.toMatchObject({ code: 'MOD_INSTALL_UNREVIEWED_MAIN' })
    expect(unreviewed.fetcher).not.toHaveBeenCalled()
    const builtIn = transaction([item])
    builtIn.builtIn.add('hello-mod')
    await expect(builtIn.run()).rejects.toMatchObject({ code: 'MOD_INSTALL_BUILT_IN' })
    expect(builtIn.fetcher).not.toHaveBeenCalled()
    const incompatible = transaction([bundle('hello-mod', '1.0.0', { hooks: ['missingHook'] })])
    await expect(incompatible.run()).rejects.toMatchObject({ code: 'MOD_INSTALL_COMPAT', message: expect.stringContaining('missingHook') })
    expect(incompatible.fetcher).not.toHaveBeenCalled()
  })

  it('records a repo zip hash with approval off', async () => {
    const original = bundle()
    const { sha256: _pinned, ...release } = original.release
    const item = { ...original, release }
    await transaction([item], listing([release], { kind: 'repo', approvedList: false })).run()
    expect(readInstalledFile(root).mods['hello-mod']['1.0.0']).toMatchObject({
      sha256: sha256(item.zip), approved: false
    })
  })

  it('follows HTTPS release redirects and redacts the original address on redirect failure', async () => {
    const original = bundle()
    const release = { ...original.release, zip: original.release.zip + '?sig=original' }
    const tx = transaction([{ ...original, release }])
    const target = 'https://release-assets.githubusercontent.com/hello?jwt=redirect-secret'
    tx.fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: target } }))
    tx.fetcher.mockResolvedValueOnce(new Response(Buffer.from(original.zip)))
    await tx.run()
    expect(tx.fetcher.mock.calls.map(([address]) => address)).toEqual([release.zip, target])

    await rm(root, { recursive: true })
    tx.fetcher.mockClear()
    tx.fetcher.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: target } }))
    tx.fetcher.mockResolvedValueOnce(new Response(null, {
      status: 302, headers: { location: 'http://example.com/?jwt=insecure' }
    }))
    await expect(tx.run()).rejects.toMatchObject({
      code: 'DOWNLOAD_SCHEME', detail: original.release.zip + '?sig=REDACTED'
    })
    expect(tx.fetcher).toHaveBeenCalledTimes(2)
  })

  it('rechecks the main-owned plan and rejects altered release metadata', async () => {
    const item = bundle()
    const installer = service([listing([item.release])])
    const plan = await installer.plan({ kind: 'install', mods: { 'hello-mod': { version: '1.0.0', source: url } } })
    if (plan.kind !== 'install') throw new Error('Expected install plan')
    const forged = { ...plan, changes: plan.changes.map((change) => ({
      ...change, release: { ...change.release, zip: 'https://example.com/different.zip' }
    })) }
    await expect(installer.install(forged)).rejects.toMatchObject({ code: 'MOD_INSTALL_CHANGED' })
    expect(existsSync(root)).toBe(false)
  })
})

describe('pending changes', () => {
  it.each(['current', 'remove', 'cleanup'] as const)('repeats safely after interruption in %s', async (phase) => {
    const first = transaction([bundle('hello-mod'), bundle('removed')])
    await first.run()
    applyPending(root)
    await transaction([bundle('hello-mod', '1.1.0')]).run()
    const pending = readPending(root)
    await writePending(root, { ...pending, remove: ['removed'] })
    await mkdir(join(root, 'hello-mod', '1.2.0.partial'))
    await mkdir(join(root, '.staging'), { recursive: true })
    const warn = vi.fn()
    expect(applyPending(root, warn, (step) => {
      if (step === phase) throw new Error('interruption')
    })).toBe(false)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(readPending(root).remove).toEqual(['removed'])
    expect(applyPending(root)).toBe(true)
    expect(readFileSync(join(root, 'hello-mod', 'current'), 'utf8').trim()).toBe('1.1.0')
    expect(existsSync(join(root, 'hello-mod', '1.0.0'))).toBe(true)
    expect(existsSync(join(root, 'hello-mod', '1.2.0.partial'))).toBe(false)
    expect(existsSync(join(root, 'removed'))).toBe(false)
    expect(existsSync(join(root, '.staging'))).toBe(false)
    expect(existsSync(join(root, 'pending.json'))).toBe(false)
    expect(readInstalledFile(root).mods).not.toHaveProperty('removed')
  })

  it.each([2, 0])('leaves unknown pending schema %s alone', async (pending) => {
    await put(sourceManifest())
    const text = JSON.stringify({ pending, current: {}, remove: ['hello-mod'] })
    await writeFile(join(root, 'pending.json'), text)
    const warn = vi.fn()
    applyPending(root, warn)
    expect(warn).toHaveBeenCalledTimes(1)
    expect(readFileSync(join(root, 'pending.json'), 'utf8')).toBe(text)
    expect(existsSync(join(root, 'hello-mod', '1.0.0'))).toBe(true)
  })

  it('refuses journal entries outside the mods directory and paths that are links', async () => {
    const outside = join(data, 'outside')
    await mkdir(outside)
    await writeFile(join(outside, 'keep'), 'keep')
    await mkdir(root)
    await symlink(outside, join(root, 'link'), 'junction')
    const warn = vi.fn()
    for (const id of ['../outside', 'link']) {
      await writeFile(join(root, 'pending.json'), JSON.stringify({ pending: 1, current: {}, remove: [id] }))
      applyPending(root, warn)
      expect(existsSync(join(outside, 'keep'))).toBe(true)
      expect(existsSync(join(root, 'pending.json'))).toBe(true)
    }
    expect(warn).toHaveBeenCalledTimes(2)
  })

  it('holds an older version through failed and safe starts, supports rollback, and cleans after a loaded start', async () => {
    const older = bundle()
    const newer = bundle('hello-mod', '1.1.0')
    for (const item of [older, newer]) {
      await transaction([item]).run()
      applyPending(root)
    }
    const row = {
      id: 'hello-mod', manifest: newer.release.manifest, dev: false, status: 'loaded'
    } as ModSessionTable['mods'][number]
    const table: ModSessionTable = { mods: [row], order: ['hello-mod'], safeStart: null, loaderError: null, coreVersion: '0.1.0' }
    await scheduleOldVersionCleanup(root, { ...table, mods: [{ ...row, status: 'failed' }] })
    await scheduleOldVersionCleanup(root, { ...table, safeStart: 'flag' })
    expect(existsSync(join(root, 'pending.json'))).toBe(false)
    expect(existsSync(join(root, 'hello-mod', '1.0.0'))).toBe(true)
    await service().rollback('hello-mod', '1.0.0')
    applyPending(root)
    expect(findInstalledMods(root).mods[0].version).toBe('1.0.0')
    expect(existsSync(join(root, 'hello-mod', '1.1.0'))).toBe(true)
    await service().rollback('hello-mod', '1.1.0')
    applyPending(root)
    await scheduleOldVersionCleanup(root, table)
    expect(existsSync(join(root, 'hello-mod', '1.0.0'))).toBe(true)
    applyPending(root)
    expect(existsSync(join(root, 'hello-mod', '1.0.0'))).toBe(false)
    expect(Object.keys(readInstalledFile(root).mods['hello-mod'])).toEqual(['1.1.0'])
  })
})

describe('removal and withdrawal', () => {
  it('refuses a required library, queues selected orphans, supports undo, and preserves mod data', async () => {
    await put(sourceManifest('hello-mod', '1.0.0', { requires: { lib: '*' } }))
    await put(sourceManifest('lib', '1.0.0', { library: true, exports: [] }))
    const saved = join(data, 'mod-data', 'hello-mod')
    await mkdir(saved, { recursive: true })
    await writeFile(join(saved, 'keep.json'), '{}')
    const installer = service()
    await expect(installer.remove('lib')).rejects.toMatchObject({ code: 'MOD_REMOVE_PLAN', message: expect.stringContaining('hello-mod') })
    expect(await installer.plan({ kind: 'remove', id: 'hello-mod' })).toMatchObject({ orphaned: ['lib'] })
    expect((await installer.remove('hello-mod', ['lib'])).remove).toEqual(['hello-mod', 'lib'])
    expect(existsSync(join(root, 'lib'))).toBe(true)
    expect((await installer.undo('lib')).remove).toEqual(['hello-mod'])
    expect((await installer.undo('hello-mod')).remove).toEqual([])
    expect(existsSync(join(root, 'pending.json'))).toBe(false)
    await installer.remove('hello-mod', ['lib'])
    applyPending(root)
    expect(findInstalledMods(root).mods).toEqual([])
    expect(existsSync(join(saved, 'keep.json'))).toBe(true)
  })

  it('clears approval only on withdrawal from the approved list and leaves the release unpacked', async () => {
    const item = bundle()
    await transaction([item]).run()
    applyPending(root)
    const source = listing([item.release])
    const withdrawn = { ...source.source, mods: source.source.mods.map((mod) => ({
      ...mod, withdrawn: [{ version: '1.0.0', reason: 'Fixture' }]
    })) }
    await revokeWithdrawn(root, { ...source, source: withdrawn, approvedList: false })
    expect(readInstalledFile(root).mods['hello-mod']['1.0.0'].approved).toBe(true)
    await service([{ ...source, source: withdrawn }]).sources()
    expect(readInstalledFile(root).mods['hello-mod']['1.0.0'].approved).toBe(false)
    expect(findInstalledMods(root).mods[0].version).toBe('1.0.0')
  })
})
