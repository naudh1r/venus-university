import type { CalendarEvent } from './types'

/** Keep a plan's makers among its remaining attendees. */
export function withPlanAttendees(event: CalendarEvent, charIds: string[]): CalendarEvent {
  const { madeWith, ...plan } = event
  const makers = madeWith?.filter((charId) => charIds.includes(charId))
  return { ...plan, charIds, ...(makers?.length ? { madeWith: makers } : {}) }
}

/** Assign each reachable attendee one plan, preferring the first one they helped make. */
export function planRemindersFor(
  events: readonly CalendarEvent[],
  isReachable: (charId: string) => boolean
): Map<string, CalendarEvent> {
  const reminders = new Map<string, CalendarEvent>()
  for (const event of events) {
    for (const charId of event.charIds) {
      if (!isReachable(charId)) continue
      const previous = reminders.get(charId)
      if (!previous || (event.madeWith?.includes(charId) && !previous.madeWith?.includes(charId))) {
        reminders.set(charId, event)
      }
    }
  }
  return reminders
}
