import { affectionFor } from './relationship'
import { dynamicFor, type CharacterDynamics, type GrowthTag } from './characterDynamics'
import type { Character, CharInfo, SceneLine } from '@vx/modkit/shared'
import type { BreakthroughState } from './breakthrough'
import { sha256Hex } from './sha256'
import { normalizeDungeon, type ReckoningDungeon } from './reckoningDungeonState'
import { firstPersonThought } from './reckoningVoice'

export const RECKONING_MOD = 'reckoning'
export const RECKONING_COST = 100
/** About 75% of the native 50-point Devoted floor, rounded up; affection has no fixed cap. */
export const RECKONING_AFFECTION_MIN = 38
export interface ReckoningEvidence { id: string; kind: 'profile' | 'memory' | 'scene'; text: string }
export interface ReckoningContext { name: string; reader: string; evidence: ReckoningEvidence[] }
export interface ReckoningThought { belief: string; challenge: string; evidence: string[] }
export interface ReckoningAnswer { reply: string; reframe: string }
export interface ReckoningSession {
  id: string; charId: string; context: ReckoningContext; thoughts: ReckoningThought[]
  answers: ReckoningAnswer[]; challenge: string; feedback: string; attempts: number
  echoName?: string
}
export interface ReckoningAftermath { id:string; charId:string; date:number; time:number; origin?:string }
/** A private event between transcript lines. No dialogue or profile text is duplicated. */
export interface ReckoningRewind { id:string; charId:string; date:number; time:number; at:number; prefix:string }
export interface ReckoningState { version: 1; active: ReckoningSession | null; aftermath?:ReckoningAftermath; afterQueue?:ReckoningAftermath[]; rewinds?:ReckoningRewind[]; dungeon?:ReckoningDungeon }
export interface ReckoningVerdict { resolved: boolean; reaction: string; feedback: string; reframe: string; tagName: string; growth: string }
const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
function text(v: unknown, max: number, field = 'a required field'): string {
  if (typeof v !== 'string' || !v.trim()) throw Error(`The response is missing ${field}. Try again; no progress was changed.`)
  if (v.length > max) throw Error(`The response's ${field} is too long. Try again; no progress was changed.`)
  return v.trim()
}
const id = (v: unknown): string => { const s=text(v,160); if (['__proto__','constructor','prototype'].includes(s)) throw Error('Invalid identity.'); return s }
/** Old saves keep the first pending closing beat; later successes can queue behind it. */
export function reckoningAftermaths(state:ReckoningState):ReckoningAftermath[] { return [...(state.aftermath?[state.aftermath]:[]),...(state.afterQueue??[])] }
export function withReckoningAftermaths(state:ReckoningState,entries:ReckoningAftermath[]):ReckoningState {
 const {aftermath:_a,afterQueue:_q,...base}=state
 return {...base,...(entries[0]?{aftermath:entries[0]}:{}),...(entries.length>1?{afterQueue:entries.slice(1)}:{})}
}
function afterRecords(value:unknown):Pick<ReckoningState,'aftermath'|'afterQueue'> {
 const state=object(value),records:ReckoningAftermath[]=[],seen=new Set<string>()
 for(const raw of [state.aftermath,...(Array.isArray(state.afterQueue)?state.afterQueue:[])].slice(0,128))try {
  const a=object(raw),key=id(a.id)
  if(seen.has(key)||!Number.isSafeInteger(a.date)||Number(a.date)<0||!Number.isSafeInteger(a.time)||Number(a.time)<0||Number(a.time)>23)continue
  records.push({id:key,charId:id(a.charId),date:Number(a.date),time:Number(a.time),...(typeof a.origin==='string'&&/^[a-f0-9]{64}$/.test(a.origin)?{origin:a.origin}:{})});seen.add(key)
 }catch{/* Ignore damaged optional closing metadata without discarding encounter progress. */}
 return {...(records[0]?{aftermath:records[0]}:{}),...(records.length>1?{afterQueue:records.slice(1)}:{})}
}
function rewindRecords(value:unknown):ReckoningRewind[] {
  if(!Array.isArray(value))return []
  const seen=new Set<string>(),records:ReckoningRewind[]=[]
  for(const entry of value.slice(-128))try {
    const v=object(entry),key=id(v.id),charId=id(v.charId)
    if(seen.has(key)||!Number.isSafeInteger(v.date)||Number(v.date)<0||!Number.isSafeInteger(v.time)||Number(v.time)<0||Number(v.time)>23||!Number.isSafeInteger(v.at)||Number(v.at)<1||Number(v.at)>100000||typeof v.prefix!=='string'||!/^[a-f0-9]{64}$/.test(v.prefix))continue
    seen.add(key);records.push({id:key,charId,date:Number(v.date),time:Number(v.time),at:Number(v.at),prefix:v.prefix})
  }catch{/* Malformed optional rewind metadata must not erase an otherwise valid encounter. */}
  return records
}
export function reckoningPrefix(lines:readonly SceneLine[]):string {
  return sha256Hex(JSON.stringify(lines.map(line=>[line.speaker,line.text])))
}
export function anchorReckoning(session:Pick<ReckoningSession,'id'|'charId'>,date:number,time:number,lines:readonly SceneLine[]):ReckoningRewind {
  return {id:session.id,charId:session.charId,date,time,at:lines.length,prefix:reckoningPrefix(lines)}
}

