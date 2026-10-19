import { describe, expect, it } from 'vitest'
import {
  endVacationOf,
  GRADUATION_DATE,
  isBreakOutingWeek
} from '../src/renderer/prompts/occasions'
import { formatWeekday } from '../src/renderer/prompts/gameDate'

/**
 * The end of the semester: the summer outing window is derived off the
 * occasion table, so an arithmetic slip moves it without anything complaining.
 */

describe('isBreakOutingWeek', () => {
  // The invariant `outingWindowOf` rests on: a per-slot fatigue record and a
  // per-weekend one must never both apply to the same slot.
  it('never covers a weekend', () => {
    for (let date = endVacationOf('spring').startDate; date <= GRADUATION_DATE; date++) {
      const weekday = formatWeekday(date)
      if (weekday === 'Saturday' || weekday === 'Sunday') {
        expect(isBreakOutingWeek(date, 'spring')).toBe(false)
      }
    }
  })
})
