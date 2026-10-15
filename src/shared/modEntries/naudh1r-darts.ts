import { packMod } from '../minigameKit'
import DARTS from '../minigameEntries/darts'

/** A pack: one mod bringing one game, with a switch of its own among the options. */
export default packMod({
  id: 'naudh1r-darts',
  name: '[N] Double or Nothing',
  author: 'naudh1r',
  version: '0.1.0',
  blurb: 'Darts at the Pino-Cola Lounge: beat the house alone, or throw with her as a team or against her.',
  games: [DARTS]
})
