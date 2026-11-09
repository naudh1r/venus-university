import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buyTalent, normalizeTalents, seedTalents, setTalentRules, talentBalance, talentEffect, TALENTS, TALENT_TREES } from '@shared/campusTalents'
import { abilityRank, completeSilverLining, silverLiningReady, TALENT_ABILITIES as A } from '@shared/talentAbilities'
import { abilityUsedThisWeek, normalizeTalentAbilities } from '@shared/talentAbilityState'
import { talentHeartBonus, talentStatGains } from '@shared/talentPerks'
import { resolveStatDeltas, type StatContext } from '@shared/playerStats'
import { carryModFields } from '@shared/modCarry'
import type { GameSave, SceneLine } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { applyTalentChoice } from '../src/renderer/stores/talentActions'
import { replyRowOfferOf } from '../src/renderer/stores/loop/playback'
import { afterSceneReply, promptLines } from '../src/renderer/mods/hooks'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writeTalentChange, writesSettled } from '../src/renderer/stores/loop/saves'
import type { PromptState } from '../src/renderer/prompts/scenePrompt'
import '../src/renderer/modEntries/campus-talents'
import { character, charInfo, sceneLines, stubApi, restoreApi } from './fixtures'

const state = (ranks: Record<string, number> = {}) => normalizeTalents({initialized:true,earned:2000,seed:2000,spent:0,ranks})
const game = () => useGameStore.getState()
const context = (patch: Partial<StatContext> = {}): StatContext => ({solo:true,classScene:false,classOutcome:null,jobOutcome:null,...patch})
beforeEach(() => {
  game().reset();resetLoopState()
  useModsStore.setState({switches:{on:{'campus-talents':true},options:{}}})
  useGameStore.setState({playthroughId:'heart-charm-test',date:7,time:0,awaitingInput:true,chars:['a'],cast:['a'],
    characters:{a:character({charId:'a'})},charInfo:{a:charInfo({nameKnown:true})},
    currentSceneTranscript:sceneLines('An awkward conversation.'),exTalents:state({[A.silverLining]:1})})
  stubApi({saves:{autosave:async (_id,draft)=>({ok:true,data:{...draft,playthroughId:'heart-charm-test',saveId:'autosave',saveDate:0}})}})
})
afterEach(async()=>{await writesSettled();restoreApi();setTalentRules()})

describe('Charm and Heart ownership',()=>{
  it('keeps old affection purchases and Anticipation intact under Charm without granting new Heart skills',()=>{
    const old=normalizeTalents({...state({'heart.warmth':3,'heart.spark':3,[A.farewell]:1}),spent:390,abilities:{uses:{[A.farewell]:{term:0,week:1}},anticipation:{a:{term:0,date:6,time:0}}}})
    const restored=normalizeTalents(JSON.parse(JSON.stringify(old)))
    expect(restored).toEqual(old)
    expect(seedTalents(restored,9999,0,7)).toEqual(old)
    expect(TALENTS.find(d=>d.id===A.farewell)?.tree).toBe('charm')
    expect(TALENTS.find(d=>d.id==='heart.warmth')?.tree).toBe('charm')
    expect(talentHeartBonus(restored,{type:'loved',desc:'New',date:7},'scene',false)).toBe(1.3)
    expect(abilityRank(restored,A.farewell)).toBe(1)
    expect(abilityRank(restored,A.silverLining)).toBe(0)
    expect(abilityUsedThisWeek(restored.abilities,A.farewell,0,7)).toBe(true)
    expect(TALENT_TREES).toHaveLength(6);expect(TALENTS).toHaveLength(43)
    for(const tree of TALENT_TREES) {
      expect(TALENTS.filter(d=>d.tree===tree.id&&!d.shared)).toHaveLength(7)
      expect(TALENTS.filter(d=>d.tree===tree.id&&d.capstone)).toHaveLength(1)
    }
  })
  it('requires a fully learned second-row Heart skill, never a Charm prerequisite',()=>{
    for(const ranks of [{[A.farewell]:1,'heart.spark':3},{'heart.confidence':2},{'heart.ease':1}] as Record<string,number>[])
      expect(()=>buyTalent(state(ranks),A.silverLining,()=>true)).toThrow('second-row')
    for(const ranks of [{'heart.ease':2},{'heart.work':1},{'heart.feet':1}] as Record<string,number>[]) {
      const bought=buyTalent(state(ranks),A.silverLining,()=>true)
      expect(bought.spent).toBe(70);expect(abilityRank(bought,A.silverLining)).toBe(1)
    }
  })
})

