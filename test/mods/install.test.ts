import { describe, expect, it } from 'vitest'
import { resolveInstall, resolveRemoval, type InstallInput } from '@vx/modkit/host/shared'
import { sourceList, sourceRelease } from './sourceFixtures'

const url = 'https://example.com/vxsource.json'

/** Builds an install request with a required library available at two versions. */
function input(over: Partial<InstallInput> = {}): InstallInput {
  return {
    installed: {},
    builtIn: {},
    request: { app: { version: '1.0.0', source: url } },
    sources: [
      {
        url,
        source: sourceList(
          sourceRelease('app', '1.0.0', { requires: { lib: '^1.0.0' } }),
          sourceRelease('lib', '1.0.0'),
          sourceRelease('lib', '1.2.0')
        )
      }
    ],
    ...over
  }
}
/** Runs a successful request and returns its dependency-ordered changes. */
function changes(value: InstallInput) {
  const result = resolveInstall(value)
  expect(result.ok, result.ok ? '' : result.error).toBe(true)
  return result.ok
    ? result.install.map((change) => [change.id, change.release.version, change.from])
    : []
}
/** Extracts a refused result for checks on the affected identities. */
function refusal(
  result: { readonly ok: true } | { readonly ok: false; readonly error: string }
): string {
  expect(result.ok).toBe(false)
  return result.ok ? '' : result.error
}

