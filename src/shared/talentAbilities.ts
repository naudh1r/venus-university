import { reconcileBreakthroughWithRefunds, type BreakthroughState } from './breakthrough'
import { talentEffect, talentsEnabled, talentMemoryKey, type TalentState } from './campusTalents'
import { abilityUsedThisWeek, recordAbilityUse } from './talentAbilityState'
import { giftReactionOf, itemDefOf, type ItemDef } from './shop'
import type { Character, CharInfo, SceneLine, TimeSlot } from '@vx/modkit/shared'
import type { ExamPeriod } from './academics'

export const TALENT_ABILITIES = {
  eureka: 'brain.eureka', farewell: 'heart.anticipation', silverLining: 'heart.silver-lining', dancer: 'body.dancer', value: 'money.eye', borrowed: 'echoes.borrowed'
} as const

/** Unlock effects respect both Campus Talents and each pack's declared dependencies. */
export function abilityRank(s: TalentState, skill: string): number {
  return talentsEnabled() ? talentEffect(s, `${skill}.unlock`) : 0
}

/** Only the saved, explicit recovery action receives this week's scene intervention. */
export function silverLiningReady(s: TalentState, term: number, date: number, time: TimeSlot): boolean {
  const p = s.abilities.silverLining
  return !!p && p.term===term && p.date===date && p.time===time &&
    abilityRank(s,TALENT_ABILITIES.silverLining)>0 && !abilityUsedThisWeek(s.abilities,TALENT_ABILITIES.silverLining,term,date)
}

/** Called only after a successful scene response; errors retain the preparation for retry. */
export function completeSilverLining(s: TalentState, transcript: readonly SceneLine[], term: number, date: number, time: TimeSlot): TalentState {
  const p = s.abilities.silverLining
  if (!p) return s
  const tail = transcript.slice(p.at), reader = tail.findLastIndex(line=>line.speaker==='reader')
  const completed = silverLiningReady(s,term,date,time) && reader>=0 && tail[reader].text===p.action &&
    tail.slice(reader+1).some(line=>line.speaker!=='reader' && line.text.trim().length>0)
  const abilities = completed ? recordAbilityUse(s.abilities,TALENT_ABILITIES.silverLining,term,date) : {...s.abilities}
  delete abilities.silverLining
  return {...s,abilities}
}

/** Only the armed project's next eligible session receives triple work. */
export function eurekaReady(s: TalentState, term: number, date: number, code: string, exam: ExamPeriod): boolean {
  const e = s.abilities.eureka
  return abilityRank(s,TALENT_ABILITIES.eureka)>0 && !abilityUsedThisWeek(s.abilities,TALENT_ABILITIES.eureka,term,date) &&
    e?.term===term && e.code===code && e.exam===exam
}

/** Completion spends the weekly use; arming, cancellation and failed scenes do not. */
export function completeEureka(s: TalentState, term: number, date: number, code: string, exam: ExamPeriod): TalentState {
  if (!eurekaReady(s,term,date,code,exam)) return s
  const abilities = recordAbilityUse(s.abilities,TALENT_ABILITIES.eureka,term,date)
  delete abilities.eureka
  return {...s,abilities}
}

/** Observable romance milestones gate the offer without revealing a hidden crush. */
export function farewellRomance(info?: CharInfo): boolean {
  return !!info && !info.flags.blocked && !info.flags.friendZoned && !info.flags.friendZonedBy &&
    (info.flags.isLover || info.flags.benefits || info.flags.hasKissed)
}

/** The ability's exact reader action must still be the last submitted action at the ending. */
export function farewellEnded(s: TalentState, transcript: readonly SceneLine[], term: number, date: number, time: TimeSlot): boolean {
  const f = s.abilities.farewell
  if (!f || f.term!==term || f.date!==date || f.time!==time) return false
  const reader = transcript.slice(f.at).filter(l=>l.speaker==='reader').at(-1)
  return reader?.text === f.action
}

/** Anticipation belongs to the next later meeting, including one in a later semester. */
export function anticipationReady(s: TalentState, id: string, term: number, date: number, time: TimeSlot): boolean {
  const a = s.abilities.anticipation[id]
  return abilityRank(s,TALENT_ABILITIES.farewell)>0 && !!a &&
    (term>a.term || term===a.term && (date>a.date || date===a.date && time>a.time))
}

