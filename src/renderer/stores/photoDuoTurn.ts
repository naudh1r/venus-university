import { allowedPhotoTier, type PhotoTier } from '@shared/photoGate'
import {
  candidateNamed,
  duoCandidates,
  friendStays,
  togetherInPrivate,
  type DuoWhereabouts
} from '@shared/photoDuo'
import { duoPhotosOn } from '@shared/photoSwitches'
import { affectionFor } from '@shared/relationship'
import type { Character } from '@shared/types'
import { useGameStore } from './gameStore'
import { canSendPhotos, noExplicitPhotos } from './localPhotoStore'

/**
 * Who a girl may put in a picture beside her, as the save has it right now, and whether the one
 * she named stays in it. The rules are `photoDuo`'s; this only reads the store for them.
 */

function whereabouts(): DuoWhereabouts {
  const game = useGameStore.getState()
  return {
    overlay: game.npcOverlay,
    date: game.date,
    time: game.time,
    relationships: game.npcRelationships
  }
}

/** The girls she may name this slot, or none while the option is off. */
export function duoCandidatesOf(charId: string): Character[] {
  if (!duoPhotosOn() || !canSendPhotos()) return []
  const game = useGameStore.getState()
  const candidates = duoCandidates(charId, Object.keys(game.characters), whereabouts())
    .map((id) => game.characters[id])
    .filter((girl): girl is Character => girl !== undefined)
  // Said every time a brief is built, so a picture of two that never comes can be told apart
  // from one she was never offered.
  const name = game.characters[charId]?.firstName ?? charId
  console.log(
    candidates.length > 0
      ? `[photo] ${name} may put ${candidates.map((girl) => girl.firstName).join(' or ')} in a picture`
      : `[photo] ${name} has nobody to put in a picture: nobody with her this slot, and no girl she gets on with`
  )
  return candidates
}

/**
 * The friend a picture of `tier` keeps, from the name she gave, or null for a picture of her
 * alone: no name, a name not on her list, or a picture past everyday that the friend would not
 * send him herself, or that they are not alone together in one of their rooms for.
 */
export function settleFriend(
  charId: string,
  name: string | undefined,
  tier: PhotoTier
): Character | null {
  const friend = candidateNamed(name, duoCandidatesOf(charId))
  if (!friend) return null
  const game = useGameStore.getState()
  const info = game.charInfo[friend.charId]
  const friendAllows = allowedPhotoTier({
    flags: info?.flags,
    affection: affectionFor(info, game.date, friend),
    traits: friend.traits,
    noNsfwImages: noExplicitPhotos(),
    canRender: canSendPhotos()
  })
  const stays = friendStays({
    tier,
    friendAllows,
    togetherInPrivate: togetherInPrivate(charId, friend.charId, whereabouts())
  })
  if (!stays) {
    console.log(`[photo] ${friend.firstName} left out of a ${tier} picture: not hers to be in`)
    return null
  }
  return friend
}
