import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buyTalent, normalizeTalents, setTalentRules, type TalentState } from '@shared/campusTalents'
import { buyTraining, PERSONAL_GROWTH, quoteTraining, readTalentTraining, reconcileTraining, trainingAfterBreak } from '@shared/talentTrading'
import { breakDecayedStats, type PlayerStats, type StatKey } from '@shared/playerStats'
import { carryModFields } from '@shared/modCarry'
import { compileTalentPacks } from '@shared/talentCatalog'
import type { TalentPack } from '@shared/talentTypes'
import type { GameSave, Result, SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { slotSettled } from '../src/renderer/mods/hooks'
import { writeTalentChange, writesSettled } from '../src/renderer/stores/loop/saves'
import { charInfo, character, playthroughRecord, restoreApi, stubApi } from './fixtures'
import '../src/renderer/modEntries/campus-talents'

const stats=(n:number):PlayerStats=>({brain:n,body:n,heart:n})
const state=(patch:Partial<TalentState>={})=>normalizeTalents({initialized:true,earned:5000,spent:60,ranks:{[PERSONAL_GROWTH]:1},...patch})
const game=()=>useGameStore.getState()
let saved:SaveDraft[]=[]
const finish=(draft:SaveDraft):Result<GameSave>=>({ok:true,data:{...draft,playthroughId:'training-test',saveId:'auto',saveDate:0}})
beforeEach(()=>{
  game().reset();resetLoopState();saved=[]
  useModsStore.setState({switches:{on:{'campus-talents':true},options:{}}})
  useGameStore.setState({playthroughId:'training-test',date:7,time:0,awaitingInput:true,stats:stats(0),exTalents:state(),
    chars:['a'],cast:['a'],characters:{a:character({charId:'a'})},charInfo:{a:charInfo()}})
  stubApi({saves:{autosave:async(_id,draft)=>{saved.push(structuredClone(draft));return finish(draft)}}})
})
afterEach(async()=>{await writesSettled();restoreApi();vi.restoreAllMocks();setTalentRules()})

describe('Personal Growth prices and purchase bounds',()=>{
  it('unlocks once from a fully upgraded second-row stat skill',()=>{
    const locked=state({spent:0,ranks:{'brain.focus':2}})
    expect(()=>buyTalent(locked,PERSONAL_GROWTH,()=>true)).toThrow('required skill')
    const learned=buyTalent({...locked,ranks:{'brain.notes':1}},PERSONAL_GROWTH,()=>true)
    expect(learned.spent).toBe(60);expect(learned.ranks[PERSONAL_GROWTH]).toBe(1)
    expect(()=>buyTalent(learned,PERSONAL_GROWTH,()=>true)).toThrow('fully learned')
    expect(()=>buyTraining(locked,stats(0),'brain',0,7)).toThrow('Learn Personal Growth')
  })
  it.each([-100,-80,-60,-30,-1,0,59,60,99])('buys an actual point at %i without pacing or changing other stats',n=>{
    const s=state({growth:stats(.75),bpFraction:.5}),before=structuredClone(s)
    const result=buyTraining(s,stats(n),'brain',0,7)
    expect(result.stats).toEqual({brain:n+1,body:n,heart:n})
    expect(result.talents.spent-s.spent).toBe(n>=60?40:25)
    expect(result.talents.earned).toBe(s.earned)
    expect(result.talents.growth).toEqual(s.growth);expect(result.talents.bpFraction).toBe(.5)
    expect(s).toEqual(before)
  })
  it('caps purchases at Godly without reducing existing surplus or losing a fractional point',()=>{
    for(const n of [100,200])expect(()=>buyTraining(state(),stats(n),'body',0,7)).toThrow('Godly')
    const result=buyTraining(state(),stats(99.5),'brain',0,7)
    expect(result.stats.brain).toBe(100);expect(result.quote.cost).toBe(20)
    expect(()=>buyTraining(state(),stats(0),'constructor' as StatKey,0,7)).toThrow('Choose')
    expect(()=>buyTraining(state(),stats(NaN),'brain',0,7)).toThrow('invalid')
    expect(()=>buyTraining(state(),stats(0),'brain',-1,7)).toThrow('invalid')
  })
  it('shares the new-progress limit across stats and does not bank unused weeks',()=>{
    let s=state(),current=stats(0)
    for(const key of ['brain','body'] as const){const r=buyTraining(s,current,key,0,7);s=r.talents;current=r.stats}
    expect(()=>buyTraining(s,current,'heart',0,7)).toThrow('both new-progress')
    s=normalizeTalents(JSON.parse(JSON.stringify(s)))
    expect(()=>buyTraining(s,current,'heart',0,13)).toThrow('both new-progress')
    const next=buyTraining(s,current,'heart',0,35)
    expect(next.talents.training?.week).toEqual({term:0,week:5,total:1,newPoints:1})
    expect(()=>buyTraining(next.talents,next.stats,'heart',0,7)).toThrow('later week')
  })
  it('does not spend fractional BP and rejects unaffordable purchases',()=>{
    const s=state({earned:84,spent:60,bpFraction:.99})
    expect(()=>buyTraining(s,stats(0),'brain',0,7)).toThrow('1 more BP')
    expect(s.spent).toBe(60)
  })
})

describe('Native semester decay and recovery accounting',()=>{
  it('records actual tier-based losses, including zero, but never negative-start recovery',()=>{
    expect(trainingAfterBreak({brain:100,body:99,heart:0},1).recovery).toEqual({term:1,targets:{brain:100,body:99,heart:0},remaining:{brain:40,body:64,heart:15}})
    expect(trainingAfterBreak(stats(200),1).recovery?.remaining).toEqual(stats(40))
    for(const n of [-15,-30,-60,-80,-100])expect(trainingAfterBreak(stats(n),1).recovery?.remaining).toEqual(stats(0))
  })
  it('carries a new finite allowance through the real mod adapter without altering native decay or BP',()=>{
    const s=state({training:{week:{term:0,week:17,total:6,newPoints:2}},growth:stats(.5)})
    const draft={...game().toGameSave(),stats:{brain:100,body:99,heart:-60},exTalents:s}
    const save={...draft,saveId:'auto',saveDate:0,playthroughId:'training-test'} as GameSave
    const original=structuredClone(save)
    const carried=carryModFields(save,{term:0,back:140,characters:{}}).exTalents!
    expect(carried.training).toEqual(trainingAfterBreak(draft.stats,1))
    expect(carried).toMatchObject({earned:s.earned,spent:s.spent,ranks:s.ranks,growth:s.growth})
    expect(breakDecayedStats(save.stats)).toEqual({brain:60,body:35,heart:-60})
    expect(carryModFields(save,{term:0,back:140,characters:{}}).exTalents).toEqual(carried)
    expect(save).toEqual(original)
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    expect(carryModFields(save,{term:0,back:140,characters:{}}).exTalents).toEqual(carried)
  })
  it('offers cheaper recovery only for the matching semester and switches price at the old target',()=>{
    let s=state({training:trainingAfterBreak({brain:61,body:0,heart:0},1)})
    expect(quoteTraining(s,stats(35),'brain',0,7).cost).toBe(25)
    expect(quoteTraining(s,stats(35),'brain',2,7).cost).toBe(25)
    const first=buyTraining(s,stats(60),'brain',1,7)
    expect(first.quote.cost).toBe(10);expect(first.stats.brain).toBe(61)
    s=normalizeTalents(JSON.parse(JSON.stringify(first.talents)))
    expect(quoteTraining(s,first.stats,'brain',1,7).cost).toBe(40)
    expect(s.training?.recovery?.remaining.brain).toBe(0)
  })
  it('uses up break losses with ordinary practice and does not refill them after a later penalty',()=>{
    const s=state({training:trainingAfterBreak(stats(100),1)})
    const practiced=reconcileTraining(s,stats(90),1)
    expect(practiced.training?.recovery?.remaining).toEqual(stats(10))
    const penalty=reconcileTraining(practiced,stats(50),1)
    expect(penalty.training?.recovery?.remaining).toEqual(stats(10))
    expect(s.training?.recovery?.remaining).toEqual(stats(40))
    const recovered=reconcileTraining(penalty,stats(100),1)
    expect(quoteTraining(recovered,stats(99),'brain',1,7).cost).toBe(40)
  })
  it('reconciles the actual scene settlement and keeps an exhausted allowance across reload',()=>{
    useGameStore.setState({semesterIndex:1,stats:stats(60),exTalents:state({training:trainingAfterBreak(stats(100),1)})})
    const before=game()
    useGameStore.setState({stats:stats(100)})
    slotSettled({before,ledger:null,closingCast:[]})
    const s=normalizeTalents(JSON.parse(JSON.stringify(game().exTalents)))
    expect(s.training?.recovery?.remaining).toEqual(stats(0))
    expect(quoteTraining(s,stats(60),'brain',1,7).recovery).toBe(false)
  })
  it('shares six purchases even when new progress is mixed with discounted recovery',()=>{
    let s=state({training:trainingAfterBreak({brain:100,body:0,heart:0},1)}),current={brain:60,body:0,heart:0}
    for(const key of ['body','heart','brain','brain','brain','brain'] as const){const r=buyTraining(s,current,key,1,7);s=r.talents;current=r.stats}
    expect(s.training?.week).toEqual({term:1,week:1,total:6,newPoints:2})
    expect(()=>buyTraining(s,current,'brain',1,7)).toThrow('all six')
    expect(buyTraining(s,current,'brain',1,14).quote.cost).toBe(10)
  })
  it('reads older saves without inventing a prior break and bounds imported training data',()=>{
    expect(normalizeTalents({initialized:true}).training).toBeUndefined()
    expect(quoteTraining(state(),stats(60),'brain',1,7).cost).toBe(40)
    expect(readTalentTraining(null)).toBeUndefined()
    expect(readTalentTraining({recovery:{term:-1},week:{term:'1',week:0}})).toEqual({})
    const t=readTalentTraining({recovery:{term:1,targets:stats(100),remaining:stats(999)},week:{term:1,week:0,total:999,newPoints:999}})
    expect(t?.recovery?.remaining).toEqual(stats(40));expect(t?.week).toEqual({term:1,week:0,total:6,newPoints:2})
  })
})

describe('Atomic BP-to-stat saves',()=>{
  it('saves the charge, stat, fractional progress and quota together and survives native load',async()=>{
    useGameStore.setState({exTalents:state({growth:stats(.75),bpFraction:.5})})
    await writeTalentChange({train:'brain'})
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({stats:{brain:1,body:0,heart:0},exTalents:{spent:85,growth:stats(.75),bpFraction:.5,training:{week:{term:0,week:1,total:1,newPoints:1}}}})
    const snapshot=JSON.parse(JSON.stringify(game().toGameSave())) as SaveDraft
    game().reset();game().loadSave({...snapshot,playthroughId:'training-test',saveId:'auto',saveDate:0},playthroughRecord(),{})
    expect(game().stats.brain).toBe(1);expect(game().exTalents.spent).toBe(85)
    expect(game().exTalents.training?.week?.total).toBe(1)
  })
  it('keeps both currency and stats unchanged when the save fails',async()=>{
    const before=game()
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'SAVE_WRITE_FAILED',message:'Disk full'}})}})
    await expect(writeTalentChange({train:'body'})).rejects.toThrow('Disk full')
    expect(game().stats).toBe(before.stats);expect(game().exTalents).toBe(before.exTalents)
  })
  it.each(['off','replay','creator','quiz','class','project','work','ending'] as const)('rejects training while %s without saving',async mode=>{
    if(mode==='off')useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    else if(mode==='replay')useGameStore.setState({replaying:{} as never})
    else if(mode==='creator')useGameStore.setState({createdScene:{} as never})
    else if(mode==='quiz')useGameStore.setState({sceneQuiz:{} as never})
    else if(mode==='class')useGameStore.setState({sceneClass:'ART'})
    else if(mode==='project')useGameStore.setState({sceneProject:'ART'})
    else if(mode==='work')useGameStore.setState({sceneJob:'barista'})
    else useGameStore.setState({sceneEnding:true})
    await expect(writeTalentChange({train:'brain'})).rejects.toThrow()
    expect(saved).toHaveLength(0);expect(game().stats).toEqual(stats(0))
  })
  it('rejects a second click and never changes a different save after a delayed acknowledgement',async()=>{
    let resolve!:(r:Result<GameSave>)=>void
    const spy=vi.spyOn(window.api.saves,'autosave').mockImplementationOnce(async(_id,draft)=>{saved.push(draft);return new Promise<Result<GameSave>>(r=>{resolve=r})})
    const first=writeTalentChange({train:'brain'}).catch(e=>e as Error)
    await vi.waitFor(()=>expect(spy).toHaveBeenCalledOnce())
    await expect(writeTalentChange({train:'body'})).rejects.toThrow('finished')
    useGameStore.setState({loads:game().loads+1,stats:stats(40)})
    resolve(finish(saved[0]));expect((await first)?.message).toContain('game changed')
    expect(game().stats).toEqual(stats(40));expect(game().exTalents.spent).toBe(60)
  })
  it('supports shared placement in third-party skill packs without allowing a shared tree capstone',()=>{
    const pack:TalentPack={id:'guest',name:'Guest',author:'Guest',trees:[{id:'guest.tree',name:'Guest',description:''}],skills:[{id:'guest.one',name:'Shared',tree:'guest.tree',chain:'Utility',shared:true,costs:[10],description:''}]}
    expect(compileTalentPacks([pack]).skills[0].shared).toBe(true)
    expect(()=>compileTalentPacks([{...pack,skills:[{...pack.skills[0],capstone:true}]}])).toThrow('shared placement')
  })
})
