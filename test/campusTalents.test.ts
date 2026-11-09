import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TALENTS, buyTalent, normalizeTalents, seedTalents, settleTalentPoints, settleSavings, talentBalance, talentEffect, talentPrice, transferSavings, talentAffinity, talentSpirit, talentAbilityCost, type TalentState } from '@shared/campusTalents'
import { compileTalentPacks } from '@shared/talentCatalog'
import type { TalentPack } from '@shared/talentTypes'
import { normalizeEcho, echoMultiplier } from '@shared/echo'
import { normalizeBreakthrough, settleBreakthrough } from '@shared/breakthrough'
import { carryModFields } from '@shared/modCarry'
import { newJobState, shiftRecordOf } from '@shared/jobs'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { ensureTalents } from '../src/renderer/modEntries/campus-talents'
import { slotSettled } from '../src/renderer/mods/hooks'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { payableShift, lockShiftPay } from '../src/renderer/stores/loop/jobs'
import { writeTalentChange, writeAutosave, writesSettled } from '../src/renderer/stores/loop/saves'
import { activateBreakthrough, availableEchoBreakthrough, rearmBreakthrough } from '../src/renderer/stores/breakthrough'
import { charInfo, character, charactersById, restoreApi, stubApi, sceneLines, playthroughRecord } from './fixtures'
import type { CharMemory, GameSave, SaveDraft, Result } from '@shared/types'

const game=()=>useGameStore.getState()
const state=(patch:Partial<TalentState>={})=>normalizeTalents({initialized:true,earned:500,seed:500,savingsDay:7,savingsSeen:7,...patch})
const memory=(type:CharMemory['type']='liked',desc='A kind gesture',date=7):CharMemory=>({type,desc,date})
const finish=(draft:SaveDraft):Result<GameSave>=>({ok:true,data:{...draft,playthroughId:'talent-test',saveId:'autosave',saveDate:0}})
let saved:SaveDraft[]=[]
beforeEach(()=>{
  game().reset();resetLoopState();saved=[]
  useModsStore.setState({switches:{on:{'campus-talents':true,echo:true,breakthrough:true},options:{}}})
  useGameStore.setState({playthroughId:'talent-test',date:7,time:0,awaitingInput:true,money:300,chars:['a','b'],cast:['a','b'],characters:charactersById(character({charId:'a'}),character({charId:'b'})),charInfo:{a:charInfo(),b:charInfo()},exTalents:state(),exEcho:normalizeEcho({player:{aspect:'daylark',name:'Dawn'},girls:{a:{aspect:'daylark',name:'Light'}}})})
  stubApi({saves:{autosave:async(_id,draft)=>{saved.push(structuredClone(draft));return finish(draft)}}})
})
afterEach(async()=>{await writesSettled();restoreApi();vi.restoreAllMocks()})

