import { completeStructured, cancelCalls } from '@vx/modkit/renderer'
import { CHARACTER_DYNAMICS_MOD, dynamicFor, type GrowthTag } from '@shared/characterDynamics'
import { anchorReckoning, applyReckoningVerdict, hasReckoningAffection, parseReckoningThoughts, parseReckoningVerdict, RECKONING_AFFECTION_MIN, RECKONING_MOD, type ReckoningContext, type ReckoningSession } from '../../shared/reckoning'
import { optionOn } from '@vx/modkit/shared'
import { create } from 'zustand'
import { profileAspect } from '@shared/echo'
import { fullNameOf } from '@shared/types'
import { charKeyOf } from '@vx/modkit/shared'
import { beginUnspokenVoice, advanceUnspokenVoice, aftermathReady, unspokenLinkBeat } from '@shared/unspokenVoice'
import { reckoningPrefix, reckoningAftermaths, withReckoningAftermaths } from '../../shared/reckoning'
import { beginReckoningPrompt, answerReckoningPrompt, reckoningContext } from '../prompts/reckoningPrompt'
import { useGameStore } from './gameStore'
import { modIsOn, useModsStore } from './modsStore'
import { useSettingsStore } from './settingsStore'
import { breakthroughCast, canSpendBreakthrough } from './breakthrough'
import { writeReckoningChange } from './loop/saves'
import { loopState } from './loop/state'
import { dungeonFarewell, dungeonVisitAllowed, useDungeonRequest } from './reckoningDungeon'
import { LINK_GLITCH_MS, useReckoningLinkEffect } from './reckoningLinkEffect'
import { unspokenNightAvailable } from './reckoningCalendar'
type Game=ReturnType<typeof useGameStore.getState>
let flight:{group:string;cancelled:boolean;committing:boolean}|null=null
export function canStartReckoning(game:Game,id:string):boolean {
  const d=game.exReckoning.dungeon
  return !!d&&d.charId===id&&d.phase==='inside'&&dungeonVisitAllowed(game)&&!game.exReckoning.active&&!useDungeonRequest.getState().busy
}
export function canUnlockReckoning(game:Game,id:string):boolean {
  return !game.exReckoning.dungeon&&game.awaitingInput&&!game.pendingLines.length&&canKeepOpening(game,id)&&canSpendBreakthrough(game,id,100)
}
/** Keep a prepared opening through rereading and temporarily closed reply controls. */
function canKeepOpening(game:Game,id:string):boolean {
  const d=game.exReckoning.dungeon
  if(!unspokenNightAvailable(game,!d))return false
  if(d)return d.charId===id&&d.phase!=='farewell'&&!game.exReckoning.active&&modIsOn(RECKONING_MOD)&&modIsOn('breakthrough')&&!!game.playthroughId&&!game.createdScene&&!game.replaying
  return modIsOn(RECKONING_MOD)&&modIsOn('breakthrough')&&!!game.playthroughId&&!game.createdScene&&!game.replaying&&
    !game.exBreakthrough.pending&&(game.exBreakthrough.meters[id]??0)>=100&&breakthroughCast(game).includes(id)&&
    !game.exReckoning.active&&
    !dynamicFor(game.exCharacterDynamics,id).growth&&hasReckoningAffection(game.charInfo[id],game.date,game.characters[id])
}

export const RECKONING_PREPARE_OPTION='prepare-questions'
type Opening={key:string;handoffKey?:string;charId:string;context:ReckoningContext;status:'queued'|'preparing'|'ready'|'error';
  thoughts?:ReckoningSession['thoughts'];error?:string;group:string;cancelled:boolean;promise?:Promise<void>}
