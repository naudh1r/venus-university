import type { TalentState } from './campusTalents'
import { breakDecayedStats, isStatKey, STAT_KEYS, type PlayerStats, type StatKey } from './playerStats'

export const PERSONAL_GROWTH = 'growth.personal'
export const TRAINING_RULES = { unlock: 60, recovery: 10, progress: 25, exceptional: 40, max: 100, weekly: 6, newWeekly: 2 } as const
export interface TalentTraining {
  recovery?: { term: number; targets: PlayerStats; remaining: PlayerStats }
  week?: { term: number; week: number; total: number; newPoints: number }
}
const object = (x: unknown): Record<string, unknown> => x && typeof x === 'object' && !Array.isArray(x) ? x as Record<string, unknown> : {}
const clock = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0 && x <= 100000
const bounded = (x: unknown, max: number): number => typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : 0
const mapStats = (fn: (key: StatKey) => number): PlayerStats => ({ brain: fn('brain'), body: fn('body'), heart: fn('heart') })

export function readTalentTraining(value: unknown): TalentTraining | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const raw=object(value), recovery=object(raw.recovery), week=object(raw.week), result:TalentTraining={}
  if (clock(recovery.term) && recovery.term > 0) {
    const source=object(recovery.targets), left=object(recovery.remaining)
    const targets=mapStats(key=>bounded(source[key],TRAINING_RULES.max)), decayed=breakDecayedStats(targets)
    result.recovery={term:recovery.term,targets,remaining:mapStats(key=>bounded(left[key],Math.max(0,targets[key]-decayed[key])))}
  }
  if (clock(week.term) && clock(week.week)) {
    const total=Math.floor(bounded(week.total,TRAINING_RULES.weekly))
    result.week={term:week.term,week:week.week,total,newPoints:Math.min(total,Math.floor(bounded(week.newPoints,TRAINING_RULES.newWeekly)))}
  }
  return result
}

/** Read native decay without changing it. A new break replaces the old allowance. */
export function trainingAfterBreak(stats: PlayerStats, nextTerm: number): TalentTraining {
  const decayed=breakDecayedStats(stats)
  const targets=mapStats(key=>bounded(stats[key],TRAINING_RULES.max))
  const remaining=mapStats(key=>stats[key]>=0?Math.max(0,targets[key]-decayed[key]):0)
  return readTalentTraining({recovery:{term:nextTerm,targets,remaining}}) ?? {}
}

/** Ordinary practice consumes the recorded loss too; later penalties cannot replenish it. */
export function reconcileTraining(state: TalentState, stats: PlayerStats, term: number): TalentState {
  const training=readTalentTraining(state.training), recovery=training?.recovery
  if (!training || !recovery || recovery.term!==term) return state
  const remaining=mapStats(key=>Math.min(recovery.remaining[key],Math.max(0,recovery.targets[key]-stats[key])))
  if (STAT_KEYS.every(key=>remaining[key]===state.training?.recovery?.remaining[key])) return state
  return {...state,training:{...training,recovery:{...recovery,remaining}}}
}

export interface TrainingQuote {
  key: StatKey; from: number; to: number; gain: number; cost: number; recovery: boolean
  weeklyLeft: number; newWeeklyLeft: number; recoverable: number; reason: string
}
/** Quotes are pure. All eligibility and prices are recomputed inside the save transaction. */
export function quoteTraining(state: TalentState, stats: PlayerStats, key: StatKey, term: number, date: number): TrainingQuote {
  const s=reconcileTraining(state,stats,term), training=readTalentTraining(s.training), w=training?.week
  const currentWeek=Math.floor(date/7), same=w?.term===term&&w.week===currentWeek
  const weeklyLeft=TRAINING_RULES.weekly-(same?w.total:0), newWeeklyLeft=TRAINING_RULES.newWeekly-(same?w.newPoints:0)
  const from=stats[key], gain=Math.max(0,Math.min(1,TRAINING_RULES.max-from))
  const recoverable=training?.recovery?.term===term?training.recovery.remaining[key]:0
  const recovery=gain>0&&recoverable>=gain
  const unitCost=recovery?TRAINING_RULES.recovery:from>=60?TRAINING_RULES.exceptional:TRAINING_RULES.progress
  const cost=Math.ceil(unitCost*gain)
  const future=w && (w.term>term || w.term===term&&w.week>currentWeek)
  const reason=!clock(term)||!clock(date)||!Number.isFinite(from)?'This save has invalid training values.':
    !s.initialized||!(s.ranks[PERSONAL_GROWTH]>0)?'Learn Personal Growth first.':
    from>=TRAINING_RULES.max?'Godly reached. Keep your BP for a future semester.':
    future?'This save already records training in a later week.':
    weeklyLeft<=0?'You have used all six purchases this week.':
    !recovery&&newWeeklyLeft<=0?'You have used both new-progress purchases this week. Recovery purchases may still be available.':
    s.earned-s.spent<cost?`You need ${cost-(s.earned-s.spent)} more BP.`:''
  return {key,from,to:from+gain,gain,cost,recovery,weeklyLeft,newWeeklyLeft,recoverable,reason}
}

export function buyTraining(state: TalentState, stats: PlayerStats, key: StatKey, term: number, date: number): {talents:TalentState;stats:PlayerStats;quote:TrainingQuote} {
  if (!isStatKey(key)) throw Error('Choose Brain, Body or Heart.')
  const s=reconcileTraining(state,stats,term), quote=quoteTraining(s,stats,key,term,date)
  if (quote.reason) throw Error(quote.reason)
  const training=readTalentTraining(s.training)??{}, old=training.week
  const week=Math.floor(date/7), same=old?.term===term&&old.week===week
  const nextStats={...stats,[key]:quote.to}
  training.week={term,week,total:(same?old.total:0)+1,newPoints:(same?old.newPoints:0)+(quote.recovery?0:1)}
  if (quote.recovery && training.recovery) training.recovery.remaining[key]=Math.max(0,training.recovery.remaining[key]-quote.gain)
  const talents=reconcileTraining({...s,spent:s.spent+quote.cost,training},nextStats,term)
  return {talents,stats:nextStats,quote}
}
