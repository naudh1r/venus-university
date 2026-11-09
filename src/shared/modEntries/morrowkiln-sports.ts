import { packMod } from '../minigameKit'
import FOOT_RACE from '../minigameEntries/foot-race'
import SWIM_RACE from '../minigameEntries/swim-race'
import ROLLER_DERBY from '../minigameEntries/roller-derby'

/** A pack: one mod bringing several games, each with a switch of its own among the options. */
export default packMod({
  id: 'morrowkiln-sports',
  name: '[MK] Sports',
  author: 'morrowkiln',
  version: '0.1.0-beta',
  blurb: 'Races on foot, in the water and on skates, alone against the clock or against the girls.',
  games: [FOOT_RACE, SWIM_RACE, ROLLER_DERBY]
})
