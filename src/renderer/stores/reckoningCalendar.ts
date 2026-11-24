import { GRADUATION_DATE } from '../prompts/occasions'

/** Linking happens in a scene; entry must wait until that scene advances the clock.
 * The final daytime scene still leads to a playable night. The final night does not.
 * Spring and continuing semesters use the same relative graduation date. */
export function unspokenNightAvailable(game: { date: number; time: number }, afterScene = false): boolean {
  const entryDate = game.date + (afterScene && game.time === 1 ? 1 : 0)
  return entryDate < GRADUATION_DATE
}
