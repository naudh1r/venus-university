import DARTS from '@shared/minigameEntries/darts'
import { DartsPack } from '../minigames/games/DartsPack'
import { registerGame } from '../minigames/kit'

registerGame(DARTS.id, DartsPack)
