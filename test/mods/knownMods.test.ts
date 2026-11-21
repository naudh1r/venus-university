import { existsSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { mkdtemp, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMods, MODS, setInstalledMods, type ModDef, type ModSwitches } from '../../src/shared/mods'
import { loadMods, type LoaderResult } from '../../src/main/mods/loader'
import { KNOWN_FILE, knownModsOf, writeKnownMods, type KnownFile } from '../../src/main/mods/known'
import { installFixture } from './fixtureMods'

/**
 * `data/mods/known.json`, the record a later build reads to tell which mods a player had on once
 * one has left the build: every built-in and installed mod with its switch as the player left it,
 * an entry for a mod that has since left kept, and a start never stopped by a write that fails.
 */

let root = ''
const original = [...MODS]
const originalIds = original.map((mod) => mod.id)

/** A mod built into the build, off unless the player switches it on, fixed per playthrough. */
const ownMod: ModDef = {
  id: 'own-mod', name: 'Own mod', author: 'test', version: '2.1.0', scope: 'playthrough',
  defaultOn: false, blurb: 'A built-in fixture.'
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'vu-known-'))
  installMods([ownMod])
  // Both default on: one the player switched off, one nobody touched.
  installFixture(root, 'hello-mod')
  installFixture(root, 'throws')
})

afterEach(async () => {
  setInstalledMods(original, originalIds)
  await rm(root, { recursive: true, force: true })
})

/** The loader as main runs it at start, with `own-mod` as part of the build. */
function run(): LoaderResult {
  return loadMods({
    modsDir: join(root, 'mods'), devFolders: [], allowUnreviewedMain: false,
    builtIn: [...originalIds, ownMod.id], coreVersion: '0.1.0', gameVersion: '0.6.0', safeStart: null,
    log: () => {}, warn: () => {}
  })
}

const switches: ModSwitches = { on: { 'own-mod': true, 'hello-mod': false }, options: {} }
const builtIn = (): ModDef[] => MODS.filter((mod) => mod.id === ownMod.id || originalIds.includes(mod.id))
const readKnown = (): KnownFile => JSON.parse(readFileSync(join(root, 'mods', KNOWN_FILE), 'utf8')) as KnownFile

describe('known.json', () => {
  it('records each built-in and installed mod with its switch as the player left it', () => {
    const file = knownModsOf({ builtIn: builtIn(), table: run().table, switches, previous: null })
    expect(file.schemaVersion).toBe(1)
    expect(file.mods['own-mod']).toEqual({ id: 'own-mod', version: '2.1.0', scope: 'playthrough', defaultOn: false, switchedOn: true, builtIn: true })
    expect(file.mods['hello-mod']).toEqual({ id: 'hello-mod', version: '1.0.0', scope: 'anytime', defaultOn: true, switchedOn: false, builtIn: false })
    expect(file.mods['throws']).toEqual({ id: 'throws', version: '1.0.0', scope: 'anytime', defaultOn: true, switchedOn: true, builtIn: false })
    expect(Object.keys(file.mods)).toEqual([...originalIds, 'hello-mod', 'own-mod', 'throws'].sort())
  })

  it('keeps the last entry of a mod that has left the build, and refreshes the rest', async () => {
    const gone = { id: 'gone-mod', version: '0.3.0', scope: 'anytime', defaultOn: true, switchedOn: true, builtIn: true }
    const stale = { id: 'hello-mod', version: '0.9.0', scope: 'anytime', defaultOn: true, switchedOn: true, builtIn: false }
    writeFileSync(join(root, 'mods', KNOWN_FILE), JSON.stringify({ schemaVersion: 1, mods: { 'gone-mod': gone, 'hello-mod': stale } }))
    await writeKnownMods(join(root, 'mods'), { builtIn: builtIn(), table: run().table, switches }, () => {})
    const file = readKnown()
    expect(file.mods['gone-mod']).toEqual(gone)
    expect(file.mods['hello-mod']).toMatchObject({ version: '1.0.0', switchedOn: false })
    // Written through a temp file renamed into place: nothing is left beside it.
    expect(readdirSync(join(root, 'mods')).filter((name) => name.endsWith('.tmp'))).toEqual([])
  })

  it.each([
    ['not JSON', '{"schemaVersion": 1, "mods": {'],
    ['of another shape', JSON.stringify({ schemaVersion: 0, mods: { 'gone-mod': { id: 'gone-mod', version: '0.3.0', scope: 'anytime', defaultOn: true, switchedOn: true, builtIn: true } } })]
  ])('replaces a file that is %s, carrying nothing over', async (_name, text) => {
    writeFileSync(join(root, 'mods', KNOWN_FILE), text)
    await writeKnownMods(join(root, 'mods'), { builtIn: builtIn(), table: run().table, switches }, () => {})
    const file = readKnown()
    expect(file.schemaVersion).toBe(1)
    expect(file.mods['gone-mod']).toBeUndefined()
    expect(file.mods['own-mod']?.switchedOn).toBe(true)
  })

  it('leaves a file from a newer build as it is', async () => {
    const newer = JSON.stringify({ schemaVersion: 2, mods: { 'gone-mod': { id: 'gone-mod', leftOut: true } } })
    writeFileSync(join(root, 'mods', KNOWN_FILE), newer)
    const warnings: string[] = []
    await writeKnownMods(join(root, 'mods'), { builtIn: builtIn(), table: run().table, switches }, (line) => warnings.push(line))
    expect(readFileSync(join(root, 'mods', KNOWN_FILE), 'utf8')).toBe(newer)
    expect(warnings).toHaveLength(1)
  })

  it('warns and does not throw where the file cannot be written', async () => {
    const table = run().table
    // A file where the mods folder should be: no folder can be made and nothing written under it.
    const modsDir = join(root, 'blocked')
    writeFileSync(modsDir, '')
    const warnings: string[] = []
    await expect(writeKnownMods(modsDir, { builtIn: builtIn(), table, switches }, (line) => warnings.push(line))).resolves.toBeUndefined()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain(`${KNOWN_FILE} not written`)
    expect(existsSync(join(modsDir, KNOWN_FILE))).toBe(false)
  })
})
