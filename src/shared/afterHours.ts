import { charKeyOf, globalSlotOf, type Character, type TimeSlot } from '@vx/modkit/shared'

export { AFTER_HOURS_MOD } from './afterHoursText'

/** The reader's phone status and the morning whose night has ended. */
export interface AfterHours {
  busy: boolean
  nightDone?: number
}

/** Restores the phone status and completed-night marker. */
export function normalize(stored: unknown): AfterHours {
  const data = typeof stored === 'object' && stored !== null ? stored as Partial<AfterHours> : {}
  return {
    busy: data.busy === true,
    ...(typeof data.nightDone === 'number' && Number.isInteger(data.nightDone) ? { nightDone: data.nightDone } : {})
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

/** Restricts her suggestions only in his chat, outside a standing invitation. */
export function busyPromptApplies(busy: boolean, startedBy: 'reader' | 'her', answeringInvite: boolean): boolean {
  return busy && startedBy === 'reader' && !answeringInvite
}

/** Busy drops her new immediate invitation in a thread the reader opened this slot. */
export function busyDrops(
  verdict: { initiatedBy: 'player' | 'contact' } | null,
  ctx: { startedBy: 'reader' | 'her'; answeringInvite: boolean },
  busy: boolean
): boolean {
  return busy && verdict?.initiatedBy === 'contact' && ctx.startedBy === 'reader' && !ctx.answeringInvite
}
