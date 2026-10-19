import { affectionFor } from '@shared/relationship'
import type { BankedOpening, CharInfo, TimeSlot } from '@shared/types'
import { isHomecomingPickSlot, pickHomecomingVisitor } from '../../prompts/homecoming'
import { useGameStore } from '../gameStore'

/** Which graduate is back in town for Homecoming, where the pick meets the store. */

/**
 * The graduate the slot opening on `date` and `time` brings back, read off `charInfo` and
 * passing over anybody in `exclude`; null on every opening but Homecoming morning's.
 */
export function homecomingPickFor(
  date: number,
  time: TimeSlot,
  charInfo: Readonly<Record<string, CharInfo>>,
  exclude: ReadonlySet<string> = new Set()
): string | null {
  const game = useGameStore.getState()
  if (!isHomecomingPickSlot(game.calendar.season, date, time)) return null
  return pickHomecomingVisitor(
    game.alumni.filter((charId) => game.characters[charId]),
    (charId) => charInfo[charId],
    (charId) => affectionFor(charInfo[charId], date, game.characters[charId]),
    exclude
  )
}

/**
 * Settles who is back for Homecoming on its morning: the pick the ending banked with this
 * slot's opening, or one made now where no scene preceded it. Null on every other slot, and
 * when nobody qualifies.
 */
export function settleHomecoming(banked: BankedOpening | null): string | null {
  const game = useGameStore.getState()
  if (!isHomecomingPickSlot(game.calendar.season, game.date, game.time)) return null
  const visitor = banked
    ? (banked.homecomingVisitor ?? null)
    : homecomingPickFor(game.date, game.time, game.charInfo)
  game.setHomecomingVisitor(visitor)
  return visitor
}
