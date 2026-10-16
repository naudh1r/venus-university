import '../src/renderer/modEntries/breakthrough'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BREAKTHROUGH_MOD, breakthroughFacts, normalizeBreakthrough, reconcileBreakthrough, settleBreakthrough } from '@shared/breakthrough'
import { DEFAULT_MEMORY_BUDGETS } from '@shared/settingsRules'
import { READER_SPEAKER, type GameSave, type MemoryType, type StructuredRequest } from '@shared/types'
import { breakthroughContinuity } from '../src/renderer/prompts/breakthroughPrompt'
import { buildScenePrompt } from '../src/renderer/prompts/scenePrompt'
import { buildTextingPrompt } from '../src/renderer/prompts/textingPrompt'
import { activateBreakthrough, canBreakthrough, finishBreakthrough, rearmBreakthrough, settleSpirit, withBreakthrough } from '../src/renderer/stores/breakthrough'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState, type TurnSnapshot } from '../src/renderer/stores/loop/state'
import { failTurn, runSceneTurn } from '../src/renderer/stores/loop/turn'
import { registerLoopHooks } from '../src/renderer/stores/loop/hooks'
import { writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const a = character({charId:'a'}), b = character({charId:'b',firstName:'Mina'})
const game = () => useGameStore.getState()
const memory = (type: MemoryType, desc: string = type, date = 7) => ({type,desc,date})
const request: StructuredRequest = {system:'scene',user:'story',schema:{name:'scene',schema:{}}}
function seed(): void {
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{},options:{}}})
  useGameStore.setState({playthroughId:'p',date:7,time:0,chars:['a','b'],cast:['a'],
    characters:charactersById(a,b),charInfo:{a:charInfo({nameKnown:true}),b:charInfo({nameKnown:true})},
    awaitingInput:true, currentSceneTranscript:sceneLines('We sit under a tree.'),sceneLog:sceneLines('We sit under a tree.'),
    exBreakthrough:normalizeBreakthrough({meters:{a:100,b:35}})})
}
beforeEach(()=>{
  seed()
  stubApi({saves:{autosave:async(_id,draft)=>({ok:true,data:{...draft,playthroughId:'p',saveId:'autosave',saveDate:0}})}})
  registerLoopHooks({advance:vi.fn(),runEnding:async()=>{},fetchEndingOpening:async()=>null,
    dispatchTurn:vi.fn(),prefetchTextLedger:vi.fn(),claimTextLedger:async()=>({})})
})
afterEach(async()=>{await writesSettled();restoreApi();vi.restoreAllMocks()})

