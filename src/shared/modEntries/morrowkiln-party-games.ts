import { packMod } from '../minigameKit'
import BEER_PONG from '../minigameEntries/beer-pong'
import TRUTH_OR_DARE from '../minigameEntries/truth-or-dare'

/** A pack: one mod bringing several games, each with a switch of its own among the options. */
export default packMod({
  id: 'morrowkiln-party-games',
  name: '[MK] Party Games',
  author: 'morrowkiln',
  version: '0.1.0-beta',
  blurb: 'Games for a drink and a dare among adults: the kind an evening turns on.',
  games: [BEER_PONG, TRUTH_OR_DARE]
})
