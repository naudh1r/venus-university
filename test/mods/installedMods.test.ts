import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ModDef } from '@shared/mods'
import type { ModSessionEntry, ModSessionTable } from '@shared/modSession'
import { restoreApi, stubApi } from '../fixtures'

/**
 * `MODS` with the installed mods in it, and what the hooks' rule makes of a mod that is not
 * running this session: in-repo and installed together, sorted by id; the rules work on both;
 * `isOn` false for a mod not `loaded` whatever its switch, and a library on while a mod that is
 * on requires it.
 */

const def = (id: string, over: Partial<ModDef> = {}): ModDef => ({
  id,
  name: id,
  author: 'a',
  version: '1.0.0',
  scope: 'anytime',
  defaultOn: true,
  blurb: '',
  ...over
})

const entry = (id: string, status: ModSessionEntry['status'], over: Partial<ModDef> = {}): ModSessionEntry => ({
  id,
  manifest: null,
  def: def(id, over),
  status,
  message: status === 'loaded' ? null : 'needs an update',
  warnings: [],
  folder: `C:\\mods\\${id}`,
  dev: false,
  renderer: null,
  style: null
})

/** A second copy of zebra, refused for being part of the build already: a row with no definition. */
const zebraCopy: ModSessionEntry = { ...entry('zebra', 'refused'), def: null, message: 'already part of this build', folder: 'C:\\mods\\zebra\\1.0.0' }

const table: ModSessionTable = {
  mods: [entry('zebra', 'loaded'), entry('apple', 'needs-update'), entry('lib', 'loaded', { library: true }), entry('user', 'loaded', { requires: ['lib'] }), zebraCopy],
  order: ['lib', 'user', 'zebra'],
  safeStart: null,
  loaderError: null,
  coreVersion: '0.1.0'
}

beforeEach(() => {
  vi.resetModules()
  stubApi({ mods: { session: table, get: async () => ({ ok: true, data: { on: {}, options: {} } }), set: async () => ({ ok: true, data: undefined }), failed: async () => ({ ok: true, data: undefined }) } })
})

afterEach(() => {
  restoreApi()
})

describe('MODS with the installed mods', () => {
  it('lists them with the in-repo ones, sorted by id, for every status', async () => {
    await import('../../src/renderer/installedMods')
    const { MODS, modOn, NO_SWITCHES } = await import('@shared/mods')
    // Beside whatever in-repo mods the build has (none on core), in one list sorted by id.
    const ids = MODS.map((mod) => mod.id)
    expect(ids).toEqual(expect.arrayContaining(['apple', 'lib', 'user', 'zebra']))
    expect(ids).toEqual([...ids].sort())
    expect(modOn(NO_SWITCHES, 'apple')).toBe(true)
    expect(modOn(NO_SWITCHES, 'zebra')).toBe(true)
  })

  it('makes the installed part what a table read again carries, leaving the build\'s own entries', async () => {
    const { MODS, installMods, modById, setInstalledMods } = await import('@shared/mods')
    const builtIn = [...MODS]
    installMods([def('apple'), def('zebra'), def('user')])
    setInstalledMods([def('zebra', { defaultOn: false }), def('mango'), def('apple', { defaultOn: false })], [...builtIn.map((mod) => mod.id), 'apple'])
    expect(MODS.map((mod) => mod.id)).toEqual([...builtIn.map((mod) => mod.id), 'apple', 'mango', 'zebra'].sort())
    for (const mod of builtIn) expect(modById(mod.id)).toBe(mod)
    expect(modById('zebra')?.defaultOn).toBe(false)
    expect(modById('apple')?.defaultOn).toBe(true)
  })

  it('keeps a mod that is not running off, whatever its switch says', async () => {
    const { modIsOn, useModsStore } = await import('../../src/renderer/stores/modsStore')
    const { withMod, NO_SWITCHES } = await import('@shared/mods')
    useModsStore.setState({ switches: withMod(NO_SWITCHES, 'apple', true) })
    expect(modIsOn('apple')).toBe(false)
    // The refused copy of zebra stands for no mod: zebra itself runs on.
    expect(modIsOn('zebra')).toBe(true)
  })

  it('asks a library while a mod that is on requires it, and not once that mod is off', async () => {
    await import('../../src/renderer/stores/modsStore')
    const hooks = await import('../../src/renderer/mods/hooks')
    const { useModsStore } = await import('../../src/renderer/stores/modsStore')
    const { withMod, NO_SWITCHES } = await import('@shared/mods')
    hooks.registerHooks('lib', { prompts: { dm: { lines: () => ['lib'] } } })
    hooks.registerHooks('user', { prompts: { dm: { lines: () => ['user'] } } })
    const ctx = {} as import('../../src/renderer/mods/hooks').PromptSpots['dm']
    expect(hooks.promptLines('dm', ctx)).toEqual(['lib', 'user'])
    useModsStore.setState({ switches: withMod(NO_SWITCHES, 'user', false) })
    expect(hooks.promptLines('dm', ctx)).toEqual([])
  })

  it('turns a mod off for the session once the window marks it failed, and writes nothing', async () => {
    const { useModSessionStore } = await import('../../src/renderer/stores/modSessionStore')
    const { modIsOn } = await import('../../src/renderer/stores/modsStore')
    expect(modIsOn('zebra')).toBe(true)
    useModSessionStore.getState().markFailed('zebra', 'failed', 'renderer.js failed to load: boom')
    expect(modIsOn('zebra')).toBe(false)
    expect(useModSessionStore.getState().table.mods.find((mod) => mod.id === 'zebra')?.message).toBe('renderer.js failed to load: boom')
    expect(useModSessionStore.getState().table.order).toEqual(['lib', 'user'])
  })
})
