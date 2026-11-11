import { globalSlotOf, type TimeSlot } from '@vx/modkit/shared'

export { AFTER_HOURS_MOD } from './afterHoursText'

/** The reader's phone status and the last night he ended this semester. */
export interface AfterHours {
  busy: boolean
  nightDone?: number
}

/** Restores an explicit Busy status and a whole-number completed-night marker. */
export function normalize(stored: unknown): AfterHours {
  const data = typeof stored === 'object' && stored !== null ? stored as Partial<AfterHours> : {}
  return {
    busy: data.busy === true,
    ...(typeof data.nightDone === 'number' && Number.isInteger(data.nightDone) ? { nightDone: data.nightDone } : {})
  }
}

/** A morning after an evening still owes its night until that morning's marker is recorded. */
export function nightOwed(to: { date: number; time: TimeSlot }, data: AfterHours): boolean {
  return to.time === 0 && to.date > 0 && data.nightDone !== globalSlotOf(to.date, to.time)
}

/** Busy drops her new immediate invitation in a thread the reader opened this slot. */
export function busyDrops(
  verdict: { initiatedBy: 'player' | 'contact' } | null,
  ctx: { startedBy: 'reader' | 'her'; answeringInvite: boolean },
  busy: boolean
): boolean {
  return busy && verdict?.initiatedBy === 'contact' && ctx.startedBy === 'reader' && !ctx.answeringInvite
}