describe('Bond Points and extensible skill packs',()=>{
  it('loads a former test save as ordinary progress without exposing test controls',()=>{
    const progress=state({earned:10000,spent:60,ranks:{'guest-pack.gift':2},bpFraction:.45})
    const loaded=normalizeTalents({...progress,developer:true})
    expect(loaded).toEqual(progress)
    expect(loaded).not.toHaveProperty('developer')
  })
  it('settles BP from pre-gain stats and preserves fractional currency in native saves',()=>{
    useGameStore.setState({stats:{brain:-15,body:-15,heart:-15},exTalents:state({bpFraction:.5})})
    const before=game()
    useGameStore.setState({stats:{brain:100,body:100,heart:100},charInfo:{a:charInfo({memories:[memory('loved')]})}})
    slotSettled({before,ledger:null,closingCast:[]})
    expect(game().exTalents.earned).toBe(503)
    expect(game().exTalents.bpFraction).toBeCloseTo(0,12)
    const draft=game().toGameSave()
    game().reset()
    game().loadSave({...draft,playthroughId:'talent-test',saveId:'autosave',saveDate:0},playthroughRecord(),{})
    expect(game().exTalents.earned).toBe(503)
    expect(game().exTalents.bpFraction).toBeCloseTo(0,12)
  })
  it('seeds an older save once without changing relationships, then retains independent pack progress',()=>{
    useGameStore.setState({exTalents:normalizeTalents(),charInfo:{a:charInfo({memories:[memory('loved')]}),b:charInfo({memories:[memory('hated')]})}})
    const before=structuredClone(game().charInfo)
    ensureTalents();expect(game().exTalents.seed).toBeGreaterThan(0)
    const seeded=game().exTalents;ensureTalents();expect(game().exTalents).toBe(seeded)
    expect(game().charInfo).toEqual(before)
    const imported=state({spent:60,ranks:{'guest-pack.gift':2}})
    expect(normalizeTalents(JSON.parse(JSON.stringify(imported)))).toEqual(imported)
    expect(talentBalance(imported)).toBe(440)
    expect(seedTalents(imported,9999,1,0)).toEqual(imported)
  })
  it('awards final positive memories across characters only once per semester and slot',()=>{
    const old=memory('liked','Old memory',6), liked=memory(), loved=memory('loved')
    const before={a:charInfo({memories:[old]}),b:charInfo()}
    const after={a:charInfo({memories:[old,liked],textMemory:liked,giftMemories:[loved]}),b:charInfo({memories:[loved,memory('hated','Negative')]})}
    const s=settleTalentPoints(state(),before,after,0,7,0)
    expect(s.earned).toBe(505);expect(s.recent.at(-1)?.characters).toBe(2)
    expect(settleTalentPoints(s,before,after,0,7,0).earned).toBe(505)
    expect(settleTalentPoints(s,after,after,0,7,1).earned).toBe(505)
    expect(settleTalentPoints(s,before,after,1,7,0).earned).toBe(510)
  })
  it('checks prerequisites, mod requirements, every rank price and insufficient funds before spending',()=>{
    expect(()=>buyTalent(state(),'reliable',()=>true)).toThrow('preceding')
    expect(()=>buyTalent(state(),'matching',()=>false)).toThrow('required')
    let s=state();for(let i=0;i<3;i++)s=buyTalent(s,'wages',()=>true)
    expect(s.spent).toBe(90);expect(s.ranks.wages).toBe(3)
    expect(()=>buyTalent(s,'wages',()=>true)).toThrow('fully')
    expect(()=>buyTalent(state({earned:10,seed:10}),'wages',()=>true)).toThrow('more Bond')
    expect(state().spent).toBe(0)
  })
  it('discovers third-party trees and rejects conflicting IDs, invalid ranks and dependency cycles',()=>{
    const pack:TalentPack={id:'guest',name:'Guest pack',author:'Guest',trees:[{id:'guest.tree',name:'Guest tree',description:'Example'}],skills:[{id:'guest.one',name:'First',tree:'guest.tree',chain:'Earn',description:'First rank',costs:[10,20],effects:{wageRate:[.05,.1]}},{id:'guest.two',name:'Second',tree:'guest.tree',chain:'Earn',description:'Second rank',costs:[30],prerequisites:[{id:'guest.one',rank:2}]}]}
    expect(compileTalentPacks([pack]).skills).toHaveLength(2)
    expect(()=>compileTalentPacks([pack,pack])).toThrow('Duplicate')
    const broken=structuredClone(pack);broken.skills[0].costs=[-10]
    expect(()=>compileTalentPacks([broken])).toThrow('prices')
    const cyclic=structuredClone(pack);cyclic.skills[0].prerequisites=[{id:'guest.two',rank:1}]
    expect(()=>compileTalentPacks([cyclic])).toThrow('Circular')
    const missing=structuredClone(pack);missing.skills[1].prerequisites=[{id:'absent',rank:1}]
    expect(()=>compileTalentPacks([missing])).toThrow('prerequisite')
    const custom=structuredClone(pack);custom.skills[0].effects={'guest.focus-bonus':[2,4]}
    const compiled=compileTalentPacks([custom]), length=TALENTS.length
    try {
      TALENTS.push(...compiled.skills)
      const bought=buyTalent(buyTalent(state(),'guest.one',()=>true),'guest.one',()=>true)
      expect(bought.spent).toBe(30);expect(talentEffect(bought,'guest.focus-bonus')).toBe(4)
    } finally {TALENTS.splice(length)}
  })
  it('keeps replay and disabled-mod sessions from seeding, earning or buying',async()=>{
    useGameStore.setState({exTalents:normalizeTalents(),replaying:{}})
    ensureTalents();expect(game().exTalents.initialized).toBe(false)
    await expect(writeTalentChange({skill:'wages'})).rejects.toThrow()
    useGameStore.setState({replaying:null,exTalents:state()})
    const before=game();useGameStore.setState({charInfo:{a:charInfo({memories:[memory('loved')]})}})
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    slotSettled({before,ledger:null,closingCast:[]});expect(game().exTalents.earned).toBe(500)
    await expect(writeTalentChange({skill:'wages'})).rejects.toThrow()
  })
  it('requires one completed alternative as well as every mandatory prerequisite, without spending on a rejected queued purchase',async()=>{
    const pack:TalentPack={id:'guest',name:'Guest',author:'Guest',trees:[{id:'guest.tree',name:'Guest',description:''}],skills:[
      {id:'guest.start',tree:'guest.tree',chain:'A',name:'Start',description:'',costs:[10]},
      {id:'guest.left',tree:'guest.tree',chain:'A',name:'Left',description:'',costs:[20,30],prerequisites:[{id:'guest.start',rank:1}]},
      {id:'guest.right',tree:'guest.tree',chain:'B',name:'Right',description:'',costs:[40,50,60]},
      {id:'guest.ability',tree:'guest.tree',chain:'Ability',capstone:true,name:'Ability',description:'',costs:[100],prerequisites:[{id:'guest.start',rank:1}],prerequisitesAny:[{id:'guest.left',rank:2},{id:'guest.right',rank:3}]}
    ]}
    const length=TALENTS.length
    try {
      TALENTS.push(...compileTalentPacks([pack]).skills)
      const partial=state({ranks:{'guest.start':1,'guest.left':1,'guest.right':2}})
      useGameStore.setState({exTalents:partial})
      await expect(writeTalentChange({skill:'guest.ability'})).rejects.toThrow()
      expect(game().exTalents).toEqual(partial);expect(saved).toEqual([])
      expect(()=>buyTalent(state({ranks:{'guest.right':3}}),'guest.ability',()=>true)).toThrow()
      for(const [id,rank] of [['guest.left',2],['guest.right',3]] as const){
        const qualified=state({ranks:{'guest.start':1,[id]:rank}})
        useGameStore.setState({exTalents:qualified})
        await writeTalentChange({skill:'guest.ability'})
        expect(game().exTalents.spent).toBe(100)
        expect(normalizeTalents(saved.at(-1)!.exTalents).ranks['guest.ability']).toBe(1)
      }
    } finally {TALENTS.splice(length)}
  })
  it('rejects invalid alternative ranks, empty alternatives, cycles and competing capstones before touching saves',()=>{
    const pack:TalentPack={id:'guest',name:'Guest',author:'Guest',trees:[{id:'guest.tree',name:'Guest',description:''}],skills:[
      {id:'guest.first',tree:'guest.tree',chain:'A',name:'First',description:'',costs:[10,20]},
      {id:'guest.ability',tree:'guest.tree',chain:'Ability',capstone:true,name:'Ability',description:'',costs:[30],prerequisitesAny:[{id:'guest.first',rank:2}]}
    ]}
    expect(compileTalentPacks([pack]).skills).toHaveLength(2)
    for(const prerequisite of [{id:'absent',rank:1},{id:'guest.first',rank:3},{id:'guest.first',rank:0}]){
      const bad=structuredClone(pack);bad.skills[1].prerequisitesAny=[prerequisite]
      expect(()=>compileTalentPacks([bad])).toThrow('prerequisite')
    }
    const empty=structuredClone(pack);empty.skills[1].prerequisitesAny=[]
    expect(()=>compileTalentPacks([empty])).toThrow('Empty')
    const cyclic=structuredClone(pack);cyclic.skills[0].prerequisites=[{id:'guest.ability',rank:1}]
    expect(()=>compileTalentPacks([cyclic])).toThrow('Circular')
    const duplicate=structuredClone(pack);duplicate.skills[0].capstone=true
    expect(()=>compileTalentPacks([duplicate])).toThrow('Multiple capstone')
  })
  it('carries points, ranks, savings and the reward ledger into a later semester even when disabled',()=>{
    const talents=state({spent:50,ranks:{reserve:1,interest:1},reserve:150,reserveFloor:100,settled:{'0:7:0':true},growth:{brain:.75,body:.5,heart:.25},bpFraction:.75})
    useGameStore.setState({exTalents:talents})
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    const draft=game().toGameSave();const save={...draft,saveId:'auto',saveDate:0,playthroughId:'talent-test'} as GameSave
    expect(carryModFields(save,{term:0,back:140,characters:{}}).exTalents).toMatchObject(talents)
    expect(settleSavings(talents,1,0)).toMatchObject({reserve:150,savingsDay:0,savingsTerm:1,interestEarned:0})
  })
})

