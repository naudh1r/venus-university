import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Character, StructuredRequest } from '@shared/types'
vi.mock('../src/renderer/minigames/MiniGamePanel', () => ({ MiniGamePanel: () => null }))
vi.mock('../src/renderer/minigames/MiniGameSeat', () => ({ MiniGameSeat: () => null }))
vi.mock('../src/renderer/minigames/PackPage', () => ({ PackPage: () => null }))
vi.mock('../src/renderer/minigames/play', () => ({ gameComponent: () => () => null }))
vi.mock('../src/renderer/minigames/skill', () => ({ skillOf: vi.fn() }))
vi.mock('../src/renderer/minigames/table', () => ({ gameIsOn: () => true, nameOf: () => 'Ana' }))
import { modRequest, afterSceneReply, setHookRules } from '../src/renderer/mods/hooks'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { agreementAvailable, keepInvitation, keptInvitation, useTableStore } from '../src/renderer/minigames/session'
import '../src/renderer/modEntries/mini-games'
const cast = [{charId:'a',firstName:'Ana',lastName:'Seo'}, {charId:'b',firstName:'Bea',lastName:'Seo'}] as Character[]
const transcript = [{speaker:'reader',text:'Hello'}, {speaker:'ana_seo',text:'Darts?'}]
function request(action: string) {
 const req = {user:`Reader's action: ${action}`,schema:{name:'scene',schema:{type:'object',properties:{lines:{}},required:['lines']}}} as unknown as StructuredRequest
 return modRequest('scene',{cast,state:{} as never,query:action},req)
}
function reply(data: Record<string, unknown>, ending=false) {afterSceneReply({reply:data,cast,solo:false,ending})}
function properties(r: StructuredRequest) {return (r.schema.schema as {properties:Record<string,unknown>}).properties}
beforeEach(()=>{
 setHookRules({isOn:id=>id==='mini-games',order:()=>0})
 useGameStore.setState({sceneMods:{},playthroughId:'test',date:1,time:0,currentSceneTranscript:transcript,sceneLog:[{bg:'pinocola_lounge',speaker:'',text:'Here'}],sceneLocation:'pino_cola_lounge',sceneClass:null,sceneJob:null,sceneProject:null})
 useTableStore.setState({proposal:null,agreed:null,played:null})
 keepInvitation(null)
})
describe('compact scene game context',()=>{
 it('ordinary chat has no launch field, rules or option enums',()=>{
  const r=request('How was your day?')
  expect(r.user).toContain('GAMES HERE')
  expect(properties(r)).toHaveProperty('minigameInvite')
  expect(properties(r)).not.toHaveProperty('minigame')
  expect(r.user).not.toContain('darts-start')
  reply({minigame:{play:'darts',with:{ana_seo:'in',bea_seo:'out'}}})
  expect(useTableStore.getState().agreed).toBeNull()
 })
 it('records an invitation and supplies only its game for a short reply',()=>{
  request('Hello'); reply({minigameInvite:{game:'darts',location:'pino_cola_lounge'}})
  useGameStore.setState({currentSceneTranscript:[...transcript,{speaker:'reader',text:'okay'}]})
  const r=request('okay')
  expect(r.user).toContain('Unanswered invitation: Darts')
  expect(r.user).toContain('darts-start')
  expect(r.user).not.toContain('Poker rules:')
  reply({minigame:{play:'darts',with:{ana_seo:'in',bea_seo:'out'},stake:'',options:{}}})
  expect(useTableStore.getState().agreed?.charIds).toEqual(['a'])
  expect(keptInvitation()).toBeNull()
 })
 it('a refusal clears invitation without opening a game',()=>{
  keepInvitation({gameId:'darts',location:'pino_cola_lounge'})
  request('No thanks'); reply({minigameInvite:{game:'',location:''},minigame:{play:'',with:{ana_seo:'out',bea_seo:'out'}}})
  expect(useTableStore.getState().agreed).toBeNull()
  expect(keptInvitation()).toBeNull()
 })
 it('keeps explicit destination agreement even while playback is still at the cafe',()=>{
  useGameStore.setState({sceneLocation:'reserve_bank_cafe',sceneLog:[{bg:'cafe',speaker:'',text:'Cafe'}]})
  const r=request('how about some darts match at pino cola lounge?')
  expect(r.user).toContain('Destination:')
  expect(r.user).toContain('Get agreement first')
  reply({minigame:{play:'darts',with:{ana_seo:'in',bea_seo:'in'},stake:'',options:{}}})
  expect(useTableStore.getState().agreed?.location).toBe('pino_cola_lounge')
  expect(useGameStore.getState().sceneLog[0].bg).toBe('cafe')
 })
 it('restoring an old scene clears the invitation',()=>{
  keepInvitation({gameId:'darts',location:'pino_cola_lounge'})
  const saved=useGameStore.getState().captureScene()!
  const {mods: _state,...old}=saved
  useGameStore.getState().restoreScene(old)
  expect(keptInvitation()).toBeNull()
  useGameStore.getState().restoreScene(saved)
  expect(keptInvitation()?.gameId).toBe('darts')
 })
 it('opens only after arrival, with an enabled game, including restored agreements',()=>{
  const due={gameId:'darts',charIds:['a'],stake:'',options:{},location:'pino_cola_lounge'}
  expect(agreementAvailable(due,'cat_cafe',[{id:'darts'}])).toBe(false)
  expect(agreementAvailable(due,'pino_cola_lounge',[])).toBe(false)
  expect(agreementAvailable(JSON.parse(JSON.stringify(due)),'pino_cola_lounge',[{id:'darts'}])).toBe(true)
 })
 it('stores an offered outing and follows it on okay after save/load',()=>{
  useGameStore.setState({sceneLocation:'reserve_bank_cafe',sceneLog:[{speaker:'',text:'Cafe',bg:'cafe'}]})
  const out=request('How was your day?')
  const line=out.user.split('\n').find(line=>line.startsWith('Possible outing: '))!
  expect(line).toBeTruthy()
  const id=line.split(' ')[2]
  const location=line.match(/\(([^)]+)\)/)![1]
  reply({minigameInvite:{game:id,location}})
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(null)
  useGameStore.getState().restoreScene(JSON.parse(JSON.stringify(saved)))
  const accepted=request('okay')
  expect(accepted.user).toContain('Unanswered invitation:')
  expect(accepted.user).toContain('Destination:')
 })
 it('keeps outing context bounded and omits it during work or class',()=>{
  expect(request('Hello').user.split('Possible outing:').length-1).toBeLessThanOrEqual(2)
  useGameStore.setState({sceneClass:'CS 101'})
  expect(request('Hello').user).not.toContain('Possible outing:')
 })
 it('rejects fabricated game/location pairs from the model',()=>{
  request('Hello'); reply({minigameInvite:{game:'darts',location:'selkie_beach'}})
  expect(keptInvitation()).toBeNull()
 })
 it('scene closing cannot retain an invitation or launch a match',()=>{
  request('Darts?'); reply({minigameInvite:{game:'darts',location:'pino_cola_lounge'},minigame:{play:'darts',with:{ana_seo:'in',bea_seo:'in'}}},true)
  expect(keptInvitation()).toBeNull()
  expect(useTableStore.getState().agreed).toBeNull()
 })
})
