import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { availableJobs, jobDefOf, meetsRequirements, newJobState, payOf, shiftRecordOf, unmetSkillRequirements } from '@shared/jobs'
import { ACTIVITY_LOCATIONS, FUN_LOCATIONS, isLocationOpen, locationDefOf } from '@shared/locations'
import { availableLocationMenu, cityLifeBackgrounds, setCityLifeEnabled } from '@shared/cityLife'
import { buyTalent, normalizeTalents } from '@shared/campusTalents'
import { abilityRank, dancerCapability } from '@shared/talentAbilities'
import { buildCharKeyToId, useGameStore } from '../src/renderer/stores/gameStore'
import { useAssetStore } from '../src/renderer/stores/assetStore'
import { createSceneSanitizer } from '../src/renderer/stores/sceneSanitizer'
import { character, charactersById, playthroughRecord } from './fixtures'
import { modIsOn, useModsStore } from '../src/renderer/stores/modsStore'
import { availableLore } from '../src/renderer/prompts/lorebook'
import { anchorOf } from '../src/renderer/views/mapLayout'
import { buildHiddenSchedules } from '../src/renderer/stores/hiddenScheduler'

const job = jobDefOf('ex_dance_instructor')!
const good = { brain: -100, body: 35, heart: 35 }
function rank(value: number) { useGameStore.setState({ exTalents: normalizeTalents({ranks:{'body.dancer':value}}) }) }
function campus(on: boolean) { useModsStore.setState({ switches: { on: {'campus-talents':on}, options:{} } }) }
beforeEach(() => {
  useGameStore.getState().reset()
  useGameStore.setState({playthroughId:'dance-test',playthroughMods:['city-life-locations','city-life-jobs'],stats:good,playerSchedule:{},jobClosures:{}})
  campus(true)
})
afterEach(() => { useGameStore.getState().reset();useModsStore.setState({switches:{on:{},options:{}}}) })

describe('Dance Studio in City Life', () => {
  it('keeps every Dancer rank purchasable and its original dance capability with City Life off', () => {
    useGameStore.setState({playthroughMods:[]})
    useModsStore.setState({switches:{on:{'campus-talents':true,'city-life-locations':false,'city-life-jobs':false},options:{}}})
    expect(modIsOn('campus-talents')).toBe(true)
    let skills=normalizeTalents({initialized:true,earned:2000,ranks:{'body.pe':1,'body.shift':1}})
    for (let value=1;value<=3;value++) {
      skills=buyTalent(skills,'body.dancer',modIsOn)
      expect(abilityRank(skills,'body.dancer')).toBe(value)
      const withoutCity=dancerCapability(skills,'I dance at the party.')
      expect(withoutCity).toBeTruthy()
      setCityLifeEnabled(true,true)
      expect(dancerCapability(skills,'I dance at the party.')).toBe(withoutCity)
      setCityLifeEnabled(false,false)
    }
    expect(dancerCapability(skills,'I dance at the party.')).toContain('improvise')
    expect(dancerCapability(skills,'I read a book.')).toBeNull()
    expect(availableJobs().some(j=>j.id===job.id)).toBe(false)
  })
  it('allows visits and practice without Campus Talents or Dancer', () => {
    campus(false); rank(0)
    expect(availableLocationMenu(FUN_LOCATIONS).dance).toBe('dance_studio')
    expect(availableLocationMenu(ACTIVITY_LOCATIONS).dance).toBe('dance_studio')
    expect(locationDefOf('dance_studio')?.label).toBe('Dance Studio')
    expect(availableLore().find(l=>l.id==='dance_studio')).toBeDefined()
    expect(cityLifeBackgrounds({interior:['dance_studio'],exterior:[]})).toEqual({interior:['dance_studio'],exterior:[]})
    for(let slot=0;slot<14;slot++) expect(isLocationOpen('dance_studio',slot)).toBe(true)
  })
  it.each([true,false])('uses the ordinary PE sprite path with rendered PE = %s', rendered => {
    const roster=charactersById(character({charId:'a',firstName:'Studio',lastName:'Tester'}))
    useGameStore.setState({characters:roster,cast:['a'],charKeyToId:buildCharKeyToId(roster),outfitReady:{a:rendered?['pe']:[]}})
    const previous=useAssetStore.getState().backgrounds
    try {
      useAssetStore.setState({backgrounds:{interior:['dance_studio'],exterior:[]}})
      const line=createSceneSanitizer().sanitizeLine({speaker:'',text:'Practice starts.',bg:'dance_studio',actions:['show:studio_tester','sprite:studio_tester,happy_pe']})
      expect(line.bg).toBe('dance_studio')
      expect(line.actions).toContain('sprite:studio_tester,'+(rendered?'happy_pe':'happy'))
    } finally { useAssetStore.setState({backgrounds:previous}) }
  })
  it('supports locations without jobs and respects saved City Life choices', () => {
    useGameStore.setState({playthroughMods:['city-life-locations']})
    expect(availableLocationMenu(FUN_LOCATIONS).dance).toBe('dance_studio')
    expect(availableJobs().some(j=>j.id===job.id)).toBe(false)
    useGameStore.setState({playthroughMods:[]})
    expect(availableLocationMenu(FUN_LOCATIONS).dance).toBeUndefined()
    expect(availableLore().some(l=>l.id==='dance_studio')).toBe(false)
    expect(cityLifeBackgrounds({interior:['dance_studio'],exterior:[]}).interior).toEqual([])
    expect(jobDefOf(job.id)).toBeDefined() // Existing saved references remain readable.
  })
  it('keeps the instructor opening visible when talent qualifications are missing', () => {
    campus(false)
    expect(availableJobs().some(j=>j.id===job.id)).toBe(true)
    expect(unmetSkillRequirements(job)).toEqual([{id:'body.dancer',label:'Dancer III',rank:3}])
    expect(meetsRequirements(good,job)).toBe(false)
    expect(meetsRequirements(good,job,{'body.dancer':3})).toBe(true)
  })
  it('has its own downtown map position and schedules normal studio visits', () => {
    expect(anchorOf('dance_studio').x).toBeLessThan(.5)
    const schedules=buildHiddenSchedules({a:{schedule:{0:'A'},job:{jobId:job.id,shifts:[1]},study:null,fun:['dance_studio'],activity:null,meal:null,homeSlots:0}})
    const visits=Object.entries(schedules.a).filter(([,slot])=>slot.location==='dance_studio')
    expect(visits.length).toBeGreaterThan(0)
    expect(visits.some(([slot])=>slot==='0')).toBe(false)
  })
})

