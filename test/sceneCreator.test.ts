import { describe, expect, it } from 'vitest'
import { dispositionOf } from '@shared/relationship'
import { zoneOf } from '@shared/npcRelationships'
import {
  affectionsOf,
  defaultMilestones,
  flagsOfEntry,
  lockedMilestones,
  npcRelationshipsOf,
  SCENE_DISPOSITIONS,
  validateSavedScene,
  weatherTableOf,
  withMilestone,
  type SavedScene,
  type SceneMilestones
} from '@shared/sceneCreator'
import { weatherAt } from '@shared/weather'
import { character } from './fixtures'

const plain = character()
const promiscuous = character({ traits: ['Promiscuous'] })

/** The default milestones with some boxes changed. */
function milestones(over: Partial<SceneMilestones>): SceneMilestones {
  return { ...defaultMilestones(), ...over }
}

describe('scene creator milestones never contradict each other', () => {
  it('lovers clears a crush and both friendzones', () => {
    const picked = milestones({ crush: true, friendzoned_reader: true, lovers: true })
    const flags = flagsOfEntry({ disposition: 'friendly', milestones: picked }, plain)
    expect(flags).toMatchObject({ isLover: true, hasCrush: false, friendZoned: false, friendZonedBy: false })
  })

  it('sex is a kiss too, and a friend with benefits only outside lovers, a breakup and hostility', () => {
    const sex = milestones({ sex: true })
    expect(flagsOfEntry({ disposition: 'neutral', milestones: sex }, plain)).toMatchObject({
      hasKissed: true,
      hadSex: true,
      benefits: true
    })
    expect(flagsOfEntry({ disposition: 'hostile', milestones: sex }, plain).benefits).toBe(false)
    expect(flagsOfEntry({ disposition: 'neutral', milestones: { ...sex, lovers: true } }, plain).benefits).toBe(false)
    expect(flagsOfEntry({ disposition: 'neutral', milestones: { ...sex, broke_up: true } }, plain).benefits).toBe(false)
  })

  it('no crush below neutral', () => {
    const crush = milestones({ crush: true })
    expect(flagsOfEntry({ disposition: 'annoyed', milestones: crush }, plain).hasCrush).toBe(false)
    expect(flagsOfEntry({ disposition: 'neutral', milestones: crush }, plain).hasCrush).toBe(true)
  })

  it('the two friendzones are one answer or the other', () => {
    const one = withMilestone(defaultMilestones(), 'friendzoned_by_reader', true, 'neutral', plain)
    const other = withMilestone(one, 'friendzoned_reader', true, 'neutral', plain)
    expect(other).toMatchObject({ friendzoned_by_reader: false, friendzoned_reader: true })
  })

  it('sharing holds only beside a lover, a crush or benefits, and always for a Promiscuous girl', () => {
    expect(lockedMilestones(milestones({ agreed_to_harem: true }), 'neutral', plain).agreed_to_harem).toBe(false)
    expect(flagsOfEntry({ disposition: 'neutral', milestones: milestones({ agreed_to_harem: true, crush: true }) }, plain).harem).toBe(true)
    expect(flagsOfEntry({ disposition: 'neutral', milestones: defaultMilestones() }, promiscuous).harem).toBe(true)
  })

  it('a girl not yet met holds nothing else and is played at neutral', () => {
    const unmet = milestones({ met: false, lovers: true, kissed: true })
    const flags = flagsOfEntry({ disposition: 'devoted', milestones: unmet }, plain)
    expect(flags).toMatchObject({ hasMet: false, isLover: false, hasKissed: false })
    expect(dispositionOf(affectionsOf({ cast: [{ charId: 'a', outfit: 'default', disposition: 'devoted', milestones: unmet, notes: '' }] }).a)).toBe('neutral')
  })
})

describe('scene creator setup projects onto what the game reads', () => {
  it('every disposition is read back as itself', () => {
    for (const disposition of SCENE_DISPOSITIONS) {
      const affection = affectionsOf({
        cast: [{ charId: 'a', outfit: 'default', disposition, milestones: defaultMilestones(), notes: '' }]
      }).a
      expect(dispositionOf(affection)).toBe(disposition)
    }
  })

  it('pairs land in their zones, strangers with no entry and friends by default', () => {
    const map = npcRelationshipsOf(['a', 'b', 'c'], { 'a|b': 'enemies', 'a|c': 'strangers' })
    expect(zoneOf(map['a|b'].affinity)).toBe('enemies')
    expect(map['a|c']).toBeUndefined()
    expect(zoneOf(map['b|c'].affinity)).toBe('friends')
  })

  it('the sky is wet in the scene slot alone', () => {
    const table = weatherTableOf(60, 1, 'storm')
    expect(weatherAt(table, 60, 1)).toBe('storm')
    expect(weatherAt(table, 60, 0)).toBe('clear')
  })
})

describe('a saved scene is refused rather than half-read', () => {
  const scene: SavedScene = {
    schemaVersion: 1,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Ami, March 20',
    savedAt: 1,
    setup: {
      reader: { firstName: 'Sam', lastName: 'Lee', tiers: { brain: 1, body: 1, heart: 1 }, bio: '' },
      cast: [{ charId: 'a', outfit: 'default', disposition: 'neutral', milestones: defaultMilestones(), notes: '' }],
      pairs: {},
      date: 60,
      time: 0,
      weather: 'clear',
      prompt: 'Hi.'
    },
    castNames: ['Ami Ito'],
    transcript: [],
    ended: true
  }

  it('reads one whole', () => {
    expect(validateSavedScene(JSON.parse(JSON.stringify(scene)), 'x').id).toBe(scene.id)
  })

  it('refuses a missing field, a bad id and a bad setup', () => {
    const { castNames: _castNames, ...missing } = scene
    expect(() => validateSavedScene(missing, 'x')).toThrow()
    expect(() => validateSavedScene({ ...scene, id: '../x' }, 'x')).toThrow()
    expect(() => validateSavedScene({ ...scene, setup: { ...scene.setup, time: 2 } }, 'x')).toThrow()
  })
})