/** Rank gifts using native taste/repeat rules; discounted prices govern budget only. */
export function valueSuggestions(info: CharInfo | undefined, items: readonly ItemDef[], budget: number, character: Pick<Character,'giftPreferences'|'traits'> | undefined): Array<{item:ItemDef;because:string;reaction:'loved'|'liked'}> {
  if (!info?.nameKnown || !character || !Number.isFinite(budget) || budget<0) return []
  return items.filter(item=>!item.medicine && Number.isFinite(item.price) && item.price>=0 && item.price<=budget).flatMap(item=> {
    // Native gifting values the original catalog price, even when the purchase was discounted.
    const reaction=giftReactionOf(itemDefOf(item.id)??item,character,info.gifts?.includes(item.id)??false)
    if(reaction!=='loved'&&reaction!=='liked')return []
    return [{item,reaction,because:reaction==='loved'?'She’ll love this gift.':'She’ll like this gift.'}]
  }).sort((a,b)=>(a.reaction===b.reaction?0:a.reaction==='loved'?-1:1)||a.item.price-b.item.price||a.item.id.localeCompare(b.item.id)).slice(0,1)
}

/** Purchased dance capability enters only a dance-relevant exchange. */
export function dancerCapability(s: TalentState, context: string): string | null {
  const rank = abilityRank(s,TALENT_ABILITIES.dancer)
  if (!rank || !/\b(danc(?:e|es|ed|ing|er)|waltz|salsa|tango|choreograph\w*)\b/i.test(context)) return null
  return [
    'The reader is a competent dancer with reliable timing and basic steps.',
    'The reader is a skilled dancer who can confidently lead a willing partner and adapt to her pace.',
    'The reader is an accomplished dancer who can improvise an expressive, technically impressive performance and lead a willing partner.'
  ][Math.min(3,rank)-1] + ' Treat this as his established physical skill, while preserving injuries, space, consent and other realistic limits. It does not decide whether anyone is attracted or impressed. Show it naturally without mentioning skill ranks.'
}

/** Settle one meeting's pending goodbye and consume older anticipation against actual scene memories. */
export function settleTalentSceneAbilities(s: TalentState, before: Record<string,CharInfo>, after: Record<string,CharInfo>, cast: readonly string[], transcript: readonly SceneLine[], term: number, date: number, time: TimeSlot): {state:TalentState; bonus:Record<string,string>} {
  if (!talentsEnabled() || s.settled[`${term}:${date}:${time}`]) return {state:s,bonus:{}}
  let abilities = {...s.abilities,anticipation:{...s.abilities.anticipation}}
  delete abilities.silverLining
  const bonus:Record<string,string> = {}
  const fresh = (id:string) => {
    const old = new Set((before[id]?.memories??[]).map(talentMemoryKey))
    return (after[id]?.memories??[]).filter(m=>m.date===date && !old.has(talentMemoryKey(m)))
  }
  for (const id of new Set(cast)) {
    if (!anticipationReady(s,id,term,date,time)) continue
    const memory = fresh(id).find(m=>m.type==='liked'||m.type==='loved')
    if (memory) bonus[id] = talentMemoryKey(memory)
    delete abilities.anticipation[id]
  }
  const f = abilities.farewell
  if (f && f.term===term && f.date===date && f.time===time) {
    const memories = fresh(f.charId)
    if (abilityRank(s,TALENT_ABILITIES.farewell)>0 && f.ended && farewellEnded(s,transcript,term,date,time) && cast.includes(f.charId) && farewellRomance(after[f.charId]) &&
        !abilityUsedThisWeek(abilities,TALENT_ABILITIES.farewell,term,date) && memories.some(m=>m.type==='liked'||m.type==='loved') && !memories.some(m=>m.type==='hated'||m.type==='disliked')) {
      abilities = recordAbilityUse(abilities,TALENT_ABILITIES.farewell,term,date)
      abilities.anticipation = {...abilities.anticipation,[f.charId]:{term,date,time}}
    }
    delete abilities.farewell
  }
  return {state:{...s,abilities},bonus}
}

/** A real transcript rewind refunds the borrowed weekly use alongside its spirit charge. */
export function reconcileTalentBreakthrough(game:{exTalents:TalentState;exBreakthrough:BreakthroughState;date:number;time:TimeSlot}, transcript:readonly SceneLine[], previous?:readonly SceneLine[]):{exTalents:TalentState;exBreakthrough:BreakthroughState} {
  const {state,refunded}=reconcileBreakthroughWithRefunds(game.exBreakthrough,transcript,game.date,game.time,previous)
  const token=game.exTalents.abilities.uses[TALENT_ABILITIES.borrowed]?.token
  if(!token||!refunded.has(token))return {exTalents:game.exTalents,exBreakthrough:state}
  const abilities={...game.exTalents.abilities,uses:{...game.exTalents.abilities.uses}}
  delete abilities.uses[TALENT_ABILITIES.borrowed]
  return {exTalents:{...game.exTalents,abilities},exBreakthrough:state}
}
