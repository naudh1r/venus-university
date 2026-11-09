import { afterEach, describe, expect, it } from 'vitest'
import { emptyCatalog, type ApplicationDraft } from '@shared/application'
import { setCityLifeEnabled } from '@shared/cityLife'
import { readApplicationRecord, stampApplication } from '@shared/saveRules'
import { challengeForStartingStats, startingChallengeForSetup } from '@shared/startingChallenge'
import { buildClassPrompt, NO_FILLED_CATALOG, shortfallOf } from '../src/renderer/prompts/classPrompt'
import { buildProfilePrompt } from '../src/renderer/prompts/profilePrompt'
import { needOf, type RequestWorld } from '../src/renderer/stores/applicationCompose'
import { character } from './fixtures'

const girl = character({ charId: 'a' })
const world: RequestWorld = { setting: 'Our chosen campus setting.', book: [] }
function application(): ApplicationDraft {
  return { screen: 'loading', season: 'spring', chars: ['a'], plan: [], occasions: {},
    catalog: emptyCatalog(), girls: { a: { profile: { major: 'Music' }, secrets: {}, memories: [] } }, pairs: {}, replies: {} }
}
afterEach(() => setCityLifeEnabled(false, false))

describe('0.7 New Game with existing VE mods', () => {
  it.each([-100, -80, -60, -30, -15, 0])('keeps starting stats and the mod snapshot through an application round-trip (%s)', points => {
    const stats = { brain: points, body: 0, heart: -30 }
    const draft = { ...application(), mods: ['starting-challenge', 'character-dynamics'],
      reader: { firstName: 'Avrix', lastName: 'Test', stats, bio: 'Synthetic reader.' } }
    const resumed = readApplicationRecord(JSON.parse(JSON.stringify(stampApplication(draft, 123))), 'synthetic.json')
    expect(resumed.mods).toEqual(draft.mods)
    expect(resumed.reader).toEqual(draft.reader)
    expect(challengeForStartingStats(resumed.reader!.stats, startingChallengeForSetup(undefined, true)))
      .toEqual({ version: 2, floors: { brain: points < -15 ? points : -15, body: -15, heart: -30 } })
  })

  it('uses Prompt Studio sizes for the remaining catalog, after player-written entries', () => {
    const input = { students: [{ character: girl, major: 'Music' }], setting: world.setting,
      filled: { ...NO_FILLED_CATALOG, pe: [{ code: 'PE 111', title: 'Swimming', description: 'Swim.' }] },
      catalog: { pe: 3, filler: 0, perMajor: 2 } }
    expect(shortfallOf(input)).toEqual({ pools: { pe: 2, humanities: 0, arts: 0, misc: 0 }, majors: [['Music', 2]] })
    const request = buildClassPrompt(input, { 'newgame.classes.instructions': 'Custom course instructions.',
      'newgame.classes.system': 'A custom registrar.', 'newgame.classes.additions': 'An extra preference.' })!
    expect(request.system).toContain('A custom registrar.')
    expect(request.system).toContain('An extra preference.')
    expect(request.system).toContain(world.setting)
    expect(request.user).toContain('Custom course instructions.')
    expect(request.user).toContain('Create 2 physical education classes')
    expect(request.user).toContain('PE 111')
    expect(request.user).toContain('No two courses may share a code.')
    expect(request.user).not.toContain('Create 5 humanities')
  })

  it.each(['classes', 'profiles', 'secrets'] as const)('includes custom %s edits in the bank key and preserves authored fields', call => {
    const draft = application()
    const original = needOf(call, draft, [girl], world)
    const edited = needOf(call, draft, [girl], { ...world, textEdits: { [`newgame.${call}.system`]: 'Custom system.' } })
    if (typeof original === 'string' || typeof edited === 'string') throw Error('Expected a generation request')
    expect(edited.key).not.toBe(original.key)
    expect(edited.request.system).toContain('Custom system.')
    expect(edited.request.system).toContain(world.setting)
    if (call === 'profiles') {
      expect(edited.request.user).toContain('Already decided')
      expect(edited.request.user).toContain('Music')
    }
    if (call === 'secrets') expect(edited.request.user).toContain('Write only the tiers asked')
  })

  it('honors occasion edits without regenerating events the player already wrote', () => {
    const draft = { ...application(), plan: [
      { id: 'gala', startDate: 12, endDate: 13, time: 1 as const, seed: 'lantern' },
      { id: 'dance', startDate: 19, endDate: 19, time: 1 as const, seed: 'stars' }
    ], occasions: { dance: { title: 'My dance', description: 'My description.' } } }
    const need = needOf('occasions', draft, [girl], { ...world, textEdits: {
      'newgame.occasions.gala': 'An unusual gala.', 'newgame.occasions.instructions': 'Custom event writing.' } })
    if (typeof need === 'string') throw Error('Expected an occasion request')
    expect(need.request.user).toContain('An unusual gala.')
    expect(need.request.user).toContain('Custom event writing.')
    expect(need.request.user).toContain('My dance')
    expect((need.request.schema.schema as any).properties.events.required).toEqual(['gala'])
  })

  it.each([false, true])('exposes City Life jobs and venues only while enabled (%s)', enabled => {
    setCityLifeEnabled(enabled, enabled)
    const request = buildProfilePrompt({ students: [{ character: girl, decided: {} }], otherMajors: [], setting: world.setting })!
    const schema = JSON.stringify(request.schema)
    expect(schema.includes('ex_dance_instructor')).toBe(enabled)
    expect(schema.includes('"dance"')).toBe(enabled)
    expect(request.user.includes('Dance Instructor')).toBe(enabled)
  })
})