const openings=new Map<string,Opening>()
let preparing:Opening|null=null,prepareTimer:ReturnType<typeof setTimeout>|undefined,watchers=0
/** Readiness is transient; no generated question or failed request is written before activation. */
export const useReckoningPreparation=create(()=>({revision:0}))
const changed=():void=>{useReckoningPreparation.setState(s=>({revision:s.revision+1}))}
const preparationOn=():boolean=>optionOn(useModsStore.getState().switches,RECKONING_MOD,RECKONING_PREPARE_OPTION)
function openingContext(game:Game,id:string):ReckoningContext {
  if(game.exReckoning.dungeon?.charId===id)return game.exReckoning.dungeon.context
  const dynamics=modIsOn(CHARACTER_DYNAMICS_MOD,{mods:[...game.playthroughMods]})?game.exCharacterDynamics:undefined
  return reckoningContext(game.characters[id],game.charInfo[id],`${game.playerFirstName} ${game.playerLastName}`.trim(),dynamics,game.currentSceneTranscript)
}
function openingKey(game:Game,id:string,context:ReckoningContext):string {
  const s=useSettingsStore.getState().settings
  if(game.exReckoning.dungeon)return JSON.stringify([game.playthroughId,game.loads,game.exReckoning.dungeon.id,id,context,s&&[s.apiProvider,s.apiModel,s.thinkingLevel,s.endpointUrl,s.endpointModel,s.endpointSecondaryModel,s.reasoningEffort,s.maxOutputTokens,s.apiKeySet,s.endpointApiKeySet]])
  return JSON.stringify([game.playthroughId,game.loads,game.date,game.time,id,context,game.currentSceneTranscript,
    s&&[s.apiProvider,s.apiModel,s.thinkingLevel,s.endpointUrl,s.endpointModel,s.endpointSecondaryModel,s.reasoningEffort,s.maxOutputTokens,s.apiKeySet,s.endpointApiKeySet]])
}
function canPrepareOpening(game:Game,id:string):boolean {
  return canStartReckoning(game,id)||canUnlockReckoning(game,id)||!!game.exReckoning.dungeon&&canKeepOpening(game,id)&&!game.busy&&!game.turnError&&!useDungeonRequest.getState().busy
}
function validOpening(opening:Opening):boolean {
  const game=useGameStore.getState()
  return !opening.cancelled&&preparationOn()&&canKeepOpening(game,opening.charId)&&
    [opening.key,opening.handoffKey].includes(openingKey(game,opening.charId,openingContext(game,opening.charId)))
}
export function reckoningPreparationStatus(game:Game,id:string):{status:Opening['status']|'idle';error?:string} {
  const opening=openings.get(id)
  if(!opening||!canKeepOpening(game,id)||!preparationOn()||![opening.key,opening.handoffKey].includes(openingKey(game,id,openingContext(game,id))))return {status:'idle'}
  return {status:opening.status,error:opening.error}
}
/** Read an already prepared opening for private whispers; never starts a request. */
export function preparedReckoningThoughts(id:string):ReckoningSession['thoughts']|undefined {
  const opening=openings.get(id)
  return opening?.status==='ready'&&validOpening(opening)?opening.thoughts:undefined
}
function discardOpening(opening:Opening):void {
  opening.cancelled=true
  if(openings.get(opening.charId)===opening)openings.delete(opening.charId)
  if(opening.status==='preparing')void cancelCalls(RECKONING_MOD, opening.group).catch(()=>{})
}
function schedulePreparation():void {
  if(!watchers||preparing||prepareTimer||flight)return
  if(![...openings.values()].some(o=>o.status==='queued'&&canPrepareOpening(useGameStore.getState(),o.charId)))return
  // Briefly settle scene/state changes, including StrictMode's mount rehearsal, before a paid call.
  prepareTimer=setTimeout(()=>{prepareTimer=undefined;void runPreparation()},600)
}
async function runPreparation():Promise<void> {
  if(!watchers||preparing||flight)return
  const opening=[...openings.values()].find(o=>o.status==='queued'&&validOpening(o)&&canPrepareOpening(useGameStore.getState(),o.charId))
  if(!opening)return
  preparing=opening;opening.status='preparing';changed()
  opening.promise=(async()=>{
    try {
      const result=await completeStructured<unknown>(RECKONING_MOD, beginReckoningPrompt(opening.context), { group: opening.group })
      if(!validOpening(opening))return
      if(!result.ok)throw Error(result.error.message)
      opening.thoughts=parseReckoningThoughts(result.data,opening.context,true)
      opening.status='ready'
    }catch(error){
      if(validOpening(opening)){
        opening.status='error'
        opening.error=error instanceof Error?error.message:'Her thoughts could not be prepared.'
      }
    }finally{
      if(preparing===opening)preparing=null
      changed();schedulePreparation()
    }
  })()
  await opening.promise
}
function syncPreparation():void {
  if(!watchers)return
  let edited=false
  for(const opening of openings.values())if(!validOpening(opening)){discardOpening(opening);edited=true}
  const game=useGameStore.getState()
  if(preparationOn()&&!flight)for(const id of game.exReckoning.dungeon?[game.exReckoning.dungeon.charId]:breakthroughCast(game)){
    if(game.exReckoning.dungeon?.thoughts||openings.has(id)||!canPrepareOpening(game,id))continue
    const context=openingContext(game,id)
    openings.set(id,{key:openingKey(game,id,context),charId:id,context,status:'queued',cancelled:false,group:`reckoning-prepare-${crypto.randomUUID()}`})
    edited=true
  }
  if(edited)changed()
  schedulePreparation()
}
/** Mounted by the game, independent of the collapsed Breakthrough panel or selected girl. */
export function watchReckoningPreparation():()=>void {
  watchers++
  const unsubscribers=[useGameStore.subscribe(syncPreparation),useModsStore.subscribe(syncPreparation),useSettingsStore.subscribe(syncPreparation),useDungeonRequest.subscribe(syncPreparation)]
  syncPreparation()
  return()=>{
    for(const unsubscribe of unsubscribers)unsubscribe()
    watchers--
    if(watchers)return
    if(prepareTimer)clearTimeout(prepareTimer)
    prepareTimer=undefined
    for(const opening of openings.values())discardOpening(opening)
    changed()
  }
}
/** A failed preparation is sticky for this context; only an explicit retry makes another call. */
export function retryReckoningPreparation(id:string):void {
  const opening=openings.get(id)
  if(opening?.status!=='error'||!(canStartReckoning(useGameStore.getState(),id)||canUnlockReckoning(useGameStore.getState(),id)))return
  discardOpening(opening);syncPreparation()
}
export function canResumeReckoning(game:Game,id:string):boolean {
  return dungeonVisitAllowed(game)&&game.exReckoning.dungeon?.phase==='inside'&&game.exReckoning.dungeon.charId===id&&game.exReckoning.active?.charId===id&&!useDungeonRequest.getState().busy
}
/** Older local saves have already paid for an encounter but have no doorway yet. */
export async function moveLegacyReckoningToDungeon():Promise<void> {
 return operation(async(_group,current,commit)=>{
  const game=useGameStore.getState(),session=game.exReckoning.active
  if(!session||game.exReckoning.dungeon||game.time!==1||game.busy||game.createdScene||game.replaying)throw Error('Continue this saved encounter in The Unspoken at night.')
  const girl=game.characters[session.charId]
  if(!girl)throw Error('This character is unavailable.')
  const aspect=game.exEcho.girls[session.charId]?.aspect??profileAspect(fullNameOf(girl),[{label:'personality',text:girl.personality,weight:3},{label:'backstory',text:girl.backstory,weight:2}]).aspect
  commit()
  await writeReckoningChange({...game.exReckoning,dungeon:{id:session.id,charId:session.charId,aspect,unlockedByReckoning:true,phase:'inside',context:session.context,replies:0,farewellReplies:0,lines:[{who:'narrator',text:'You settle somewhere quiet and follow her voice inward. Your unfinished encounter is still waiting in The Unspoken.'}]}},game.exReckoning,0,session.charId,undefined,current)
 })
}
/** A saved closing beat waits for a later ordinary scene with her, never the inner world. */
export function pendingReckoningAftermath(game:Game) {
 if(!modIsOn(RECKONING_MOD)||!game.awaitingInput||game.busy)return undefined
 return reckoningAftermaths(game.exReckoning).find(after=>canSpendBreakthrough(game,after.charId,0)&&
  aftermathReady({...game.exReckoning,aftermath:after},game.date,game.time,game.currentSceneTranscript)&&dynamicFor(game.exCharacterDynamics,after.charId).growth?.id===after.id)
}
export function canContinueReckoning(game:Game):boolean { return !!pendingReckoningAftermath(game) }
export function finishReckoningAftermath(token?:string):void {
  if(!token)return
  const game=useGameStore.getState()
  if(!reckoningAftermaths(game.exReckoning).some(a=>a.id===token))return
  const state=withReckoningAftermaths(game.exReckoning,reckoningAftermaths(game.exReckoning).filter(a=>a.id!==token))
  if(loopState.statusBase)loopState.statusBase={...loopState.statusBase,exReckoning:state}
  useGameStore.setState({exReckoning:state})
}
/** An in-flight disk commit finishes before the panel may close. */
export function cancelReckoningRequest():boolean {
  if(flight?.committing)return false
  if(flight){flight.cancelled=true;void cancelCalls(RECKONING_MOD, flight.group)}
  return true
}
async function operation<T>(run:(group:string,current:()=>boolean,commit:()=>void)=>Promise<T>):Promise<T> {
  if(flight)throw Error('An inner-world request is already in progress.')
  const game=useGameStore.getState(),job={group:`reckoning-${crypto.randomUUID()}`,cancelled:false,committing:false}
  flight=job
  const current=():boolean=>{const now=useGameStore.getState();return !job.cancelled&&modIsOn(RECKONING_MOD)&&modIsOn('breakthrough')&&
    now.playthroughId===game.playthroughId&&now.loads===game.loads&&now.date===game.date&&now.time===game.time&&now.currentSceneTranscript===game.currentSceneTranscript&&
    now.exCharacterDynamics===game.exCharacterDynamics&&now.exReckoning===game.exReckoning&&
    !now.createdScene&&!now.replaying}
  try{return await run(job.group,current,()=>{job.committing=true})}finally{if(flight===job)flight=null;syncPreparation()}
}
export async function startReckoning(charId:string):Promise<void> {
  return operation(async(group,current,commit)=>{
    const game=useGameStore.getState()
    if(!canStartReckoning(game,charId))throw Error('Listen beneath her words to open a connection, then follow her voice from the map at night.')
    const context=openingContext(game,charId)
    const cached=openings.get(charId)
    let thoughts:ReckoningSession['thoughts']
    if(game.exReckoning.dungeon?.thoughts){thoughts=game.exReckoning.dungeon.thoughts}
    else if(cached&&validOpening(cached)){
      // A direct caller during preparation joins that request instead of paying for a second one.
      if(cached.status==='preparing')await cached.promise
      if(!current()||!validOpening(cached))throw Error('The encounter changed. No spirit was spent.')
      if(cached.status!=='ready'||!cached.thoughts)throw Error(cached.error||'Her thoughts are still being prepared.')
      thoughts=cached.thoughts
    }else{
      const result=await completeStructured<unknown>(RECKONING_MOD, beginReckoningPrompt(context), { group: group })
      if(!current())throw Error('The encounter changed. No spirit was spent.')
      if(!result.ok)throw Error(result.error.message)
      thoughts=parseReckoningThoughts(result.data,context,true)
    }
    const session:ReckoningSession={id:game.exReckoning.dungeon!.id,charId,context,thoughts,answers:[],challenge:thoughts[0].challenge,feedback:'',attempts:0,
      ...(modIsOn('echo')&&game.exEcho.player?{echoName:game.exEcho.player.name}:{})}
    if(!canStartReckoning(useGameStore.getState(),charId))throw Error('The encounter is no longer available. No spirit was spent.')
    commit()
    // Only the current scene can be branched; do not retain old-semester timeline metadata.
    await writeReckoningChange({...game.exReckoning,dungeon:{...game.exReckoning.dungeon!,thoughts},active:session},game.exReckoning,0,charId,undefined,current)
  })
}
export async function answerReckoning(reply:string):Promise<{tag?:GrowthTag;failed?:boolean;feedback:string;reaction:string}> {
  return operation(async(group,current,commit)=>{
    const game=useGameStore.getState(),session=game.exReckoning.active
    if(!session||!canResumeReckoning(game,session.charId))throw Error('Resume these questions in The Unspoken.')
    if(!reply.trim()||reply.length>1500)throw Error('Use 1–1,500 characters for your response.')
    const result=await completeStructured<unknown>(RECKONING_MOD, answerReckoningPrompt(session,reply.trim()), { group: group })
    if(!current())throw Error('The encounter changed; this answer was not applied.')
    if(!result.ok)throw Error(result.error.message)
    const verdict=parseReckoningVerdict(result.data,session.answers.length===2)
    const next=applyReckoningVerdict(session,reply.trim(),verdict,game.exCharacterDynamics)
    if(game.exReckoning.rewinds?.length)next.state.rewinds=game.exReckoning.rewinds
    const dungeon=game.exReckoning.dungeon!
    next.state.dungeon=next.tag||next.failed?dungeonFarewell(dungeon,next.tag?'victory':'failed'):dungeon
    next.state=withReckoningAftermaths(next.state,[...reckoningAftermaths(game.exReckoning),...(next.tag?[{id:session.id,charId:session.charId,date:game.date,time:game.time,origin:reckoningPrefix(game.currentSceneTranscript.slice(0,1))}]:[])])
    if(!canResumeReckoning(useGameStore.getState(),session.charId))throw Error('The reply window closed; this answer was not applied.')
    commit()
    await writeReckoningChange(next.state,game.exReckoning,0,session.charId,next.dynamics,current)
    return {tag:next.tag,failed:next.failed,feedback:verdict.feedback,reaction:verdict.reaction}
  })
}

