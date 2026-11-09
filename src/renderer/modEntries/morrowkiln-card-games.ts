import HIGH_LOW from '@shared/minigameEntries/high-low'
import { HighLow } from '../minigames/games/HighLow'
import BLACKJACK from '@shared/minigameEntries/blackjack'
import { Blackjack } from '../minigames/games/Blackjack'
import POKER from '@shared/minigameEntries/poker'
import { Poker } from '../minigames/games/Poker'
import CAT_PAIRS from '@shared/minigameEntries/cat-pairs'
import { CatPairs } from '../minigames/games/CatPairs'
import { registerGame } from '../minigames/kit'

registerGame(HIGH_LOW.id, HighLow)
registerGame(BLACKJACK.id, Blackjack)
registerGame(POKER.id, Poker)
registerGame(CAT_PAIRS.id, CatPairs)
