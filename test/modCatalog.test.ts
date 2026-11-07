import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { zipSync, strToU8 } from 'fflate'
import { ModCatalog, parseCatalog } from '../src/main/mods/catalog'
import type { DownloadOptions } from '../src/main/services/downloadService'
import { downloadFile } from '../src/main/services/downloadService'
import * as atomic from '../src/main/services/jsonFile'

const folders: string[] = []
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  await Promise.all(folders.splice(0).map((p) => rm(p, { recursive: true, force: true })))
})
const manifest = (version = '1.0.0', id = 'test-mod') => ({
  manifest: 1,
  id,
  name: 'Test',
  author: 'Tester',
  version,
  blurb: 'Test mod',
  source: 'https://example.com/mod',
  kit: '0.7.0',
  hooks: [],
  main: false,
  scope: 'anytime',
  defaultOn: false
})
const archive = (version = '1.0.0', id = 'test-mod') =>
  zipSync(
    {
      'vxmod.json': strToU8(JSON.stringify(manifest(version, id))),
      'renderer.js': strToU8('export {}')
    },
    { mtime: new Date('2020-01-01T00:00:00Z') }
  )
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const release = (version = '1.0.0', bytes = archive(version)) => ({
  version,
  url: `https://example.com/${version}.zip`,
  sha256: hash(bytes),
  kit: '0.7.0',
  main: false,
  reviewed: false,
  released: '2026-11-07',
  changes: ['Test']
})
const index = (releases = [release()]) => ({
  schemaVersion: 1,
  mods: [
    {
      id: 'test-mod',
      name: 'Test',
      author: 'Tester',
      blurb: 'A mod',
      source: 'https://example.com/mod',
      releases
    }
  ]
})
async function setup(bytes = archive()) {
  const root = await mkdtemp(join(tmpdir(), 'catalog-'))
  folders.push(root)
  const download = async (o: DownloadOptions) => {
    await mkdir(join(root, '.downloads'), { recursive: true })
    await writeFile(o.destPath, bytes)
    return { bytes: bytes.length, sha256: hash(bytes) }
  }
  return { root, catalog: new ModCatalog(root, download) }
}

describe('catalogue parser', () => {
  it('drops a bad entry and release, keeping the rest with a log', () => {
    const log = vi.fn()
    const good = index().mods[0]
    const parsed = parseCatalog(
      {
        schemaVersion: 1,
        mods: [
          { ...good, id: '../escape' },
          { ...good, releases: [{ ...release(), sha256: 'wrong' }, release()] }
        ]
      },
      log
    )
    expect(parsed.map((m) => m.id)).toEqual(['test-mod'])
    expect(parsed[0].releases).toHaveLength(1)
    expect(log).toHaveBeenCalledTimes(2)
  })
  it('shows incompatible releases but refuses installation', async () => {
    const { root, catalog } = await setup()
    catalog.setIndex(index([{ ...release(), kit: '>=9.0.0' }]))
    expect(catalog.list()[0].releases[0].incompatible).toContain('Needs kit')
    await expect(catalog.installRelease('test-mod', '1.0.0')).rejects.toThrow('Not compatible')
    expect(await readdir(root)).toEqual([])
  })
})

