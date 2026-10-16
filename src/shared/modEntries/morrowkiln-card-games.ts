import { packMod } from '../minigameKit'
import HIGH_LOW from '../minigameEntries/high-low'
import BLACKJACK from '../minigameEntries/blackjack'
import POKER from '../minigameEntries/poker'
import CAT_PAIRS from '../minigameEntries/cat-pairs'

/** A pack: one mod bringing several games, each with a switch of its own among the options. */
export default packMod({
  id: 'morrowkiln-card-games',
  name: '[MK] Card Games',
  author: 'morrowkiln',
  version: '0.1.0-beta',
  blurb: 'Cards on the table: quick ones for anywhere, and longer ones for an evening in.',
  games: [HIGH_LOW, BLACKJACK, POKER, CAT_PAIRS]
})
