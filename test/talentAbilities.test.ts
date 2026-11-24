import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { normalizeTalents, setTalentRules, buyTalent, talentMemoryKey, type TalentState } from '@shared/campusTalents'
import { abilityUsedThisWeek, normalizeTalentAbilities } from '@shared/talentAbilityState'
import { abilityRank, completeEureka, eurekaReady, reconcileTalentBreakthrough, settleTalentSceneAbilities, TALENT_ABILITIES as A, valueSuggestions } from '@shared/talentAbilities'
import { talentProjectWork } from '@shared/talentPerks'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { normalizeEcho } from '@shared/echo'
import { carryModFields } from '@shared/modCarry'
import { SHOPS, itemsInShop, giftReactionOf, type ItemDef } from '@shared/shop'
import type { CharMemory, GameSave } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writeTalentChange, writesSettled } from '../src/renderer/stores/loop/saves'
import { applyTalentChoice, eurekaProjects, talentGoodbyeOpen } from '../src/renderer/stores/talentActions'
import { availableEchoBreakthrough, activateBreakthrough, finishBreakthrough, rearmBreakthrough } from '../src/renderer/stores/breakthrough'
import { projectPeriodOf, workedOn } from '../src/renderer/prompts/classProgress'
import { slotSettled } from '../src/renderer/mods/hooks'
import '../src/renderer/modEntries/campus-talents'
import { charInfo, character, classEntry, sceneLines, stubApi, restoreApi } from './fixtures'

const game=()=>useGameStore.getState()
const state=(patch:Partial<TalentState>={})=>normalizeTalents({initialized:true,earned:2000,seed:2000,...patch})
const memory=(type:CharMemory['type']='liked',desc='Meeting',date=7):CharMemory=>({type,desc,date})
beforeEach(()=>{
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{'campus-talents':true,echo:true,breakthrough:true},options:{}}})
  useGameStore.setState({playthroughId:'abilities-test',date:7,time:0,awaitingInput:true,exTalents:state(),
    characters:{a:character({charId:'a'}),b:character({charId:'b'})},chars:['a','b'],cast:['a','b'],
    charInfo:{a:charInfo({nameKnown:true}),b:charInfo({nameKnown:true})}})
  stubApi({saves:{autosave:async(_id,draft)=>({ok:true,data:{...draft,playthroughId:'abilities-test',saveId:'autosave',saveDate:0}})}})
})
afterEach(async()=>{await writesSettled();restoreApi();setTalentRules()})

