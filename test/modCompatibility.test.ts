import { expect, it } from 'vitest'
import { compatibilityWarning, compatibilityWarnings } from '../src/shared/modCompatibility'

it('distinguishes undeclared support, supported releases and out-of-range releases', () => {
  expect(compatibilityWarning({ name: 'Example' }, '0.9.2')).toContain('has not declared')
  expect(compatibilityWarning({ name: 'Example', game: '>=0.9.0 <0.10.0' }, '0.9.2')).toBeNull()
  expect(compatibilityWarning({ name: 'Example', game: '0.8.x' }, '0.9.2')).toContain('outside that range')
  expect(compatibilityWarning({ name: 'Example', game: 'invalid' }, '0.9.2')).toContain('unreadable')
})

it('warns for saved enrollment even when new-game defaults are off, excluding disabled mods and libraries', async () => {
  const base = { name: 'Example', author: 'Author', version: '1.0.0', blurb: '', defaultOn: false };
  const mods = [{ ...base, id: 'saved', scope: 'playthrough' as const }, { ...base, id: 'off', scope: 'anytime' as const }, { ...base, id: 'library', scope: 'anytime' as const, library: true }];
  const switches = { schemaVersion: 1 as const, on: { saved: false, off: false, library: true }, options: {} };
  expect(await compatibilityWarnings(mods, switches, '0.9.2')).toEqual([]);
  expect(await compatibilityWarnings(mods, switches, '0.9.2', { mods: ['saved'] })).toHaveLength(1);
  expect(await compatibilityWarnings(mods, switches, '0.9.2', { mods: [] })).toEqual([]);
})
