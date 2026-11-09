import type { CharInfo, SceneLine, TimeSlot } from '@vx/modkit/shared'
import { normalizeTermOrigin, type TermOrigin } from './termOrigin'
import { isEchoBreakthroughAspect, type EchoBreakthroughAspect } from './echoBreakthrough'

export const BREAKTHROUGH_MOD = 'breakthrough'
export const SPIRIT_MAX = 100

export interface BreakthroughPending {
  id: string
  charId: string
  direction: string
  date: number
  time: TimeSlot
  playthroughId: string
  /** Optional local Echo integration; omitted for an ordinary Breakthrough. */
  echoAspect?: EchoBreakthroughAspect
  /** Price actually charged for an Echo activation; absent in older, full-bar saves. */
  spent?: number
  /** A purchased Borrowed Voice activation uses this present partner's aspect. */
  borrowedFrom?: string
  talentTerm?: number
}

export interface BreakthroughMoment {
  id: string
  date: number
  time: TimeSlot
  /** Actual generated dialogue, never the player's requested outcome. */
  outcome: string
  transcriptStart?: number
  transcriptCount?: number
  /** Actual successful charge. Older outcomes omit this; their price cannot be inferred. */
  spent?: number
  origin?: TermOrigin
}

export interface BreakthroughState {
  meters: Record<string, number>
  settled: Record<string, true>
  pending: BreakthroughPending | null
  moments: Record<string, BreakthroughMoment[]>
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {}
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 160 &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
}

function slot(date: unknown, time: unknown): boolean {
  return Number.isSafeInteger(date) && (date as number) >= 0 && (time === 0 || time === 1)
}

const meter = (n: number): number => Math.max(0, Math.min(SPIRIT_MAX, Number.isFinite(n) ? n : 0))

function isSpiritPrice(value:unknown):value is number {
  return typeof value==='number' && Number.isInteger(value) && value>=15 && value<=100 && value%5===0
}

/** Ordinary and legacy activations always paid a full bar. Never infer an old price from today's catalog. */
export function breakthroughSpent(pending:BreakthroughPending):number {
  return pending.echoAspect&&isSpiritPrice(pending.spent)?pending.spent:SPIRIT_MAX
}

export function refundSpirit(current:number,pending:BreakthroughPending):number {
  return meter(current+breakthroughSpent(pending))
}

/** Imported optional data is bounded. Loading refunds an interrupted, uncommitted activation. */
export function normalizeBreakthrough(value?: unknown, recover = false): BreakthroughState {
  const raw = record(value)
  const meters = Object.fromEntries(Object.entries(record(raw.meters)).slice(0,512)
    .filter(([id]) => safeId(id)).map(([id, n]) => [id, meter(Number(n))]))
  const settled = Object.fromEntries(Object.entries(record(raw.settled))
    .filter(([key, done]) => /^\d+:[01]$/.test(key) && done === true).slice(-2048)) as Record<string, true>
  const moments: BreakthroughState['moments'] = {}
  for (const [charId, entries] of Object.entries(record(raw.moments)).slice(0,512)) {
    if (!safeId(charId) || !Array.isArray(entries)) continue
    moments[charId] = entries.slice(-6).flatMap(value => {
      const e = record(value)
      const origin = normalizeTermOrigin(e.origin)
      const archived = origin && Number.isSafeInteger(e.date) && Number(e.date) >= -100000 &&
        Number(e.date) < 0 && (e.time === 0 || e.time === 1)
      if (!safeId(e.id) || !(slot(e.date,e.time) || archived) || typeof e.outcome !== 'string' || !e.outcome.trim()) return []
      const range = Number.isSafeInteger(e.transcriptStart) && (e.transcriptStart as number) >= 0 &&
        Number.isSafeInteger(e.transcriptCount) && (e.transcriptCount as number) > 0
      return [{ id:e.id, date:e.date as number, time:e.time as TimeSlot, outcome:e.outcome.slice(0,12000),
        ...(origin ? { origin } : {}),
        ...(range ? { transcriptStart:e.transcriptStart as number, transcriptCount:e.transcriptCount as number,
          ...(isSpiritPrice(e.spent) ? { spent:e.spent } : {}) } : {}) }]
    })
  }
  const p = record(raw.pending)
  const pending: BreakthroughPending | null = safeId(p.id) && safeId(p.charId) && safeId(p.playthroughId) &&
    slot(p.date,p.time) && typeof p.direction === 'string' && !!p.direction.trim() && p.direction.length <= 1000
    ? { id:p.id, charId:p.charId, playthroughId:p.playthroughId, date:p.date as number,
      time:p.time as TimeSlot, direction:p.direction.trim(),
      ...(isEchoBreakthroughAspect(p.echoAspect)?{echoAspect:p.echoAspect,...(isSpiritPrice(p.spent)?{spent:p.spent}:{}),
        ...(safeId(p.borrowedFrom)&&Number.isSafeInteger(p.talentTerm)&&Number(p.talentTerm)>=0?{borrowedFrom:p.borrowedFrom,talentTerm:Number(p.talentTerm)}:{})}:{}) } : null
  if (recover && pending) meters[pending.charId] = refundSpirit(meters[pending.charId]??0,pending)
  return { meters, settled, moments, pending:recover ? null : pending }
}

