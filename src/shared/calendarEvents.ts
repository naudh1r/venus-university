import type { CalendarEvent } from './types'

/** Keep a plan's makers among its remaining attendees. */
export function withPlanAttendees(event: CalendarEvent, charIds: string[]): CalendarEvent {
  const { madeWith, ...plan } = event
  const makers = madeWith?.filter((charId) => charIds.includes(charId))
  return { ...plan, charIds, ...(makers?.length ? { madeWith: makers } : {}) }
}

/** Prefer reachable makers, with a free sender first within either group. */
export function pickPlanReminderSender(
  event: CalendarEvent,
  reachable: readonly string[],
  isBusy: (charId: string) => boolean
): string | undefined {
  const makers = reachable.filter((charId) => event.madeWith?.includes(charId))
  const candidates = makers.length > 0 ? makers : reachable
  return candidates.find((charId) => !isBusy(charId)) ?? candidates[0]
}
