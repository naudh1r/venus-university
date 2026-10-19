import { affectionFor } from '@shared/relationship'
import type { CharInfo, EventCancellation } from '@shared/types'
import {
  isAwayForSpringBreak,
  pickSpringBreakLeavers,
  SPRING_BREAK_LEAVE,
  SPRING_BREAK_NOTICE,
  SPRING_BREAK_RETURN
} from '../../prompts/springBreak'
import { useGameStore } from '../gameStore'

/** Who leaves campus for spring break, where the pick meets the store. */

/** What settling spring break did on its slot: who is leaving, and the plans that cost them. */
export interface SpringBreakSettle {
  away: string[]
  cancellations: EventCancellation[]
}

/**
 * The leavers the slot opening on `date` settles, read off `charInfo`; null on every opening
 * but the first on or after the notice, and in a fall, whose break sends nobody away.
 */
export function springBreakPickFor(
  date: number,
  charInfo: Readonly<Record<string, CharInfo>>
): string[] | null {
  const game = useGameStore.getState()
  if (game.calendar.season !== 'spring') return null
  if (game.springBreakAway !== null || date < SPRING_BREAK_NOTICE) return null
  return pickSpringBreakLeavers(game.chars, (charId) =>
    affectionFor(charInfo[charId], date, game.characters[charId])
  )
}

/**
 * Settles the roster's spring break, once per playthrough: the pick the ending banked with this
 * slot's opening, or one made now. Null on every slot but that one.
 */
export function settleSpringBreak(banked?: readonly string[]): SpringBreakSettle | null {
  const game = useGameStore.getState()
  if (game.calendar.season !== 'spring') return null
  const away = banked ? [...banked] : springBreakPickFor(game.date, game.charInfo)
  if (away === null || game.springBreakAway !== null || game.date < SPRING_BREAK_NOTICE) return null

  game.setSpringBreakAway(away)
  if (away.length === 0) return { away, cancellations: [] }

  // Every date she already had in the week she will be out of the country, cancelled now.
  const cancellations: EventCancellation[] = []
  for (const event of game.events) {
    if (event.date < SPRING_BREAK_LEAVE || event.date >= SPRING_BREAK_RETURN) continue
    for (const charId of event.charIds) {
      if (!isAwayForSpringBreak(away, charId, event.date)) continue
      cancellations.push({ charId, date: event.date, time: event.time, reason: 'away' })
    }
  }
  useGameStore
    .getState()
    .withdrawFromEvents(away, SPRING_BREAK_LEAVE, SPRING_BREAK_RETURN)
  return { away, cancellations }
}
