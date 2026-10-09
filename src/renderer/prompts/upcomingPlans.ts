import { globalSlotOf } from '@shared/jobs'
import { andList } from '@shared/sentences'
import type { CalendarEvent, Character } from '@shared/types'
import { formatDatePart, slotHalf } from './gameDate'

/** What the plan is for, in quotes: the detail sentence, else the chip label. */
function planText(event: CalendarEvent): string {
  const text = event.description.trim() || event.title.trim()
  return text.replace(/[.!]+$/, '')
}

/**
 * One sentence per plan still on the calendar from `fromSlot` on, keyed by each attendee's
 * charId and in slot order: she is named first, then whoever else is going.
 */
export function upcomingPlanLines(
  events: readonly CalendarEvent[],
  characters: Readonly<Record<string, Character>>,
  fromSlot: number
): Record<string, string[]> {
  const ahead = events
    .filter((event) => globalSlotOf(event.date, event.time) >= fromSlot)
    .sort((a, b) => globalSlotOf(a.date, a.time) - globalSlotOf(b.date, b.time))

  const lines: Record<string, string[]> = {}
  for (const event of ahead) {
    const text = planText(event)
    if (!text) continue
    // An attendee who resolves to nobody is dropped.
    const going = [...new Set(event.charIds)].filter((charId) => characters[charId])
    const when = `${formatDatePart(event.date)} (${slotHalf(event.time)})`
    for (const charId of going) {
      const names = [charId, ...going.filter((other) => other !== charId)].map(
        (id) => characters[id].firstName
      )
      const sentence = `${andList([...names, 'the reader'])} are planning to meet up on ${when} for "${text}".`
      lines[charId] = [...(lines[charId] ?? []), sentence]
    }
  }
  return lines
}
