import type { PlayerStats } from '@shared/playerStats'
import { attractionInPlay, isRomanceable } from '@shared/relationship'
import { readerCrushFactorOf } from '@shared/npcRelationships'
import type { Character, CharFlags, CharMemory, Season } from '@shared/types'
import {
  relationshipLines as nativeRelationshipLines,
  type RelationshipMedium,
  type RelationshipProgress
} from '../prompts/relationship'
import {
  memoryLines as nativeMemoryLines,
  profileLines as nativeProfileLines
} from '../prompts/scenePrompt'
import { useGameStore } from '../stores/gameStore'

/** The character's prompt profile, with the active playthrough's attraction rules. */
export function profileLines(character: Character, flags: CharFlags, castSize = 1): string[] {
  const game = useGameStore.getState()
  const info = { ...game.charInfo[character.charId], flags }
  const attraction = attractionInPlay(character, info, game.romance, game.playerPronouns)
  return nativeProfileLines(character, flags, attraction, castSize)
}

/** Memories in the active reader's pronouns, ready for a character's prompt block. */
export function memoryLines(
  character: Character,
  memories: readonly CharMemory[],
  textMemory: CharMemory | undefined,
  season: Season
): string[] {
  return nativeMemoryLines(
    character,
    memories,
    textMemory,
    season,
    useGameStore.getState().playerPronouns
  )
}

/** Relationship context using the current playthrough's reader and romance rules. */
export function relationshipLines(
  character: Character,
  flags: CharFlags,
  nameKnown: boolean,
  affection: number,
  progress: RelationshipProgress | undefined,
  stats?: PlayerStats,
  medium?: RelationshipMedium,
  mood?: { date: number; offset: number; sick?: boolean },
  attractionGate?: boolean
): string[] {
  const game = useGameStore.getState()
  const info = { ...game.charInfo[character.charId], flags }
  return nativeRelationshipLines(character, flags, nameKnown, affection, progress, {
    stats,
    medium,
    mood,
    attractionGate,
    romanceable:
      attractionGate === false || isRomanceable(character, info, game.romance, game.playerPronouns),
    loyal:
      attractionGate !== false &&
      readerCrushFactorOf(game.npcRelationships, character.charId, character, game.date) === 0,
    readerPronouns: game.playerPronouns
  })
}