/** Invocation reserves exactly one paid attempt. The actual confrontation happens only inside. */
export async function unlockReckoningDungeon(charId:string):Promise<void> {
 return operation(async(_group,current,commit)=>{
  const game=useGameStore.getState()
  if(!canUnlockReckoning(game,charId))throw Error(`Reach ${RECKONING_AFFECTION_MIN}+ affection and 100 spirit during an open reply. Finish the current dungeon before invoking another.`)
  const context=openingContext(game,charId),cached=openings.get(charId),id=crypto.randomUUID()
  const prior=(game.exReckoning.rewinds??[]).filter(e=>e.date===game.date&&e.time===game.time)
  const anchor=anchorReckoning({id,charId},game.date,game.time,game.currentSceneTranscript)
  const girl=game.characters[charId]
  const aspect=game.exEcho.girls[charId]?.aspect??profileAspect(fullNameOf(girl),[{label:'personality',text:girl.personality,weight:3},{label:'backstory',text:girl.backstory,weight:2}]).aspect
  const dungeon={id,charId,aspect,unlockedByReckoning:true as const,phase:'unlocked' as const,context,replies:0,farewellReplies:0,lines:[],
   ...(cached?.status==='ready'&&validOpening(cached)&&cached.thoughts?{thoughts:cached.thoughts}:{})}
  const linked={...dungeon,voice:beginUnspokenVoice(dungeon,game.date,game.time)}
  // Both identities are valid during the durable handoff, with the same load, provider
  // and evidence fences. A failed write leaves the original preparation usable.
  const handoff=cached&&validOpening(cached)?cached:undefined
  if(handoff)handoff.handoffKey=openingKey({...game,exReckoning:{...game.exReckoning,dungeon:linked}},charId,context)
  commit()
  try {
  await writeReckoningChange(withReckoningAftermaths({version:1,active:null,dungeon:linked,rewinds:[...prior,anchor]},reckoningAftermaths(game.exReckoning)),game.exReckoning,100,charId,undefined,current,unspokenLinkBeat(charKeyOf(girl.firstName,girl.lastName),context.name))
  } finally {
    if(handoff){
      if(useGameStore.getState().exReckoning.dungeon?.id===id&&validOpening(handoff))handoff.key=handoff.handoffKey!
      delete handoff.handoffKey
      syncPreparation()
    }
  }
  const now=useGameStore.getState()
  if(now.playthroughId===game.playthroughId&&now.loads===game.loads&&now.exReckoning.dungeon?.id===id)
   useReckoningLinkEffect.setState({pulse:{id,playthroughId:game.playthroughId!,loads:game.loads,until:Date.now()+LINK_GLITCH_MS}})
 })
}

/** Called only after a successful ordinary turn, before its normal autosave. No extra API call. */
export function settleUnspokenVoice():void {
 const game=useGameStore.getState(),d=game.exReckoning.dungeon
 if(!d||d.phase!=='unlocked'||!modIsOn(RECKONING_MOD)||!modIsOn('breakthrough')||game.createdScene||game.replaying)return
 const cached=openings.get(d.charId)
 const thoughts=d.thoughts??(cached?.status==='ready'&&validOpening(cached)?cached.thoughts:undefined)
 const next=advanceUnspokenVoice({...d,...(thoughts?{thoughts}:{})},game.date,game.time)
 const exReckoning={...game.exReckoning,dungeon:next}
 if(loopState.statusBase)loopState.statusBase={...loopState.statusBase,exReckoning}
 useGameStore.setState({exReckoning})
}
