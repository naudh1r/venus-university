import { cpSync, readFileSync } from 'fs'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURES, installFixture } from './fixtureMods'

/**
 * A developer folder's manifest changes while the game runs: the rerun of the checks remakes the
 * installed part of main's `MODS`, so main's shared rule reads the new definition (a changed
 * `defaultOn`, a new requirement), and a mod whose manifest became unreadable or whose folder is
 * gone is no longer in the list, so the rule answers off for it. Only Electron is a stub.
 */
let root = ''
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => root,
    getPath: () => root,
    getVersion: () => '0.6.0',
    commandLine: { hasSwitch: () => false }
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { on: () => {}, handle: () => {} },
  dialog: {},
  net: {},
  protocol: {},
  safeStorage: {}
}))

const { setModSwitches } = await import('../../src/main/services/modsService')
const { modSession, rerunModChecks, startModSession } = await import('../../src/main/mods/session')
const { MODS, modById } = await import('../../src/shared/mods')
const { sharedModOn } = await import('../../src/shared/modRules')

// Core has none; main must keep its bundled definitions through every installed-mod rerun.
const builtIn = [...MODS]

function expectBundledAndLibrary(): void {
  expect(MODS.map((mod) => mod.id)).toEqual([...builtIn.map((mod) => mod.id), 'lib'].sort())
  for (const mod of builtIn) expect(modById(mod.id)).toBe(mod)
}

/** The developer folder: a copy of the hello-mod fixture. */
let dev = ''

const helloManifest = (): Record<string, unknown> => JSON.parse(readFileSync(join(FIXTURES, 'hello-mod', 'vxmod.json'), 'utf8')) as Record<string, unknown>

/** Rewrites the folder's manifest with these fields over the fixture's, and reruns the checks as the watcher would. */
async function rewrite(over: Record<string, unknown>): Promise<void> {
  await writeFile(join(dev, 'vxmod.json'), JSON.stringify({ ...helloManifest(), ...over }))
  rerunModChecks()
}

const row = (id: string): import('../../src/shared/modSession').ModSessionEntry | undefined => modSession().mods.find((mod) => mod.id === id)

describe('a developer folder reloaded while the game runs', () => {
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vu-dev-'))
    const data = join(root, 'data')
    dev = join(root, 'dev', 'hello-mod')
    cpSync(join(FIXTURES, 'hello-mod'), dev, { recursive: true })
    installFixture(data, 'lib')
    await mkdir(data, { recursive: true })
    await writeFile(join(data, 'settings.json'), JSON.stringify({ devModFolders: [dev] }))
    await setModSwitches({ on: {}, options: {} })
    startModSession()
    expect(row('hello-mod')?.status).toBe('loaded')
    expect(sharedModOn('hello-mod')).toBe(true)
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('reads a changed defaultOn', async () => {
    await rewrite({ defaultOn: false })
    expect(row('hello-mod')?.status).toBe('loaded')
    expect(modById('hello-mod')?.defaultOn).toBe(false)
    expect(sharedModOn('hello-mod')).toBe(false)
    await setModSwitches({ on: { 'hello-mod': true }, options: {} })
    expect(sharedModOn('hello-mod')).toBe(true)
  })

  it('reads a new requirement, and turns the mod off with it', async () => {
    await rewrite({ requires: { lib: '*' } })
    expect(row('hello-mod')?.status).toBe('loaded')
    expect(modById('hello-mod')?.requires).toEqual(['lib'])
    expect(sharedModOn('hello-mod')).toBe(true)
    await setModSwitches({ on: { lib: false }, options: {} })
    expect(sharedModOn('hello-mod')).toBe(false)
  })

  it('drops a mod whose manifest became unreadable, so the rule answers off whatever its switch', async () => {
    await setModSwitches({ on: { 'hello-mod': true }, options: {} })
    await rewrite({ surprise: true })
    expect(row('hello-mod')?.status).toBe('refused')
    expect(row('hello-mod')?.def).toBeNull()
    expectBundledAndLibrary()
    expect(sharedModOn('hello-mod')).toBe(false)
  })

  it('drops a mod whose folder is gone', async () => {
    await setModSwitches({ on: { 'hello-mod': true }, options: {} })
    await rm(dev, { recursive: true, force: true })
    rerunModChecks()
    expect(row('hello-mod')?.def).toBeNull()
    expectBundledAndLibrary()
    expect(sharedModOn('hello-mod')).toBe(false)
  })
})
