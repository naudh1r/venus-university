import { mkdir, mkdtemp, rm, writeFile, unlink } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { zipSync } from 'fflate'
import { loadMods, type LoaderInput, type LoaderResult } from '../../src/main/mods/loader'
import { unpackRelease } from '../../src/main/mods/unpack'
import type { MainContext } from '../../src/main/mods/require'
import { FIXTURES, installFixture, recordInstall, setCurrent, snapshot, zipFixture } from './fixtureMods'

/**
 * The loader on the fixture set, installed under a temp data folder exactly as an install lays a
 * mod out: the session table status by status, with the messages; `main.js` required through
 * the kit proxy; a loader that throws leaving every mod off; and nothing written anywhere.
 */

let root = ''
const lines: string[] = []

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-loader-'))
  lines.length = 0
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

const ALL = ['hello-mod', 'missing-hook', 'undeclared', 'throws', 'lib', 'uses-lib', 'cycle-a', 'cycle-b']

function run(over: Partial<LoaderInput> = {}): LoaderResult {
  return loadMods({
    modsDir: join(root, 'mods'),
    devFolders: [],
    allowUnreviewedMain: false,
    builtIn: [],
    coreVersion: '0.1.0',
    gameVersion: '0.6.0',
    safeStart: null,
    log: (line) => lines.push(line),
    warn: (line) => lines.push(line),
    ...over
  })
}

const statusOf = (result: LoaderResult, id: string): string | undefined => result.table.mods.find((mod) => mod.id === id)?.status
const messageOf = (result: LoaderResult, id: string): string | null | undefined => result.table.mods.find((mod) => mod.id === id)?.message

