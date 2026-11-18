import { describe, expect, it } from 'vitest'
import { resolveInstall, resolveRemoval, type InstallInput } from '@vx/modkit/host/shared'
import { sourceList, sourceRelease } from './sourceFixtures'
const url = 'https://example.com/vxsource.json'
function input(over: Partial<InstallInput> = {}): InstallInput {
  return { installed: {}, builtIn: {}, request: { app: { version: '1.0.0', source: url } }, sources: [{ url,
    source: sourceList(sourceRelease('app', '1.0.0', { requires: { lib: '^1.0.0' } }), sourceRelease('lib', '1.0.0'), sourceRelease('lib', '1.2.0')) }], ...over }
}
function changes(value: InstallInput) {
  const result = resolveInstall(value)
  expect(result.ok, result.ok ? '' : result.error).toBe(true)
  return result.ok ? result.install.map(change => [change.id, change.release.version, change.from]) : []
}
describe('resolveInstall', () => {
  it('keeps an installed requirement in range rather than upgrading it', () => {
    expect(changes(input({ installed: { lib: { version: '1.0.0' } } }))).toEqual([['app', '1.0.0', undefined]])
  })
  it('pulls the highest fitting update in before its dependent', () => {
    expect(changes(input({ installed: { lib: { version: '0.9.0' } } }))).toEqual([['lib', '1.2.0', '0.9.0'], ['app', '1.0.0', undefined]])
  })
  it('checks ranges from unchanged installed dependents and names both on refusal', () => {
    const result = resolveInstall(input({ installed: { other: { version: '1.0.0', requires: { lib: '^2.0.0' } } } }))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('^1.0.0'); expect(result.error).toContain('^2.0.0')
  })
  it('uses a built-in requirement and never replaces an out-of-range built-in', () => {
    expect(changes(input({ builtIn: { lib: { version: '1.1.0' } } }))).toEqual([['app', '1.0.0', undefined]])
    expect(resolveInstall(input({ builtIn: { lib: { version: '0.1.0' } } })).ok).toBe(false)
    expect(resolveInstall(input({ builtIn: { app: { version: '1.0.0' } } })).ok).toBe(false)
  })
  it('does not fetch a requirement from a different source', () => {
    const source = sourceList(sourceRelease('app', '1.0.0', { requires: { absent: '*' } }))
    const result = resolveInstall(input({ sources: [{ url, source }, { url: 'https://other.example/list', source: sourceList(sourceRelease('absent')) }] }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("absent isn't in this source")
  })
  it('never installs an optional dependency, but orders an installed one in range first', () => {
    const sources = [{ url, source: sourceList(sourceRelease('app', '1.0.0', { optional: { lib: '^1.0.0' } }), sourceRelease('lib')) }]
    expect(changes(input({ sources }))).toEqual([['app', '1.0.0', undefined]])
    const result = resolveInstall(input({ sources, installed: { lib: { version: '1.0.0' } } }))
    expect(result.ok && result.optionalPresent.app).toEqual(['lib'])
    const out = resolveInstall(input({ sources, installed: { lib: { version: '2.0.0' } } }))
    expect(out.ok && out.optionalPresent.app).toBeUndefined()
  })
  it('refuses required and present-optional cycles through the loader ordering', () => {
    for (const field of ['requires', 'optional']) {
      const sources = [{ url, source: sourceList(sourceRelease('app', '1.0.0', { requires: { lib: '*' } }), sourceRelease('lib', '1.0.0', { [field]: { app: '*' } })) }]
      expect(resolveInstall(input({ sources })).ok).toBe(false)
    }
  })
  it('passes over a newer release with missing hooks and a withdrawn release', () => {
    const source: any = input().sources[0].source
    source.mods[1].releases.push(sourceRelease('lib', '1.3.0', { hooks: ['nonexistent'] }), sourceRelease('lib', '1.4.0'))
    source.mods[1].withdrawn = [{ version: '1.4.0', reason: 'bad' }]
    expect(changes(input({ sources: [{ url, source }] }))[0]).toEqual(['lib', '1.2.0', undefined])
  })
  it('does not backtrack to a lower version of an earlier greedy pick', () => {
    const sources = [{ url, source: sourceList(
      sourceRelease('app', '1.0.0', { requires: { lib: '*' } }),
      sourceRelease('lib', '2.0.0', { requires: { absent: '*' } }), sourceRelease('lib', '1.0.0')) }]
    expect(resolveInstall(input({ sources })).ok).toBe(false)
  })
  it('drops a requirement removed by an update, rather than retaining its stale range', () => {
    const sources = [{ url, source: sourceList(sourceRelease('app', '1.0.0', { requires: { old: '^2.0.0', lib: '^2.0.0' } }),
      sourceRelease('lib', '2.0.0'), sourceRelease('old', '2.0.0')) }]
    expect(changes(input({ sources, installed: { lib: { version: '1.0.0', requires: { old: '^1.0.0' } } } })))
      .toEqual([['lib', '2.0.0', '1.0.0'], ['old', '2.0.0', undefined], ['app', '1.0.0', undefined]])
  })
  it('does not mutate the request, installed snapshots or source releases', () => {
    const value = input(); const before = structuredClone(value)
    resolveInstall(value); expect(value).toEqual(before)
  })
  it('treats constructor as a mod id rather than an inherited map entry', () => {
    expect(changes(input({ request: { constructor: { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(sourceRelease('constructor')) }] })))
      .toEqual([['constructor', '1.0.0', undefined]])
  })
  it('refuses ambiguous duplicate source addresses instead of letting one shadow another', () => {
    const value = input()
    expect(resolveInstall({ ...value, sources: [...value.sources, ...value.sources] }).ok).toBe(false)
  })
})
describe('resolveRemoval', () => {
  it('refuses removal while an installed or built-in mod requires it', () => {
    const lib = { version: '1.0.0', library: true }
    const app = { version: '1.0.0', requires: { lib: '*' } }
    expect(resolveRemoval('lib', { app, lib }).ok).toBe(false)
    expect(resolveRemoval('lib', { lib }, { app }).ok).toBe(false)
  })
  it('offers newly orphaned library chains, leaving shared and unrelated libraries alone', () => {
    const installed = { app: { version: '1.0.0', requires: { lib: '*', shared: '*' } },
      lib: { version: '1.0.0', library: true, requires: { inner: '*' } }, inner: { version: '1.0.0', library: true },
      shared: { version: '1.0.0', library: true }, other: { version: '1.0.0', requires: { shared: '*' } },
      unrelated: { version: '1.0.0', library: true } }
    expect(resolveRemoval('app', installed)).toEqual({ ok: true, remove: ['app'], orphaned: ['lib', 'inner'] })
  })
})
