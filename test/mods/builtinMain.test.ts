import { cpSync, readFileSync, writeFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { installMods, MODS, setInstalledMods, type ModDef } from '../../src/shared/mods'
import { isRunning, sessionRow } from '../../src/shared/modSession'
import { loadMods, type LoaderInput, type LoaderResult } from '../../src/main/mods/loader'
import type { MainContext } from '../../src/main/mods/require'
import { ModInvocations } from '../../src/main/mods/invoke'
import { handleModProtocol } from '../../src/main/mods/protocol'
import { useModSessionStore } from '../../src/renderer/stores/modSessionStore'
import { FIXTURES, installFixture } from './fixtureMods'
import { restoreApi, stubApi } from '../fixtures'
import { entry } from '../fixtures/builtin-main/entry'
import { throwingEntry } from '../fixtures/builtin-main/throws'

const electron = vi.hoisted(() => ({ handle: vi.fn(), fetch: vi.fn() }))
vi.mock('electron', () => ({ protocol: { handle: electron.handle }, net: { fetch: electron.fetch } }))

let root = ''
const original = [...MODS]
const originalIds = original.map(mod => mod.id)
const def = (id: string, hooks?: readonly string[]): ModDef => ({
  id, hooks, name: id, author: 'test', version: '1.0.0', scope: 'anytime',
  defaultOn: false, blurb: 'A built-in fixture.'
})

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-builtin-main-'))
  vi.clearAllMocks()
  stubApi({ mods: { noticesSeen: async () => ({ ok: true, data: undefined }) } })
})
afterEach(async () => {
  restoreApi()
  setInstalledMods(original, originalIds)
  await rm(root, { recursive: true, force: true })
})

function run(builtInMain: LoaderInput['builtInMain'], over: Partial<LoaderInput> = {}): LoaderResult {
  return loadMods({
    modsDir: join(root, 'mods'), devFolders: [], allowUnreviewedMain: true,
    builtIn: MODS.map(mod => mod.id), builtInMain,
    coreVersion: '0.1.0', gameVersion: '0.7.0', safeStart: null,
    log: () => {}, warn: () => {}, ...over
  })
}

/** The real protocol handler, with only Electron's registration and file transport stood in. */
function serve(result: LoaderResult): (request: Request) => Promise<Response> {
  handleModProtocol({ served: () => result.served, routes: () => result.routes, hostNames: () => null })
  expect(electron.handle).toHaveBeenLastCalledWith('vxmod', expect.any(Function))
  return electron.handle.mock.lastCall![1]
}

/** Dispatches the same start/result handshake main's IPC channel uses. */
async function call(result: LoaderResult, id: string): Promise<unknown> {
  const invocations = new ModInvocations()
  invocations.replace(result.table, result.invokes)
  const requestId = invocations.dispatch(1, id, { kind: 'start', name: 'identity', args: ['hello'] })
  return invocations.dispatch(1, id, { kind: 'result', requestId })
}

it('loads built-ins from start, dispatches their invoke and serves their route without exposing core files', async () => {
  installMods([def('one', ['invoke']), def('no-main')])
  const result = run({ one: entry })
  expect(sessionRow(result.table, 'one')?.status).toBe('loaded')
  // A built-in with nothing in main has no row, so it runs whatever the session does.
  expect(sessionRow(result.table, 'no-main')).toBeUndefined()
  expect(isRunning(result.table, 'no-main')).toBe(true)
  // A default-off switch does not prevent a loaded handler from answering.
  expect(await call(result, 'one')).toEqual({ id: 'one', value: 'hello' })
  const respond = serve(result)
  const response = await respond(new Request('vxmod://one/@/ping'))
  expect(response.status).toBe(200)
  expect(await response.text()).toBe('built-in pong')
  expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  expect((await respond(new Request('vxmod://one/index.js'))).status).toBe(404)
  expect(electron.fetch).not.toHaveBeenCalled()
})