describe('the loader on the fixture set', () => {
  beforeEach(() => {
    for (const id of ALL) installFixture(root, id)
  })

  it('gives every mod its status, and loads the rest in dependency order', () => {
    const result = run()
    expect(result.table.loaderError).toBeNull()
    expect(statusOf(result, 'hello-mod')).toBe('loaded')
    expect(statusOf(result, 'lib')).toBe('loaded')
    expect(statusOf(result, 'uses-lib')).toBe('loaded')
    // Undeclared registrations are the window's to catch: here it reads as any other mod.
    expect(statusOf(result, 'undeclared')).toBe('loaded')
    expect(statusOf(result, 'throws')).toBe('loaded')
    expect(statusOf(result, 'missing-hook')).toBe('needs-update')
    expect(messageOf(result, 'missing-hook')).toBe('needs an update: `notARealHook` is not in this core')
    expect(statusOf(result, 'cycle-a')).toBe('blocked')
    expect(messageOf(result, 'cycle-a')).toBe('requires itself through cycle-a → cycle-b → cycle-a')
    expect(statusOf(result, 'cycle-b')).toBe('blocked')
    expect(result.table.order).toEqual(['hello-mod', 'lib', 'throws', 'undeclared', 'uses-lib'])
    expect(result.table.order.indexOf('lib')).toBeLessThan(result.table.order.indexOf('uses-lib'))
  })

  it("requires hello-mod's main.js once, through the kit proxy, and collects its route", async () => {
    const seen: MainContext[] = []
    const result = run({
      requireMain: (ctx) => {
        seen.push(ctx)
        return { protocols: [{ route: 'ping', handle: () => 'ok' }] }
      }
    })
    expect(seen.map((ctx) => ctx.id)).toEqual(['hello-mod'])
    expect(seen[0].declared.has('protocols')).toBe(true)
    expect(seen[0].file).toBe(join(root, 'mods', 'hello-mod', '1.0.0', 'main.js'))
    const handler = result.routes.get('hello-mod')?.get('ping')
    expect(handler).toBeDefined()
    expect(await handler?.(new Request('vxmod://hello-mod/@/ping'))).toBe('ok')
  })

  it('collects declared invoke handlers atomically and leaves none for failed or refused main code', () => {
    const file = join(root, 'mods', 'hello-mod', '1.0.0', 'vxmod.json')
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    writeFileSync(file, JSON.stringify({ ...manifest, hooks: [...new Set([...manifest.hooks, 'invoke'])] }))
    const say = (): string => 'hello'
    expect(run({ requireMain: () => ({ invoke: { say } }) }).invokes.get('hello-mod')?.get('say')).toBe(say)
    for (const invoke of [null, [], { 'Bad/name': say }, { say: 1 }]) {
      const result = run({ requireMain: () => ({ protocols: [{ route: 'ok', handle: say }], invoke }) })
      expect(statusOf(result, 'hello-mod')).toBe('failed')
      expect(result.invokes.has('hello-mod')).toBe(false)
      expect(result.routes.has('hello-mod')).toBe(false)
    }
    writeFileSync(file, JSON.stringify({ ...manifest, hooks: manifest.hooks.filter((hook: string) => hook !== 'invoke') }))
    const undeclared = run({ requireMain: () => ({ invoke: { say } }) })
    expect(statusOf(undeclared, 'hello-mod')).toBe('refused')
    expect(undeclared.invokes.has('hello-mod')).toBe(false)
    const failed = run({ requireMain: () => { throw new Error('boom') } })
    expect(failed.invokes.has('hello-mod')).toBe(false)
    const refused = run({ allowUnreviewedMain: false, requireMain: () => ({ invoke: { say } }) })
    expect(refused.invokes.has('hello-mod')).toBe(false)
  })

  it("runs hello-mod's real main.js and serves its files", () => {
    const result = run()
    expect(result.routes.get('hello-mod')?.has('ping')).toBe(true)
    const served = result.served.get('hello-mod')
    expect(served?.loaded).toBe(true)
    expect(served?.folder).toBe(join(root, 'mods', 'hello-mod', '1.0.0'))
    expect(result.served.get('missing-hook')?.loaded).toBe(false)
    const hello = result.table.mods.find((mod) => mod.id === 'hello-mod')
    expect(hello?.renderer).toBe('vxmod://hello-mod/renderer.js')
    expect(hello?.style).toBe('vxmod://hello-mod/style.css')
    expect(result.table.mods.find((mod) => mod.id === 'lib')?.style).toBeNull()
  })

  it('refuses a mod whose main.js threw, and blocks what requires one that did not load', () => {
    const result = run({
      requireMain: () => {
        throw new Error('boom')
      }
    })
    expect(statusOf(result, 'hello-mod')).toBe('failed')
    expect(messageOf(result, 'hello-mod')).toBe('main.js threw: boom')
    expect(result.served.get('hello-mod')?.loaded).toBe(false)
  })

  it('does not permit main-process code from an unreviewed source unless the setting says so', async () => {
    // Approval is the installer's record beside the folders; a file inside the folder is anyone's to write.
    await unlink(join(root, 'mods', 'installed.json'))
    await writeFile(join(root, 'mods', 'hello-mod', '1.0.0', 'install.json'), '{ "approved": true }')
    expect(statusOf(run(), 'hello-mod')).toBe('not-permitted')
    expect(statusOf(run({ allowUnreviewedMain: true }), 'hello-mod')).toBe('loaded')
    recordInstall(root, 'hello-mod', '1.0.0', zipFixture('hello-mod'), false)
    expect(statusOf(run(), 'hello-mod')).toBe('not-permitted')
    recordInstall(root, 'hello-mod', '1.0.0', zipFixture('hello-mod'), true)
    expect(statusOf(run(), 'hello-mod')).toBe('loaded')
  })

  it('reads the manifests but runs nothing with --no-mods', () => {
    let required = 0
    const result = run({ safeStart: 'flag', requireMain: () => (required++, {}) })
    expect(required).toBe(0)
    expect(result.table.safeStart).toBe('flag')
    expect(statusOf(result, 'hello-mod')).toBe('loaded')
    expect(result.served.get('hello-mod')?.loaded).toBe(false)
  })

  it('leaves every mod off, and says why, when the loader itself throws', () => {
    const result = run({ devFolders: [123 as unknown as string] })
    expect(result.table.loaderError).toMatch(/^the mod loader failed: /)
    expect(result.table.order).toEqual([])
    for (const mod of result.table.mods) expect(result.served.get(mod.id)?.loaded ?? false).toBe(false)
  })

  it('writes nothing: mods.json and every mod folder are byte for byte as before', async () => {
    await writeFile(join(root, 'mods.json'), '{"schemaVersion":1,"on":{"hello-mod":false},"options":{}}')
    const before = snapshot(root)
    run()
    run({ requireMain: () => { throw new Error('boom') } })
    expect(snapshot(root)).toEqual(before)
  })
})