describe('saved ability state',()=>{
  it('upgrades old saves without reseeding or losing unknown packs and rejects malformed ability data',()=>{
    const s=state({earned:90,spent:50,ranks:{'guest.perk':2}})
    expect(s.abilities).toEqual({uses:{},anticipation:{}})
    const n=normalizeTalents({...s,abilities:{uses:{bad:{term:-1,week:1},good:{term:0,week:1}},eureka:{term:0,code:'ART',exam:'other'},anticipation:{a:{term:0,date:7,time:5}}}})
    expect(n).toMatchObject({earned:90,spent:50,ranks:{'guest.perk':2},abilities:{uses:{good:{term:0,week:1}},anticipation:{}}})
    expect(n.abilities.eureka).toBeUndefined()
    expect(normalizeTalentAbilities({farewell:{term:0,date:7,time:0,charId:'a',action:'x'.repeat(1001),at:0}}).farewell).toBeUndefined()
  })
  it('carries earned effects and cooldowns but clears old-semester project and goodbye preparations',()=>{
    const s=state({abilities:{uses:{[A.borrowed]:{term:0,week:1,token:'spent'}},anticipation:{a:{term:0,date:7,time:0}},eureka:{term:0,code:'ART',exam:'midterm'},farewell:{term:0,date:7,time:0,charId:'a',action:'Goodbye',at:0}}})
    useGameStore.setState({exTalents:s})
    const save={...game().toGameSave(),saveId:'auto',saveDate:0,playthroughId:'abilities-test'} as GameSave
    const carried=carryModFields(save,{term:0,back:140,characters:{}}).exTalents!
    expect(carried.abilities.anticipation).toEqual(s.abilities.anticipation)
    expect(carried.abilities.uses).toEqual(s.abilities.uses)
    expect(carried.abilities.eureka).toBeUndefined();expect(carried.abilities.farewell).toBeUndefined()
    expect(abilityUsedThisWeek(carried.abilities,A.borrowed,1,7)).toBe(false)
  })
  it('supports ranked unlocks through the same purchase and dependency checks as numerical effects',()=>{
    let s=state({ranks:{'body.pe':1,'body.shift':1}})
    for(let rank=1;rank<=3;rank++){s=buyTalent(s,A.dancer,()=>true);expect(abilityRank(s,A.dancer)).toBe(rank)}
    expect(()=>buyTalent(s,A.dancer,()=>true)).toThrow()
    setTalentRules(false);expect(abilityRank(s,A.dancer)).toBe(0)
  })
  it('keeps an earlier purchased ability usable while requiring a completed second-row skill for another rank',()=>{
    const old=state({spent:25,ranks:{'body.pe':1,[A.dancer]:1}})
    const restored=normalizeTalents(JSON.parse(JSON.stringify(old)))
    expect(restored).toEqual(old)
    expect(abilityRank(restored,A.dancer)).toBe(1)
    expect(()=>buyTalent(restored,A.dancer,()=>true)).toThrow('second-row')
    const qualified=buyTalent(restored,'body.shift',()=>true)
    expect(abilityRank(buyTalent(qualified,A.dancer,()=>true),A.dancer)).toBe(2)
  })
})

describe('Eureka work and persistence',()=>{
  function prepare(){
    const entry=classEntry({code:'ART',kind:'project',slot:1})
    const period=projectPeriodOf(entry,7,game().calendar)!
    useGameStore.setState({classes:{ART:entry},playerSchedule:{1:'ART'},classRecords:{ART:{meetings:[{date:period.assignmentDate,attended:true}]}},exTalents:state({ranks:{[A.eureka]:1,'brain.cram':1},abilities:{uses:{},anticipation:{}}})})
  }
  it('arms only assigned unfinished projects, without spending its use until actual completion',async()=>{
    prepare();expect(eurekaProjects(game())).toHaveLength(1)
    await expect(writeTalentChange({ability:'eureka',code:'OTHER',exam:'midterm'})).rejects.toThrow()
    await writeTalentChange({ability:'eureka',code:'ART',exam:'midterm'})
    const s=game().exTalents
    expect(abilityUsedThisWeek(s.abilities,A.eureka,0,7)).toBe(false)
    expect(talentProjectWork(s,1,{term:0,date:7,code:'ART',exam:'midterm'})).toBe(3)
    expect(eurekaReady(s,0,7,'OTHER','midterm')).toBe(false)
    expect(eurekaReady(s,0,7,'ART','final')).toBe(false)
    game().recordProjectWork('ART','midterm',7,1)
    expect(workedOn(game().classRecords.ART,'midterm')).toBe(3)
    expect(abilityUsedThisWeek(game().exTalents.abilities,A.eureka,0,7)).toBe(true)
    expect(game().exTalents.abilities.eureka).toBeUndefined()
    game().recordProjectWork('ART','midterm',7,1)
    expect(workedOn(game().classRecords.ART,'midterm')).toBe(3)
    await expect(writeTalentChange({ability:'eureka',code:'ART',exam:'midterm'})).rejects.toThrow('week')
    useGameStore.setState({date:14})
    await writeTalentChange({ability:'eureka',code:'ART',exam:'midterm'})
    expect(eurekaReady(game().exTalents,0,14,'ART','midterm')).toBe(true)
  })
  it('cancellation, failed writes, mod toggles and replay work cannot consume an armed use',async()=>{
    prepare()
    const start=game().exTalents
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'SAVE_WRITE_FAILED',message:'Disk full'}})}})
    await expect(writeTalentChange({ability:'eureka',code:'ART',exam:'midterm'})).rejects.toThrow('Disk full')
    expect(game().exTalents).toBe(start)
    const armed=applyTalentChoice(game(),start,{ability:'eureka',code:'ART',exam:'midterm'})
    expect(applyTalentChoice(game(),armed,{ability:'cancel-eureka'}).abilities).toEqual(start.abilities)
    setTalentRules(false)
    expect(completeEureka(armed,0,7,'ART','midterm')).toBe(armed)
    useGameStore.setState({replaying:{},exTalents:armed})
    game().recordProjectWork('ART','midterm',7,1)
    expect(workedOn(game().classRecords.ART,'midterm')).toBe(1)
    expect(game().exTalents).toBe(armed)
  })
})

