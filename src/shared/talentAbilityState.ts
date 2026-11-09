/** Bounded save data for purchased abilities; handlers live in compiled source packs. */
export interface TalentAbilityState {
  uses: Record<string, { term: number; week: number; token?: string }>
  eureka?: { term: number; code: string; exam: 'midterm' | 'final' }
  farewell?: { term: number; date: number; time: 0 | 1; charId: string; action: string; at: number; ended?: boolean }
  silverLining?: { term: number; date: number; time: 0 | 1; charId: string; action: string; at: number }
  anticipation: Record<string, { term: number; date: number; time: 0 | 1 }>
}
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {}
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 160 && !['__proto__', 'constructor', 'prototype'].includes(v)
const integer = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= 100000
const slot = (v: Record<string, unknown>): boolean => integer(v.term) && integer(v.date) && (v.time === 0 || v.time === 1)

/** Older saves acquire empty ability state without changing their currency or ranks. */
export function normalizeTalentAbilities(value?: unknown): TalentAbilityState {
  const raw = object(value), e = object(raw.eureka), f = object(raw.farewell), silver = object(raw.silverLining)
  return {
    uses: Object.fromEntries(Object.entries(object(raw.uses)).slice(0,1024).flatMap(([key, value]) => {
      const r = object(value)
      return id(key) && integer(r.term) && integer(r.week) ? [[key, {term:r.term,week:r.week,...(id(r.token)?{token:r.token}:{})}]] : []
    })),
    anticipation: Object.fromEntries(Object.entries(object(raw.anticipation)).slice(0,512).flatMap(([key, value]) => {
      const r = object(value)
      return id(key) && slot(r) ? [[key,{term:r.term as number,date:r.date as number,time:r.time as 0|1}]] : []
    })),
    ...(integer(e.term) && id(e.code) && (e.exam === 'midterm' || e.exam === 'final') ? {eureka:{term:e.term,code:e.code,exam:e.exam}} : {}),
    ...(slot(silver) && id(silver.charId) && integer(silver.at) && typeof silver.action === 'string' && silver.action.length > 0 && silver.action.length <= 1000
      ? {silverLining:{term:silver.term as number,date:silver.date as number,time:silver.time as 0|1,charId:silver.charId,action:silver.action,at:silver.at}} : {}),
    ...(slot(f) && id(f.charId) && integer(f.at) && typeof f.action === 'string' && f.action.length > 0 && f.action.length <= 1000
      ? {farewell:{term:f.term as number,date:f.date as number,time:f.time as 0|1,charId:f.charId,action:f.action,at:f.at,...(f.ended===true?{ended:true}:{})}} : {})
  }
}

/** Calendar-week cooldowns are scoped to the save's semester. */
export function abilityUsedThisWeek(state: TalentAbilityState, skill: string, term: number, date: number): boolean {
  const use = state.uses[skill]
  return use?.term === term && use.week === Math.floor(date / 7)
}

/** Each completion records one stable use; retries carrying that token remain idempotent. */
export function recordAbilityUse(state: TalentAbilityState, skill: string, term: number, date: number, token?: string): TalentAbilityState {
  return {...state,uses:{...state.uses,[skill]:{term,week:Math.floor(date/7),...(token?{token}:{})}}}
}