describe('the loader on the folders', () => {
  it('reads the version `current` names and refuses a manifest that disagrees with its folder', () => {
    installFixture(root, 'hello-mod', '1.0.0')
    installFixture(root, 'hello-mod', '1.2.0')
    setCurrent(root, 'hello-mod', '1.2.0')
    const result = run()
    expect(result.table.mods.find((mod) => mod.id === 'hello-mod')?.folder).toBe(join(root, 'mods', 'hello-mod', '1.2.0'))
    expect(statusOf(result, 'hello-mod')).toBe('refused')
    expect(messageOf(result, 'hello-mod')).toBe('the folder says 1.2.0, the manifest says 1.0.0')
  })

  it('lists a folder whose manifest cannot be read under its own name, with the reason', async () => {
    installFixture(root, 'hello-mod')
    await writeFile(join(root, 'mods', 'hello-mod', '1.0.0', 'vxmod.json'), '{ not json')
    const result = run()
    const row = result.table.mods.find((mod) => mod.id === 'hello-mod')
    expect(row?.status).toBe('refused')
    expect(row?.def).toBeNull()
    expect(row?.message).toMatch(/^vxmod.json cannot be read: /)
    expect(result.served.has('hello-mod')).toBe(false)
  })

  it('refuses a manifest that says main: true with no main.js beside it', async () => {
    installFixture(root, 'hello-mod')
    await unlink(join(root, 'mods', 'hello-mod', '1.0.0', 'main.js'))
    expect(messageOf(run(), 'hello-mod')).toBe('says main: true but has no main.js')
  })

  it('lets a developer folder stand in for the installed copy, with a note on the row', () => {
    installFixture(root, 'hello-mod')
    const result = run({ devFolders: [join(FIXTURES, 'hello-mod')] })
    const rows = result.table.mods.filter((mod) => mod.id === 'hello-mod')
    expect(rows).toHaveLength(1)
    expect(rows[0].dev).toBe(true)
    expect(rows[0].folder).toBe(join(FIXTURES, 'hello-mod'))
    expect(rows[0].warnings).toEqual(['standing in for the installed 1.0.0 this session'])
    // A developer folder is the player's own choice: its main.js runs with no install record.
    expect(rows[0].status).toBe('loaded')
  })

  it('refuses two developer folders with one id, keeping one definition for the list', () => {
    const result = run({ devFolders: [join(FIXTURES, 'hello-mod'), join(FIXTURES, 'hello-mod')] })
    const rows = result.table.mods.filter((mod) => mod.id === 'hello-mod')
    expect(rows.map((row) => row.status)).toEqual(['refused', 'refused'])
    expect(rows.filter((row) => row.def !== null)).toHaveLength(1)
  })

  it('warns, and still loads, a mod made for another version of the game', () => {
    installFixture(root, 'hello-mod')
    const result = run({ gameVersion: '0.9.0' })
    expect(statusOf(result, 'hello-mod')).toBe('loaded')
    expect(result.table.coreVersion).toBe('0.1.0')
    const bounded = { ...JSON.parse(require('fs').readFileSync(join(FIXTURES, 'hello-mod', 'vxmod.json'), 'utf8')), game: '>=0.6.0 <0.8.0' }
    require('fs').writeFileSync(join(root, 'mods', 'hello-mod', '1.0.0', 'vxmod.json'), JSON.stringify(bounded))
    const warned = run({ gameVersion: '0.9.0' })
    expect(statusOf(warned, 'hello-mod')).toBe('loaded')
    expect(warned.table.mods.find((mod) => mod.id === 'hello-mod')?.warnings).toEqual(['made for Venus University >=0.6.0 <0.8.0; this is 0.9.0'])
  })

  it('needs an update where a library no longer has an export a dependent uses', () => {
    installFixture(root, 'lib')
    installFixture(root, 'uses-lib')
    const libManifest = JSON.parse(require('fs').readFileSync(join(FIXTURES, 'lib', 'vxmod.json'), 'utf8')) as { exports: string[] }
    require('fs').writeFileSync(join(root, 'mods', 'lib', '1.0.0', 'vxmod.json'), JSON.stringify({ ...libManifest, exports: ['wave'] }))
    const result = run()
    expect(statusOf(result, 'lib')).toBe('loaded')
    expect(statusOf(result, 'uses-lib')).toBe('needs-update')
    expect(messageOf(result, 'uses-lib')).toBe('needs `lib:greet`, which Lib 1.0.0 no longer has')
  })

  it('blocks a mod whose requirement is missing', () => {
    installFixture(root, 'uses-lib')
    expect(messageOf(run(), 'uses-lib')).toBe('needs lib, which is not installed')
  })

  it('runs a mod without an optional dependency whose main.js failed, with a warning', async () => {
    installFixture(root, 'hello-mod')
    const helloManifest = JSON.parse(require('fs').readFileSync(join(FIXTURES, 'hello-mod', 'vxmod.json'), 'utf8')) as Record<string, unknown>
    await writeFile(join(root, 'mods', 'hello-mod', '1.0.0', 'vxmod.json'), JSON.stringify({ ...helloManifest, optional: { helper: '*' } }))
    const helperFolder = join(root, 'mods', 'helper', '1.0.0')
    await mkdir(helperFolder, { recursive: true })
    await writeFile(join(helperFolder, 'vxmod.json'), JSON.stringify({ ...helloManifest, id: 'helper', name: 'Helper', options: undefined }))
    await writeFile(join(helperFolder, 'main.js'), 'module.exports = {}')
    const seen: MainContext[] = []
    const result = run({
      allowUnreviewedMain: true,
      requireMain: (ctx) => {
        if (ctx.id === 'helper') throw new Error('boom')
        seen.push(ctx)
        return {}
      }
    })
    expect(statusOf(result, 'helper')).toBe('failed')
    expect(statusOf(result, 'hello-mod')).toBe('loaded')
    expect(seen.map((ctx) => [ctx.id, [...ctx.dependencies]])).toEqual([['hello-mod', []]])
    expect(lines).toContain('[mods] hello-mod: optional helper is installed but did not load; running without it')
  })
})

describe('unpackRelease', () => {
  it('refuses a zip naming a file outside its folder before writing anything', () => {
    const zip = zipSync({ 'vxmod.json': new Uint8Array([123, 125]), '../escape.txt': new Uint8Array([1]) })
    expect(() => unpackRelease(zip, join(root, 'out'))).toThrow(/outside its folder/)
    expect(existsSync(join(root, 'out'))).toBe(false)
    expect(existsSync(join(root, 'escape.txt'))).toBe(false)
  })
})
