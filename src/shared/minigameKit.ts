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

/** How well a girl plays a game, from 1 to 5, as the framework judges it. */
export type SkillLevel = 1 | 2 | 3 | 4 | 5

export { freshDeck, rankMark, rankWord, type Card, type Suit } from './minigameCards'

/** A stream of floats in [0, 1) off one seed: the same game for the same seed, as a test needs. */
export { seededRand } from './hash'
export { pick, shuffle } from './shuffle'
