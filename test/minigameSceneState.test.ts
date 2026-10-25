import {beforeEach, describe, it, expect, vi} from 'vitest'
import {useGameStore} from '../src/renderer/stores/gameStore'
import {checkpointResult, clearMatch, keepInvitation, keptInvitation, keptAgreed, sceneMiniGame, useTableStore} from '../src/renderer/minigames/session'
import {fileResult, resumeMiniGameResult} from '../src/renderer/minigames/table'
import {writeAutosave, queuedScene} from '../src/renderer/stores/loop/saves'
import {submitAction} from '../src/renderer/stores/gameLoop'
import DARTS from '@shared/minigameEntries/darts'
vi.mock('../src/renderer/stores/gameLoop',()=>({submitAction:vi.fn(),takeTurnFromReply:vi.fn(()=>false)}))
vi.mock('../src/renderer/stores/loop/saves',async original=>({...await original<typeof import('../src/renderer/stores/loop/saves')>(),writeAutosave:vi.fn(async()=>{})}))
vi.mock('../src/renderer/stores/loop/hooks',async original=>({...await original<typeof import('../src/renderer/stores/loop/hooks')>(),advance:vi.fn()}))
vi.mock('../src/renderer/views/boxRows',()=>({boxFits:()=>true}))
const agreed={gameId:'darts',location:'pino_cola_lounge',charIds:['a','b'],stake:'Peach fizz',options:{'darts-mode':2,'darts-start':2}}
const outcome={outcome:'won' as const,summary:'You won.',account:['The final dart has landed.']}
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
 it('captures a solo match and does not leak mutable options into the save',()=>{
  useTableStore.getState().setAgreed({...agreed,charIds:[]})
  const saved=useGameStore.getState().captureScene()!
  sceneMiniGame()!.match!.options['darts-mode']=1
  expect(saved.mods!.miniGame!.match!.options['darts-mode']).toBe(2)
  expect(saved.mods!.miniGame!.match!.charIds).toEqual([])
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
  expect(sceneMiniGame()).toBeUndefined()
 })
 it('settled result blocks restart even before the final dialogue is read',()=>{
  useTableStore.getState().setAgreed(agreed)
  checkpointResult(outcome,['Ana','Bea'])
  expect(keptAgreed()).toBeNull()
  const saved=useGameStore.getState().captureScene()!
  useGameStore.getState().restoreScene(saved)
  expect(sceneMiniGame()?.match?.result).toEqual(outcome)
  useTableStore.getState().setAgreed(agreed)
  expect(keptAgreed()).toBeNull()
 })
 it('persists once before starting aftermath and ignores duplicate callbacks',async()=>{
  useTableStore.getState().setAgreed(agreed)
  let saved!:()=>void
  vi.mocked(writeAutosave).mockImplementationOnce(()=>new Promise<void>(resolve=>{saved=resolve}))
  fileResult(outcome,{game:DARTS,names:['Ana','Bea'],stake:agreed.stake})
  expect(submitAction).not.toHaveBeenCalled()
  expect(sceneMiniGame()?.match?.status).toBe('result')
  // A recovery effect cannot submit a second request while persistence is busy.
  resumeMiniGameResult()
  saved(); await vi.waitFor(()=>expect(submitAction).toHaveBeenCalledTimes(1))
  expect(writeAutosave).toHaveBeenCalledTimes(1)
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
  expect(queuedScene(base,[]).mods?.miniGame?.match).toBeUndefined()
 })
})