describe('Money effects',()=>{
  it('applies shop discounts exactly once, counts third purchases and returns to native prices when disabled',()=>{
    useGameStore.setState({exTalents:state({ranks:{bargain:3,regular:2},purchases:2})})
    expect(talentPrice(game().exTalents,100)).toBe(75)
    game().buyItem('test-item',100)
    expect(game().money).toBe(225);expect(game().exTalents.purchases).toBe(3)
    expect(talentPrice(game().exTalents,100)).toBe(85)
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    game().buyItem('test-item',100);expect(game().money).toBe(125);expect(game().exTalents.purchases).toBe(3)
  })
  it('quotes skill purchases made mid-shift and freezes the actual payment for the work ledger',()=>{
    const job={...newJobState('fast_eats',[],0),streak:2}
    useGameStore.setState({job});const raw=shiftRecordOf(job,{jobId:'fast_eats'},7,0)!
    loopState.jobShift=raw
    expect(payableShift(raw)?.pay).toBe(raw.pay)
    useGameStore.setState({exTalents:state({ranks:{wages:3,reliable:2}})})
    const quoted=payableShift(raw)!.pay;expect(quoted).toBe(Math.round((raw.pay*1.3+50)*100)/100)
    const paid=lockShiftPay();expect(paid?.pay).toBe(quoted)
    useModsStore.setState({switches:{on:{'campus-talents':false},options:{}}})
    expect(lockShiftPay()?.pay).toBe(quoted)
    expect(payableShift(raw)?.pay).toBe(raw.pay)
  })
  it('keeps savings and cash conserved, rejects overdrafts and uses the lowest balance for a full week',()=>{
    let s=state({ranks:{reserve:1,interest:3},reserve:1000,reserveFloor:1000})
    const moved=transferSavings(s,300,-500);s=moved.talents
    expect(moved.money).toBe(800);expect(s.reserve).toBe(500)
    s=transferSavings(s,800,700).talents;expect(s.reserveFloor).toBe(500)
    expect(()=>transferSavings(s,100,101)).toThrow('available cash')
    expect(()=>transferSavings(s,-100,1)).toThrow('available cash')
    expect(()=>transferSavings(s,100,-1201)).toThrow('cover')
    expect(()=>transferSavings(s,100,NaN)).toThrow('amount')
    for(let day=8;day<14;day++){s=settleSavings(s,0,day);expect(s.interestEarned).toBe(0)}
    s=settleSavings(s,0,14);expect(s.interestEarned).toBe(15);expect(s.reserve).toBe(1215)
    expect(settleSavings(s,0,14).reserve).toBe(1215)
    expect(settleSavings(s,0,28).reserve).toBe(1215)
  })
  it('caps weekly interest and restarts a period after a missing week',()=>{
    let s=state({ranks:{reserve:1,interest:3},reserve:10000,reserveFloor:10000})
    for(let day=8;day<=14;day++)s=settleSavings(s,0,day)
    expect(s.interestEarned).toBe(75)
    const jumped=settleSavings(s,0,99);expect(jumped.interestEarned).toBe(75);expect(jumped.savingsDay).toBe(99)
  })
})

