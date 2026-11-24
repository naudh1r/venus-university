import {beforeAll, beforeEach, describe, it, expect, vi} from 'vitest'
import { miniGamesReady } from './fixtures/miniGamesKit'
import {bindSceneFieldSaves} from '@vx/modkit/host/renderer'
import {useGameStore} from '../src/renderer/stores/gameStore'
import {cancelMatch, checkpointResult, clearMatch, keepInvitation, keptInvitation, keptAgreed, savedMiniGame, seatMatch, sceneMiniGame, useTableStore} from '../src/renderer/minigames/session'
import {fileResult, resumeMiniGameResult} from '../src/renderer/minigames/table'
import {queuedScene} from '../src/renderer/stores/loop/saves'
import {submitAction} from '../src/renderer/stores/gameLoop'
import DARTS from '@shared/minigameEntries/darts'

// The kit's renderer entry loads the game's stores; these tests take each name from its own module.
vi.mock('@vx/modkit/renderer', async () => (await import('./fixtures/miniGamesKit')).miniGamesKit())
beforeAll(miniGamesReady)
vi.mock('../src/renderer/stores/gameLoop',()=>({submitAction:vi.fn(),takeTurnFromReply:vi.fn(()=>false)}))

vi.mock('../src/renderer/stores/loop/hooks',async original=>({...await original<typeof import('../src/renderer/stores/loop/hooks')>(),advance:vi.fn()}))
vi.mock('../src/renderer/views/boxRows',()=>({boxFits:()=>true}))
const agreed={gameId:'darts',location:'pino_cola_lounge',charIds:['a','b'],stake:'Peach fizz',options:{'darts-mode':2,'darts-start':2}}
const outcome={outcome:'won' as const,summary:'You won.',account:['The final dart has landed.']}
type Written={ok:true;data:null}
// The scene field's saves, standing in for core's: each puts the value on the store and is written.
const written=async(_modId:string,_keys:readonly string[],apply:()=>void):Promise<Written>=>{apply();return {ok:true,data:null}}
const save=vi.fn(written)
beforeAll(()=>bindSceneFieldSaves({save}))
beforeEach(()=>{
 vi.clearAllMocks()
 useGameStore.getState().reset()
 useGameStore.setState({playthroughId:'test',awaitingInput:true,cast:['a','b'],currentSceneTranscript:[{speaker:'reader',text:'Darts?'}]})
 useTableStore.setState({agreed:null,active:false,played:null,proposal:null})
})
describe('mini-game scene checkpoint',()=>{
 it('round trips invitation through the save without browser storage',()=>{
  keepInvitation({gameId:'darts',location:'pino_cola_lounge'})
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(null)
  expect(keptInvitation()).toBeNull()
  useGameStore.getState().restoreScene(JSON.parse(JSON.stringify(saved)))
  expect(keptInvitation()).toEqual({gameId:'darts',location:'pino_cola_lounge'})
 })
 it('restarts a saved match with identical participants and options',()=>{
  useTableStore.getState().setAgreed(agreed)
  useTableStore.getState().dropAgreed()
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(null)
  useGameStore.getState().restoreScene(JSON.parse(JSON.stringify(saved)))
  expect(keptAgreed()).toMatchObject(agreed)
  expect(keptAgreed()).not.toHaveProperty('score')
 })
 it('a table cancelled before its first move does not come back on reload',async()=>{
  // Core's decision point, standing in: each scene-field save copies the scene into it.
  let held=useGameStore.getState().captureScene()
  save.mockImplementation(async(modId,keys,apply)=>{const done=await written(modId,keys,apply);held=useGameStore.getState().captureScene();return done})
  try{
   // Seated, as the panel seats a solo table.
   const table={left:false}
   await seatMatch(table,{...agreed,charIds:[]})
   expect(savedMiniGame(held!.mods!).match?.status).toBe('playing')
   await cancelMatch(table)
   // Leaving writes the decision point; loading it must not reopen the table.
   useGameStore.getState().restoreScene(null)
   useGameStore.getState().restoreScene(JSON.parse(JSON.stringify(held)))
   expect(keptAgreed()).toBeNull()
   expect(sceneMiniGame().match).toBeUndefined()
  }finally{save.mockImplementation(written)}
 })
 it('a game that fails as it first draws is not seated again after it is cancelled',async()=>{
  let held=useGameStore.getState().captureScene()
  save.mockImplementation(async(modId,keys,apply)=>{const done=await written(modId,keys,apply);held=useGameStore.getState().captureScene();return done})
  try{
   // The game throws on its first render: its guard stands the reader up during that commit,
   // and the panel's seating for the same render runs after.
   const table={left:false}
   await cancelMatch(table)
   await seatMatch(table,{...agreed,charIds:[]})
   useGameStore.getState().restoreScene(null)
   useGameStore.getState().restoreScene(JSON.parse(JSON.stringify(held)))
   expect(keptAgreed()).toBeNull()
   expect(sceneMiniGame().match).toBeUndefined()
  }finally{save.mockImplementation(written)}
 })
 it('captures a solo match and does not leak mutable options into the save',()=>{
  useTableStore.getState().setAgreed({...agreed,charIds:[]})
  const saved=useGameStore.getState().captureScene()!
  sceneMiniGame()!.match!.options['darts-mode']=1
  const kept=savedMiniGame(saved.mods!)
  expect(kept.match!.options['darts-mode']).toBe(2)
  expect(kept.match!.charIds).toEqual([])
 })
 it('rewinding before an invitation invalidates it',()=>{
  useGameStore.setState({currentSceneTranscript:[{speaker:'reader',text:'Hello'},{speaker:'a',text:'Darts?'}]})
  keepInvitation({gameId:'darts',location:'pino_cola_lounge'})
  useGameStore.setState({currentSceneTranscript:[{speaker:'reader',text:'Hello'}]})
  expect(keptInvitation()).toBeNull()
 })
 it('old saves and new scenes clear checkpoint fields',()=>{
  useTableStore.getState().setAgreed(agreed)
  const {mods:_mods,...old}=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(old)
  expect(keptAgreed()).toBeNull()
  useTableStore.getState().setAgreed(agreed)
  useGameStore.getState().setCast([])
  expect(sceneMiniGame()).toEqual({})
 })
 it('settled result blocks restart even before the final dialogue is read',()=>{
  useTableStore.getState().setAgreed(agreed)
  checkpointResult(outcome,['Ana','Bea'])
  expect(keptAgreed()).toBeNull()
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(saved)
  expect(sceneMiniGame().match?.result).toEqual(outcome)
  useTableStore.getState().setAgreed(agreed)
  expect(keptAgreed()).toBeNull()
 })
 it('persists once before starting aftermath and ignores duplicate callbacks',async()=>{
  useTableStore.getState().setAgreed(agreed)
  let saved!:()=>void
  save.mockImplementationOnce((_modId,_keys,apply)=>{apply();return new Promise<Written>(resolve=>{saved=()=>resolve({ok:true,data:null})})})
  fileResult(outcome,{game:DARTS,names:['Ana','Bea'],stake:agreed.stake})
  expect(submitAction).not.toHaveBeenCalled()
  expect(sceneMiniGame().match?.status).toBe('result')
  // A recovery effect cannot submit a second request while persistence is busy.
  resumeMiniGameResult()
  saved(); await vi.waitFor(()=>expect(submitAction).toHaveBeenCalledTimes(1))
  expect(save).toHaveBeenCalledTimes(1)
  fileResult(outcome,{game:DARTS,names:['Ana','Bea'],stake:agreed.stake})
  expect(submitAction).toHaveBeenCalledTimes(1)
 })
 it('recovers a saved result as aftermath, never as a playable match',async()=>{
  useTableStore.getState().setAgreed(agreed)
  checkpointResult(outcome,['Ana','Bea'])
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(saved)
  useGameStore.setState({awaitingInput:true})
  resumeMiniGameResult()
  await vi.waitFor(()=>expect(submitAction).toHaveBeenCalledWith('You won.'))
  expect(keptAgreed()).toBeNull()
 })
 it('does not automatically retry an AI error or resume over the active game panel',()=>{
  useTableStore.getState().setAgreed(agreed)
  checkpointResult(outcome,['Ana'])
  useTableStore.setState({active:true}); resumeMiniGameResult()
  useTableStore.setState({active:false}); useGameStore.setState({turnError:{message:'offline'} as never}); resumeMiniGameResult()
  expect(submitAction).not.toHaveBeenCalled()
 })
 it('queued saves use current state, not a stale match from the base',()=>{
  useTableStore.getState().setAgreed(agreed)
  const base=useGameStore.getState().captureScene()!
  clearMatch()
  expect(savedMiniGame(queuedScene(base,[]).mods??{}).match).toBeUndefined()
 })
 it('reads a match an older save kept under its old key, and moves it on the next change',()=>{
  const match={...agreed,id:'m1',status:'playing'}
  useGameStore.getState().restoreScene({...useGameStore.getState().captureScene()!,mods:{miniGame:{match}} as never})
  expect(keptAgreed()).toMatchObject(agreed)
  checkpointResult(outcome,['Ana','Bea'])
  const mods=useGameStore.getState().captureScene()!.mods as Record<string,unknown>
  expect(mods).not.toHaveProperty('miniGame')
  expect(savedMiniGame(mods).match?.result).toEqual(outcome)
 })
 it('leaves out a damaged match rather than reopening it',()=>{
  useGameStore.getState().restoreScene({...useGameStore.getState().captureScene()!,
   mods:{'mini-games':{match:{gameId:'darts',status:'playing',charIds:'a'},invitation:{gameId:'darts',location:null}}} as never})
  expect(keptAgreed()).toBeNull()
  expect(sceneMiniGame()).toEqual({invitation:{gameId:'darts',location:null}})
 })
})
