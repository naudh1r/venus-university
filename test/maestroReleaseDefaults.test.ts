import { afterEach, expect, it } from 'vitest'
import { MODS, modOn, NO_SWITCHES } from '@shared/mods'
import { normalizeTalents, setTalentRules, talentEffect, talentsEnabled } from '@shared/campusTalents'
import { useModsStore } from '../src/renderer/stores/modsStore'

afterEach(() => {
  setTalentRules()
  useModsStore.setState({ switches: NO_SWITCHES })
})

it.each(['campus-talents', 'starting-challenge', 'godlike-standards'])('%s ships off with a release version', id => {
  const entry = MODS.find(mod => mod.id === id)
  expect(entry).toBeDefined()
  expect(entry!.defaultOn).toBe(false)
  expect(modOn(NO_SWITCHES, id)).toBe(false)
  expect(entry!.version).toMatch(/^\d+\.\d+\.\d+$/)
})

it('reads talent and dependency switches live after moving feature wiring out of modsStore', () => {
  setTalentRules()
  useModsStore.setState({ switches: NO_SWITCHES })
  expect(talentsEnabled()).toBe(false)
  useModsStore.setState({ switches: { on: { 'campus-talents': true, echo: false }, options: {} } })
  expect(talentsEnabled()).toBe(true)
  const talents = normalizeTalents({ initialized: true, earned: 1000, ranks: { matching: 2 } })
  expect(talentEffect(talents, 'matchingBonus')).toBe(0)
  useModsStore.setState({ switches: { on: { 'campus-talents': true, echo: true }, options: {} } })
  expect(talentEffect(talents, 'matchingBonus')).toBeGreaterThan(0)
  useModsStore.setState({ switches: NO_SWITCHES })
  expect(talentsEnabled()).toBe(false)
})
