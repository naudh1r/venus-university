import { describe, expect, it } from 'vitest'
import { nativeDefaultPreset } from '../src/shared/presets/gameParts'
import {
  buildPresetsBackup,
  buildPromptsBackup,
  mergePresets,
  mergePrompts,
  parseStudioBackup,
  presetFromBackup
} from '../src/shared/presets/studioBackup'

describe('a presets backup', () => {
  it('merges by id with the file winning, and the file\'s active preset in force', () => {
    const file = buildPresetsBackup([nativeDefaultPreset('a'), nativeDefaultPreset('b')], 'b')
    const merge = mergePresets(['a', 'c'], file)
    expect(merge).toMatchObject({ active: 'b', added: 1, replaced: 1 })
    expect(merge.save.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('is refused whole when one preset is malformed or the active one is missing', () => {
    const good = buildPresetsBackup([nativeDefaultPreset('a')], 'a')
    expect(parseStudioBackup('presets', JSON.stringify(good)).ok).toBe(true)
    const broken = { ...good, presets: [{ ...good.presets[0], blocks: 'no' }] }
    expect(parseStudioBackup('presets', JSON.stringify(broken)).ok).toBe(false)
    expect(parseStudioBackup('presets', JSON.stringify({ ...good, active: 'zzz' })).ok).toBe(false)
  })

  it('of one preset imports as a copy under a fresh id, and one of several is refused', () => {
    const one = buildPresetsBackup([{ ...nativeDefaultPreset('a'), name: 'Mine' }], 'a')
    const imported = presetFromBackup(JSON.stringify(one), 'fresh')
    expect(imported).toMatchObject({ ok: true, preset: { id: 'fresh', name: 'Mine' } })
    expect(imported?.ok && 'schemaVersion' in imported.preset).toBe(false)
    const several = buildPresetsBackup([nativeDefaultPreset('a'), nativeDefaultPreset('b')], 'a')
    expect(presetFromBackup(JSON.stringify(several), 'fresh')?.ok).toBe(false)
    expect(presetFromBackup(JSON.stringify({ prompts: [] }), 'fresh')).toBeNull()
  })
})

describe('a prompts backup', () => {
  it('merges block by block and size by size, leaving what the file does not hold', () => {
    const current = { schemaVersion: 1, blocks: { 'persona.solo': 'mine', 'persona.texting': 'kept' }, classCatalog: { pe: 3, filler: 2 } }
    const file = { schemaVersion: 1, blocks: { 'persona.solo': 'theirs' }, classCatalog: { pe: 7 } }
    const merged = mergePrompts(current as never, file as never)
    expect(merged.blocks).toEqual({ 'persona.solo': 'theirs', 'persona.texting': 'kept' })
    expect(merged.classCatalog).toEqual({ pe: 7, filler: 2 })
  })

  it('is refused when its record is not valid', () => {
    const good = buildPromptsBackup({ schemaVersion: 1, blocks: { 'persona.solo': 'x' } as never })
    expect(parseStudioBackup('prompts', JSON.stringify(good)).ok).toBe(true)
    const bad = { ...good, prompts: { schemaVersion: 1, blocks: { 'persona.solo': 4 } } }
    expect(parseStudioBackup('prompts', JSON.stringify(bad)).ok).toBe(false)
  })
})

describe('the kind marker', () => {
  it('refuses a file of another section, naming what it is', () => {
    const file = buildPromptsBackup({ schemaVersion: 1 })
    const result = parseStudioBackup('presets', JSON.stringify(file))
    expect(result).toEqual({ ok: false, error: 'This is a prompts backup, not a presets backup.' })
  })

  it('refuses a file that is no backup at all', () => {
    expect(parseStudioBackup('prompts', '{"a":1}').ok).toBe(false)
    expect(parseStudioBackup('prompts', 'nope').ok).toBe(false)
  })
})