describe('Heart stat gains',()=>{
  const skills={'heart.confidence':2,'heart.ease':2,'heart.class':1,'heart.work':1,'heart.pride':2,'heart.feet':1}
  const gain=(ctx:StatContext,heart=0,ledger:{brain?:boolean;heart?:boolean}|undefined={heart:true})=>talentStatGains(state(skills),resolveStatDeltas(ledger,ctx),ctx,false,heart)
  it('adds the applicable training bonus for solo, social, class and shift activities',()=>{
    expect(gain(context()).deltas.heart).toBe(4)
    expect(gain(context({solo:false})).deltas.heart).toBe(3)
    expect(gain(context({solo:false,classScene:true,classOutcome:{stat:'heart',attended:true}})).deltas.heart).toBe(2)
    expect(gain(context({jobOutcome:{gain:{stats:['heart'],text:'Shift'}}})).deltas.heart).toBe(2)
  })
  it('adds recovery only below zero and does not reset a challenge starting value',()=>{
    expect(gain(context(),-60).deltas.heart).toBe(5)
    expect(gain(context({solo:false}),-30).deltas.heart).toBe(4)
    expect(gain(context(),0).deltas.heart).toBe(4)
    expect(gain(context(),NaN).deltas.heart).toBe(4)
  })
  it('preserves the native stat choice, missed classes, unrelated jobs and zero awards',()=>{
    expect(gain(context({solo:false}),-60,{brain:true,heart:true}).deltas).toEqual({brain:1,body:0,heart:0})
    expect(gain(context(),-60,{}).deltas.heart).toBe(0)
    expect(gain(context({solo:false,classScene:true,classOutcome:{stat:'heart',attended:false}}),-60,{}).deltas.heart).toBe(0)
    expect(gain(context({jobOutcome:{gain:{stats:['body'],text:'Shift'}}}),-60).deltas.heart).toBe(0)
  })
  it('never adds a grade bonus and keeps grade confidence separate from training',()=>{
    expect(gain(context({gradeOutcome:{heart:2,lines:[]}}),-60,{}).deltas.heart).toBe(2)
    expect(gain(context({gradeOutcome:{heart:-2,lines:[]}}),-60,{}).deltas.heart).toBe(-2)
    expect(gain(context({gradeOutcome:{heart:2,lines:[]}}),0).deltas.heart).toBe(6)
    // Actual Heart practice still earns its bonus even when a grade makes the net delta negative.
    expect(gain(context({gradeOutcome:{heart:-5,lines:[]}}),0).deltas.heart).toBe(-1)
    expect(gain(context({jobOutcome:{gain:{stats:['heart'],text:'Shift'}},gradeOutcome:{heart:2,lines:[]}}),0).deltas.heart).toBe(2)
  })
  it('gives no extra points while sick or disabled and does not mutate native results',()=>{
    const ctx=context({gradeOutcome:{heart:2,lines:[]}}),native=resolveStatDeltas({heart:true},ctx),copy=structuredClone(native)
    talentStatGains(state(skills),native,ctx,false,-60);expect(native).toEqual(copy)
    expect(gain({...ctx,sick:true},-60).deltas.heart).toBe(2)
    setTalentRules(false)
    expect(talentStatGains(state(skills),native,ctx,false,-60)).toBe(native)
  })
})

