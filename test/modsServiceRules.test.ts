import { readFileSync } from 'fs'
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXTURES, installFixture, recordInstall } from './mods/fixtureMods'

/**
 * Shared rules in the main process, with the real rule and the real loader: the mod session adds
 * the installed mods to `MODS`, so a shared registry asked in main sees an installed mod as the
 * window does. On by default, off once its switch is written off, on again once a switch read
 * from disk says so; off whatever its switch while its `main.js` failed. Only Electron is a stub.
 */
let root = ''
let noMods = false
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getAppPath: () => root,
    getPath: () => root,
    getVersion: () => '0.6.0',
    commandLine: { hasSwitch: (name: string) => name === 'no-mods' && noMods }
  },
  BrowserWindow: { getAllWindows: () => [] },
  ipcMain: { on: () => {}, handle: () => {} },
  dialog: {},
  net: {},
  protocol: {},
  safeStorage: {}
}))

const { getModSwitches, setModSwitches, modOptionOn, modIsOn } = await import('../src/main/services/modsService')
const { modSession, startModSession } = await import('../src/main/mods/session')
const { MODS, switchedOn, optionOn, optionKey } = await import('../src/shared/mods')
const { sharedModOn } = await import('../src/shared/modRules')

/** The hello-mod fixture's manifest, under another id and with a `main.js` that throws. */
async function installBroken(data: string): Promise<void> {
  const manifest = JSON.parse(readFileSync(join(FIXTURES, 'hello-mod', 'vxmod.json'), 'utf8')) as Record<string, unknown>
  const folder = join(data, 'mods', 'broken', '1.0.0')
  await mkdir(folder, { recursive: true })
  await writeFile(join(folder, 'vxmod.json'), JSON.stringify({ ...manifest, id: 'broken', name: 'Broken', hooks: ['protocols'], options: undefined }))
  await writeFile(join(folder, 'main.js'), "throw new Error('boom')")
  recordInstall(data, 'broken', '1.0.0', new Uint8Array())
}

describe('shared rules in main', () => {
  beforeEach(async () => {
    noMods = false
    root = await mkdtemp(join(tmpdir(), 'vu-mods-'))
    const data = join(root, 'data')
    installFixture(data, 'hello-mod')
    await installBroken(data)
    await setModSwitches({ on: {}, options: {} })
    startModSession()
    // Startup records known mods in the background. Let that write finish before a test
    // changes the switches or teardown removes its directory (and the next test changes root).
    await vi.waitFor(() => {
      const known = JSON.parse(readFileSync(join(data, 'mods', 'known.json'), 'utf8'))
      expect(known.mods).toHaveProperty('hello-mod')
    })
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('applies pending removal before loading with --no-mods', async () => {
    const folder = join(root, 'data', 'mods')
    const known = join(folder, 'known.json')
    await rm(known)
    await writeFile(join(folder, 'pending.json'), JSON.stringify({ pending: 1, current: {}, remove: ['broken'] }))
    noMods = true
    startModSession()
    expect(modSession().safeStart).toBe('flag')
    expect(modSession().mods.map((row) => row.id)).not.toContain('broken')
    const records = JSON.parse(readFileSync(join(folder, 'installed.json'), 'utf8'))
    expect(records.mods).not.toHaveProperty('broken')
    await vi.waitFor(() => {
      const snapshot = JSON.parse(readFileSync(known, 'utf8'))
      expect(snapshot.mods).not.toHaveProperty('broken')
    })
  })

  it('reports a replay failure synchronously and skips installed main code', async () => {
    const folder = join(root, 'data', 'mods')
    const known = join(folder, 'known.json')
    const pending = join(folder, 'pending.json')
    const journal = JSON.stringify({ pending: 1, current: { 'hello-mod': '1.0.0' }, remove: [] })
    await rm(known)
    await mkdir(join(folder, 'hello-mod', 'current'))
    await writeFile(pending, journal)

    startModSession()

    const session = modSession()
    expect(session.safeStart).toBe('flag')
    expect(session.loaderError).toBeTruthy()
    expect(session.mods.find((mod) => mod.id === 'broken')?.status).not.toBe('failed')
    expect(readFileSync(pending, 'utf8')).toBe(journal)
    await vi.waitFor(() => {
      expect(JSON.parse(readFileSync(known, 'utf8')).mods).toHaveProperty('hello-mod')
    })
  })

  it('list the installed mods, and answer for a loaded one from the switches main last read or wrote', async () => {
    expect(modSession().mods.map((mod) => [mod.id, mod.status])).toEqual([
      ['broken', 'failed'],
      ['hello-mod', 'loaded']
    ])
    expect(MODS.map((mod) => mod.id)).toEqual(expect.arrayContaining(['broken', 'hello-mod']))

    expect(sharedModOn('hello-mod')).toBe(true)
    await setModSwitches({ on: { 'hello-mod': false }, options: {} })
    expect(sharedModOn('hello-mod')).toBe(false)

    await writeFile(join(root, 'data', 'mods.json'), JSON.stringify({ schemaVersion: 1, on: { 'hello-mod': true }, options: {} }))
    await getModSwitches()
    expect(sharedModOn('hello-mod')).toBe(true)
  })

  it('reads option defaults and follows switch changes without combining the on/off switch', async () => {
    const mod = MODS.find((mod) => mod.id === 'hello-mod')!
    const option = mod.options![0]
    expect(modOptionOn(mod.id, option.id)).toBe(optionOn({ on: {}, options: {} }, mod.id, option.id))
    await setModSwitches({ on: { [mod.id]: false }, options: { [optionKey(mod.id, option.id)]: !option.default } })
    expect(sharedModOn(mod.id)).toBe(false)
    expect(modOptionOn(mod.id, option.id)).toBe(!option.default)
    await setModSwitches({ on: {}, options: {} })
    expect(modOptionOn(mod.id, option.id)).toBe(option.default)
    expect(modOptionOn(mod.id, 'missing')).toBe(false)
  })

  it('answer off for an installed mod whose main.js failed, whatever its switch', async () => {
    const switches = await setModSwitches({ on: { broken: true }, options: {} }).then(getModSwitches)
    expect(switchedOn(switches, 'broken')).toBe(true)
    expect(sharedModOn('broken')).toBe(false)
    expect(await modIsOn('broken')).toBe(false)
  })

  it('reads fresh switches for a main caller and refreshes options in the same read', async () => {
    const mod = MODS.find(mod => mod.id === 'hello-mod')!
    const option = mod.options![0]
    expect(await modIsOn(mod.id)).toBe(true)
    await writeFile(join(root, 'data', 'mods.json'), JSON.stringify({
      schemaVersion: 1, on: { [mod.id]: false },
      options: { [optionKey(mod.id, option.id)]: !option.default }
    }))
    expect(await modIsOn(mod.id)).toBe(false)
    expect(modOptionOn(mod.id, option.id)).toBe(!option.default)
    expect(await modIsOn('not-installed')).toBe(false)
  })

  it('propagates an unreadable switch record rather than silently enabling a mod', async () => {
    await writeFile(join(root, 'data', 'mods.json'), '{broken')
    await expect(modIsOn('hello-mod')).rejects.toMatchObject({ code: 'MODS_MALFORMED' })
  })
})
