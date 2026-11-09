import { expect, it, vi } from 'vitest'

it('registers through the public kit after the shared catalogue without a startup cycle', async () => {
  vi.resetModules()
  const kit = await import('@vx/modkit/shared')
  const traits = await import('../src/shared/traits')
  const rules = await import('../src/shared/modRules')
  const romance = await import('../src/shared/romanceRequirements')
  expect(kit.modById('godlike-standards')?.defaultOn).toBe(false)
  expect(traits.characterTraitOptions().some(trait => trait.value === 'Godlike')).toBe(false)

  await import('../src/renderer/modEntries/godlike-standards')
  expect(traits.characterTraitOptions().filter(trait => trait.value === 'Godlike')).toHaveLength(1)
  expect(traits.traitTone('Godlike')).toBe('gold')
  const who = { traits: ['Godlike'], preferredStat: 'heart' as const }
  rules.setSharedModRules(() => true)
  expect(romance.blocksNewRomance(who, { brain: 100, body: 99, heart: 100 })).toBe(true)
  expect(romance.blocksNewRomance(who, { brain: 100, body: 100, heart: 100 })).toBe(false)
  rules.setSharedModRules(() => false)
  expect(romance.blocksNewRomance(who, { brain: 0, body: 0, heart: 0 })).toBe(false)
  expect(traits.characterTraitOptions().some(trait => trait.value === 'Godlike')).toBe(true)
})