describe('spirit accounting',()=>{
  it('uses final edited scene/text memories once, caps gains, and leaves disliked alone',()=>{
    const before={a:charInfo({memories:[memory('liked','old')]}),b:charInfo()}
    const after={a:charInfo({memories:[memory('liked','old'),memory('liked','one'),memory('loved','two'),memory('hated','three')]}),
      b:charInfo({memories:[memory('disliked')],textMemory:memory('liked','text')})}
    const state=settleBreakthrough(normalizeBreakthrough({meters:{a:50,b:10}}),before,after,7,0)
    expect(state.meters).toEqual({a:55,b:20})
    expect(settleBreakthrough(state,before,after,7,0)).toEqual(state)
    expect(settleBreakthrough(normalizeBreakthrough(),{}, {a:charInfo({memories:[memory('hated')]})},7,0).meters.a).toBe(0)
    expect(settleBreakthrough(normalizeBreakthrough({meters:{a:95}}),{}, {a:charInfo({memories:[memory('loved')]})},7,0).meters.a).toBe(100)
  })
  it('does not earn while disabled or change another playthrough',()=>{
    const before=game()
    useGameStore.setState({charInfo:{a:charInfo({memories:[memory('loved')]}),b:charInfo()}})
    useModsStore.setState({switches:{on:{[BREAKTHROUGH_MOD]:false},options:{}}})
    settleSpirit(before)
    expect(game().exBreakthrough.settled).toEqual({})
    useModsStore.setState({switches:{on:{},options:{}}})
    useGameStore.setState({playthroughId:'other'})
    settleSpirit(before)
    expect(game().exBreakthrough.settled).toEqual({})
  })
  it('allows both ordinary replies and mid-stream interjections, but not locked classes/exams/departed cast',()=>{
    expect(canBreakthrough(game(),'a')).toBe(true)
    const lines=[{speaker:READER_SPEAKER,text:'Hello'},...sceneLines('One','Two')]
    useGameStore.setState({awaitingInput:false,busy:true,streaming:true,currentSceneTranscript:lines,pendingLines:[lines[2]]})
    expect(canBreakthrough(game(),'a')).toBe(true)
    useGameStore.setState({sceneClass:'ART101'})
    expect(canBreakthrough(game(),'a')).toBe(false)
    useGameStore.setState({sceneClass:null,departed:['a']})
    expect(canBreakthrough(game(),'a')).toBe(false)
    seed();useGameStore.setState({statusShown:true})
    expect(canBreakthrough(game(),'a')).toBe(false)
  })
  it('spends only the selected meter synchronously and refunds a refused dispatch exactly once',()=>{
    const before=game().exBreakthrough
    expect(()=>activateBreakthrough('a','x'.repeat(1001),()=>true)).toThrow()
    expect(game().exBreakthrough).toEqual(before)
    let token=''
    expect(()=>activateBreakthrough('a','I offer an honest apology.',()=>{
      token=game().exBreakthrough.pending!.id
      expect(game().exBreakthrough.meters).toEqual({a:0,b:35})
      return false
    })).toThrow('returned')
    expect(game().exBreakthrough.meters.a).toBe(100)
    finishBreakthrough(token,true)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })
  it('refunds native failed turns and charges their explicit retry again',()=>{
    activateBreakthrough('a','A hoped-for outcome',()=>true)
    const intent=game().exBreakthrough.pending!
    const snapshot:TurnSnapshot={action:intent.direction,scene:game().captureScene(),breakthrough:intent}
    failTurn({code:'LLM_FAILED',message:'failed'},snapshot)
    expect(game().exBreakthrough.meters.a).toBe(100)
    useGameStore.setState({turnError:null,awaitingInput:true})
    rearmBreakthrough(snapshot.breakthrough)
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(game().exBreakthrough.pending?.id).toBe(intent.id)
    finishBreakthrough('a different call',true)
    expect(game().exBreakthrough.pending?.id).toBe(intent.id)
  })
  it('refunds interrupted pending state on load and preserves data with the switch off',()=>{
    activateBreakthrough('a','Try to reconnect',()=>true)
    const save={...game().toGameSave(),playthroughId:'p',saveId:'save',saveDate:0} as GameSave
    useModsStore.setState({switches:{on:{[BREAKTHROUGH_MOD]:false},options:{}}})
    game().loadSave(save,playthroughRecord({chars:['a','b']}),charactersById(a,b))
    expect(game().exBreakthrough.meters).toEqual({a:100,b:35})
    expect(game().exBreakthrough.pending).toBeNull()
    expect(game().toGameSave().exBreakthrough?.meters.a).toBe(100)
  })
})

