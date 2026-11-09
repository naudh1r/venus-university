import { sharedModOn } from './modRules'
import type { CharInfo, CharMemory, TimeSlot } from '@vx/modkit/shared'
import { normalizeTalentAbilities, type TalentAbilityState } from './talentAbilityState'
import { readTalentGrowth, type TalentGrowth } from './talentGrowth'
import { readBondFraction, talentBondRate, TALENT_BP_REWARDS } from './talentBondPoints'
import { readTalentTraining, type TalentTraining } from './talentTrading'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from './playerStats'

export const TALENTS_MOD = 'campus-talents'
import { TALENTS } from './talentCatalog'
import type { TalentDef, TalentEffect } from './talentTypes'
export { TALENTS, TALENT_TREES } from './talentCatalog'
export type { TalentDef, TalentPack, TalentEffect } from './talentTypes'
export type TalentTree = string
export interface TalentState {
  initialized: boolean
  earned: number
  seed: number
  spent: number
  ranks: Record<string, number>
  settled: Record<string, true>
  purchases: number
  reserve: number
  reserveFloor: number
  savingsTerm: number
  savingsSeen: number
  savingsDay: number
  interestEarned: number
  recent: Array<{ slot: string; points: number; characters: number }>
  abilities: TalentAbilityState
  /** Last day Show Up paid out; retained across saves and mod toggles. */
  showUpDay?: { term: number; date: number }
  /** Inert legacy test-build data; retained on load, never used to scale new gains. */
  growth?: TalentGrowth
  /** Unfinished BP from scaled rewards; never spent until it makes a whole point. */
  bpFraction?: number
  training?: TalentTraining
}
declare module './types' {
  interface GameSave { exTalents?: TalentState }
  interface ModEnrollmentFields { exTalents?: TalentState }
  interface CharMemory {
    /** Earned multipliers are fixed when the memory is created. */
    talentEchoMultiplier?: number
    talentHeartMultiplier?: number
    /** This memory received the earned Anticipation bonus. */
    talentAnticipation?: true
  }
  interface ProjectSession {
    /** Credited work; absent on native sessions. */
    talentWorkUnits?: number
  }
}

