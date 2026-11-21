import { optionDependencyError } from '../../packages/modkit/src/shared/optionRules'
import { describe, expect, it } from 'vitest'
import { hookNameKind, modDefOf, parseManifest } from '@vx/modkit/host/shared'

/** The manifest parser: what a mod's `vxmod.json` must hold before the loader reads it. */

function valid(): Record<string, unknown> {
  return {
    manifest: 1,
    id: 'hello-mod',
    name: 'Hello mod',
    author: 'morrowkiln',
    version: '1.0.0',
    blurb: 'Says hello in App settings.',
    source: 'https://github.com/venus-extracurriculars/hello-mod',
    kit: '0.2.0',
    hooks: ['settingsSection', 'renderer:registerHooks', 'renderer:useModOn'],
    game: '>=0.6.0 <0.8.0',
    requires: { 'mini-games': '^1.2.0' },
    optional: { 'photo-feature': '^2.0.0' },
    main: false,
    scope: 'anytime',
    defaultOn: true,
    offNote: 'Switching it off keeps what it saved.',
    options: [{ id: 'loud', label: 'Loud', hint: 'Says it louder.', default: false }],
    optionGroups: [],
    library: false,
    exports: []
  }
}

function without(key: string): Record<string, unknown> {
  const manifest = valid()
  delete manifest[key]
  return manifest
}

function errorOf(json: unknown, folder?: { id: string; version: string }): string | undefined {
  const parsed = parseManifest(json, folder)
  return parsed.ok ? undefined : parsed.error
}