describe('romantic anticipation',()=>{
  const romance=()=>{const c=charInfo({nameKnown:true});c.flags.hasKissed=true;return c}
  const armed=()=>state({ranks:{[A.farewell]:1},abilities:{uses:{},anticipation:{},farewell:{term:0,date:7,time:0,charId:'a',action:'Goodbye',at:0,ended:true}}})
  const transcript=[{speaker:'reader',text:'Goodbye'},...sceneLines('She waves goodbye.')]
  it('requires a positive final scene, the explicit last reader goodbye and an established connection',()=>{
    const before={a:romance()},after={a:{...romance(),memories:[memory()]}}
    const settle=(s=armed(),lines=transcript,infos=after)=>settleTalentSceneAbilities(s,before,infos,['a'],lines,0,7,0)
    const result=settle().state
    expect(result.abilities.anticipation.a).toEqual({term:0,date:7,time:0})
    expect(abilityUsedThisWeek(result.abilities,A.farewell,0,7)).toBe(true)
    for(const failed of [settle(armed(),[...transcript,{speaker:'reader',text:'Actually, stay.'}]),settle(armed(),transcript,{a:{...romance(),memories:[memory(),memory('disliked','Argument')]}}),settle(armed(),transcript,{a:charInfo({memories:[memory()]})}),settle(armed(),transcript,before)]){
      expect(failed.state.abilities.anticipation).toEqual({});expect(failed.state.abilities.uses).toEqual({})
    }
    useGameStore.setState({currentSceneTranscript:sceneLines('A quiet conversation.'),charInfo:before,exTalents:armed(),pendingLines:sceneLines('Unread')})
    expect(talentGoodbyeOpen(game())).toBe(false)
    expect(()=>applyTalentChoice(game(),armed(),{ability:'farewell',charId:'a'})).toThrow('Finish reading')
    useGameStore.setState({pendingLines:[],awaitingInput:false})
    expect(talentGoodbyeOpen(game())).toBe(true)
    expect(applyTalentChoice(game(),armed(),{ability:'farewell',charId:'a'}).abilities.farewell?.charId).toBe('a')
    useGameStore.setState({streaming:true})
    expect(talentGoodbyeOpen(game())).toBe(false)
  })
  it('bonuses just one positive memory at the next meeting, leaves BP unchanged and expires after a negative meeting',()=>{
    const s=state({ranks:{[A.farewell]:1},abilities:{uses:{},anticipation:{a:{term:0,date:7,time:0}}}})
    useGameStore.setState({time:1,exTalents:s,charInfo:{a:romance()}})
    const before=game()
    useGameStore.setState({charInfo:{a:{...romance(),memories:[memory(),memory('loved','Second')],textMemory:memory('liked','Text')}}})
    slotSettled({before,ledger:null,closingCast:[game().characters.a]})
    const info=game().charInfo.a
    expect(info.memories[0].talentHeartMultiplier).toBe(1.25)
    expect(info.memories[1].talentHeartMultiplier).toBe(1)
    expect(info.textMemory?.talentHeartMultiplier).toBe(1)
    expect(game().exTalents.earned).toBe(2004)
    expect(game().exTalents.abilities.anticipation).toEqual({})
    slotSettled({before,ledger:null,closingCast:[game().characters.a]})
    expect(game().exTalents.earned).toBe(2004)
    const negative=settleTalentSceneAbilities(s,{a:romance()},{a:{...romance(),memories:[memory('hated')]}},['a'],[],0,7,1)
    expect(negative.bonus).toEqual({});expect(negative.state.abilities.anticipation).toEqual({})
    const later=settleTalentSceneAbilities(s,{a:romance()},{a:{...romance(),memories:[memory()]}},['a'],[],1,7,0)
    expect(later.bonus.a).toBe(talentMemoryKey(memory()))
  })
})

