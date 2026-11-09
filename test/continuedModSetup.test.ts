import { afterEach, describe, expect, it } from 'vitest'
import '@shared/modEntries/echo'
import '@shared/modEntries/character-dynamics'
import { continuedDynamics, returningSetupIds, withContinuedModSetup } from '@shared/continuedModSetup'
import { CHARACTER_DYNAMICS_MOD, type CharacterDynamics } from '@shared/characterDynamics'
import { changePlayerEcho, withEchoArtwork } from '@shared/echo'
import { chooseSetupEchoAspect, prepareEchoSetup } from '@shared/echoSetup'
import { ENROLLMENT_READ, SAVE_READ, stampEnrollment, stampSave } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { semesterOf } from '@shared/semesters'
import type { EnrollmentDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { carryOf } from '../src/renderer/stores/semesterCarry'
import { continuedStartOf } from '../src/renderer/stores/semesterStart'
import { modFieldsLeaving } from '../src/renderer/stores/semesterModCarry'
import { character, charInfo, enrollment, playthroughRecord } from './fixtures'

// Mirror renderer boot's carry registration for this store-only setup fixture.
await import('../src/shared/echoCarry')
await import('../src/shared/characterDynamicsCarry')

const returning = character({ charId: 'returning' })
const untagged = character({ charId: 'untagged' })
const graduate = character({ charId: 'graduate' })
const newcomer = character({ charId: 'newcomer' })
const roster = [returning, untagged, newcomer]
const oldRoster = [returning, untagged, graduate]
const inherited: CharacterDynamics = { version: 1, characters: {
  returning: { traits: ['guarded', 'future-trait'], relationship: { kind: 'rival', reason: 'An old contest.' },
    growth: { id: 'growth-1', name: 'Patient courage', description: 'She learned to ask for help.', reframes: ['guarded'] } },
  graduate: { traits: ['curious'] }
} }

/** A real native carry, with two returnees, one graduate and room for a newcomer. */
function registration(): EnrollmentDraft {
  useGameStore.getState().reset()
  const record = playthroughRecord({ chars: oldRoster.map(c => c.charId), mods: [CHARACTER_DYNAMICS_MOD],
    profiles: Object.fromEntries(oldRoster.map(c => [c.charId, {
      year: c.charId === 'graduate' ? 4 : 1, intake: 'spring' as const,
      dorm: 'lowrise_1' as const, major: 'Biology', schedule: {}, moodCycleOffset: 0
    }])) })
  record.profiles.graduate.intake = 'fall'
  const echo = withEchoArtwork(changePlayerEcho(prepareEchoSetup(undefined, 'ending', oldRoster, 'Reader', ''), 'wildspark'),
    'returning', 'd058c3ab-01f7-4994-aed8-ec004e9b243a', 'uploaded')
  useGameStore.setState({ date: 123, exCharacterDynamics: inherited, exEcho: echo,
    charInfo: Object.fromEntries(oldRoster.map(c => [c.charId, charInfo({ ...record.profiles[c.charId],
      nameKnown: c.charId !== 'untagged', memories: [{ date: 120, desc: 'A remembered conversation.', type: 'liked' }]
    })])) })
  const handoff = carryOf(useGameStore.getState(), semesterOf(record))
  handoff.carry.mods = modFieldsLeaving(useGameStore.getState().toGameSave(), {
    playthroughId: '123', index: 0, season: 'spring', characters: Object.fromEntries(oldRoster.map(c => [c.charId, c]))
  })
  return enrollment({ chars: roster.map(c => c.charId), mods: [CHARACTER_DYNAMICS_MOD],
    perChar: Object.fromEntries(roster.map(c => [c.charId, { year: 1, dorm: 'lowrise_1', major: 'Biology', schedule: {} }])),
    continued: { id: '200', index: 1, alumni: handoff.alumni, priorProfiles: handoff.priorProfiles,
      pursuits: { graduate: 'Working away from Veridan.' }, carry: handoff.carry }
  })
}

afterEach(() => useGameStore.getState().reset())

describe('native next-semester mod setup', () => {
  it('locks all established girls and retains their growth, absent entries and unknown future tags', () => {
    const draft = registration()
    expect(returningSetupIds(draft).sort()).toEqual(['graduate', 'returning', 'untagged'])
    const attempted: CharacterDynamics = { version: 1, characters: {
      returning: { traits: ['cheerful'] }, untagged: { traits: ['dramatic'] },
      newcomer: { traits: ['curious'], relationship: { kind: 'rival', reason: '  They competed before university.  ' } }
    } }
    const settled = continuedDynamics(draft, roster, attempted)
    expect(settled.characters.returning).toEqual(inherited.characters.returning)
    expect(settled.characters.graduate).toEqual(inherited.characters.graduate)
    expect(settled.characters.untagged).toBeUndefined()
    expect(settled.characters.newcomer.relationship?.reason).toBe('They competed before university.')
    expect(draft.continued?.carry.mods?.exCharacterDynamics).toEqual(inherited)
  })

  it('persists both newcomer choices through registration and the native opening save without resetting returnees', () => {
    const draft = registration(), before = structuredClone(draft)
    draft.exCharacterDynamics = continuedDynamics(draft, roster, { version: 1, characters: {
      newcomer: { traits: ['curious'], relationship: { kind: 'rival', reason: 'They competed before university.' } }
    } })
    const carried = draft.continued!.carry.mods!.exEcho!
    draft.exEcho = chooseSetupEchoAspect(prepareEchoSetup(carried, '123', roster, 'Reader', ''), 'newcomer', 'heartthread', roster, '')
    const resumed = validateRecord(JSON.parse(JSON.stringify(stampEnrollment(draft, 1))), 'enrollment.json', ENROLLMENT_READ)
    const native = continuedStartOf(resumed, {}, roster).save
    const save = withContinuedModSetup(native, resumed, roster)
    const loaded = validateRecord(JSON.parse(JSON.stringify(stampSave(save, '123', '200', 2))), '200.json', SAVE_READ)
    expect(loaded.exEcho?.girls.newcomer.aspect).toBe('heartthread')
    expect(loaded.exEcho?.playerChangeUsed).toBe(true)
    for (const id of ['returning', 'untagged', 'graduate']) {
      expect(loaded.exEcho?.girls[id]).toEqual(carried.girls[id])
      expect(loaded.charInfo[id]).toEqual(native.charInfo[id])
    }
    expect(loaded.exEcho?.player).toEqual(carried.player)
    expect(loaded.charInfo.newcomer).toEqual({ ...native.charInfo.newcomer, nameKnown: true,
      flags: { ...native.charInfo.newcomer.flags, hasMet: true } })
    expect(loaded.exCharacterDynamics?.characters.newcomer).toEqual(draft.exCharacterDynamics.characters.newcomer)
    expect(loaded.exCharacterDynamics?.characters.returning).toEqual(inherited.characters.returning)
    expect(loaded.semester).toBe('200')
    expect(draft.continued).toEqual(before.continued)
  })

  it.each([true, false])('works with Echo alone or Dynamics alone (Echo %s)', echoOn => {
    const draft = registration()
    if (echoOn) {
      draft.mods = []
      draft.exEcho = prepareEchoSetup(draft.continued?.carry.mods?.exEcho, '123', roster, 'Reader', '')
    } else {
      draft.exCharacterDynamics = { version: 1, characters: { newcomer: { traits: ['curious'] } } }
    }
    const native = continuedStartOf(draft, {}, roster).save
    const result = withContinuedModSetup(native, draft, roster)
    expect(result.charInfo).toEqual(native.charInfo)
    expect(result.exEcho).toEqual(echoOn ? draft.exEcho : native.exEcho)
    expect(result.exCharacterDynamics?.characters.newcomer).toEqual(echoOn ? undefined : { traits: ['curious'] })
  })

  it('leaves unconfigured or disabled dynamics intact and rejects rewriting a returning Echo', () => {
    const draft = registration(), native = continuedStartOf(draft, {}, roster).save
    expect(withContinuedModSetup(native, draft, roster)).toBe(native)
    draft.mods = []
    draft.exCharacterDynamics = { version: 1, characters: { newcomer: { traits: ['curious'] } } }
    expect(withContinuedModSetup(native, draft, roster)).toBe(native)
    draft.exEcho = prepareEchoSetup(draft.continued?.carry.mods?.exEcho, '123', roster, 'Reader', '')
    draft.exEcho.girls.returning.aspect = draft.exEcho.girls.returning.aspect === 'wildspark' ? 'heartthread' : 'wildspark'
    expect(() => withContinuedModSetup(native, draft, roster)).toThrow('returning students')
  })
})