/** Final edited memories only, once per slot; old retained memories earn nothing again. */
export function settleBreakthrough(
  value: BreakthroughState, before: Record<string, CharInfo>, after: Record<string, CharInfo>,
  date: number, time: TimeSlot, positiveGain: (positive:number,id:string)=>number = n=>n
): BreakthroughState {
  const state = normalizeBreakthrough(value), key = `${date}:${time}`
  if (state.settled[key]) return state
  for (const [id, info] of Object.entries(after)) {
    const old = before[id]
    const signature = (m: CharInfo['memories'][number]): string => JSON.stringify([m.date,m.type,m.desc])
    const retained = new Set([...(old?.memories ?? []), ...(old?.textMemory ? [old.textMemory] : [])].map(signature))
    const fresh = [...info.memories, ...(info.textMemory ? [info.textMemory] : [])]
      .filter(m => m.date === date && !retained.has(signature(m)))
    const unique = [...new Map(fresh.map(m => [signature(m),m])).values()]
    const positive = Math.min(20,unique.reduce((sum,m) => sum + (m.type === 'loved' ? 20 : m.type === 'liked' ? 10 : 0),0))
    const penalty = unique.filter(m => m.type === 'hated').length * 15
    if (positive || penalty) state.meters[id] = meter((state.meters[id] ?? 0) + Math.max(0,positiveGain(positive,id)) - penalty)
  }
  state.settled[key] = true
  return state
}

export function outcomeOf(lines: readonly SceneLine[]): string {
  return lines.filter(line => typeof line.text === 'string' && line.text.trim())
    .map(line => `${line.speaker || 'Narrator'}: ${line.text}`).join('\n').slice(0,12000)
}

/**
 * Align continuity with the retained transcript. Supplying its previous contents also
 * refunds complete activations removed by a real prefix cut, never by rereading or edits.
 * This is pure so decision-point saves can project the same refund without changing play.
 */
export function reconcileBreakthroughWithRefunds(
  value: BreakthroughState, transcript: readonly SceneLine[], date: number, time: TimeSlot,
  previous?: readonly SceneLine[]
): {state:BreakthroughState;refunded:Set<string>} {
  const state = normalizeBreakthrough(value)
  const cut = previous && transcript.length < previous.length && transcript.every((line, i) =>
    line.speaker === previous[i].speaker && line.text === previous[i].text)
  const refunded = new Set<string>()
  for (const [id, entries] of Object.entries(state.moments)) {
    state.moments[id] = entries.flatMap(entry => {
      if (entry.date !== date || entry.time !== time || entry.transcriptStart === undefined) return [entry]
      if (cut && !entry.origin && transcript.length <= entry.transcriptStart &&
          entry.transcriptStart + entry.transcriptCount! <= previous.length &&
          isSpiritPrice(entry.spent) && !refunded.has(entry.id) &&
          outcomeOf(previous.slice(entry.transcriptStart, entry.transcriptStart + entry.transcriptCount!)) === entry.outcome) {
        state.meters[id] = meter((state.meters[id] ?? 0) + entry.spent)
        refunded.add(entry.id)
      }
      const lines = transcript.slice(entry.transcriptStart,entry.transcriptStart + entry.transcriptCount!)
      const outcome = outcomeOf(lines)
      return outcome ? [{ ...entry, outcome, transcriptCount:lines.length }] : []
    })
  }
  return {state,refunded}
}

/** Preserve the ordinary reconciliation API for callers without additional usage ledgers. */
export function reconcileBreakthrough(value:BreakthroughState, transcript:readonly SceneLine[], date:number, time:TimeSlot, previous?:readonly SceneLine[]):BreakthroughState {
  return reconcileBreakthroughWithRefunds(value,transcript,date,time,previous).state
}

/** Stable, canonical event records for prompts and a future optional memory index. */
export function breakthroughFacts(state: BreakthroughState, ids: readonly string[], date: number, time: TimeSlot) {
  return [...new Set(ids)].flatMap(charId => (state.moments[charId] ?? [])
    .filter(e => e.date < date || e.date === date && e.time <= time)
    .slice(-3).map(e => ({ id:e.id, charId, date:e.date, time:e.time, outcome:e.outcome.slice(0,6000),
      ...(e.origin ? { originalSemester: e.origin.term + 1, originalDay: e.origin.day } : {}) })))
}
