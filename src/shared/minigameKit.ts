/**
 * Everything a game pack may use from outside its own files, for the half of a pack that is pure:
 * its games on paper, its mod entry and its rules. A pack imports from here and from nowhere else
 * in the game, so the game can change underneath without a pack noticing. The half that is drawn
 * has its own, `src/renderer/minigames/kit`. `test/minigamePacks.test.ts` holds packs to both.
 */

export {
  MINI_GAMES,
  fewestWith,
  listed,
  packMod,
  type Chattiness,
  type GameOption,
  type MiniGameDef,
  type PlaySurface,
  type SuggestRate
} from './minigames'

/**
 * The words a game's lines are written in. A player at the table is a girl or a guy, and the
 * reader is he, she or they, so a line never spells a pronoun out: it takes a player's from
 * `PRONOUNS[gender]` (`they`, `them`, `their`, `theirs`, `themself`, and each with a capital), and
 * the reader's from `readerWords(reader, beside)` (`he`, `him`, `his`, `hers`, `himself`, `He`,
 * `Him`, `His`), `beside` being the gender of the one player the line names with the reader.
 * A reader whose pronouns are that player's too is then named outright, and a they/them reader's
 * subject is "the reader", so a verb after `he` is always singular.
 */
// Taken from the game's own file, as the seeded draw below is: this file is read while the mods
// are still being listed, before the kit can be.
export { PRONOUNS, readerGenderOf, readerWords } from './gender'
export type { Gender, Pronouns, ReaderPronouns, ReaderWords } from '@vx/modkit/shared'

import { PRONOUNS, readerGenderOf, readerWords } from './gender'
import type { Gender, Pronouns, ReaderPronouns, ReaderWords } from '@vx/modkit/shared'

/** One gender's words: what a line about a player of that gender is written in. */
export function wordsOf(gender: Gender): Pronouns {
  return PRONOUNS[gender]
}

/**
 * The reader's words for a line that names several players with the reader: the reader's own
 * pronouns, or the reader named outright where any of those players shares them.
 */
export function readerAmong(reader: ReaderPronouns, genders: readonly Gender[]): ReaderWords {
  const own = readerGenderOf(reader)
  return readerWords(reader, own !== null && genders.includes(own) ? own : undefined)
}

/** The reader's pronouns as a sheet's heading tags them. */
export function readerTag(reader: ReaderPronouns): string {
  return reader === 'she' ? 'she/her' : reader === 'they' ? 'they/them' : 'he/him'
}

/** How well a player plays a game, from 1 to 5, as the framework judges it. */
export type SkillLevel = 1 | 2 | 3 | 4 | 5

export { freshDeck, rankMark, rankWord, type Card, type Suit } from './minigameCards'

/** A stream of floats in [0, 1) off one seed: the same game for the same seed, as a test needs. */
export { seededRand } from './hash'
export { pick, shuffle } from './shuffle'
