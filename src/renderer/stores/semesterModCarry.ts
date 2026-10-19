import { carryModFields, type ModCarryFields } from '@shared/modCarry'
import { semesterShiftOf } from '@shared/semesters'
import type { Character, GameSave, SaveDraft, Season } from '@shared/types'

/** The semester being left, as the ending's carry knows it. */
export interface LeavingSemester {
  playthroughId: string
  /** Zero-based index of the semester that ended. */
  index: number
  season: Season
  /** Every character the playthrough knows, by charId. */
  characters: Record<string, Character>
}

/**
 * What the mods carry out of a finished semester into New Game+: each field a mod registered
 * with `registerTermCarry`, read off the ending's save by that mod's own adapter. The game's own
 * carry composes the next save field by field and knows nothing of a mod's fields, so this rides
 * beside it on the carry and the next semester's opening save takes it back in. Dates move back
 * by the same shift the game's carry uses, so a mod's dates land on the new semester's clock.
 */
export function modFieldsLeaving(
  save: SaveDraft,
  leaving: LeavingSemester
): Partial<ModCarryFields> {
  const full: GameSave = {
    ...save,
    playthroughId: leaving.playthroughId,
    saveId: 'ending',
    saveDate: 0
  }
  return carryModFields(full, {
    term: leaving.index,
    back: semesterShiftOf(leaving.season),
    characters: leaving.characters
  })
}