describe('actual outcomes and independent continuity',()=>{
  it('records only successful native turn output, before the autosave',async()=>{
    activateBreakthrough('a','The request is not a fact',()=>true)
    const intent=game().exBreakthrough.pending!, lines=sceneLines('She agrees to talk tomorrow.')
    const snapshot:TurnSnapshot={action:intent.direction,scene:game().captureScene(),breakthrough:intent}
    const saved=vi.fn(async(_id:string,draft:ReturnType<GameSaveDraft>)=>({ok:true as const,data:{...draft,playthroughId:'p',saveId:'auto',saveDate:0}}))
    stubApi({saves:{autosave:saved}})
    await runSceneTurn(Promise.resolve({ok:true,data:{lines,summary:null,end:false,applied:false,at:1,reply:{lines}}}),snapshot,['a'],[a],false)
    expect(game().exBreakthrough.meters.a).toBe(0)
    expect(game().exBreakthrough.pending).toBeNull()
    const moment=game().exBreakthrough.moments.a[0]
    expect(moment.outcome).toContain('agrees to talk tomorrow')
    expect(moment.outcome).not.toContain('request is not a fact')
    expect(saved.mock.calls[0][1].exBreakthrough?.moments.a[0].id).toBe(intent.id)
  })
  it('drops cancelled calls and empty outputs without inventing a remembered success',async()=>{
    activateBreakthrough('a','Hope',()=>true)
    const intent=game().exBreakthrough.pending!
    const snapshot:TurnSnapshot={action:'Hope',scene:game().captureScene(),breakthrough:intent}
    let resolve!:(v:Awaited<import('../src/renderer/stores/loop/stream').SceneCall>)=>void
    const pending=runSceneTurn(new Promise(r=>{resolve=r}),snapshot,['a'],[a],false)
    loopState.sceneCall={}
    finishBreakthrough(intent.id,true)
    resolve({ok:true,data:{lines:sceneLines('Discard me'),summary:null,end:false,applied:false,at:1,reply:{lines:sceneLines('Discard me')}}})
    await pending
    expect(game().exBreakthrough.moments).toEqual({})
    activateBreakthrough('a','Hope',()=>true)
    finishBreakthrough(game().exBreakthrough.pending!.id,false,[],1)
    expect(game().exBreakthrough.meters.a).toBe(100)
  })
  it('keeps edited/truncated outcomes aligned and projects old decision-point saves',async()=>{
    const first=sceneLines('Beginning'),reply=sceneLines('Wrong fact','Second fact')
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:0},moments:{a:[{id:'m',date:7,time:0,outcome:'Wrong fact',transcriptStart:1,transcriptCount:2}]}}),
      currentSceneTranscript:[...first,...reply],sceneLog:[...first,...reply],currentLine:reply[0],pendingLines:[reply[1]]})
    game().editLogLine(1,'Correct fact')
    expect(game().exBreakthrough.moments.a[0].outcome).toContain('Correct fact')
    game().truncateUnread()
    expect(game().exBreakthrough.moments.a[0].outcome).not.toContain('Second fact')
    const base={...game().captureScene()!,transcript:first}
    const saved=vi.fn(async(_id:string,draft:ReturnType<GameSaveDraft>)=>({ok:true as const,data:{...draft,playthroughId:'p',saveId:'auto',saveDate:0}}))
    stubApi({saves:{autosave:saved}})
    await writeAutosave(base)
    expect(saved.mock.calls[0][1].exBreakthrough?.moments.a).toEqual([])
    game().restoreScene(base)
    expect(game().exBreakthrough.moments.a).toEqual([])
  })
  it('bounds imported data and never shares another character’s or a future outcome',()=>{
    const state=normalizeBreakthrough({meters:{a:Infinity,b:-10},moments:{a:Array.from({length:20},(_,i)=>({id:String(i),date:7,time:0,outcome:'x'.repeat(20000)})),
      b:[{id:'secret',date:6,time:0,outcome:'Private fact'}],c:[{id:'future',date:20,time:0,outcome:'Future fact'}]}})
    expect(state.meters).toEqual({a:0,b:0})
    expect(state.moments.a).toHaveLength(6)
    expect(state.moments.a[0].outcome).toHaveLength(12000)
    expect(breakthroughFacts(state,['c'],7,0)).toEqual([])
    const text=breakthroughContinuity(state,[a],7,0)
    expect(text).not.toContain('Private fact');expect(text.length).toBeLessThan(24500)
    expect(reconcileBreakthrough(state,[],8,0).moments.a).toHaveLength(6)
  })
  it('adds the advantage once, refunds absent targets, and has no effect when disabled',()=>{
    activateBreakthrough('a','Reach an understanding',()=>true)
    expect(withBreakthrough(request,[a],false).user).toContain('ONE-TURN NARRATIVE ADVANTAGE')
    expect(withBreakthrough(request,[b],false).user).toBe(request.user)
    expect(game().exBreakthrough.meters.a).toBe(100)
    useModsStore.setState({switches:{on:{[BREAKTHROUGH_MOD]:false},options:{}}})
    expect(withBreakthrough(request,[a],false)).toBe(request)
  })
  it('carries committed outcomes into new scenes and texts, with no repeated advantage',()=>{
    const state=normalizeBreakthrough({moments:{a:[{id:'m',date:6,time:0,outcome:'A promise about the observatory.'}]}})
    const common={date:7,time:0 as const,charInfo:{a:charInfo()},npcRelationships:{},roster:[],classes:{},playerSchedule:{},occasions:[],playerJob:null,breakthrough:state}
    const scene=buildScenePrompt([a],'Hello',{...common,playthroughId:'p',seedWord:'aspen',backgrounds:{interior:['library'],exterior:['quad']},bg:null,classCode:null,projectClass:null,jobId:null,visitJobId:null,giftNotes:[],emotions:{},onStage:[],lessNsfwText:false,memoryBudgets:DEFAULT_MEMORY_BUDGETS,cgReady:{},outfitReady:{},roomReady:{}, customCgReady:{}},'SETTING','READER')
    const text=buildTextingPrompt(a,charInfo(),undefined,'Hello',{...common,memoryBudget:10},'READER')
    for (const r of [scene,text]) {expect(r.user).toContain('observatory');expect(r.user).not.toContain('ONE-TURN NARRATIVE ADVANTAGE')}
    expect(buildTextingPrompt(b,charInfo(),undefined,'Hello',{...common,memoryBudget:10},'READER').user).not.toContain('observatory')
  })
})

type GameSaveDraft = ReturnType<typeof useGameStore.getState>['toGameSave']
