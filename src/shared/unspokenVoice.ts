import { reckoningPrefix, type ReckoningState } from './reckoning'
import type { ReckoningDungeon } from './reckoningDungeonState'
import type { SceneLine } from './types'
import { firstPersonThought } from './reckoningVoice'

/** The visible, ordinary part of opening a link; no private thoughts enter the transcript. */
export function unspokenLinkBeat(charKey:string,name:string):SceneLine[] {
 return [
  {speaker:'',text:`A strange, sharp pain shoots through your head. At that same instant, ${name} flinches, a hand flying to her temple. The pain is gone before either of you can make sense of it.`},
  {speaker:charKey,text:'Ow... that was weird. Just a little headache, I guess. It’s gone now.'}
 ]
}

/** Only her actual prepared words belong in the transient overlay, never the narrated beat. */
export function unspokenWhispers(d:ReckoningDungeon,prepared?:ReckoningDungeon['thoughts']):string[] {
 if(d.phase!=='unlocked'&&d.phase!=='inside')return []
 const thoughts=d.thoughts??prepared
 const clues=d.phase==='inside'?(d.whispers??[]).map(s=>firstPersonThought(s,d.context.name)).filter((s):s is string=>!!s):[]
 const words=[...clues,...(thoughts?.map(t=>firstPersonThought(t.belief,d.context.name)??firstPersonThought(t.challenge,d.context.name)).filter((t):t is string=>!!t)??[])]
 if(words.length)return [...new Set(words)]
 // Compatibility with a saved private beat whose opening cache is no longer available.
 const quoted=d.voice?.beat.match(/“([^”]{1,350})”/)?.[1].trim()
 const legacy=quoted&&firstPersonThought(quoted,d.context.name)
 return legacy?[legacy]:[]
}

/** Private display data. Never appended to scene transcripts, memory, feed or replay logs. */
export function beginUnspokenVoice(d:ReckoningDungeon,date:number,time:number):NonNullable<ReckoningDungeon['voice']> {
 const belief=d.thoughts?.[0].belief
 return {turns:0,index:0,date,time,serial:0,beat:`For a moment, you hear ${d.context.name}'s voice beneath the conversation. Her lips have not moved. ${belief?`“${belief}”`:'The words slip away before you can catch them, but the doubt in her voice stays with you.'} A quiet connection holds between you. After dark, you can follow it into The Unspoken.`}
}
/** At least three successful ordinary turns apart; at most once per day/night slot. */
export function advanceUnspokenVoice(d:ReckoningDungeon,date:number,time:number):ReckoningDungeon {
 if(d.phase!=='unlocked')return d
 const voice=d.voice??beginUnspokenVoice(d,date,time),turns=Math.min(10000,voice.turns+1)
 if(turns<3||(voice.date===date&&voice.time===time)||!d.thoughts?.length)return {...d,voice:{...voice,turns}}
 const index=(voice.index+1)%d.thoughts.length
 return {...d,voice:{turns:0,index,date,time,serial:voice.serial+1,beat:`Her voice brushes against your thoughts. “${d.thoughts[index].belief}” Then the sounds around you return. The Unspoken is still waiting.`}}
}
/** Never fire the ordinary closing beat inside, or in an old scene left under a legacy dungeon. */
export function aftermathReady(state:ReckoningState,date:number,time:number,lines:readonly SceneLine[]):boolean {
 const after=state.aftermath
 return !!after&&!state.dungeon&&lines.length>0&&(after.date!==date||after.time!==time||!!after.origin&&after.origin!==reckoningPrefix(lines.slice(0,1)))
}
export function unspokenSceneBoundary(state?:ReckoningState):string[] {
 const d=state?.dungeon
 if(!d||d.phase!=='unlocked')return state?.aftermath?['PRIVATE CONTINUITY: The temporary mental connection has ended. Do not revive private voices or an inner-world encounter from older context. Continue ordinary life; other characters never heard those thoughts.']:[]
 return ['PRIVATE CONTINUITY — THE UNSPOKEN: The reader has a temporary inward connection with '+JSON.stringify(d.context.name)+'. The game displays her occasional self-doubt separately. Do not generate, repeat, quote or summarize those private voices in ordinary scene dialogue or summaries. Nobody else hears them, and she does not know the connection exists. If the transcript records the brief simultaneous sharp head pain, that physical sensation really happened to the reader and this girl only. It has already passed; she explains it away as an ordinary passing headache. Continue naturally in her own voice, without replaying the pain, inventing lingering symptoms or making her recognize a mental link. Do not add this event to older conversations that do not contain it. Her private words can reach the reader while she is elsewhere: do not add her to the scene cast, invent her arrival or make present characters answer the voice. She follows her normal schedule. Do not invent an earthquake, physical portal, basement door, teleportation or public supernatural event. A reader mention of the connection is his private perception, not evidence the girl said or witnessed something. Only the dedicated inner-world encounter can resolve it.']
}