const MAX = 100000000
const bounded = (x: unknown, max = MAX): number => typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, Math.floor(x))) : 0
const object = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
export const cash = (x: number): number => Math.round(x * 100) / 100
export function normalizeTalents(value?: unknown): TalentState {
  const raw = object(value), ranks = object(raw.ranks)
  const savedRanks = Object.fromEntries(Object.entries(ranks).filter(([id])=>/^[a-z][a-z0-9.-]{0,79}$/.test(id)&&!['constructor','prototype'].includes(id)).slice(0,1024).map(([id,n])=>[id,bounded(n,10)]))
  const state: TalentState = {
    abilities: normalizeTalentAbilities(raw.abilities),
    initialized: raw.initialized === true, earned: bounded(raw.earned), seed: bounded(raw.seed), spent:bounded(raw.spent), ranks:savedRanks,
    settled: Object.fromEntries(Object.entries(object(raw.settled)).filter(([k,v]) => /^\d+:\d+:[01]$/.test(k) && v === true).slice(-4096)) as Record<string,true>,
    purchases:bounded(raw.purchases), reserve:cash(Math.max(0, Math.min(MAX, Number(raw.reserve)||0))),
    reserveFloor:cash(Math.max(0, Math.min(MAX, Number(raw.reserveFloor)||0))),
    savingsSeen:bounded(raw.savingsSeen??raw.savingsDay,100000), savingsTerm:bounded(raw.savingsTerm, 1000), savingsDay:bounded(raw.savingsDay, 100000), interestEarned:cash(Math.max(0, Math.min(MAX, Number(raw.interestEarned)||0))),
    recent:Array.isArray(raw.recent) ? raw.recent.slice(-5).flatMap(e => {
      const r=object(e); return typeof r.slot==='string' && /^\d+:\d+:[01]$/.test(r.slot) ? [{slot:r.slot,points:bounded(r.points),characters:bounded(r.characters,512)}] : []
    }) : []
  }
  const showUpDay = object(raw.showUpDay)
  const growth = readTalentGrowth(raw.growth)
  if (growth) state.growth = growth
  const bpFraction = readBondFraction(raw.bpFraction)
  if (bpFraction !== undefined) state.bpFraction = bpFraction
  const training = readTalentTraining(raw.training)
  if (training) state.training = training
  if (Number.isInteger(showUpDay.term) && Number.isInteger(showUpDay.date) &&
      Number(showUpDay.term) >= 0 && Number(showUpDay.term) <= 1000 &&
      Number(showUpDay.date) >= 0 && Number(showUpDay.date) <= 100000) {
    state.showUpDay = { term: Number(showUpDay.term), date: Number(showUpDay.date) }
  }
  state.seed=Math.min(state.seed,state.earned)
  state.reserveFloor=Math.min(state.reserveFloor,state.reserve)
  // An overspent ledger cannot expose purchased ranks or a negative balance.
  if (state.spent>state.earned) { state.ranks={}; state.spent=state.earned }
  // Finding Your Feet now has one 40 BP rank. Grandfather old rank-I purchases;
  // old rank II cost 65 total, so return the 25 BP difference once. The collapsed
  // rank makes subsequent load/normalize/save passes idempotent.
  if (state.ranks['heart.feet'] > 1) {
    state.ranks['heart.feet'] = 1
    state.spent = Math.max(0, state.spent - 25)
  }
  return state
}
export const talentRank = (s: TalentState | undefined, id: string): number => s?.ranks[id] ?? 0
export const spentTalents = (s: TalentState): number => s.spent
export const talentBalance = (s: TalentState): number => Math.max(0,s.earned-spentTalents(s))
export function talentPrerequisitesMet(s: TalentState, def: TalentDef): boolean {
  return (def.prerequisites??[]).every(p=>talentRank(s,p.id)>=p.rank) &&
    (!def.prerequisitesAny||def.prerequisitesAny.some(p=>talentRank(s,p.id)>=p.rank))
}
export function buyTalent(value: TalentState, id: string, available: (modId:string)=>boolean): TalentState {
  const s=normalizeTalents(value), def=TALENTS.find(d=>d.id===id)
  if (!s.initialized || !def) throw Error('Open a playthrough before learning a skill.')
  if (def.requires?.some(id=>!available(id))) throw Error('Enable the required mods first.')
  if (!talentPrerequisitesMet(s,def)) throw Error(def.capstone?'Fully upgrade one second-row skill first.':def.shared?'Learn one required skill first.':'Learn the preceding skill first.')
  const rank=talentRank(s,id), cost=def.costs[rank]
  if (cost===undefined) throw Error('This skill is fully learned.')
  if (talentBalance(s)<cost) throw Error('You need more Bond Points.')
  return {...s,spent:s.spent+cost,ranks:{...s.ranks,[id]:rank+1}}
}
export function seedTalents(value: TalentState, total: number, term: number, day: number): TalentState {
  const s=normalizeTalents(value)
  return s.initialized ? s : {...s,initialized:true,earned:bounded(total),seed:bounded(total),savingsTerm:term,savingsSeen:day,savingsDay:day}
}
export function talentMemories(info?: CharInfo): CharMemory[] {
  return [...(info?.memories??[]),...(info?.textMemory?[info.textMemory]:[]),...(info?.giftMemories??[]),...(info?.jealousyMemories??[])]
}
export const talentMemoryKey = (m: CharMemory): string => JSON.stringify([m.date,m.type,m.desc])
export function settleTalentPoints(value: TalentState, before: Record<string,CharInfo>, after: Record<string,CharInfo>, term: number, date: number, time: TimeSlot, stats: PlayerStats = DEFAULT_PLAYER_STATS): TalentState {
  const s=normalizeTalents(value), slot=`${term}:${date}:${time}`
  if (!s.initialized || s.settled[slot]) return s
  let points=0, characters=0
  for (const [id,info] of Object.entries(after)) {
    const seen=new Set(talentMemories(before[id]).map(talentMemoryKey)); let gained=0
    for (const m of talentMemories(info)) {
      const key=talentMemoryKey(m)
      if (m.date===date && !seen.has(key)) gained+=m.type==='loved'?TALENT_BP_REWARDS.loved:m.type==='liked'?TALENT_BP_REWARDS.liked:0
      seen.add(key)
    }
    if (gained) { points+=gained; characters++ }
  }
  if (!points) return {...s,settled:{...s.settled,[slot]:true}}
  const exact = points * talentBondRate(stats).multiplier + (s.bpFraction ?? 0)
  const whole = Math.floor(exact + 1e-9)
  const paid = Math.min(MAX - s.earned, whole)
  return {...s,earned:s.earned+paid,bpFraction:s.earned+paid===MAX?0:Math.max(0,exact-whole),
    settled:{...s.settled,[slot]:true},recent:[...s.recent,{slot,points:paid,characters}].slice(-5)}
}
export function talentPay(s: TalentState, pay: number, streak: number): number {
  return cash(pay*(1+Math.min(1,talentEffect(s,'wageRate')))+((streak+1)%3===0?Math.min(250,talentEffect(s,'streakCash')):0))
}
export function talentPrice(s: TalentState, price: number): number {
  const discount=talentEffect(s,'shopDiscount')+((s.purchases+1)%3===0?talentEffect(s,'thirdPurchaseDiscount'):0)
  return cash(Math.max(0,price)*(1-Math.min(.25,discount)))
}
export function transferSavings(value: TalentState, money: number, amount: number): { talents:TalentState; money:number } {
  const s=normalizeTalents(value), n=cash(amount)
  if (!talentEffect(s,'savingsAccess') || !Number.isFinite(n) || n===0) throw Error('Choose an amount to deposit or withdraw.')
  if (n>0 && n>Math.max(0,money)) throw Error('Only available cash can be deposited.')
  if (n<0 && -n>s.reserve) throw Error('Your savings do not cover that withdrawal.')
  const reserve=cash(s.reserve+n)
  if (reserve>MAX) throw Error('The savings pocket is full.')
  return {talents:{...s,reserve,reserveFloor:Math.min(s.reserveFloor,reserve)},money:cash(money-n)}
}
export function settleSavings(value: TalentState, term: number, date: number): TalentState {
  const s=normalizeTalents(value)
  if (term!==s.savingsTerm || date<s.savingsDay || date>s.savingsSeen+1) return {...s,savingsTerm:term,savingsDay:date,savingsSeen:date,reserveFloor:s.reserve}
  s.savingsSeen=date
  if (date<s.savingsDay+7) return s
  const interest=cash(Math.min(MAX-s.reserve,250,talentEffect(s,'savingsCap'),s.reserveFloor*Math.min(.05,talentEffect(s,'savingsRate'))))
  return {...s,reserve:cash(s.reserve+interest),interestEarned:cash(Math.min(MAX,s.interestEarned+interest)),reserveFloor:cash(s.reserve+interest),savingsDay:date}
}
export function talentAffinity(s: TalentState, affinity: 'matching'|'competing'|'neutral'): number {
  if (affinity==='matching') return Math.min(1.5,1.25+talentEffect(s,'matchingBonus'))
  if (affinity==='competing') return Math.min(1,.75+talentEffect(s,'competingRelief'))
  return Math.min(1.5,1+talentEffect(s,'neutralBonus'))
}
export function talentSpirit(s: TalentState, positive: number, matching: boolean): number {
  return positive>0 ? cash(positive*(1+talentEffect(s,'spiritRate'))+(matching?talentEffect(s,'matchingSpirit'):0)) : 0
}
export function talentAbilityCost(s: TalentState, price: number): number { return Math.max(15,price-5*Math.round(talentEffect(s,'echoDiscount')/5)) }
let enabled: () => boolean = () => sharedModOn(TALENTS_MOD)
let available: ((modId: string) => boolean) | null = sharedModOn
/** Explicit rule bindings for standalone hosts and tests; the renderer uses its live lookup. */
export function setTalentRules(on?: boolean, mods?: Iterable<string>): void {
  if (on === undefined) {
    enabled = () => sharedModOn(TALENTS_MOD)
    available = sharedModOn
    return
  }
  enabled = () => on
  const selected = mods ? new Set(mods) : null
  available = selected ? id => selected.has(id) : null
}
export function talentEffect(s: TalentState, key: TalentEffect): number {
  return TALENTS.reduce((sum,d)=>{
    if (d.requires?.some(id=>available!==null&&!available(id)))return sum
    return sum+(d.effects?.[key]?.[talentRank(s,d.id)-1]??0)
  },0)
}
export function talentMemoryMultiplier(m: CharMemory): number | undefined {
  return enabled() && typeof m.talentEchoMultiplier==='number' && m.talentEchoMultiplier>=.75 && m.talentEchoMultiplier<=1.5 ? m.talentEchoMultiplier : undefined
}
export const talentsEnabled = ():boolean => enabled()