describe('Finding Your Feet single rank',()=>{
  it('costs 40 BP once, grants +1 recovery and fully qualifies for Silver Lining',()=>{
    const before=state({'heart.pride':1})
    const bought=buyTalent(before,'heart.feet',()=>true)
    expect(before.ranks['heart.feet']).toBeUndefined()
    expect(bought.spent-before.spent).toBe(40)
    expect(talentEffect(bought,'heart.recovery')).toBe(1)
    expect(()=>buyTalent(bought,'heart.feet',()=>true)).toThrow('fully learned')
    expect(buyTalent(bought,A.silverLining,()=>true).ranks[A.silverLining]).toBe(1)
    expect(()=>buyTalent(state(),'heart.feet',()=>true)).toThrow('preceding skill')
  })
  it('keeps older rank-I purchases without charging the new price',()=>{
    const old={...state({'heart.pride':1,'heart.feet':1}),spent:45}
    const restored=normalizeTalents(JSON.parse(JSON.stringify(old)))
    expect(restored).toEqual(old)
    expect(talentEffect(restored,'heart.recovery')).toBe(1)
    expect(buyTalent(restored,A.silverLining,()=>true).spent).toBe(115)
  })
  it('converts old rank II and refunds the 65-to-40 BP difference exactly once',()=>{
    const old={...state({'heart.pride':1,'heart.warmth':1}),spent:100,ranks:{'heart.pride':1,'heart.warmth':1,'heart.feet':2},showUpDay:{term:0,date:7}}
    const restored=normalizeTalents(JSON.parse(JSON.stringify(old)))
    expect(restored.ranks).toEqual({...old.ranks,'heart.feet':1})
    expect(restored.spent).toBe(75);expect(restored.earned).toBe(old.earned)
    expect(talentBalance(restored)).toBe(talentBalance(old)+25)
    expect(talentEffect(restored,'heart.recovery')).toBe(1)
    expect(restored.showUpDay).toEqual(old.showUpDay)
    expect(normalizeTalents(JSON.parse(JSON.stringify(restored)))).toEqual(restored)
    expect(seedTalents(restored,99999,0,7)).toEqual(restored)
    expect(normalizeTalents({...old,earned:50}).ranks).toEqual({})
  })
})

