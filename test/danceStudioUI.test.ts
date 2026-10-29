import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import type { ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'node:fs'
import { normalizeTalents } from '@shared/campusTalents'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { BoardView } from '../src/renderer/views/JobsModal'
import { TalentAbilityControls } from '../src/renderer/views/TalentAbilityControls'

// Rendering controls must not initialize Electron's generation jobs or make an AI call.
vi.mock('../src/renderer/stores/gameLoop',()=>({interject:vi.fn(()=>true)}))
// Keep the real motion behavior in this server render without starting Electron's
// renderer bridge. The kit contract tests verify these are its exported presets.
vi.mock('@vx/modkit/renderer', () => import('../src/renderer/views/motion'))

// Select the new opening while rendering the real board, without substituting its rules or UI.
vi.mock('@shared/jobs', async original => {
  const jobs=await original<typeof import('@shared/jobs')>()
  return {...jobs,availableJobs:()=>jobs.availableJobs().filter(j=>j.id==='ex_dance_instructor')}
})
beforeEach(()=>{
  useGameStore.getState().reset()
  useGameStore.setState({playthroughId:'dance-ui',playthroughMods:['city-life-locations','city-life-jobs'],stats:{brain:0,body:35,heart:35},playerSchedule:{},jobClosures:{}})
  useModsStore.setState({switches:{on:{'campus-talents':true},options:{}}})
})
afterEach(()=>{useGameStore.getState().reset();useModsStore.setState({switches:{on:{},options:{}}});vi.restoreAllMocks()})
const renderView=(view:ReactElement)=>{
  // Zustand SSR reads the vanilla store's boot snapshot. Temporarily supply the staged
  // state for this synchronous render, restoring both snapshots even on failure.
  const game=useGameStore.getInitialState(),mods=useModsStore.getInitialState()
  const originalGame={...game},originalMods={...mods}
  try {
    Object.assign(game,useGameStore.getState());Object.assign(mods,useModsStore.getState())
    return renderToStaticMarkup(view)
  } finally {Object.assign(game,originalGame);Object.assign(mods,originalMods)}
}
const board=()=>renderView(createElement(BoardView,{onClose:()=>{}}))

it.each([{mods:[]},{mods:['city-life-locations']},{mods:['city-life-locations','city-life-jobs']}])('keeps Dancer controls independent with playthrough mods $mods',({mods})=>{
  useGameStore.setState({playthroughMods:mods,exTalents:normalizeTalents({ranks:{'body.dancer':3}}),awaitingInput:true})
  const html=renderView(createElement(TalentAbilityControls,{skill:'body.dancer',safe:true,act:async()=>true,onClose:()=>{}}))
  expect(html).toContain('Start dancing')
  expect(html).toContain('Your rank 3 dancing skill applies whenever you dance.')
  if(mods.includes('city-life-jobs'))expect(html).toContain('Dance Instructor')
  else expect(html).not.toContain('Dance Instructor')
})

it('shows all three requirements and explains the missing rank on the real board',()=>{
  const html=board()
  expect(html).toContain('Dance Instructor')
  expect(html).toContain('vu-jobs-req vu-jobs-req--short">Dancer III')
  expect(html).toContain('Body: Good');expect(html).toContain('Heart: Good')
  expect(html).toContain('Learn the required ranks in Skill trees.')
  expect(html).toContain('The studio is open to visitors at every rank.')
  if(process.env.DANCE_UI_PATH)writeFileSync(process.env.DANCE_UI_PATH,html)
})
it('marks Dancer III met and removes the skill warning when learned',()=>{
  useGameStore.setState({exTalents:normalizeTalents({ranks:{'body.dancer':3}})})
  const html=board()
  expect(html).toContain('vu-jobs-req">Dancer III')
  expect(html).not.toContain('Learn the required ranks in Skill trees.')
})
it('explains that Campus Talents must be enabled even with saved ranks',()=>{
  useGameStore.setState({exTalents:normalizeTalents({ranks:{'body.dancer':3}})})
  useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
  expect(board()).toContain('Enable Campus Talents and learn the required ranks')
})
it('keeps the stat warning after Dancer III is learned',()=>{
  useGameStore.setState({exTalents:normalizeTalents({ranks:{'body.dancer':3}}),stats:{brain:0,body:34,heart:35}})
  const html=board()
  expect(html).toContain('vu-jobs-req vu-jobs-req--short">Body: Good')
  expect(html).toContain('to work')
})
