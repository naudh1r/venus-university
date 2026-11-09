import BEER_PONG from '@shared/minigameEntries/beer-pong'
import { BeerPong } from '../minigames/games/BeerPong'
import TRUTH_OR_DARE from '@shared/minigameEntries/truth-or-dare'
import { TruthOrDare } from '../minigames/games/TruthOrDare'
import { registerGame } from '../minigames/kit'

registerGame(BEER_PONG.id, BeerPong)
registerGame(TRUTH_OR_DARE.id, TruthOrDare)