interface RewindableReckoning {
  date:number; time:number; currentSceneTranscript:readonly SceneLine[]
  exReckoning:ReckoningState; exBreakthrough:BreakthroughState; exCharacterDynamics?:CharacterDynamics
}
/** Called only when a new action commits a transcript cut, never while rereading or retrying. */
export function rewindReckoning(state:RewindableReckoning,kept:number):Partial<Pick<RewindableReckoning,'exReckoning'|'exBreakthrough'|'exCharacterDynamics'>> {
  if(kept<0||kept>=state.currentSceneTranscript.length)return {}
  const removed=(state.exReckoning.rewinds??[]).filter(entry=>entry.date===state.date&&entry.time===state.time&&
    kept<=entry.at&&entry.at<=state.currentSceneTranscript.length&&entry.prefix===reckoningPrefix(state.currentSceneTranscript.slice(0,entry.at)))
  if(!removed.length)return {}
  const ids=new Set(removed.map(entry=>entry.id)),meters={...state.exBreakthrough.meters}
  let dynamics=state.exCharacterDynamics
  for(const entry of removed){
    meters[entry.charId]=Math.min(100,(meters[entry.charId]??0)+RECKONING_COST)
    const owner=dynamics?.characters[entry.charId]
    // Keep other traits/history and any unrelated earned tag exactly as they were.
    if(owner?.growth?.id===entry.id){
      const {growth:_growth,...rest}=owner
      dynamics={...dynamics!,characters:{...dynamics!.characters,[entry.charId]:rest}}
    }
  }
  const {aftermath:_after,afterQueue:_queue,rewinds:records,...base}=state.exReckoning
  const rewinds=records?.filter(entry=>!ids.has(entry.id))??[]
  return {exReckoning:{...base,active:base.active&&ids.has(base.active.id)?null:base.active,
    ...(base.dungeon&&ids.has(base.dungeon.id)?{dungeon:undefined}:{}),
    ...afterRecords(withReckoningAftermaths(base,reckoningAftermaths(state.exReckoning).filter(a=>!ids.has(a.id)))),...(rewinds.length?{rewinds}:{})},
    exBreakthrough:{...state.exBreakthrough,meters},...(dynamics!==state.exCharacterDynamics?{exCharacterDynamics:dynamics}:{})}
}
/** Editing words in-place keeps the event at the same point; a later branch can still undo it. */
export function rebaseReckoning(state:RewindableReckoning,lines:readonly SceneLine[]):ReckoningState {
  if(!state.exReckoning.rewinds?.length)return state.exReckoning
  return {...state.exReckoning,rewinds:state.exReckoning.rewinds.map(entry=>entry.date===state.date&&entry.time===state.time&&
    entry.at<=lines.length&&entry.prefix===reckoningPrefix(state.currentSceneTranscript.slice(0,entry.at))
    ? {...entry,prefix:reckoningPrefix(lines.slice(0,entry.at))}:entry)}
}
export function hasReckoningAffection(info: CharInfo | undefined, today: number, character: Character | undefined): boolean {
  return !!info?.nameKnown && !!character && affectionFor(info,today,character) >= RECKONING_AFFECTION_MIN
}
export function parseReckoningThoughts(value: unknown, context: ReckoningContext, requireFirstPerson=false): ReckoningThought[] {
  const raw=object(value).thoughts
  if (!Array.isArray(raw) || raw.length!==3) throw Error('The encounter needs exactly three thoughts. Try again; no spirit was spent.')
  const allowed=new Set(context.evidence.map(e=>e.id))
  const thoughts=raw.map(v=>{
    const t=object(v)
    if(!Array.isArray(t.evidence)||!t.evidence.length||t.evidence.length>4||t.evidence.some(e=>typeof e!=='string'||!allowed.has(e)))throw Error('A thought cited unavailable history. Try again; no spirit was spent.')
    const rawBelief=text(t.belief,350,'the limiting belief'),belief=requireFirstPerson?firstPersonThought(rawBelief,context.name):rawBelief
    if(!belief)throw Error('The thought must be in her own first-person voice. Try again; no progress was changed.')
    return {belief,challenge:text(t.challenge,550,'the thought\'s challenge'),evidence:t.evidence as string[]}
  })
  if(new Set(thoughts.map(t=>t.belief.toLowerCase())).size!==3)throw Error('The thoughts repeated themselves. Try again.')
  const memories=context.evidence.filter(e=>e.kind!=='profile').map(e=>e.id)
  if(memories.length&&!thoughts.some(t=>t.evidence.some(e=>memories.includes(e))))throw Error('The thoughts did not use your shared experiences. Try again.')
  return thoughts
}
export function parseReckoningVerdict(value: unknown, finalRound: boolean): ReckoningVerdict {
  const v=object(value)
  if(typeof v.resolved!=='boolean')throw Error('The response did not decide the round. Try again.')
  return {resolved:v.resolved,reaction:text(v.reaction,600,'the thought\'s reaction'),feedback:text(v.feedback,500,'the round feedback'),
    reframe:v.resolved?text(v.reframe,500,'the new belief'):'',
    tagName:v.resolved&&finalRound?text(v.tagName,70,'the earned growth tag\'s name'):'',
    growth:v.resolved&&finalRound?text(v.growth,700,'the earned growth description'):''}
}
export function normalizeReckoning(value?: unknown): ReckoningState {
  const d=normalizeDungeon(object(value).dungeon),dungeon=d?{dungeon:d}:{},afters=afterRecords(value)
  try {
    const state=object(value),raw=object(state.active)
    const records=rewindRecords(state.rewinds),rewinds=records.length?{rewinds:records}:{}
    if(!Object.keys(raw).length)return {version:1,active:null,...rewinds,...dungeon,...afters}
    if(d&&(!['inside','unlocked'].includes(d.phase)||raw.charId!==d.charId||raw.id!==d.id))throw Error('Mismatched dungeon encounter')
    const c=object(raw.context)
    if(!Array.isArray(c.evidence)||c.evidence.length>22)throw Error('Invalid evidence')
    const context: ReckoningContext={name:text(c.name,150),reader:text(c.reader,150),evidence:c.evidence.map(v=>{
      const e=object(v);if(!['profile','memory','scene'].includes(String(e.kind)))throw Error('Invalid evidence kind')
      return {id:id(e.id),kind:e.kind as ReckoningEvidence['kind'],text:text(e.text,4000)}
    })}
    const thoughts=parseReckoningThoughts({thoughts:raw.thoughts},context)
    if(!Array.isArray(raw.answers)||raw.answers.length>2)throw Error('Invalid rounds')
    return {version:1,...rewinds,...dungeon,...afters,active:{id:id(raw.id),charId:id(raw.charId),context,thoughts,
      ...(typeof raw.echoName==='string'&&raw.echoName.trim()?{echoName:text(raw.echoName,120)}:{}),
      answers:raw.answers.map(v=>{const a=object(v);return {reply:text(a.reply,1500),reframe:text(a.reframe,500)}}),
      challenge:text(raw.challenge,600),feedback:typeof raw.feedback==='string'?raw.feedback.slice(0,500):'',
      attempts:Number.isSafeInteger(raw.attempts)&&Number(raw.attempts)>=0?Math.min(10000,Number(raw.attempts)):0}}
  } catch { return {version:1,active:null,...dungeon,...afters} }
}
/** The tag belongs to her saved dynamic, never to the shared character library or trait palette. */
export function applyReckoningVerdict(session: ReckoningSession, reply: string, verdict: ReckoningVerdict, dynamics?: CharacterDynamics): {state:ReckoningState;dynamics?:CharacterDynamics;tag?:GrowthTag;failed?:boolean} {
  if(!verdict.resolved)return {state:{version:1,active:null},failed:true}
  const answer=text(reply,1500),answers=verdict.resolved?[...session.answers,{reply:answer,reframe:verdict.reframe}]:session.answers
  if(answers.length===3){
    const names=new Set(Object.keys(dynamics?.characters??{}).map(key=>dynamicFor(dynamics,key).growth?.name.toLowerCase()).filter(Boolean))
    const name=names.has(verdict.tagName.toLowerCase())?`${verdict.tagName.slice(0,45)} · ${session.context.name.slice(0,22)}`:verdict.tagName
    const tag:GrowthTag={id:session.id,name,description:verdict.growth,reframes:answers.map(a=>a.reframe)}
    const next:CharacterDynamics=structuredClone(dynamics??{version:1,characters:{}})
    next.characters[session.charId]={...dynamicFor(next,session.charId),growth:tag}
    return {state:{version:1,active:null},dynamics:next,tag}
  }
  return {state:{version:1,active:{...session,answers,attempts:session.attempts+1,feedback:verdict.feedback,
    challenge:verdict.resolved?session.thoughts[answers.length].challenge:verdict.reaction}}}
}
