import { completeStructured } from '@vx/modkit/renderer'
import { create } from 'zustand'
import { sceneActiveOf, epilogueOf } from './textingLoop'
import { RECKONING_DUNGEONS,DUNGEON_MAX_REPLIES } from '../../shared/reckoningDungeons'
import type { ReckoningDungeon } from '../../shared/reckoningDungeonState'
import { dungeonConversationPrompt,dungeonInsightPrompt,parseDungeonText,withDungeonReply } from '@shared/dungeonConversation'
import { preparedReckoningThoughts } from './reckoning'
import { useGameStore } from './gameStore'
import { modIsOn } from './modsStore'
import { manualSaveOffer, writeReckoningChange } from './loop/saves'
import { unspokenNightAvailable } from './reckoningCalendar'

type Game=ReturnType<typeof useGameStore.getState>
const canLeave=(game:Game):boolean=>!!game.playthroughId&&!game.createdScene&&!game.replaying&&!game.busy&&!game.turnError&&manualSaveOffer()==='open'
export const useDungeonRequest=create(()=>({busy:false}))
let group:string|null=null
export function dungeonVisitAllowed(game:Game):boolean {
 return modIsOn('reckoning')&&modIsOn('breakthrough')&&!!game.playthroughId&&!game.createdScene&&!game.replaying&&!game.busy&&!game.turnError&&game.time===1&&!!game.exReckoning.dungeon&&manualSaveOffer()==='open'
}
/** Entry is travel: finish the summoning scene before using the nighttime map.
 * Kept separate from visit readiness so old, already-inside saves remain playable. */