describe('resolveInstall', () => {
  it('keeps an installed requirement in range rather than upgrading it', () => {
    const value = input({ installed: { lib: { version: '1.0.0' } } })
    const result = resolveInstall(value)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.install.map((change) => change.id)).toEqual(['app'])
    expect(result.keep).toContain('lib')
    expect(result.order).toEqual(['lib', 'app'])
  })
  it('pulls the highest fitting update in before its dependent', () => {
    const value = input({ installed: { lib: { version: '0.9.0' } } })
    const selected = changes(value)
    expect(selected).toEqual([
      ['lib', '1.2.0', '0.9.0'],
      ['app', '1.0.0', undefined]
    ])
  })
  it('checks ranges from unchanged installed dependents and names both on refusal', () => {
    const result = resolveInstall(
      input({ installed: { other: { version: '1.0.0', requires: { lib: '^2.0.0' } } } })
    )
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('^1.0.0')
    expect(result.error).toContain('^2.0.0')
  })
  it('uses a built-in requirement and never replaces an out-of-range built-in', () => {
    const value = input({ builtIn: { lib: { version: '1.1.0' } } })
    const selected = changes(value)
    expect(selected).toEqual([['app', '1.0.0', undefined]])

    const oldBuiltIn = input({ builtIn: { lib: { version: '0.1.0' } } })
    const oldBuiltInResult = resolveInstall(oldBuiltIn)
    expect(refusal(oldBuiltInResult)).toContain('lib')

    const requestedBuiltIn = input({ builtIn: { app: { version: '1.0.0' } } })
    const requestedBuiltInResult = resolveInstall(requestedBuiltIn)
    expect(refusal(requestedBuiltInResult)).toContain('app')
  })
  it('does not fetch a requirement from a different source', () => {
    const source = sourceList(sourceRelease('app', '1.0.0', { requires: { absent: '*' } }))
    const result = resolveInstall(
      input({
        sources: [
          { url, source },
          { url: 'https://other.example/list', source: sourceList(sourceRelease('absent')) }
        ]
      })
    )
    expect(result.ok).toBe(false)
    const error = refusal(result)
    expect(error).toContain('absent')
    expect(error).toContain(url)
  })
  it('never installs an optional dependency, but orders an installed one in range first', () => {
    const sources = [
      {
        url,
        source: sourceList(
          sourceRelease('app', '1.0.0', { optional: { lib: '^1.0.0' } }),
          sourceRelease('lib')
        )
      }
    ]
    const selected = changes(input({ sources }))
    expect(selected).toEqual([['app', '1.0.0', undefined]])
    const result = resolveInstall(input({ sources, installed: { lib: { version: '1.0.0' } } }))
    expect(result.ok && result.optionalPresent.app).toEqual(['lib'])
    const out = resolveInstall(input({ sources, installed: { lib: { version: '2.0.0' } } }))
    expect(out.ok && out.optionalPresent.app).toBeUndefined()
  })
  it('refuses required and present-optional cycles through the loader ordering', () => {
    for (const field of ['requires', 'optional']) {
      const sources = [
        {
          url,
          source: sourceList(
            sourceRelease('app', '1.0.0', { requires: { lib: '*' } }),
            sourceRelease('lib', '1.0.0', { [field]: { app: '*' } })
          )
        }
      ]
      const result = resolveInstall(input({ sources }))
      const error = refusal(result)
      expect(error).toContain('app')
      expect(error).toContain('lib')
    }
  })
  it('passes over a newer release with missing hooks and a withdrawn release', () => {
    const source: any = input().sources[0].source
    source.mods[1].releases.push(
      sourceRelease('lib', '1.3.0', { hooks: ['nonexistent'] }),
      sourceRelease('lib', '1.4.0')
    )
    source.mods[1].withdrawn = [{ version: '1.4.0', reason: 'bad' }]
    const selected = changes(input({ sources: [{ url, source }] }))
    expect(selected[0]).toEqual(['lib', '1.2.0', undefined])
  })
  it('does not backtrack to a lower version of an earlier greedy pick', () => {
    const sources = [
      {
        url,
        source: sourceList(
          sourceRelease('app', '1.0.0', { requires: { lib: '*' } }),
          sourceRelease('lib', '2.0.0', { requires: { absent: '*' } }),
          sourceRelease('lib', '1.0.0')
        )
      }
    ]
    const result = resolveInstall(input({ sources }))
    const error = refusal(result)
    expect(error).toContain('absent')
  })
  it('drops a requirement removed by an update, rather than retaining its stale range', () => {
    const sources = [
      {
        url,
        source: sourceList(
          sourceRelease('app', '1.0.0', { requires: { old: '^2.0.0', lib: '^2.0.0' } }),
          sourceRelease('lib', '2.0.0'),
          sourceRelease('old', '2.0.0')
        )
      }
    ]
    const value = input({
      sources,
      installed: { lib: { version: '1.0.0', requires: { old: '^1.0.0' } } }
    })
    const selected = changes(value)
    expect(selected).toEqual([
      ['lib', '2.0.0', '1.0.0'],
      ['old', '2.0.0', undefined],
      ['app', '1.0.0', undefined]
    ])
  })
  it('does not mutate the request, installed snapshots or source releases', () => {
    const value = input()
    const before = structuredClone(value)
    resolveInstall(value)
    expect(value).toEqual(before)
  })
  it('treats constructor as a mod id rather than an inherited map entry', () => {
    const value = input({
      request: { constructor: { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(sourceRelease('constructor')) }]
    })
    const selected = changes(value)
    expect(selected).toEqual([['constructor', '1.0.0', undefined]])
  })
  it('refuses ambiguous duplicate source addresses instead of letting one shadow another', () => {
    const value = input()
    const result = resolveInstall({ ...value, sources: [...value.sources, ...value.sources] })
    expect(result.ok).toBe(false)
  })
})
describe('library exports in install plans', () => {
  const lib1 = sourceRelease('lib', '1.0.0', { library: true, exports: ['greet'] })
  const lib2 = sourceRelease('lib', '2.0.0', { library: true, exports: ['wave'] })
  const dependent = sourceRelease('uses-lib', '1.0.0', {
    requires: { lib: '*' },
    hooks: ['lib:greet']
  })

  it("picks the highest library release exporting the requested dependent's names", () => {
    const value = input({
      request: { 'uses-lib': { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(dependent, lib1, lib2) }]
    })
    const selected = changes(value)
    expect(selected).toEqual([
      ['lib', '1.0.0', undefined],
      ['uses-lib', '1.0.0', undefined]
    ])
  })

  it('refuses when no release exports the required name', () => {
    const value = input({
      request: { 'uses-lib': { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(dependent, lib2) }]
    })
    const error = refusal(resolveInstall(value))
    expect(error).toContain('uses-lib')
    expect(error).toContain('lib')
  })

  it.each(['installed', 'builtIn'] as const)(
    'respects %s dependents when choosing a library',
    (location) => {
      const value = input({
        [location]: {
          'uses-lib': { version: '1.0.0', requires: { lib: '*' }, hooks: ['lib:greet'] }
        },
        sources: [
          {
            url,
            source: sourceList(
              sourceRelease('app', '1.0.0', { requires: { lib: '*' } }),
              lib1,
              lib2
            )
          }
        ]
      })
      const result = resolveInstall(value)
      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.install.find((change) => change.id === 'lib')?.release.version).toBe('1.0.0')
      expect(result.keep).toContain('uses-lib')
    }
  )

  it('respects newly discovered dependents before picking their library', () => {
    const value = input({
      sources: [
        {
          url,
          source: sourceList(
            sourceRelease('app', '1.0.0', { requires: { 'uses-lib': '*' } }),
            dependent,
            lib1,
            lib2
          )
        }
      ]
    })
    const selected = changes(value)
    expect(selected.map((change) => change.slice(0, 2))).toEqual([
      ['lib', '1.0.0'],
      ['uses-lib', '1.0.0'],
      ['app', '1.0.0']
    ])
  })

  it('refuses an export conflict discovered after a greedy library choice', () => {
    const value = input({
      sources: [
        {
          url,
          source: sourceList(
            sourceRelease('app', '1.0.0', { requires: { lib: '*', 'uses-lib': '*' } }),
            dependent,
            lib1,
            lib2
          )
        }
      ]
    })
    const error = refusal(resolveInstall(value))
    expect(error).toContain('uses-lib')
    expect(error).toContain('lib:greet')
  })

  it('updates an installed library in range when its exports cannot serve a new dependent', () => {
    const value = input({
      installed: { lib: { version: '0.9.0', exports: ['wave'] } },
      request: { 'uses-lib': { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(dependent, lib1, lib2) }]
    })
    const selected = changes(value)
    expect(selected[0]).toEqual(['lib', '1.0.0', '0.9.0'])
  })

  it('refuses to replace a built-in library missing a required export', () => {
    const value = input({
      builtIn: { lib: { version: '1.0.0', exports: ['wave'] } },
      request: { 'uses-lib': { version: '1.0.0', source: url } },
      sources: [{ url, source: sourceList(dependent, lib1) }]
    })
    const error = refusal(resolveInstall(value))
    expect(error).toContain('uses-lib')
    expect(error).toContain('lib:greet')
  })

  it('checks a requested library against retained optional dependents in the final graph', () => {
    const value = input({
      installed: { 'uses-lib': { version: '1.0.0', optional: { lib: '*' }, hooks: ['lib:greet'] } },
      request: { lib: { version: '2.0.0', source: url } },
      sources: [{ url, source: sourceList(lib1, lib2) }]
    })
    const error = refusal(resolveInstall(value))
    expect(error).toContain('uses-lib')
    expect(error).toContain('lib:greet')
  })
})

describe('resolveRemoval', () => {
  it('refuses removal while an installed or built-in mod requires it', () => {
    const lib = { version: '1.0.0', library: true }
    const app = { version: '1.0.0', requires: { lib: '*' } }
    const installedError = refusal(resolveRemoval('lib', { app, lib }))
    const builtInError = refusal(resolveRemoval('lib', { lib }, { app }))
    for (const error of [installedError, builtInError]) {
      expect(error).toContain('lib')
      expect(error).toContain('app')
    }
  })
  it('offers newly orphaned library chains, leaving shared and unrelated libraries alone', () => {
    const installed = {
      app: { version: '1.0.0', requires: { lib: '*', shared: '*' } },
      lib: { version: '1.0.0', library: true, requires: { inner: '*' } },
      inner: { version: '1.0.0', library: true },
      shared: { version: '1.0.0', library: true },
      other: { version: '1.0.0', requires: { shared: '*' } },
      unrelated: { version: '1.0.0', library: true }
    }
    const result = resolveRemoval('app', installed)
    expect(result).toEqual({
      ok: true,
      remove: ['app'],
      orphaned: ['lib', 'inner']
    })
  })
})