describe('install and update file protection', () => {
  it('uses the real downloader hash check, writes no mod folder and removes all scratch', async () => {
    const { root } = await setup()
    const bytes = archive()
    const response = new Response(bytes)
    Object.defineProperty(response, 'url', { value: 'https://example.com/test.zip' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    const catalog = new ModCatalog(root, downloadFile)
    catalog.setIndex(index([{ ...release(), sha256: '0'.repeat(64) }]))
    await expect(catalog.installRelease('test-mod', '1.0.0')).rejects.toMatchObject({
      code: 'DOWNLOAD_HASH_MISMATCH'
    })
    expect(existsSync(join(root, 'test-mod'))).toBe(false)
    expect(existsSync(join(root, 'installed.json'))).toBe(false)
    expect(await readdir(join(root, '.downloads'))).toEqual([])
  })
  it.each([
    ['other-mod', '1.0.0'],
    ['test-mod', '2.0.0']
  ])('refuses manifest %s %s and cleans scratch', async (id, version) => {
    const bytes = archive(version, id)
    const { root, catalog } = await setup(bytes)
    catalog.setIndex(index([release('1.0.0', bytes)]))
    await expect(catalog.installRelease('test-mod', '1.0.0')).rejects.toThrow('manifest refused')
    expect(existsSync(join(root, 'test-mod', '1.0.0'))).toBe(false)
    expect(await readdir(join(root, 'test-mod'))).toEqual([])
    expect(await readdir(join(root, '.downloads'))).toEqual([])
  })
  it('refuses to overwrite an existing version folder', async () => {
    const { root, catalog } = await setup()
    catalog.setIndex(index())
    await mkdir(join(root, 'test-mod', '1.0.0'), { recursive: true })
    await writeFile(join(root, 'test-mod', '1.0.0', 'keep'), 'precious')
    await expect(catalog.installRelease('test-mod', '1.0.0')).rejects.toThrow('already there')
    expect(await readFile(join(root, 'test-mod', '1.0.0', 'keep'), 'utf8')).toBe('precious')
  })
  it('keeps old folders and every record while selecting the new version', async () => {
    const { root, catalog } = await setup(archive('1.0.1'))
    catalog.setIndex(index([release('1.0.1')]))
    await mkdir(join(root, 'test-mod', '1.0.0'), { recursive: true })
    await writeFile(join(root, 'test-mod', '1.0.0', 'keep'), 'old')
    const old = { source: 'old', sha256: 'old-hash', approved: true, installedAt: 'yesterday' }
    await writeFile(
      join(root, 'installed.json'),
      JSON.stringify({
        schemaVersion: 1,
        mods: { 'test-mod': { '1.0.0': old }, another: { '2.0.0': old } }
      })
    )
    await catalog.installRelease('test-mod', '1.0.1')
    expect(await readFile(join(root, 'test-mod', '1.0.0', 'keep'), 'utf8')).toBe('old')
    expect(await readFile(join(root, 'test-mod', 'current'), 'utf8')).toBe('1.0.1\n')
    const records = JSON.parse(await readFile(join(root, 'installed.json'), 'utf8'))
    expect(records.mods['test-mod']['1.0.0']).toEqual(old)
    expect(records.mods.another['2.0.0']).toEqual(old)
    expect(records.mods['test-mod']['1.0.1']).toMatchObject({
      source: release('1.0.1').url,
      approved: false,
      sha256: release('1.0.1').sha256
    })
    expect(await readdir(join(root, '.downloads'))).toEqual([])
    expect((await readdir(join(root, 'test-mod'))).sort()).toEqual(['1.0.0', '1.0.1', 'current'])
  })
  it('restores current and keeps history if writing the install record fails', async () => {
    const { root, catalog } = await setup(archive('1.0.1'))
    catalog.setIndex(index([release('1.0.1')]))
    await mkdir(join(root, 'test-mod', '1.0.0'), { recursive: true })
    await writeFile(join(root, 'test-mod', 'current'), '1.0.0\n')
    const records = JSON.stringify({
      schemaVersion: 1,
      mods: { 'test-mod': { '1.0.0': { approved: true } } }
    })
    await writeFile(join(root, 'installed.json'), records)
    vi.spyOn(atomic, 'writeAtomicJson').mockRejectedValueOnce(new Error('record write failed'))
    await expect(catalog.installRelease('test-mod', '1.0.1')).rejects.toThrow('record write failed')
    expect(await readFile(join(root, 'test-mod', 'current'), 'utf8')).toBe('1.0.0\n')
    expect(await readFile(join(root, 'installed.json'), 'utf8')).toBe(records)
    expect(existsSync(join(root, 'test-mod', '1.0.1'))).toBe(false)
    expect(existsSync(join(root, 'test-mod', '1.0.0'))).toBe(true)
    expect(await readdir(join(root, '.downloads'))).toEqual([])
  })
  it('requires explicit approval for main code and never treats reviewed as consent', async () => {
    const bytes = zipSync({
      'vxmod.json': strToU8(JSON.stringify({ ...manifest(), main: true })),
      'main.js': strToU8('module.exports = {}')
    })
    const { root, catalog } = await setup(bytes)
    catalog.setIndex(index([{ ...release('1.0.0', bytes), main: true, reviewed: true }]))
    await expect(catalog.installRelease('test-mod', '1.0.0')).rejects.toThrow('needs your approval')
    expect(existsSync(join(root, 'test-mod'))).toBe(false)
    await catalog.installRelease('test-mod', '1.0.0', true)
    const records = JSON.parse(await readFile(join(root, 'installed.json'), 'utf8'))
    expect(records.mods['test-mod']['1.0.0'].approved).toBe(true)
  })
  it('refuses a release absent from the main-side catalogue', async () => {
    const { root, catalog } = await setup()
    catalog.setIndex(index())
    await expect(catalog.installRelease('test-mod', '../../escape')).rejects.toThrow(
      'not in the catalogue'
    )
    expect(await readdir(root)).toEqual([])
  })
})
