import type { ChatClock } from './chatVisibility'

/** The slot a DM prompt reads as now, including the night before a held morning. */
export function textingClockOf(game: ChatClock & {
  interlude?: { now: { from: ChatClock; clock?: 'late-night' } } | null
}): ChatClock {
  const hold = game.interlude?.now
  return hold?.clock === 'late-night' ? hold.from : { date: game.date, time: game.time }
}