describe('parseManifest', () => {
  it('reads the example manifest as written, and lists it the way MODS does', () => {
    const parsed = parseManifest(valid(), { id: 'hello-mod', version: '1.0.0' })
    expect(parsed).toEqual({ ok: true, manifest: valid() })
    if (!parsed.ok) return
    expect(modDefOf(parsed.manifest)).toEqual({
      id: 'hello-mod',
      name: 'Hello mod',
      author: 'morrowkiln',
      version: '1.0.0',
      scope: 'anytime',
      defaultOn: true,
      blurb: 'Says hello in App settings.',
      offNote: 'Switching it off keeps what it saved.',
      requires: ['mini-games'],
      options: [{ id: 'loud', label: 'Loud', hint: 'Says it louder.', default: false }],
      optionGroups: []
    })
  })

  it('holds only the fields the file had, sharing nothing with it', () => {
    const json = { ...without('game'), hooks: ['settingsSection'] }
    const parsed = parseManifest(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect('game' in parsed.manifest).toBe(false)
    expect(parsed.manifest.hooks).not.toBe(json.hooks)
  })

  it('refuses a manifest missing any required field, naming it', () => {
    for (const key of ['id', 'name', 'author', 'version', 'blurb', 'source', 'kit', 'hooks', 'main', 'scope', 'defaultOn']) {
      expect(errorOf(without(key))).toBe(`"${key}" is missing`)
    }
  })

  it('refuses what is not an object, and a field of the wrong type', () => {
    expect(errorOf([])).toBe('vxmod.json is not an object')
    expect(errorOf(null)).toBe('vxmod.json is not an object')
    expect(errorOf({ ...valid(), name: 3 })).toBe('"name" is not a string')
    expect(errorOf({ ...valid(), scope: 'always' })).toBe('"scope" is not "anytime" or "playthrough"')
  })

  it('refuses a manifest made for a newer schema', () => {
    expect(errorOf({ ...valid(), manifest: 2 })).toMatch(/^made for a newer game/)
    expect(errorOf(without('manifest'))).toBe('"manifest" is missing or not a number')
  })

  it('refuses a field schema 1 does not have', () => {
    expect(errorOf({ ...valid(), icon: 'hello.png' })).toBe('unknown field "icon"')
  })

  it('refuses an id with capitals, and a reserved id', () => {
    expect(errorOf({ ...valid(), id: 'Hello_Mod' })).toBe('"id" is not lower-case words with dashes: "Hello_Mod"')
    expect(errorOf({ ...valid(), id: 'host' })).toBe('"id" host is reserved')
  })

  it('refuses a version that is not major.minor.patch', () => {
    expect(errorOf({ ...valid(), version: '1.0' })).toBe('"version" is not major.minor.patch: "1.0"')
  })

  it('refuses a manifest that disagrees with its folder', () => {
    expect(errorOf(valid(), { id: 'other-mod', version: '1.0.0' })).toBe('the folder says other-mod, the manifest says hello-mod')
    expect(errorOf(valid(), { id: 'hello-mod', version: '1.2.0' })).toBe('the folder says 1.2.0, the manifest says 1.0.0')
  })

  it('refuses a hook named twice', () => {
    expect(errorOf({ ...valid(), hooks: ['settingsSection', 'settingsSection'] })).toBe('"hooks" is not a list of names, each once')
  })

  it('refuses a game range outside the subset', () => {
    expect(errorOf({ ...valid(), game: 'newest' })).toBe('"game" is not a version range: "newest"')
  })

  it('refuses a requirement with no range, and one both required and optional', () => {
    expect(errorOf({ ...valid(), requires: { 'mini-games': 'latest' } })).toBe('"requires" has no version range for mini-games: "latest"')
    expect(errorOf({ ...valid(), optional: { 'mini-games': '^1.0.0' } })).toBe('"optional" repeats mini-games from "requires"')
    expect(errorOf({ ...valid(), requires: { 'hello-mod': '^1.0.0' } })).toBe('"requires" names the mod itself')
  })

  it("refuses a library's export from a library the mod does not require, optional or not", () => {
    const hooks = ['settingsSection', 'lib:greet']
    expect(errorOf({ ...valid(), hooks })).toBe('uses "lib:greet" but does not require lib')
    expect(parseManifest({ ...valid(), hooks, optional: { lib: '^1.0.0' } }).ok).toBe(true)
  })

  it('refuses an option whose group is not declared', () => {
    const options = [{ id: 'loud', label: 'Loud', hint: 'Says it louder.', default: false, group: 'volume' }]
    expect(errorOf({ ...valid(), options })).toBe('option loud names group "volume", which "optionGroups" does not have')
  })

  it('retains an option requirement when a manifest becomes a mod definition', () => {
    const options = [
      { id: 'base', label: 'Base', hint: '', default: false },
      { id: 'extra', label: 'Extra', hint: '', default: true, requires: 'base' }
    ]
    const parsed = parseManifest({ ...valid(), options })
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(modDefOf(parsed.manifest).options).toEqual(options)
    expect(optionDependencyError(options)).toBeUndefined()
  })

  it.each([
    ['missing', [{ id: 'a', requires: 'gone' }]],
    ['self', [{ id: 'a', requires: 'a' }]],
    ['grouped target', [{ id: 'a', requires: 'b' }, { id: 'b', group: 'g' }]],
    ['grouped dependent', [{ id: 'a', group: 'g', requires: 'b' }, { id: 'b' }]],
    ['cycle', [{ id: 'a', requires: 'b' }, { id: 'b', requires: 'c' }, { id: 'c', requires: 'a' }]],
    ['invalid type', [{ id: 'a', requires: 3 }]]
  ])('refuses a %s requirement for installed and built-in options', (_kind, entries) => {
    const options = entries.map(entry => ({ label: entry.id, hint: '', default: true, ...entry }))
    const parsed = parseManifest({ ...valid(), options, optionGroups: [{ id: 'g', label: 'Group', hint: '' }] })
    expect(parsed.ok).toBe(false)
    const reason = optionDependencyError(options as never)
    expect(typeof reason).toBe('string')
    if (!parsed.ok) expect(parsed.error).toContain(reason!)
  })

  it('takes exports from a library only, and requires them of one', () => {
    expect(errorOf({ ...without('exports'), library: true })).toBe('a library must list its "exports"')
    expect(parseManifest({ ...valid(), library: true, exports: ['greet'] }).ok).toBe(true)
    expect(errorOf({ ...valid(), exports: ['greet'] })).toBe('only a library has "exports"')
  })

  it('lists a library as one in MODS', () => {
    const parsed = parseManifest({ ...without('requires'), library: true, exports: ['greet'] })
    expect(parsed.ok && modDefOf(parsed.manifest)).toMatchObject({ library: true })
    expect(parsed.ok && 'requires' in modDefOf(parsed.manifest)).toBe(false)
  })
})

describe('hookNameKind', () => {
  it('reads a hook, a kit API and a library export, split at the first colon', () => {
    expect(hookNameKind('prompts.dm')).toEqual({ kind: 'hook', name: 'prompts.dm' })
    expect(hookNameKind('renderer:useModOn')).toEqual({ kind: 'api', side: 'renderer', name: 'useModOn' })
    expect(hookNameKind('mini-games:register:x')).toEqual({ kind: 'export', library: 'mini-games', name: 'register:x' })
  })
})
