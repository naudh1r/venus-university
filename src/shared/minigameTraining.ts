import type { MiniGameDef } from './minigames'
import type { StatKey } from './playerStats'
import { STAT_LABELS } from './playerStats'
import type { SlotActivityOffer } from './slotActivity'

/** One row per available game/place, shared by offering and revalidation. */
export function trainingOffers(
  owner: string, stat: StatKey, games: readonly MiniGameDef[],
  enabled: (game: MiniGameDef) => boolean,
  placeLabel: (id: string) => string | null
): SlotActivityOffer[] {
  return games.flatMap(game => {
    if (game.trainingStat !== stat || game.players.min !== 0 || !enabled(game)) return []
    return (game.locations ?? []).flatMap(location => {
      const place = placeLabel(location)
      return place ? [{ owner, id: game.id, stat, location,
        label: `Improve ${STAT_LABELS[stat]} ${game.trainingActivity ?? `by playing ${game.name}`} at ${place}.` }] : []
    })
  })
}
