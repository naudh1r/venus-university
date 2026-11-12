import { globalSlotOf, type TimeSlot } from '@vx/modkit/shared'

export { AFTER_HOURS_MOD } from './afterHoursText'

export interface NightVisit {
  charId: string
  room: 'herRoom' | 'hisRoom'
  morning: number
  stayed?: boolean
  scened?: boolean
}

/** The reader's phone status and the night's visit, if one began. */
export interface AfterHours {
  busy: boolean
  nightDone?: number
  visit?: NightVisit
}

/** Restores the phone status, completed-night marker and a well-formed visit. */
export function normalize(stored: unknown): AfterHours {
  const data = typeof stored === 'object' && stored !== null ? stored as Partial<AfterHours> : {}
  const visit = data.visit
  const validVisit = visit && typeof visit === 'object' &&
    typeof visit.charId === 'string' && visit.charId.trim().length > 0 &&
    (visit.room === 'herRoom' || visit.room === 'hisRoom') &&
    Number.isInteger(visit.morning) && visit.morning >= 0 && visit.morning % 2 === 0 &&
    (visit.stayed === undefined || typeof visit.stayed === 'boolean') &&
    (visit.scened === undefined || typeof visit.scened === 'boolean')
  return {
    ...(validVisit ? {
      visit: {
        charId: visit.charId, room: visit.room, morning: visit.morning,
        ...(visit.stayed !== undefined ? { stayed: visit.stayed } : {}),
        ...(visit.scened !== undefined ? { scened: visit.scened } : {})
      }
    } : {}),
    busy: data.busy === true,
    ...(typeof data.nightDone === 'number' && Number.isInteger(data.nightDone) ? { nightDone: data.nightDone } : {})
  }
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

/** Chooses the hold and whether the morning can be spent with her. */
export function morningInterlude(
  to: { date: number; time: TimeSlot }, data: AfterHours, free: boolean, graduation: boolean
): 'night' | 'morningScene' | 'buttons' | null {
  if (to.time !== 0 || to.date <= 0) return null
  const visit = data.visit
  if (visit?.morning === globalSlotOf(to.date, to.time)) {
    if (!visit.stayed) return null
    if (!visit.scened) return 'morningScene'
    return !graduation && visit.room === 'herRoom' && free ? 'buttons' : null
  }
  return nightOwed(to, data) ? 'night' : null
}