describe('Echo integration',()=>{
  it('stamps only newly earned positive memories, avoids reward feedback, and keeps old memories at their earned rate',()=>{
    const old={...memory('liked','Old',6),echoAffinity:'matching' as const}
    useGameStore.setState({charInfo:{a:charInfo({memories:[old]})},exTalents:state({ranks:{matching:3}})})
    const before=game();useGameStore.setState({charInfo:{a:charInfo({memories:[old,memory('loved')]})}})
    slotSettled({before,ledger:null,closingCast:[]})
    const fresh=game().charInfo.a.memories[1]
    expect(fresh.talentEchoMultiplier).toBe(1.4);expect(echoMultiplier(fresh)).toBe(1.4)
    expect(game().charInfo.a.memories[0]).toEqual(old);expect(game().exTalents.earned).toBe(502)
    useGameStore.setState({exTalents:state({ranks:{matching:1}})})
    expect(echoMultiplier(fresh)).toBe(1.4)
    useModsStore.setState({switches:{on:{'campus-talents':false,echo:true},options:{}}})
    expect(echoMultiplier({...fresh,echoAffinity:'matching'})).toBe(1.25)
    useModsStore.setState({switches:{on:{echo:false},options:{}}})
    expect(echoMultiplier(fresh)).toBe(1)
  })
  it('boosts positive spirit only, preserves negative penalties and caps the meter',()=>{
    const s=state({ranks:{kindling:3,spark:2,competing:3,neutral:2}})
    expect(talentAffinity(s,'competing')).toBe(1);expect(talentAffinity(s,'neutral')).toBe(1.1)
    expect(talentSpirit(s,0,true)).toBe(0);expect(talentSpirit(s,20,true)).toBe(32)
    const after={a:charInfo({memories:[memory('loved'),memory('hated','Hated')]})}
    expect(settleBreakthrough(normalizeBreakthrough({meters:{a:20}}),{},after,7,0,n=>talentSpirit(s,n,true)).meters.a).toBe(37)
    expect(settleBreakthrough(normalizeBreakthrough({meters:{a:95}}),{},after,7,0,n=>talentSpirit(s,n,true)).meters.a).toBe(100)
  })
  it('charges and recovers the discounted Echo cost, preserving standard Breakthrough and failed-send refunds',()=>{
    useGameStore.setState({exTalents:state({ranks:{breath:2}}),exBreakthrough:normalizeBreakthrough({meters:{a:100}}),currentSceneTranscript:sceneLines('A quiet conversation.')})
    const ability=availableEchoBreakthrough(game())!;expect(ability.cost).toBe(talentAbilityCost(game().exTalents,50))
    activateBreakthrough('a',ability.action,()=>true,'daylark')
    const pending=game().exBreakthrough.pending!
    expect(game().exBreakthrough.meters.a).toBe(100-ability.cost)
    expect(normalizeBreakthrough(game().exBreakthrough,true).meters.a).toBe(100)
    useGameStore.setState({exBreakthrough:normalizeBreakthrough(game().exBreakthrough,true)})
    rearmBreakthrough(pending);expect(game().exBreakthrough.pending?.spent).toBe(ability.cost)
    useGameStore.setState({exBreakthrough:normalizeBreakthrough({meters:{a:100}})})
    expect(()=>activateBreakthrough('a',ability.action,()=>false,'daylark')).toThrow('returned');expect(game().exBreakthrough.meters.a).toBe(100)
    activateBreakthrough('a','I speak honestly.',()=>true);expect(game().exBreakthrough.meters.a).toBe(0)
  })
})

