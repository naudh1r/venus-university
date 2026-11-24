import './fixtures/maestroModelKit'
import { afterEach, describe, expect, it } from 'vitest'
import { CITY_LIFE_JOBS_MOD, CITY_LIFE_LOCATIONS_MOD, availableLocationMenu, cityLifeBackgrounds, cityLifeJobsOn, cityLifeLocationsOn, setCityLifeEnabled } from '@shared/cityLife'
import { availableJobs, jobDefOf, newJobState, payOf, meetsRequirements, rollJobClosures } from '@shared/jobs'
import { FUN_LOCATIONS } from '@shared/locations'
import { pointsForTier } from '@shared/playerStats'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { buildHiddenSchedules } from '../src/renderer/stores/hiddenScheduler'
import { knownWhereabouts } from '../src/renderer/stores/whereabouts'
import { charJobNow } from '../src/renderer/stores/timetable'
import { availableLore } from '../src/renderer/prompts/lorebook'
import { character, charactersById, charInfo } from './fixtures'

afterEach(() => { useGameStore.getState().reset(); useModsStore.setState({ switches: { on: {}, options: {} } }); setCityLifeEnabled(false, false) })

describe('City Life isolation', () => {
  it('keeps new assignments, job openings, backgrounds, and rumors out when disabled', () => {
    setCityLifeEnabled(false, true)
    expect(availableLocationMenu(FUN_LOCATIONS).bowling).toBeUndefined()
    expect(availableJobs().some(j => j.id.startsWith('ex_'))).toBe(false)
    expect(rollJobClosures({}).ex_bowling).toBeUndefined()
    expect(cityLifeBackgrounds({ interior: ['bowling_alley','classroom'], exterior: ['park'] })).toEqual({ interior: ['classroom'], exterior: ['park'] })
    expect(availableLore().some(e => e.id === 'bowling_alley')).toBe(false)
    // Catalog lookups are always available to render saved references without data loss.
    expect(jobDefOf('ex_bowling')).toBeDefined()
  })
  it('supports locations without jobs, and reads existing playthrough choices instead of menu switches', () => {
    useGameStore.getState().reset()
    useModsStore.setState({ switches: { on: { [CITY_LIFE_JOBS_MOD]: false }, options: {} } })
    expect(cityLifeLocationsOn()).toBe(true); expect(cityLifeJobsOn()).toBe(false)
    expect(availableLocationMenu(FUN_LOCATIONS).bowling).toBe('bowling_alley')
    useGameStore.setState({ playthroughId: 'with-mod', playthroughMods: [CITY_LIFE_LOCATIONS_MOD, CITY_LIFE_JOBS_MOD] })
    expect(cityLifeJobsOn()).toBe(true)
    useModsStore.setState({ switches: { on: { [CITY_LIFE_LOCATIONS_MOD]: false, [CITY_LIFE_JOBS_MOD]: false }, options: {} } })
    expect(cityLifeLocationsOn()).toBe(true); expect(cityLifeJobsOn()).toBe(true)
    useGameStore.setState({ playthroughId: 'old-save', playthroughMods: [] })
    expect(cityLifeLocationsOn()).toBe(false); expect(cityLifeJobsOn()).toBe(false)
  })
  it('uses native job requirements, shift pay, raises, and closure rolls', () => {
    setCityLifeEnabled(true,true)
    const def = jobDefOf('ex_roller')!, state = newJobState(def.id,[11],0)
    expect(meetsRequirements({ brain: 0, body: 0, heart: 0 },def)).toBe(false)
    expect(meetsRequirements({ brain: 0, body: pointsForTier(2), heart: pointsForTier(2) },def)).toBe(true)
    expect(payOf(state)).toBe(def.pay)
    expect(rollJobClosures({})[def.id]).toHaveLength(2)
  })
  it('schedules a venue as an ordinary haunt around classes and shifts', () => {
    const schedule = buildHiddenSchedules({ a: { schedule: { 0:'A' }, job: { jobId:'ex_bowling',shifts:[1] },
      study:null, fun:['roller_rink'], activity:null, meal:null, homeSlots:0 } })
    const found = Object.entries(schedule.a).find(([,v]) => v.location === 'roller_rink')
    expect(found).toBeDefined()
    expect(['0','1']).not.toContain(found![0])
  })
  it('shows a venue on the map only through an NPC occupying it, including workers', () => {
    const c=character({charId:'a'})
    useGameStore.getState().reset()
    useGameStore.setState({ date:7,time:0,chars:['a'],characters:charactersById(c),charInfo:{ a:charInfo({
      nameKnown:true,flags:{...charInfo().flags,gaveContactInfo:true},job:{jobId:'ex_cat_cafe',shifts:[0]},
      hiddenSchedule:{0:{location:'roller_rink',kind:'fun'}}
    }) } })
    expect(charJobNow('a')).toBe('ex_cat_cafe')
    expect(knownWhereabouts().map(r=>r.placeKey)).toEqual(['cat_cafe'])
    expect(knownWhereabouts().some(r=>r.placeKey==='bowling_alley')).toBe(false)
    useGameStore.setState({chars:[]})
    expect(knownWhereabouts()).toEqual([])
  })
})