describe('Borrowed Voice',()=>{
  function prepare(){
    useGameStore.setState({exTalents:state({ranks:{[A.borrowed]:1}}),exEcho:normalizeEcho({player:{aspect:'horizonbound',name:'One'},girls:{a:{aspect:'heartthread',name:'Two'}}}),exBreakthrough:normalizeBreakthrough({meters:{a:100,b:100}}),currentSceneTranscript:sceneLines('Conversation'),charInfo:{a:charInfo({nameKnown:true,memories:Array.from({length:40},(_,i)=>memory('loved',`Bond ${i}`))}),b:charInfo({nameKnown:true})}})
  }
  it('uses the trusted source ability and original price without changing either aspect; refunds failure',()=>{
    prepare();const echo=game().exEcho,ability=availableEchoBreakthrough(game(),'a')!
    expect(ability.aspect).toBe('heartthread')
    activateBreakthrough('b',ability.action,()=>true,ability.aspect,'a')
    const pending=game().exBreakthrough.pending!
    expect(normalizeBreakthrough(JSON.parse(JSON.stringify(game().exBreakthrough))).pending).toEqual(pending)
    expect(game().exBreakthrough.meters.b).toBe(100-ability.cost)
    expect(normalizeBreakthrough(game().exBreakthrough,true).meters.b).toBe(100)
    finishBreakthrough(pending.id,true)
    expect(game().exTalents.abilities.uses).toEqual({})
    expect(game().exBreakthrough.meters.b).toBe(100)
    rearmBreakthrough(pending)
    finishBreakthrough(pending.id,false,sceneLines('They find common ground.'),1)
    const saved=game().exTalents
    expect(abilityUsedThisWeek(saved.abilities,A.borrowed,0,7)).toBe(true)
    expect(game().exEcho).toBe(echo)
    finishBreakthrough(pending.id,false,sceneLines('Duplicate.'),1)
    expect(game().exTalents).toBe(saved)
    expect(availableEchoBreakthrough(game(),'a')).toBeNull()
    expect(availableEchoBreakthrough(game())?.aspect).toBe('horizonbound')
    useGameStore.setState({date:14});expect(availableEchoBreakthrough(game(),'a')).not.toBeNull()
    useGameStore.setState({departed:['a']});expect(availableEchoBreakthrough(game(),'a')).toBeNull()
  })
  it('refunds a completed borrowed use on a real transcript cut, never rereading or an edited transcript',()=>{
    prepare();const ability=availableEchoBreakthrough(game(),'a')!,prefix=sceneLines('Conversation'),outcome=sceneLines('They find common ground.')
    activateBreakthrough('b',ability.action,()=>true,ability.aspect,'a')
    finishBreakthrough(game().exBreakthrough.pending!.id,false,outcome,1)
    const full=[...prefix,...outcome],g=game()
    expect(reconcileTalentBreakthrough(g,full,full).exTalents).toBe(g.exTalents)
    expect(reconcileTalentBreakthrough(g,sceneLines('Edited'),full).exTalents).toBe(g.exTalents)
    const cut=reconcileTalentBreakthrough(g,prefix,full)
    expect(cut.exTalents.abilities.uses).toEqual({});expect(cut.exBreakthrough.meters.b).toBe(100)
  })
  it('rejects an untrusted source and a disabled Echo dependency before charging',()=>{
    prepare();useGameStore.setState({charInfo:{a:charInfo({nameKnown:true}),b:charInfo()}})
    expect(availableEchoBreakthrough(game(),'a')).toBeNull()
    expect(()=>activateBreakthrough('b','Try',()=>true,'heartthread','a')).toThrow()
    expect(game().exBreakthrough.meters.b).toBe(100)
    prepare();useModsStore.setState({switches:{on:{'campus-talents':true,echo:false},options:{}}})
    expect(availableEchoBreakthrough(game(),'a')).toBeNull()
  })
})

