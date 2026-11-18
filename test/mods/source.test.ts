import { describe, expect, it } from 'vitest'
import { parseSource } from '@vx/modkit/host/shared'
import { sourceList, sourceRelease } from './sourceFixtures'

const valid = (): any => sourceList(sourceRelease())
function error(change: (json: any) => unknown): string | undefined {
  const json = valid(); const replacement = change(json)
  const result = parseSource(replacement === undefined ? json : replacement)
  return result.ok ? undefined : result.error
}
describe('parseSource', () => {
  it('copies manifests, approval, withdrawals and migration metadata without sharing the input', () => {
    const json = valid()
    json.mods[0].bundledIn = '0.7.0'
    json.mods[0].withdrawn = [{ version: '0.9.0', reason: 'Bad save writes.' }]
    json.mods[0].releases[0].approved = { by: 'reviewer', pr: 12, at: '2026-11-10' }
    const parsed = parseSource(json)
    expect(parsed).toEqual({ ok: true, source: json })
    if (!parsed.ok) return
    json.mods[0].releases[0].manifest.hooks.push('made-up')
    json.mods[0].withdrawn[0].reason = 'changed'
    expect(parsed.source.mods[0].releases[0].manifest.hooks).toEqual([])
    expect(parsed.source.mods[0].withdrawn?.[0].reason).toBe('Bad save writes.')
  })
  const refusals: [string, (json: any) => unknown][] = [
    ['non-object', () => []], ['missing schema', j => { delete j.source }],
    ['wrong schema type', j => { j.source = '1' }], ['older schema', j => { j.source = 0 }],
    ['newer schema', j => { j.source = 2 }], ['unknown root field', j => { j.extra = true }],
    ['missing name', j => { delete j.name }], ['empty name', j => { j.name = ' ' }],
    ['missing mods', j => { delete j.mods }], ['non-list mods', j => { j.mods = {} }],
    ['non-object mod', j => { j.mods = [7] }], ['unknown mod field', j => { j.mods[0].extra = true }],
    ['invalid id', j => { j.mods[0].id = '../escape' }], ['reserved id', j => { j.mods[0].id = 'host' }],
    ['duplicate id', j => { j.mods.push(structuredClone(j.mods[0])) }],
    ['insecure repo', j => { j.mods[0].repo = 'http://example.com' }],
    ['repo credentials', j => { j.mods[0].repo = 'https://secret@example.com' }],
    ['missing releases', j => { delete j.mods[0].releases }],
    ['non-list releases', j => { j.mods[0].releases = {} }],
    ['non-object release', j => { j.mods[0].releases = [null] }],
    ['unknown release field', j => { j.mods[0].releases[0].extra = true }],
    ['invalid release version', j => { j.mods[0].releases[0].version = 'v1.0' }],
    ['duplicate version', j => { j.mods[0].releases.push(structuredClone(j.mods[0].releases[0])) }],
    ['insecure zip', j => { j.mods[0].releases[0].zip = 'http://example.com/mod.zip' }],
    ['missing hash', j => { delete j.mods[0].releases[0].sha256 }],
    ['invalid hash', j => { j.mods[0].releases[0].sha256 = 'abc' }],
    ['missing size', j => { delete j.mods[0].releases[0].size }],
    ['negative size', j => { j.mods[0].releases[0].size = -1 }],
    ['fractional size', j => { j.mods[0].releases[0].size = 1.1 }],
    ['unsafe size', j => { j.mods[0].releases[0].size = Number.MAX_SAFE_INTEGER + 1 }],
    ['invalid manifest', j => { delete j.mods[0].releases[0].manifest.hooks }],
    ['mismatched manifest id', j => { j.mods[0].releases[0].manifest.id = 'other' }],
    ['mismatched manifest version', j => { j.mods[0].releases[0].manifest.version = '2.0.0' }],
    ['non-object approval', j => { j.mods[0].releases[0].approved = false }],
    ['unknown approval field', j => { j.mods[0].releases[0].approved = { by: 'r', pr: 1, at: '2026-11-10', extra: 1 } }],
    ['empty reviewer', j => { j.mods[0].releases[0].approved = { by: '', pr: 1, at: '2026-11-10' } }],
    ['invalid PR', j => { j.mods[0].releases[0].approved = { by: 'r', pr: 0, at: '2026-11-10' } }],
    ['invalid approval date', j => { j.mods[0].releases[0].approved = { by: 'r', pr: 1, at: '2026-02-30' } }],
    ['invalid bundled version', j => { j.mods[0].bundledIn = 'latest' }],
    ['non-list withdrawals', j => { j.mods[0].withdrawn = {} }],
    ['non-object withdrawal', j => { j.mods[0].withdrawn = [null] }],
    ['unknown withdrawal field', j => { j.mods[0].withdrawn = [{ version: '1.0.0', reason: 'bad', extra: 1 }] }],
    ['invalid withdrawal version', j => { j.mods[0].withdrawn = [{ version: 'bad', reason: 'bad' }] }],
    ['missing withdrawal reason', j => { j.mods[0].withdrawn = [{ version: '1.0.0' }] }],
    ['duplicate withdrawal', j => { j.mods[0].withdrawn = [{ version: '1.0.0', reason: 'bad' }, { version: '1.0.0', reason: 'bad' }] }],
    ['insecure cover', j => { j.mods[0].cover = 'http://example.com/cover.webp' }]
  ]
  it.each(refusals)('refuses the whole source: %s', (_name, change) => {
    expect(error(change)).toBeTypeOf('string')
  })
  it('identifies a newer source and names the duplicate or disagreeing entry', () => {
    expect(error(j => { j.source = 2 })).toContain('newer game')
    expect(error(j => { j.mods.push(j.mods[0]) })).toContain('hello-mod')
    expect(error(j => { j.mods[0].releases[0].manifest.version = '2.0.0' })).toContain('hello-mod@1.0.0')
  })
  it('accepts https art, drops bad screenshot entries and retains at most eight valid screenshots', () => {
    const json = valid()
    json.mods[0].cover = 'https://example.com/cover.webp'
    json.mods[0].screenshots = [null, { url: 'http://example.com/no' }, { url: 'https://example.com/no', caption: 7 },
      { url: 'https://example.com/no', extra: true }, ...Array.from({ length: 12 }, (_, i) => ({ url: `https://example.com/${i}.webp`, caption: `Shot ${i}` }))]
    const parsed = parseSource(json)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.source.mods[0].cover).toBe(json.mods[0].cover)
    expect(parsed.source.mods[0].screenshots).toEqual(json.mods[0].screenshots.slice(4, 12))
    json.mods[0].screenshots = 'bad'
    expect(parseSource(json)).toEqual({ ok: true, source: { ...parsed.source, mods: [{ ...parsed.source.mods[0], screenshots: undefined }] } })
  })
})
