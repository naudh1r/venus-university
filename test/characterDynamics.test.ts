import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  CHARACTER_DYNAMICS_MOD, dynamicFor, emptyCharacterDynamics, invalidDynamicsReasons,
  readCharacterDynamics, readCharacterDynamicsEnabled, settleCharacterDynamics, type CharacterDynamics
} from '@shared/characterDynamics'
import '@shared/characterDynamicsCarry'
import { carriedModFields, carryModFields } from '@shared/modCarry'
import { modOn, NO_SWITCHES, withMod } from '@shared/mods'
import { ENROLLMENT_READ, SAVE_READ, stampEnrollment, stampSave } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { characterDynamicsLines } from '../src/renderer/prompts/characterDynamics'
import { modRequest, promptLines, setHookRules } from '../src/renderer/mods/hooks'
import '../src/renderer/modEntries/character-dynamics'
import type { PromptState } from '../src/renderer/prompts/scenePrompt'
import type { TextingPromptState } from '../src/renderer/prompts/textingPrompt'
import type { SlotIntroInput } from '../src/renderer/prompts/slotIntroPrompt'
import { character, charactersById, enrollment, playthroughRecord } from './fixtures'

const choices = (): CharacterDynamics => ({ version: 1, characters: {
  a: { relationship: { kind: 'ex-girlfriend', reason: 'They parted when she moved to another city.' }, traits: ['guarded', 'mischievous'] },
  b: { relationship: { kind: 'rival', reason: 'They want to lead the same student club.' }, traits: ['competitive'] }
} })

beforeEach(() => useGameStore.getState().reset())
afterEach(() => setHookRules({ isOn: () => true, order: () => 0 }))

describe('Character Dynamics setup and retention', () => {
  it('reads prerelease saves and carries or re-saves only the prefixed field without mutating the original', () => {
    const dynamics = choices()
    dynamics.characters.a.traits.push('future-tag')
    const legacy = { ...stampSave(useGameStore.getState().toGameSave(), '123', '456', 1), characterDynamics: dynamics }
    const original = structuredClone(legacy)
    useGameStore.getState().loadSave(legacy, playthroughRecord(), {})
    const saved = useGameStore.getState().toGameSave()
    expect(saved.exCharacterDynamics).toEqual(dynamics)
    expect(saved).not.toHaveProperty('characterDynamics')
    const carry = carryModFields(legacy, { term: 0, back: 120, characters: {} })
    expect(carry.exCharacterDynamics).toEqual(dynamics)
    expect(carry).not.toHaveProperty('characterDynamics')
    expect(legacy).toEqual(original)
    const preferred = emptyCharacterDynamics()
    expect(readCharacterDynamics({ ...legacy, exCharacterDynamics: preferred })).toEqual(preferred)
    saved.exCharacterDynamics!.characters.a.traits.push('headstrong')
    expect(legacy).toEqual(original)
  })

  it('retains prerelease enrollment choices and the frozen switch, preferring explicit prefixed values', () => {
    const dynamics = choices()
    const old = { ...stampEnrollment(enrollment(), 1), characterDynamics: dynamics, characterDynamicsEnabled: true }
    const loaded = validateRecord(JSON.parse(JSON.stringify(old)), 'enrollment.json', ENROLLMENT_READ)
    expect(readCharacterDynamics(loaded)).toEqual(dynamics)
    expect(readCharacterDynamicsEnabled(loaded)).toBe(true)
    expect(readCharacterDynamicsEnabled({ ...old, exCharacterDynamicsEnabled: false })).toBe(false)
    expect(readCharacterDynamicsEnabled({ characterDynamicsEnabled: false })).toBe(false)
    const next = stampEnrollment(enrollment({ exCharacterDynamics: readCharacterDynamics(loaded), exCharacterDynamicsEnabled: readCharacterDynamicsEnabled(loaded) }), 2)
    expect(next.exCharacterDynamics).toEqual(dynamics)
    expect(next.exCharacterDynamicsEnabled).toBe(true)
    expect(next).not.toHaveProperty('characterDynamics')
    expect(next).not.toHaveProperty('characterDynamicsEnabled')
    expect(readCharacterDynamics({})).toBeUndefined()
    expect(readCharacterDynamicsEnabled({})).toBe(false)
  })

  it('requires each selected relationship to have a reason, without requiring traits or relationships elsewhere', () => {
    const draft = choices()
    draft.characters.a.relationship!.reason = '  \n '
    draft.characters.b = { traits: ['guarded', 'guarded'] }
    expect(invalidDynamicsReasons(draft, ['a', 'b', 'c'])).toEqual(['a'])
    expect(() => settleCharacterDynamics(draft, ['a', 'b'])).toThrow()
    draft.characters.a.relationship!.reason = ' They parted on good terms. '
    const settled = settleCharacterDynamics(draft, ['a', 'b', 'c'])
    expect(settled.characters.a.relationship!.reason).toBe('They parted on good terms.')
    expect(settled.characters.b).toEqual({ traits: ['guarded'] })
    expect(settled.characters.c).toBeUndefined()
    expect(settleCharacterDynamics(emptyCharacterDynamics(), ['a'])).toEqual(emptyCharacterDynamics())
  })

  it('keeps enrollment choices through JSON validation and a save/load/save cycle, including unknown future tags', () => {
    const dynamics = choices()
    dynamics.characters.a.traits.push('future-tag')
    const enrolled = stampEnrollment(enrollment({ exCharacterDynamics: dynamics }), 1)
    expect(validateRecord(JSON.parse(JSON.stringify(enrolled)), 'enrollment.json', ENROLLMENT_READ).exCharacterDynamics).toEqual(dynamics)
    useGameStore.setState({ exCharacterDynamics: dynamics })
    const save = stampSave(useGameStore.getState().toGameSave(), '123', '456', 1)
    expect(validateRecord(JSON.parse(JSON.stringify(save)), 'save.json', SAVE_READ).exCharacterDynamics).toEqual(dynamics)
    useGameStore.getState().loadSave(save, playthroughRecord(), {})
    expect(useGameStore.getState().toGameSave().exCharacterDynamics).toEqual(dynamics)
    expect(dynamicFor(dynamics, 'a').traits).not.toContain('future-tag')
    useGameStore.getState().reset()
    expect(useGameStore.getState().toGameSave()).not.toHaveProperty('exCharacterDynamics')
    useGameStore.getState().loadSave({ ...save, exCharacterDynamics: undefined }, playthroughRecord(), {})
    expect(useGameStore.getState().exCharacterDynamics).toBeUndefined()
  })

  it('carries choices without modifying old history, and only lets newly enrolled girls be configured', () => {
    const prior = choices()
    prior.characters.a.traits.push('future-tag')
    useGameStore.setState({ exCharacterDynamics: prior })
    const save = stampSave(useGameStore.getState().toGameSave(), '123', '456', 1)
    const carried = carriedModFields(carryModFields(save, { term: 0, back: 120, characters: charactersById(character({ charId: 'a' })) }))
    expect(carried.exCharacterDynamics).toEqual(prior)
    const edited = structuredClone(prior)
    edited.characters.a = { traits: ['impulsive'] }
    edited.characters.c = { traits: ['tenderhearted'] }
    const next = settleCharacterDynamics(edited, ['c'], carried.exCharacterDynamics)
    expect(next.characters.a).toEqual(prior.characters.a)
    expect(next.characters.b).toEqual(prior.characters.b)
    expect(next.characters.c).toEqual({ traits: ['tenderhearted'] })
    next.characters.a.traits.push('headstrong')
    expect(prior.characters.a.traits).not.toContain('headstrong')
  })
})