describe('Silver Lining scene action',()=>{
  const prepare=()=>applyTalentChoice(game(),game().exTalents,{ability:'silver-lining',charId:'a'})
  const reply=(s=game().exTalents):SceneLine[]=>[...game().currentSceneTranscript,{speaker:'reader',text:s.abilities.silverLining!.action},...sceneLines('She relaxes and offers a compromise.')]
  it('uses the native reply row on a finished last line without requiring another advance',async()=>{
    const transcript=game().currentSceneTranscript
    useGameStore.setState({awaitingInput:false,currentLine:transcript.at(-1)!,sceneLog:transcript})
    expect(replyRowOfferOf(game())).toBe('open')
    await writeTalentChange({ability:'silver-lining',charId:'a'})
    const prepared=game().exTalents
    expect(prepared.abilities.silverLining?.at).toBe(transcript.length)
    expect(prepared.abilities.uses).toEqual({})
    expect(game().currentSceneTranscript).toEqual(transcript)
    useGameStore.setState({currentSceneTranscript:reply(prepared)})
    afterSceneReply({reply:{},cast:[game().characters.a],solo:false,ending:false})
    expect(abilityUsedThisWeek(game().exTalents.abilities,A.silverLining,0,7)).toBe(true)
  })
  it('saves preparation without spending a use and charges only after the matching successful reply',async()=>{
    await writeTalentChange({ability:'silver-lining',charId:'a'})
    const prepared=game().exTalents
    expect(normalizeTalents(JSON.parse(JSON.stringify(prepared)))).toEqual(prepared)
    expect(abilityUsedThisWeek(prepared.abilities,A.silverLining,0,7)).toBe(false)
    useGameStore.setState({currentSceneTranscript:reply()})
    afterSceneReply({reply:{},cast:[game().characters.a],solo:false,ending:false})
    const completed=game().exTalents
    expect(completed.abilities.silverLining).toBeUndefined()
    expect(abilityUsedThisWeek(completed.abilities,A.silverLining,0,7)).toBe(true)
    expect(completeSilverLining(completed,game().currentSceneTranscript,0,7,0)).toBe(completed)
    expect(()=>applyTalentChoice(game(),completed,{ability:'silver-lining',charId:'a'})).toThrow('week')
    expect(abilityUsedThisWeek(completed.abilities,A.silverLining,0,14)).toBe(false)
    expect(abilityUsedThisWeek(completed.abilities,A.silverLining,1,7)).toBe(false)
  })
  it('does not spend a use for cancellation, a failed save or an unrelated response',async()=>{
    const prepared=prepare()
    expect(applyTalentChoice(game(),prepared,{ability:'cancel-silver-lining'}).abilities).toEqual({uses:{},anticipation:{}})
    stubApi({saves:{autosave:async()=>({ok:false,error:{code:'SAVE_WRITE_FAILED',message:'Disk full'}})}})
    const before=game().exTalents
    await expect(writeTalentChange({ability:'silver-lining',charId:'a'})).rejects.toThrow('Disk full')
    expect(game().exTalents).toBe(before)
    const changed=[...reply(prepared),{speaker:'reader',text:'Never mind.'},...sceneLines('A different response.')]
    expect(completeSilverLining(prepared,changed,0,7,0).abilities.uses).toEqual({})
    expect(completeSilverLining(prepared,reply(prepared),0,8,0).abilities.uses).toEqual({})
    expect(completeSilverLining(prepared,[...game().currentSceneTranscript,{speaker:'reader',text:prepared.abilities.silverLining!.action}],0,7,0).abilities.uses).toEqual({})
  })
  it('injects recovery only for its saved action, target and slot, with no follow-up leak',()=>{
    const prepared=prepare();useGameStore.setState({exTalents:prepared})
    const query=prepared.abilities.silverLining!.action
    useGameStore.setState({currentSceneTranscript:[...game().currentSceneTranscript,{speaker:'reader',text:query}]})
    const lines=(q=query,cast=[game().characters.a])=>promptLines('scene',{query:q,cast,state:{} as PromptState}).join('\n')
    expect(lines()).toContain('SILVER LINING')
    expect(lines()).toContain('Do not mention skill names')
    expect(lines('Another action')).not.toContain('SILVER LINING')
    expect(lines(query,[])).not.toContain('SILVER LINING')
    const prior=game().currentSceneTranscript
    useGameStore.setState({currentSceneTranscript:[...prior,{speaker:'reader',text:'Something else'}]})
    expect(lines()).not.toContain('SILVER LINING')
    useGameStore.setState({currentSceneTranscript:prior})
    useGameStore.setState({exTalents:completeSilverLining(prepared,reply(prepared),0,7,0)})
    expect(lines()).not.toContain('SILVER LINING')
  })
  it('rejects unavailable, unread, absent-target, replay, creator and classroom actions',()=>{
    const original=game()
    for(const patch of [{pendingLines:sceneLines('Unread')},{departed:['a']},{cast:[]},{replaying:{}},{createdScene:{}},{sceneClass:'ART'},{busy:true},{streaming:true},{waitingForLine:true},{sceneEnding:true},{statusShown:true},{turnError:'Failed'}]) {
      useGameStore.setState({...original,...patch} as Partial<typeof original>)
      expect(()=>prepare()).toThrow()
    }
    useGameStore.setState(original);setTalentRules(false)
    expect(()=>prepare()).toThrow('Learn Silver Lining')
  })
  it('discards stale preparations at semester carry and sanitizes imported ability data',()=>{
    const prepared=prepare()
    useGameStore.setState({exTalents:prepared})
    const save={...game().toGameSave(),saveId:'auto',saveDate:0,playthroughId:'heart-charm-test'} as GameSave
    expect(carryModFields(save,{term:0,back:140,characters:{}}).exTalents!.abilities.silverLining).toBeUndefined()
    expect(normalizeTalentAbilities({silverLining:{...prepared.abilities.silverLining,action:'x'.repeat(1001)}}).silverLining).toBeUndefined()
    expect(silverLiningReady(prepared,0,7,1)).toBe(false)
    setTalentRules(false)
    expect(completeSilverLining(prepared,reply(prepared),0,7,0).abilities.uses).toEqual({})
  })
})