it.each([
  ['bad invoke name', () => ({ invoke: { 'Bad/name': () => 'bad' } })],
  ['non-function invoke', () => ({ invoke: { identity: 1 } })],
  ['own scheme', () => ({ protocols: [{ scheme: 'custom', route: 'ping', handle: () => 'bad' }] })],
  ['duplicate route', () => ({ protocols: [
    { route: 'ping', handle: () => 'bad' }, { route: 'ping', handle: () => 'bad' }
  ] })],
  ['bad route name', () => ({ protocols: [{ route: 'Bad/name', handle: () => 'bad' }] })],
  ['entry exception', throwingEntry]
])('fails only the offending built-in for %s, leaving its whole mod off', async (_reason, bad) => {
  installMods([def('bad', ['invoke']), def('good', ['invoke'])])
  // A valid route cannot survive another part of the same entry failing validation.
  const result = run({ bad: () => ({ protocols: entry().protocols, ...bad() }), good: entry })
  expect(sessionRow(result.table, 'bad')?.status).toBe('failed')
  expect(sessionRow(result.table, 'bad')?.message).toMatch(/^main entry failed:/)
  expect(isRunning(result.table, 'bad')).toBe(false)
  useModSessionStore.setState({ table: result.table })
  expect(useModSessionStore.getState().running('bad')).toBe(false)
  expect(useModSessionStore.getState().running('good')).toBe(true)
  useModSessionStore.getState().noticeAtStart({})
  expect(useModSessionStore.getState().notice?.mods.map(mod => mod.id)).toEqual(['bad'])
  useModSessionStore.getState().dismissNotice()
  useModSessionStore.getState().noticeAtStart({ bad: '1.0.0' })
  expect(useModSessionStore.getState().notice).toBeNull()
  expect(result.invokes.has('bad')).toBe(false)
  expect(result.routes.has('bad')).toBe(false)
  await expect(call(result, 'bad')).rejects.toMatchObject({ code: 'MOD_INVOKE_NOT_LOADED' })
  expect((await serve(result)(new Request('vxmod://bad/@/ping'))).status).toBe(404)
  expect(await call(result, 'good')).toEqual({ id: 'good', value: 'hello' })
})

it('refuses an undeclared invoke through the same declaration check as installed main.js', async () => {
  installMods([def('undeclared')])
  const result = run({ undeclared: entry })
  expect(sessionRow(result.table, 'undeclared')?.status).toBe('failed')
  expect(sessionRow(result.table, 'undeclared')?.message).toContain('`invoke`')
  expect(result.invokes.has('undeclared')).toBe(false)
  expect(result.routes.has('undeclared')).toBe(false)
})

it('refuses unknown table ids without calling their functions or affecting known entries', async () => {
  installMods([def('known', ['invoke'])])
  const unknown = vi.fn(entry)
  const result = run({ unknown, known: entry })
  expect(unknown).not.toHaveBeenCalled()
  expect(result.table.mods.find(mod => mod.id === 'unknown')).toMatchObject({ status: 'refused', def: null })
  expect(result.invokes.has('unknown')).toBe(false)
  expect(await call(result, 'known')).toEqual({ id: 'known', value: 'hello' })
})

it('keeps handlers and routes in their owning id, including result claims', async () => {
  installMods([def('one', ['invoke']), def('two')])
  const result = run({ one: entry })
  await expect(call(result, 'two')).rejects.toMatchObject({ code: 'MOD_INVOKE_UNKNOWN' })
  const invocations = new ModInvocations()
  invocations.replace(result.table, result.invokes)
  const requestId = invocations.dispatch(1, 'one', { kind: 'start', name: 'identity', args: [] })
  await expect(invocations.dispatch(1, 'two', { kind: 'result', requestId })).rejects
    .toMatchObject({ code: 'MOD_INVOKE_UNKNOWN' })
  expect(await invocations.dispatch(1, 'one', { kind: 'result', requestId })).toMatchObject({ id: 'one' })
  expect((await serve(result)(new Request('vxmod://two/@/ping'))).status).toBe(404)
})

it.each(['hello-mod', 'another-folder'])('cannot replace a built-in entry through an installed copy or dev folder %s', async folderName => {
  installMods([def('hello-mod', ['invoke'])])
  installFixture(root, 'hello-mod')
  const dev = join(root, 'dev', folderName)
  cpSync(join(FIXTURES, 'hello-mod'), dev, { recursive: true })
  const requireMain = vi.fn(() => ({ invoke: { identity: () => 'replacement' } }))
  const result = run({ 'hello-mod': entry }, { devFolders: [dev], requireMain })
  const refused = result.table.mods.filter(mod => mod.def === null)
  expect(refused).toHaveLength(2)
  expect(refused.map(mod => [mod.dev, mod.status, mod.message])).toEqual([
    [false, 'refused', 'already part of this build'], [true, 'refused', 'already part of this build']
  ])
  expect(requireMain).not.toHaveBeenCalled()
  expect(sessionRow(result.table, 'hello-mod')?.status).toBe('loaded')
  expect(await call(result, 'hello-mod')).toEqual({ id: 'hello-mod', value: 'hello' })
  expect(await (await serve(result)(new Request('vxmod://hello-mod/@/ping'))).text()).toBe('built-in pong')
})

it.each(['flag', 'shift'] as const)('keeps built-ins running, with and without a main entry, in safe start (%s)', async (safeStart) => {
  installMods([def('one', ['invoke']), def('no-main')])
  const load = vi.fn(entry)
  const result = run({ one: load }, { safeStart })
  expect(load).toHaveBeenCalledOnce()
  expect(isRunning(result.table, 'one')).toBe(true)
  expect(isRunning(result.table, 'no-main')).toBe(true)
  expect(sessionRow(result.table, 'no-main')).toBeUndefined()
  expect(result.served.get('one')?.loaded).toBe(true)
  expect(await call(result, 'one')).toEqual({ id: 'one', value: 'hello' })
  useModSessionStore.setState({ table: result.table, shiftStart: true })
  expect(useModSessionStore.getState().running('one')).toBe(true)
  expect(useModSessionStore.getState().running('no-main')).toBe(true)
})

