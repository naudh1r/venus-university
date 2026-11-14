import { describe, expect, it } from 'vitest'
import { textingClockOf } from '@shared/textingClock'

describe('the slot a DM prompt reads as now', () => {
  it('uses the game clock without a late-night hold', () => {
    const game = { date: 8, time: 0 as const }
    expect(textingClockOf(game)).toEqual(game)
    expect(textingClockOf({ ...game, interlude: { now: { from: { date: 7, time: 1 } } } })).toEqual(game)
  })

  it('uses the finished evening while a late-night hold stands', () => {
    expect(textingClockOf({
      date: 8, time: 0,
      interlude: { now: { from: { date: 7, time: 1 }, clock: 'late-night' } }
    })).toEqual({ date: 7, time: 1 })
  })
})