describe('Atomic purchases',()=>{
  it('persists a purchase and a transfer, keeps them in ordinary saves, and resets safely for a new game',async()=>{
    const relationships=structuredClone(game().charInfo)
    await writeTalentChange({skill:'reserve'});await writeTalentChange({transfer:100});await writeAutosave(null)
    expect(game().exTalents).toMatchObject({spent:20,reserve:100,reserveFloor:100,savingsDay:7})
    expect(game().money).toBe(200);expect(game().charInfo).toEqual(relationships)
    expect(saved.at(-1)?.exTalents).toEqual(game().exTalents)
    game().reset();expect(game().exTalents.initialized).toBe(false)
    game().loadSave({...saved[1],playthroughId:'talent-test',saveId:'autosave',saveDate:0},playthroughRecord(),{});expect(game().exTalents.reserve).toBe(100)
  })
  it('spends neither points nor money when the disk write fails',async()=>{
    const before=game().exTalents
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'DISK',message:'Disk full'}})}})
    await expect(writeTalentChange({skill:'wages'})).rejects.toThrow('Disk full')
    expect(game().exTalents).toBe(before);expect(game().money).toBe(300)
  })
  it('serializes double clicks and refuses a late acknowledgement after a different save loads',async()=>{
    let resolve!:(r:Result<GameSave>)=>void
    const spy=vi.spyOn(window.api.saves,'autosave').mockImplementationOnce(async(_id,draft)=>{saved.push(draft);return new Promise<Result<GameSave>>(r=>{resolve=r})})
    const first=writeTalentChange({skill:'wages'}).catch(e=>e as Error)
    await vi.waitFor(()=>expect(spy).toHaveBeenCalledOnce())
    await expect(writeTalentChange({skill:'wages'})).rejects.toThrow('finished')
    useGameStore.setState({loads:game().loads+1})
    resolve(finish(saved[0]));expect((await first)?.message).toContain('game changed')
    expect(game().exTalents.spent).toBe(0);expect(spy).toHaveBeenCalledOnce()
  })
})