describe('instructor hiring is checked in the store as well as the UI', () => {
  it.each([0,1,2])('refuses Dancer rank %i even with Godly stats', value => {
    rank(value);useGameStore.setState({stats:{brain:100,body:100,heart:100}})
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
    expect(useGameStore.getState().job).toBeNull()
  })
  it.each(['body','heart'] as const)('refuses insufficient %s with Dancer III', stat => {
    rank(3); useGameStore.setState({stats:{...good,[stat]:34.99}})
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
  })
  it('accepts exactly Good Body and Heart with Dancer III, regardless of Brain', () => {
    rank(3)
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(true)
    expect(useGameStore.getState().job).toMatchObject({jobId:job.id,shifts:[11],raises:0})
  })
  it('refuses saved Dancer ranks while Campus Talents is disabled', () => {
    rank(3);campus(false)
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
  })
  it('refuses hiring when City Life jobs or locations are absent', () => {
    rank(3);useGameStore.setState({playthroughMods:['city-life-locations']})
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
    setCityLifeEnabled(false,true)
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
  })
  it('does not replace another job or reopen a closed employer', () => {
    rank(3);useGameStore.getState().takeJob('fast_eats',[11],0)
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
    expect(useGameStore.getState().job?.jobId).toBe('fast_eats')
    useGameStore.setState({job:null,jobsClosed:[job.id]})
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
  })
  it('rejects empty, duplicate, closed, or class-conflicting shifts', () => {
    rank(3)
    expect(useGameStore.getState().takeJob(job.id,[],0)).toBe(false)
    expect(useGameStore.getState().takeJob(job.id,[11,11],0)).toBe(false)
    useGameStore.setState({jobClosures:{[job.id]:[11]},playerSchedule:{0:'A'}})
    expect(useGameStore.getState().takeJob(job.id,[11],0)).toBe(false)
    expect(useGameStore.getState().takeJob(job.id,[0],0)).toBe(false)
  })
  it('uses normal wages, raises and a single native stat gain per completed shift', () => {
    const state=newJobState(job.id,[11],0)
    expect(payOf(state)).toBe(300)
    expect(payOf({...state,raises:1})).toBe(360)
    const barback=newJobState('club_apogee',[11],0)
    for(const raises of [0,1,2,3,10]) {
      expect(payOf({...state,raises})).toBe(payOf({...barback,raises}))
    }
    for(const stat of ['body','heart']) {
      const shift=shiftRecordOf(state,{jobId:job.id,jobStats:[stat as 'body'|'heart']},0,1)!
      expect(shift.pay).toBe(300);expect(shift.gain.stats).toEqual([stat])
    }
  })
  it('preserves a hired job across save round-trips and later talent toggles', () => {
    rank(3);useGameStore.getState().takeJob(job.id,[11],0)
    const save={...useGameStore.getState().toGameSave(),playthroughId:'dance-test',saveId:'dance-save',saveDate:Date.now()}
    expect(save.job?.jobId).toBe(job.id)
    useGameStore.getState().reset()
    useGameStore.getState().loadSave(save,playthroughRecord({mods:['city-life-locations','city-life-jobs']}),{})
    expect(useGameStore.getState().job?.jobId).toBe(job.id)
    campus(false);rank(0)
    expect(useGameStore.getState().job?.jobId).toBe(job.id)
    expect(payOf(useGameStore.getState().job!)).toBe(300)
  })
  it('does not add skill requirements to existing City Life jobs', () => {
    campus(false)
    expect(meetsRequirements({brain:15,body:15,heart:15},jobDefOf('ex_roller')!)).toBe(true)
  })
})