it('routes only selected characters into active scene, DM, and slot hooks; old runs stay untouched and other request fields survive', () => {
  const a = character({ charId: 'a', firstName: 'Alice' })
  const b = character({ charId: 'b', firstName: 'Beatrice' })
  const c = character({ charId: 'c', firstName: 'Clara' })
  const data = choices()
  const scene = { exCharacterDynamics: data } as PromptState
  const dm = { exCharacterDynamics: data } as TextingPromptState
  const record = playthroughRecord({ mods: [CHARACTER_DYNAMICS_MOD] })
  setHookRules({ isOn: id => modOn(NO_SWITCHES, id, record), order: () => 0 })
  const lines = promptLines('scene', { cast: [a], state: scene, query: '' }).join('\n')
  expect(lines).toContain(data.characters.a.relationship!.reason)
  expect(lines).not.toContain(data.characters.b.relationship!.reason)
  expect(promptLines('dm', { character: b, info: undefined, state: dm }).join('\n')).toContain(data.characters.b.relationship!.reason)
  expect(characterDynamicsLines([c], data)).toEqual([])
  const request = { system: 'existing system', user: 'existing mod context', schema: { name: 'test', schema: { type: 'object' } }, cacheKey: 'existing' }
  const input = { exCharacterDynamics: data, askers: [{ character: a }], breakups: [], posters: [{ character: a }, { character: c }] } as unknown as SlotIntroInput
  const extended = modRequest('slot-intro', { input }, request)
  expect(extended.user).toContain(request.user)
  expect(extended.schema).toBe(request.schema)
  expect(extended.system).toBe(request.system)
  expect(extended.user.split(data.characters.a.relationship!.reason)).toHaveLength(2)
  const globallyEnabled = withMod(NO_SWITCHES, CHARACTER_DYNAMICS_MOD, true)
  setHookRules({ isOn: id => modOn(globallyEnabled, id, playthroughRecord()), order: () => 0 })
  expect(promptLines('scene', { cast: [a], state: scene, query: '' })).toEqual([])
  expect(modRequest('slot-intro', { input }, request)).toBe(request)
})
