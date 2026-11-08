import { existsSync, readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { entryMods, importsOf, scanGame, scanKit, scanMods, type ModSet } from './boundaryScan'
import { MOD_FILES } from './modFiles'

/**
 * The import boundary: a mod file imports only the kit, React, `motion`, its own code and the
 * mods it requires, and no game file imports a mod's. Proved on fixture mods, then held over the
 * in-repo mods and the kit itself.
 */

const ROOT = resolve(__dirname, '../..')
const FIXTURES = 'test/fixtures/kit-boundary'

const fixtureMods: Record<string, ModSet> = {
  'good-mod': { globs: [`${FIXTURES}/good-mod/**`] },
  'bad-mod': { globs: [`${FIXTURES}/bad-mod/**`] },
  'lib-user': { globs: [`${FIXTURES}/lib-user/**`], requires: ['good-mod'] }
}

const line = ({ file, specifier }: { file: string; specifier: string }): string => `${file} -> ${specifier}`

/** Today's in-repo mods: each entry's files, with what `MOD_FILES` lists. */
function inRepoMods(): Record<string, ModSet> {
  // The entries' own `requires` win over the map's, which is for a mod whose entry is elsewhere.
  const mods: Record<string, ModSet> = { ...MOD_FILES }
  for (const [id, entry] of Object.entries(entryMods(ROOT))) {
    const listed = mods[id]
    mods[id] = {
      globs: [...(listed?.globs ?? []), ...entry.globs],
      requires: entry.requires?.length ? entry.requires : listed?.requires
    }
  }
  return mods
}

/** An allowlist the integrate branch into `main` writes with every violation of the day; absent on core. */
function allowlist(name: string): string[] {
  const file = resolve(__dirname, name)
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []
}

describe('importsOf', () => {
  it('finds every form of import, and none in a comment', () => {
    const source = `
      import a from 'a'
      import { b } from "b"
      import type { c } from 'c'
      import 'd'
      export { e } from 'e'
      export * from 'f'
      const g = await import('g')
      const h = import.meta.glob('./h/*.ts', { eager: true })
      const i = import.meta.glob(['./i/*.ts', '../j/*.ts'])
      // import k from 'k'
      /* import l from 'l' */
    `
    expect(importsOf(source)).toEqual(['a', 'b', 'c', 'e', 'f', 'd', 'g', './h/*.ts', './i/*.ts', '../j/*.ts'])
  })
})

describe('the import boundary', () => {
  it('allows each kind of import a mod may make, and names each kind it may not', () => {
    const { files, violations, required } = scanMods(ROOT, fixtureMods)
    expect(files.length).toBe(10)
    expect(required).toEqual([
      { file: `${FIXTURES}/lib-user/renderer/entry.ts`, specifier: '../../good-mod/renderer/panel', mod: 'good-mod' }
    ])
    expect(violations.map(line).sort()).toEqual(
      [
        `${FIXTURES}/bad-mod/main/entry.ts -> @vx/modkit/renderer`,
        `${FIXTURES}/bad-mod/main/entry.ts -> react`,
        `${FIXTURES}/bad-mod/preload/bridge.ts -> electron`,
        `${FIXTURES}/bad-mod/renderer/entry.ts -> ../../../../../src/renderer/stores/gameStore`,
        `${FIXTURES}/bad-mod/renderer/entry.ts -> @vx/modkit/host/renderer`,
        `${FIXTURES}/bad-mod/renderer/entry.ts -> electron`,
        `${FIXTURES}/bad-mod/renderer/entry.ts -> node:fs`,
        `${FIXTURES}/bad-mod/shared/entry.ts -> ../../good-mod/shared/rules`,
        `${FIXTURES}/bad-mod/shared/entry.ts -> @shared/types`,
        `${FIXTURES}/bad-mod/shared/entry.ts -> @vx/modkit/renderer`
      ].sort()
    )
    const reasons = Object.fromEntries(violations.map((one) => [line(one), one.reason]))
    expect(reasons[`${FIXTURES}/bad-mod/shared/entry.ts -> ../../good-mod/shared/rules`]).toBe(
      'imports mod `good-mod`, which it does not require'
    )
    expect(reasons[`${FIXTURES}/bad-mod/renderer/entry.ts -> ../../../../../src/renderer/stores/gameStore`]).toBe(
      'reaches outside the mod: `src/renderer/stores/gameStore`'
    )
    expect(reasons[`${FIXTURES}/bad-mod/shared/entry.ts -> @vx/modkit/renderer`]).toBe(
      "the kit's `renderer` entry in a shared file"
    )
  })

  it("finds a glob import's owner in the glob's own folder, not the one above it", () => {
    const shared = 'test/fixtures/kit-boundary-glob/shared'
    // The neighbour is listed first, so its file is the first one in the shared folder.
    const { violations } = scanMods(ROOT, {
      neighbour: { globs: [`${shared}/neighbour.ts`] },
      packs: { globs: [`${shared}/catalog.ts`, `${shared}/packs/**`] }
    })
    expect(violations.map((one) => `${line(one)}: ${one.reason}`)).toEqual([
      `${shared}/neighbour.ts -> ./packs/*.ts: imports mod \`packs\`, which it does not require`
    ])
  })

  it('checks the owner of every file a glob matches, not only the first', () => {
    const shared = 'test/fixtures/kit-boundary-glob/shared'
    // `entries/` holds one file of each mod, the packs mod's own first.
    const mods = (requires?: string[]): Record<string, ModSet> => ({
      packs: { globs: [`${shared}/loader.ts`, `${shared}/entries/alpha.ts`], requires },
      neighbour: { globs: [`${shared}/entries/beta.ts`] }
    })
    expect(scanMods(ROOT, mods()).violations.map((one) => `${line(one)}: ${one.reason}`)).toEqual([
      `${shared}/loader.ts -> ./entries/*.ts: imports mod \`neighbour\`, which it does not require`
    ])
    const { violations, required } = scanMods(ROOT, mods(['neighbour']))
    expect(violations).toEqual([])
    expect(required).toEqual([{ file: `${shared}/loader.ts`, specifier: './entries/*.ts', mod: 'neighbour' }])
  })

  it("holds today's in-repo mods to the kit, beyond the allowlist", () => {
    const found = scanMods(ROOT, inRepoMods()).violations.map(line).sort()
    const allowed = allowlist('boundaryAllowlist.json')
    expect(found.filter((one) => !allowed.includes(one)), 'new violations').toEqual([])
    expect(allowed.filter((one) => !found.includes(one)), 'allowlist entries that no longer violate').toEqual([])
  })

  it("names each game file that imports a mod's, sparing the registries' entries", () => {
    const base = 'test/fixtures/kit-boundary-reverse'
    const { files, violations } = scanGame(
      ROOT,
      { alpha: { globs: [`${base}/modEntries/alpha.ts`, `${base}/alpha/**`] } },
      [`${base}/**`],
      [`${base}/game/registry.ts`, `${base}/modEntries/index.ts`]
    )
    expect(files).toEqual([
      `${base}/game/caller.ts`,
      `${base}/game/helper.ts`,
      `${base}/game/registry.ts`,
      `${base}/modEntries/index.ts`
    ])
    expect(violations.map((one) => `${line(one)}: ${one.reason}`)).toEqual([
      `${base}/game/caller.ts -> ../alpha/state: imports mod \`alpha\``,
      `${base}/game/caller.ts -> ../modEntries/alpha: imports mod \`alpha\``,
      `${base}/game/registry.ts -> ../alpha/state: imports mod \`alpha\``
    ])
  })

  it("keeps the game off today's in-repo mods, beyond the allowlist", () => {
    const found = scanGame(ROOT, inRepoMods()).violations.map(line).sort()
    const allowed = allowlist('gameAllowlist.json')
    expect(found.filter((one) => !allowed.includes(one)), 'new violations').toEqual([])
    expect(allowed.filter((one) => !found.includes(one)), 'allowlist entries that no longer violate').toEqual([])
  })

  it('keeps the kit itself off core, except through its bridge', () => {
    expect(scanKit(ROOT).map((one) => `${line(one)}: ${one.reason}`)).toEqual([])
  })
})