it('keeps built-in entries working after a loader error in installed mods', async () => {
  installMods([def('one', ['invoke'])])
  const result = run({ one: entry }, { modsDir: '\0 not a folder' })
  expect(result.table.loaderError).not.toBeNull()
  {
    expect(isRunning(result.table, 'one')).toBe(true)
    expect(await call(result, 'one')).toEqual({ id: 'one', value: 'hello' })
  }
})

it.each([null, 'flag'] as const)('lets a built-in with a main entry require one without, which keeps no row (safe start %s)', async (safeStart) => {
  installMods([{ ...def('companion', ['invoke']), requires: ['notes'] }, def('notes')])
  const load = vi.fn(entry)
  const result = run({ companion: load }, { safeStart })
  expect(sessionRow(result.table, 'companion')).toMatchObject({ status: 'loaded', message: null })
  expect(load).toHaveBeenCalledOnce()
  expect(await call(result, 'companion')).toEqual({ id: 'companion', value: 'hello' })
  expect(sessionRow(result.table, 'notes')).toBeUndefined()
  expect(result.table.order).toEqual(['companion'])
  expect(isRunning(result.table, 'notes')).toBe(true)
})

it('lets an installed mod require a built-in without a main entry, held to its range', () => {
  installMods([def('notes')])
  const folder = installFixture(root, 'hello-mod')
  const manifest = JSON.parse(readFileSync(join(folder, 'vxmod.json'), 'utf8')) as Record<string, unknown>
  const requireMain = vi.fn((_ctx: MainContext) => ({}))
  writeFileSync(join(folder, 'vxmod.json'), JSON.stringify({ ...manifest, requires: { notes: '^1.0.0' } }))
  const inRange = run({}, { requireMain })
  expect(sessionRow(inRange.table, 'hello-mod')).toMatchObject({ status: 'loaded', message: null })
  expect(requireMain).toHaveBeenCalledOnce()
  expect(requireMain.mock.lastCall![0].dependencies).toEqual(new Set(['notes']))
  expect(sessionRow(inRange.table, 'notes')).toBeUndefined()
  writeFileSync(join(folder, 'vxmod.json'), JSON.stringify({ ...manifest, requires: { notes: '^2.0.0' } }))
  const outOfRange = run({}, { requireMain })
  expect(sessionRow(outOfRange.table, 'hello-mod')).toMatchObject({ status: 'blocked', message: 'needs notes ^2.0.0, 1.0.0 is installed' })
})

it('blocks an installed mod whose built-in requirement without a main entry needs a mod that is absent', () => {
  installMods([{ ...def('notes'), requires: ['backend'] }])
  const folder = installFixture(root, 'hello-mod')
  const manifest = JSON.parse(readFileSync(join(folder, 'vxmod.json'), 'utf8')) as Record<string, unknown>
  writeFileSync(join(folder, 'vxmod.json'), JSON.stringify({ ...manifest, requires: { notes: '*' } }))
  const requireMain = vi.fn((_ctx: MainContext) => ({}))
  const result = run({}, { requireMain })
  expect(sessionRow(result.table, 'hello-mod')).toMatchObject({ status: 'blocked', message: 'needs notes, which did not load' })
  expect(requireMain).not.toHaveBeenCalled()
  expect(sessionRow(result.table, 'notes')).toBeUndefined()
})

it('blocks a built-in whose requirement without a main entry needs a built-in whose entry threw', () => {
  installMods([
    { ...def('companion', ['invoke']), requires: ['notes'] },
    { ...def('notes'), requires: ['backend'] },
    def('backend', ['invoke'])
  ])
  const load = vi.fn(entry)
  const result = run({ companion: load, backend: throwingEntry })
  expect(sessionRow(result.table, 'backend')?.status).toBe('failed')
  expect(sessionRow(result.table, 'companion')).toMatchObject({ status: 'blocked', message: 'needs notes, which did not load' })
  expect(load).not.toHaveBeenCalled()
  expect(result.invokes.has('companion')).toBe(false)
  expect(sessionRow(result.table, 'notes')).toBeUndefined()
  expect(result.table.order).toEqual([])
})

it('blocks a built-in that requires itself through a built-in without a main entry', () => {
  installMods([{ ...def('companion', ['invoke']), requires: ['notes'] }, { ...def('notes'), requires: ['companion'] }])
  const load = vi.fn(entry)
  const result = run({ companion: load })
  expect(sessionRow(result.table, 'companion')).toMatchObject({ status: 'blocked', message: 'requires itself through companion → notes → companion' })
  expect(load).not.toHaveBeenCalled()
  expect(sessionRow(result.table, 'notes')).toBeUndefined()
})
