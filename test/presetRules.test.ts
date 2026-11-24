import { describe, expect, it } from 'vitest'
import { nativeDefaultPreset } from '../src/shared/presets/gameParts'
import {
  PRESET_SCHEMA_VERSION,
  assertSafePresetId,
  isSafePresetId,
  toPresetFile,
  validatePreset,
  validatePresetIndex
} from '../src/shared/presets/presetRules'

/** What a preset file and the presets index must hold to be read back: unknown keys survive, malformed files are refused. */

describe('validatePreset', () => {
  const file = (): Record<string, unknown> => ({ ...toPresetFile(nativeDefaultPreset('default')) })

  it('accepts a stored preset and hands back keys this build does not know', () => {
    const json = { ...file(), futureField: { a: 1 } }
    const result = validatePreset(json)
    expect(result.ok).toBe(true)
    if (result.ok) expect((result.preset as unknown as Record<string, unknown>).futureField).toEqual({ a: 1 })
  })

  it('refuses a wrong version, a bad id, and a missing or malformed part without throwing', () => {
    const cases: unknown[] = [
      null,
      'x',
      [],
      { ...file(), schemaVersion: PRESET_SCHEMA_VERSION + 1 },
      { ...file(), id: '../escape' },
      { ...file(), id: undefined },
      { ...file(), name: '  ' },
      { ...file(), source: 'other' },
      { ...file(), blocks: 'nope' },
      { ...file(), blocks: [null] },
      { ...file(), blocks: [{ ...nativeDefaultPreset('d').blocks[0], role: 'robot' }] },
      { ...file(), blocks: [{ ...nativeDefaultPreset('d').blocks[0], marker: 'nowhere' }] },
      { ...file(), blocks: [nativeDefaultPreset('d').blocks[0], nativeDefaultPreset('d').blocks[0]] },
      { ...file(), overrides: 'x' },
      { ...file(), sampling: { temperature: 'hot' } },
      { ...file(), regex: [{ name: 'a' }] }
    ]
    for (const bad of cases) expect(validatePreset(bad).ok).toBe(false)
  })
})

describe('preset ids', () => {
  it('accept only what is safe as a file name', () => {
    expect(isSafePresetId('3f2a-9_B')).toBe(true)
    for (const bad of ['', '..', 'a/b', 'a\\b', 'a.json', ' a', 'x'.repeat(65), 5, null]) expect(isSafePresetId(bad)).toBe(false)
    expect(() => assertSafePresetId('../x')).toThrow()
    expect(() => assertSafePresetId('fine-id')).not.toThrow()
  })
})

describe('validatePresetIndex', () => {
  it('needs this version and a safe active id', () => {
    expect(validatePresetIndex({ schemaVersion: 1, active: 'default' }).ok).toBe(true)
    for (const bad of [null, {}, { schemaVersion: 2, active: 'default' }, { schemaVersion: 1, active: '../x' }, { schemaVersion: 1 }]) {
      expect(validatePresetIndex(bad).ok).toBe(false)
    }
  })
})
