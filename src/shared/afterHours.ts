import { charKeyOf, globalSlotOf, type Character, type TimeSlot } from '@vx/modkit/shared'

export { AFTER_HOURS_MOD } from './afterHoursText'

/** A night spent together, kept until the morning it ends on has opened. */
export interface StayOver {
  charId: string
  room: 'herRoom' | 'hisRoom'
  morning: number
}

/** The reader's phone status, the morning whose night has ended, and a night spent together. */
export interface AfterHours {
  busy: boolean
  nightDone?: number
  stayOver?: StayOver
}

/** Restores the phone status, completed-night marker and a well-formed stay-over. */
export function normalize(stored: unknown): AfterHours {
  const data = typeof stored === 'object' && stored !== null ? stored as Partial<AfterHours> : {}
  const stay = data.stayOver
  const validStay = stay && typeof stay === 'object' && typeof stay.charId === 'string' && stay.charId.length > 0 &&
    (stay.room === 'herRoom' || stay.room === 'hisRoom') && Number.isInteger(stay.morning)
  return {
    busy: data.busy === true,
    ...(typeof data.nightDone === 'number' && Number.isInteger(data.nightDone) ? { nightDone: data.nightDone } : {}),
    ...(validStay ? { stayOver: { charId: stay.charId, room: stay.room, morning: stay.morning } } : {})
  }
}

/** The girl of this cast the ledger says is staying over, in a room they can share. */
export function stayOverOf(ledger: unknown, cast: readonly Character[]): { girl: Character; room: 'herRoom' | 'hisRoom' } | null {
  if (!ledger || typeof ledger !== 'object') return null
  const { stayedOverWith, stayedOverIn } = ledger as { stayedOverWith?: unknown; stayedOverIn?: unknown }
  if (typeof stayedOverWith !== 'string' || stayedOverWith === 'none' ||
    (stayedOverIn !== 'herRoom' && stayedOverIn !== 'hisRoom')) return null
  const girl = cast.find(girl => charKeyOf(girl.firstName, girl.lastName) === stayedOverWith)
  return girl ? { girl, room: stayedOverIn } : null
}

/** A morning after an evening still owes its night until that morning's marker is recorded. */
export function nightOwed(to: { date: number; time: TimeSlot }, data: AfterHours): boolean {
  return to.time === 0 && to.date > 0 && data.nightDone !== globalSlotOf(to.date, to.time)
}

/** Busy keeps a chat the reader opened from becoming a meet-up now. */
export function busyPromptApplies(busy: boolean, startedBy: 'reader' | 'her'): boolean {
  return busy && startedBy === 'reader'
}
