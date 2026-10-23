import { MINI_GAMES, MINI_GAMES_LIST, OFFER_TRAINING } from '@shared/minigames'
import { optionOn } from '@shared/mods'
import { locationAvailable } from '@shared/cityLife'
import { locationDefOf } from '@shared/locations'
import { trainingOffers } from '@shared/minigameTraining'
import type { StatKey } from '@shared/playerStats'
import type { SlotActivityOffer } from '@shared/slotActivity'
import { useGameStore } from '../stores/gameStore'
import { useModsStore } from '../stores/modsStore'
import { gameIsOn } from './table'
import { gameComponent } from './play'

function available(stat: StatKey): SlotActivityOffer[] {
  return trainingOffers(MINI_GAMES, stat, MINI_GAMES_LIST,
    game => gameIsOn(game.modId, game) && Boolean(gameComponent(game.id)),
    id => locationAvailable(id) ? locationDefOf(id)?.label ?? null : null)
}

export function trainingSuggestions(stat: StatKey): SlotActivityOffer[] {
  return optionOn(useModsStore.getState().switches, MINI_GAMES, OFFER_TRAINING) ? available(stat) : []
}

/** Turning suggestions off does not cancel a slot already committed. */
export function trainingAvailable(offer: SlotActivityOffer): boolean {
  return offer.owner === MINI_GAMES && available(offer.stat).some(candidate =>
    candidate.id === offer.id && candidate.location === offer.location)
}

export function pendingTraining() {
  const activity = useGameStore.getState().sceneActivity
  return activity?.owner === MINI_GAMES && activity.status === 'pending' ? activity : null
}
