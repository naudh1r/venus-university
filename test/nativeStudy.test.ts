import {beforeEach,describe,expect,it,vi} from 'vitest'
const state=vi.hoisted(()=>({field:null as any,game:{} as any,values:{} as Record<string,unknown>,run:0}))
vi.mock('@vx/modkit/renderer',async()=>({
 saveField:(await import('../packages/modkit/src/renderer/saveField')).saveField,
 sceneField:()=>({read:()=>state.field,set:(v:unknown)=>{state.field=v}}),
 clock:()=>state.game,currentRun:()=>state.run,runStale:(run:number)=>run!==state.run
}))
import {bindSaveFieldStore,readModSlices,writeModSlices} from '../packages/modkit/src/renderer/saveField'
import {filterSceneLedger,registerHooks,setHookRules} from '../packages/modkit/src/renderer/hooks'
import {mergeLedgerReplies} from '../src/renderer/prompts/textLedgerPrompt'
import {declinedThisSlot,studyHooks,studyInstructions} from '../src/renderer/studyRoom/nativeStudy'
beforeEach(()=>{
 state.field=null;state.values={};state.run++;state.game={date:5,time:1}
 bindSaveFieldStore({values:()=>state.values,set:(id,value)=>{state.values={...state.values,[id]:value}},subscribe:()=>()=>{}})
})
const session=()=>({partner:'girl',topic:'Drawing perspective',document:{name:'notes.txt',sections:['First section','Selected section']},section:1,beforeInfo:{memories:[{type:'loved',desc:'before studying'}],flags:{gaveContactInfo:true}},beforeStats:{brain:1,body:2,heart:3},declined:false})
describe('native study scene rules',()=>{
 it('lets the current document replace the original study topic',()=>{
  const lines=studyHooks.prompts!.scene!.lines!({state:{ex:{'study-room':session(),'scene-notes':{document:{name:'new.md',text:'New subject.'}}}}} as any) as string[]
  expect(lines.join(' ')).toContain('Work only from the current reference document')
  expect(lines.join(' ')).not.toContain('Drawing perspective')
 })
 it('does not affect another scene and keeps other mods schema additions',()=>{
  const req={user:'scene',schema:{name:'scene',schema:{properties:{lines:{},other_mod:{}},required:['lines','other_mod']}}} as any
  expect(studyHooks.requests!.scene!(req,{state:{ex:{}}} as any)).toBe(req)
  state.field=session()
  const extended=studyHooks.requests!.scene!(req,{state:{ex:{'study-room':state.field}}} as any)
  expect(extended.schema.schema.properties).toMatchObject({other_mod:{},study_boundary_exit:{type:'boolean'},end_scene:{type:'boolean'}})
  expect(extended.schema.schema.required).toEqual(['lines','other_mod','study_boundary_exit'])
  expect(studyInstructions(state.field).join(' ')).toContain('Drawing perspective')
  expect(studyInstructions(state.field).join(' ')).not.toContain('REFERENCE NOTES')
 })
 it('suppresses study gains at their source without restoring player or partner snapshots',()=>{
  state.field=session()
  const keep=studyHooks.keepSceneLedgerEntry!
  expect(keep({kind:'memory',value:{charKey:'test',type:'loved',desc:'study reward'}})).toBe(false)
  expect(keep({kind:'event',value:{charKey:'test',event:'became_lovers'}})).toBe(false)
  expect(keep({kind:'event',value:{charKey:'test',event:'friendzoned_reader'}})).toBe(true)
  expect(keep({kind:'memory',value:{charKey:'test',type:'disliked',desc:'ignored a boundary'}})).toBe(true)
  const deltas={deltas:{brain:3,body:2,heart:1},lines:[]}
  expect(studyHooks.settleSceneStats!(deltas,{} as any).deltas).toEqual({brain:0,body:0,heart:0})
  expect(studyHooks).not.toHaveProperty('slotSettled')
  state.field=null
  expect(keep({kind:'memory',value:{charKey:'test',type:'loved',desc:'ordinary encounter'}})).toBe(true)
  expect(studyHooks.settleSceneStats!(deltas,{} as any)).toBe(deltas)
 })
 it('retains a separate message and relationship event for the same participant during a study slot',()=>{
  registerHooks('study-room',{keepSceneLedgerEntry:studyHooks.keepSceneLedgerEntry})
  setHookRules({isOn:id=>id==='study-room',order:()=>0})
  state.field=session()
  const memory={charKey:'test',type:'loved' as const,desc:'helpful message'}
  const event={charKey:'test',event:'unblocked' as const}
  const scene={memories:[{...memory,desc:'study reward'}],events:[event]}
  const settled=mergeLedgerReplies(filterSceneLedger(scene),{textMemories:[memory],events:[event]})
  expect(settled.memories).toEqual([])
  expect(settled.textMemories).toEqual([memory])
  expect(settled.events).toEqual([event])
  expect(scene.memories).toHaveLength(1)
  state.field=null
  expect(filterSceneLedger(scene)).toEqual(scene)
 })
 it('keeps a refusal with its own save, even when both saves are in the same time slot',()=>{
  const earlier = {ex:writeModSlices({},state.values)}
  state.field=session();studyHooks.afterSceneReply!({reply:{study_boundary_exit:false}} as any)
  expect(declinedThisSlot('girl')).toBe(false)
  studyHooks.afterSceneReply!({reply:{study_boundary_exit:true}} as any)
  expect(state.field.declined).toBe(true)
  const later = {ex:writeModSlices({},state.values)}
  state.values=readModSlices(earlier,(_,err)=>{throw err}).values
  expect(declinedThisSlot('girl')).toBe(false)
  state.values=readModSlices(later,(_,err)=>{throw err}).values
  expect(declinedThisSlot('girl')).toBe(true)
  expect(declinedThisSlot('other')).toBe(false)
  state.game.time++
  expect(declinedThisSlot('girl')).toBe(false)
 })
 it('recovers a legacy refusal only from the study scene restored with that save',async()=>{
  studyHooks.gameEntered!()
  state.field={...session(),declined:true}
  await Promise.resolve()
  expect(declinedThisSlot('girl')).toBe(true)
  state.values={};state.field=null;state.run++
  studyHooks.gameEntered!()
  await Promise.resolve()
  expect(declinedThisSlot('girl')).toBe(false)
 })
})