describe('best affordable gift',()=>{
  const all=SHOPS.flatMap(s=>itemsInShop(s.id)).filter(i=>!i.medicine)
  const info=charInfo({nameKnown:true,gifts:[],giftMemories:[]}),person=character()
  const item=(id:string,price:number,categories:ItemDef['categories'],shopId=SHOPS[0].id):ItemDef=>({...all[0],id,price,categories,shopId})
  const liked=item('test-liked',1,['cozy','artsy']),loved=item('test-loved',20,['cozy']),cheaper=item('test-cheaper',10,['cozy'],SHOPS[1].id)
  it('works before the first gift and ranks love above like, then price across shops',()=>{
    expect(valueSuggestions(info,[liked,loved,cheaper],20,person)).toMatchObject([{item:{id:cheaper.id},reaction:'loved'}])
    expect(valueSuggestions(info,[liked,loved,cheaper],9,person)).toMatchObject([{item:{id:liked.id},reaction:'liked'}])
    const samePrice=item('test-a',10,['cozy'])
    expect(valueSuggestions(info,[cheaper,samePrice],20,person)[0].item.id).toBe(samePrice.id)
  })
  it('skips repeats, medicine and poor matches instead of presenting them as a best gift',()=>{
    expect(valueSuggestions({...info,gifts:[cheaper.id]},[loved,cheaper],20,person)[0].item.id).toBe(loved.id)
    expect(valueSuggestions({...info,gifts:[loved.id,cheaper.id]},[loved,cheaper],20,person)).toEqual([])
    expect(valueSuggestions(info,[{...loved,medicine:true},item('test-bad',1,['edgy']),item('test-neutral',1,['practical'])],20,person)).toEqual([])
  })
  it('requires a known person and a valid budget',()=>{
    for(const budget of [-1,NaN,Infinity,0])expect(valueSuggestions(info,[loved],budget,person)).toEqual([])
    expect(valueSuggestions({...info,nameKnown:false},[loved],20,person)).toEqual([])
    expect(valueSuggestions(info,[loved],20,undefined)).toEqual([])
  })
  it('uses catalog value for Materialist taste while honoring the discounted purchase price',()=>{
    const premium=all.find(i=>i.price>=100)!
    const materialist=character({traits:['Materialist'],giftPreferences:{liked:[...premium.categories],disliked:[]}})
    expect(giftReactionOf(premium,materialist,false)).toBe('loved')
    expect(valueSuggestions(info,[{...premium,price:1}],1,materialist)[0].reaction).toBe('loved')
    expect(valueSuggestions(info,[{...premium,price:1}],0,materialist)).toEqual([])
    const cheap=item('test-cheap-materialist',50,[premium.categories[0]])
    expect(valueSuggestions(info,[cheap],100,materialist)).toEqual([])
  })
  it('agrees with the native verdict for the full catalog and never chooses a weaker affordable gift',()=>{
    for(const budget of [5,30,100,1000]){
      const result=valueSuggestions(info,all,budget,person)[0]
      const eligible=all.filter(i=>i.price<=budget&&['loved','liked'].includes(giftReactionOf(i,person,false)))
      if(!eligible.length){expect(result).toBeUndefined();continue}
      expect(result.reaction).toBe(giftReactionOf(result.item,person,false))
      expect(result.item.price).toBeLessThanOrEqual(budget)
      const best=eligible.filter(i=>giftReactionOf(i,person,false)===(eligible.some(i=>giftReactionOf(i,person,false)==='loved')?'loved':'liked'))
      expect(result.item.price).toBe(Math.min(...best.map(i=>i.price)))
    }
  })
})