export function dungeonEntryAllowed(game:Game):boolean {
 return dungeonVisitAllowed(game)&&unspokenNightAvailable(game)&&game.exReckoning.dungeon?.phase==='unlocked'
  &&(!game.exReckoning.dungeon?.needsSpirit||(game.exBreakthrough.meters[game.exReckoning.dungeon.charId]??0)>=100)
  &&!sceneActiveOf(game)&&game.awaitingInput&&!game.pendingLines.length&&!game.sceneEnding&&!epilogueOf(game)
}
export function dungeonVisible(game:Game):boolean { return !!game.exReckoning.dungeon&&game.exReckoning.dungeon.phase!=='unlocked'&&!game.createdScene&&!game.replaying }
export function dungeonFarewell(d:ReckoningDungeon,outcome:NonNullable<ReckoningDungeon['outcome']>):ReckoningDungeon {
 const text=dungeonOutcomeText(d,outcome)
 return {...d,phase:'farewell',outcome,lines:[{who:'narrator',text}],voice:outcome==='victory'?undefined:d.voice,farewellReplies:0}
}
// Keep the legacy phase name readable in existing saves; it is now an outcome, never a goodbye scene.
export function dungeonOutcomeText(d:ReckoningDungeon,outcome=d.outcome):string {
 return outcome==='victory'?`${d.context.name}'s Unheard Soul breaks into light. The voice falls quiet. The inner world is empty; you can open your eyes now.`:
  outcome==='expelled'?'Her voice recedes as your concentration slips. This attempt is over. Open your eyes and gather your strength before trying again.':
  outcome==='failed'?'The thought still holds its ground. This attempt is over, but the connection remains. Open your eyes and gather your strength.':'Open your eyes and return to the world around you.'
}
async function change(run:(d:ReckoningDungeon,current:()=>boolean,job:string)=>Promise<ReckoningDungeon|undefined>,leaving=false):Promise<void> {
 if(group)throw Error('Wait for the current reply.')
 const game=useGameStore.getState(),previous=game.exReckoning,d=previous.dungeon
 if(!d||!(leaving?canLeave(game):dungeonVisitAllowed(game)))throw Error('Follow her voice at night, when the game is ready.')
 const job=`dungeon-${crypto.randomUUID()}`;group=job;useDungeonRequest.setState({busy:true})
 const current=():boolean=>{const now=useGameStore.getState();return now.playthroughId===game.playthroughId&&now.loads===game.loads&&now.exReckoning===previous&&now.date===game.date&&now.time===game.time&&(leaving||modIsOn('reckoning')&&modIsOn('breakthrough'))}
 try{
  const dungeon=await run(d,current,job)
  if(!current())throw Error('The visit changed; that reply was not applied.')
  const {dungeon:_d,...base}=previous
  const charge=d.phase==='unlocked'&&d.needsSpirit&&dungeon?.phase==='inside'?100:0
  await writeReckoningChange({...base,active:dungeon&&!d.outcome?previous.active:null,...(dungeon?{dungeon}:{})},previous,charge,d.charId,undefined,current)
 }finally{if(group===job)group=null;useDungeonRequest.setState({busy:false})}
}
export async function enterReckoningDungeon():Promise<void> {
 return change(async d=>{
  if(d.phase!=='unlocked')throw Error('This visit has already begun.')
  if(d.needsSpirit&&(useGameStore.getState().exBreakthrough.meters[d.charId]??0)<100)throw Error('Rebuild 100 spirit with her before another attempt.')
  if(!dungeonEntryAllowed(useGameStore.getState()))throw Error('Finish the current scene, then enter from the map at night.')
  const place=RECKONING_DUNGEONS[d.aspect]
  return {...d,phase:'inside',needsSpirit:undefined,lines:[{who:'narrator',text:`You find somewhere quiet, close your eyes, and follow ${d.context.name}'s voice inward. The world around you falls away. The Unspoken Void takes shape around you. Before you lies ${place.name}, built from feelings she has never said aloud. Her Unheard Soul waits within it.`}],replies:0}
 })
}
function beforeQuestions(d:ReckoningDungeon):void {
 if(d.phase==='farewell')throw Error('This encounter is over. Open your eyes.')
 if(d.phase!=='inside'||useGameStore.getState().exReckoning.active)throw Error('Finish the current questions first.')
}
function withQuestions(d:ReckoningDungeon):ReckoningDungeon {
 // Capture an already-prepared opening, without starting or regenerating the questions.
 const thoughts=d.thoughts??preparedReckoningThoughts(d.charId)
 return thoughts?{...d,thoughts}:d
}
export async function openDungeonConversation():Promise<void> {
 const existing=useGameStore.getState().exReckoning.dungeon
 if(existing){beforeQuestions(existing);if(existing.lines.some(l=>l.who==='reflection'))return}
 return change(async(d,current,job)=>{
  beforeQuestions(d)
  const context=withQuestions(d),result=await completeStructured<unknown>('reckoning', dungeonConversationPrompt(context), { group: job })
  if(!current())throw Error('The visit changed.')
  if(!result.ok)throw Error(result.error.message)
  return withDungeonReply(context,parseDungeonText(result.data,context,'reply'))
 })
}
export async function talkInReckoningDungeon(reply:string):Promise<void> {
 if(!reply.trim()||reply.length>1500)throw Error('Use 1–1,500 characters.')
 return change(async(d,current,job)=>{
  beforeQuestions(d)
  // The fourth reply ends the visit locally, without another paid request.
  if(d.replies>=DUNGEON_MAX_REPLIES-1)return dungeonFarewell({...d,replies:DUNGEON_MAX_REPLIES},'expelled')
  const context=withQuestions(d),result=await completeStructured<unknown>('reckoning', dungeonConversationPrompt(context,reply.trim()), { group: job })
  if(!current())throw Error('The visit changed.')
  if(!result.ok)throw Error(result.error.message)
  const text=parseDungeonText(result.data,context,'reply')
  return withDungeonReply({...context,lines:[...context.lines,{who:'reader',text:reply.trim()}],replies:d.replies+1},text)
 })
}
export async function useDungeonInsight():Promise<void> {
 return change(async(d,current,job)=>{
  beforeQuestions(d)
  const aspect=useGameStore.getState().exEcho.player?.aspect
  if(!modIsOn('echo')||!aspect)throw Error('Enable Echoes and choose your Echo first.')
  if(d.insight)throw Error('You have already used your aspect hint for this connection.')
  const context=withQuestions(d),result=await completeStructured<unknown>('reckoning', dungeonInsightPrompt(context,aspect), { group: job })
  if(!current()||!modIsOn('echo')||useGameStore.getState().exEcho.player?.aspect!==aspect)throw Error('Your Echo or visit changed; the hint was not used.')
  if(!result.ok)throw Error(result.error.message)
  return {...context,insight:{aspect,text:parseDungeonText(result.data,context,'hint')}}
 })
}
export async function leaveReckoningDungeon():Promise<void> {
 return change(async d=>d.outcome==='victory'?undefined:{...d,phase:'unlocked',outcome:undefined,lines:[],whispers:undefined,replies:0,farewellReplies:0,...(d.outcome?{needsSpirit:true}:{})},true)
}
