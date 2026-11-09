import { ECHO_ASPECTS, type EchoAspect } from './echoAspects'
import type { ReckoningContext, ReckoningThought } from './reckoning'

export interface DungeonLine { who:'reader'|'reflection'|'girl'|'narrator'; text:string }
export interface ReckoningDungeon {
 id:string; charId:string; aspect:EchoAspect; unlockedByReckoning:true
 phase:'unlocked'|'inside'|'farewell'; context:ReckoningContext
 replies:number; farewellReplies:number; lines:DungeonLine[]
 outcome?:'victory'|'failed'|'expelled'|'left'
 thoughts?:ReckoningThought[]
 voice?:{turns:number;index:number;date:number;time:number;serial:number;beat:string}
 needsSpirit?:boolean
 /** A single perspective for this link, retained across leaving/reloading. */
 insight?:{aspect:EchoAspect;text:string}
 /** Most recent private spoken clues first; cleared on leaving, never story memory. */
 whispers?:string[]
}
const obj=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const validId=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=160&&!['__proto__','constructor','prototype'].includes(v)
/** Temporary dialogue stays in this private encounter only, and is erased on leaving. */
export function normalizeDungeon(value:unknown):ReckoningDungeon|undefined {
 const v=obj(value),c=obj(v.context)
 if(!validId(v.id)||!validId(v.charId)||v.unlockedByReckoning!==true||!ECHO_ASPECTS.some(a=>a.id===v.aspect)||!['unlocked','inside','farewell'].includes(String(v.phase)))return
 if(typeof c.name!=='string'||!c.name.trim()||typeof c.reader!=='string'||!Array.isArray(c.evidence)||c.evidence.length>22)return
 const evidence=c.evidence.flatMap(raw=>{const e=obj(raw);return validId(e.id)&&['profile','memory','scene'].includes(String(e.kind))&&typeof e.text==='string'?[{id:e.id,kind:e.kind as ReckoningContext['evidence'][number]['kind'],text:e.text.slice(0,4000)}]:[]})
 if(!evidence.length)return
 const lines=Array.isArray(v.lines)?v.lines.slice(-14).flatMap(raw=>{const l=obj(raw);return ['reader','reflection','girl','narrator'].includes(String(l.who))&&typeof l.text==='string'?[{who:l.who as DungeonLine['who'],text:l.text.slice(0,1500)}]:[]}):[]
 // Older local checkpoints stored the authored basement entrance. Update only that private narration.
 for(const line of lines)if(line.who==='narrator'&&/\b(basement|earthquake|hidden door)\b/i.test(line.text))line.text=`You close your eyes and follow ${c.name}'s voice inward. The Unspoken Void takes shape around you. Her Unheard Soul waits among the thoughts she has never said aloud.`
 for(const line of lines)if(line.who==='narrator')line.text=line.text.replace('Her reflection waits within it.','Her Unheard Soul waits within it.').replace('Her reflection waits among the thoughts she has never said aloud.','Her Unheard Soul waits among the thoughts she has never said aloud.').replace('Her Unheard waits within it.','Her Unheard Soul waits within it.').replace('Her Unheard waits among the thoughts she has never said aloud.','Her Unheard Soul waits among the thoughts she has never said aloud.').replace('The Unspoken takes shape around you.','The Unspoken Void takes shape around you.')
 const thoughts=Array.isArray(v.thoughts)&&v.thoughts.length===3?v.thoughts.flatMap(raw=>{const t=obj(raw);return typeof t.belief==='string'&&t.belief.trim()&&t.belief.length<=350&&typeof t.challenge==='string'&&t.challenge.trim()&&t.challenge.length<=550&&Array.isArray(t.evidence)&&t.evidence.length>0&&t.evidence.every(id=>evidence.some(e=>e.id===id))?[{belief:t.belief,challenge:t.challenge,evidence:t.evidence as string[]}]:[]}):[]
 const outcome=['victory','failed','expelled','left'].includes(String(v.outcome))?v.outcome as ReckoningDungeon['outcome']:undefined
 if(v.phase==='farewell'&&!outcome)return
 const rawVoice=obj(v.voice)
 const voice=Number.isSafeInteger(rawVoice.turns)&&Number(rawVoice.turns)>=0&&Number.isSafeInteger(rawVoice.index)&&Number(rawVoice.index)>=0&&Number.isSafeInteger(rawVoice.date)&&Number(rawVoice.date)>=0&&Number.isSafeInteger(rawVoice.time)&&[0,1].includes(Number(rawVoice.time))&&Number.isSafeInteger(rawVoice.serial)&&Number(rawVoice.serial)>=0&&typeof rawVoice.beat==='string'
  ? {turns:Math.min(10000,Number(rawVoice.turns)),index:Number(rawVoice.index)%3,date:Number(rawVoice.date),time:Number(rawVoice.time),serial:Number(rawVoice.serial),beat:rawVoice.beat.slice(0,1100)}:undefined
 const validThoughts=thoughts.length===3&&new Set(thoughts.map(t=>t.belief.toLowerCase())).size===3&&(!evidence.some(e=>e.kind!=='profile')||thoughts.some(t=>t.evidence.some(id=>evidence.some(e=>e.id===id&&e.kind!=='profile'))))
 const rawInsight=obj(v.insight),insight=ECHO_ASPECTS.some(a=>a.id===rawInsight.aspect)&&typeof rawInsight.text==='string'&&rawInsight.text.trim()&&rawInsight.text.length<=900?{aspect:rawInsight.aspect as EchoAspect,text:rawInsight.text.trim()}:undefined
 const whispers=Array.isArray(v.whispers)?[...new Set(v.whispers.filter((s):s is string=>typeof s==='string'&&!!s.trim()&&s.length<=900).map(s=>s.trim()))].slice(0,4):[]
 return {id:v.id,charId:v.charId,aspect:v.aspect as EchoAspect,unlockedByReckoning:true,phase:v.phase as ReckoningDungeon['phase'],context:{name:c.name.slice(0,150),reader:c.reader.slice(0,150),evidence},
 replies:Number.isSafeInteger(v.replies)?Math.max(0,Math.min(5,Number(v.replies))):0,farewellReplies:Number.isSafeInteger(v.farewellReplies)?Math.max(0,Math.min(2,Number(v.farewellReplies))):0,lines,...(voice?{voice}:{}),...(v.needsSpirit===true?{needsSpirit:true}:{}),...(outcome?{outcome}:{}),...(validThoughts?{thoughts}:{}),...(insight?{insight}:{}),...(whispers.length?{whispers}:{})}
}
