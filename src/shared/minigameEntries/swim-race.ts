import type { MiniGameDef } from '../minigameKit'

const SWIM_RACE: MiniGameDef = {
  trainingStat: 'body',
  trainingActivity: 'by practising swimming',
  id: 'swim-race',
  modId: 'morrowkiln-sports',
  name: 'Swim Race',
  calledAs: ['race', 'swim'],
  icon: '🏊',
  blurb:
    'a freestyle swimming race, side by side in the water: long even strokes, a breath at the right moment and a clean turn at each end',
  format:
    'A freestyle race over a set number of lengths: lengths of the swimming pool at the stadium. Everyone racing dives in together on the whistle, each in a lane of their own; anyone who goes before it is called back and held while the others get away. They turn at the end of every length; the first to touch at the end of the last length wins, and the others are placed by their times, to the hundredth of a second. Two who touch in the same hundredth share the place, and the reader sharing first is a draw. Time is called 25 seconds a length after the whistle: whoever is still swimming then did not finish, is placed behind everyone who did, and for the reader that is a loss. Alone the reader swims against the clock for a time. There are no heats, no handicaps and no other strokes.',
  options: [
    {
      id: 'lengths',
      label: 'Race distance',
      describe:
        'how far the race is: 1 is two lengths of the pool, a sprint, 2 is four lengths, 3 is six lengths, a long swim that tells on anyone unfit',
      values: { 1: 'Two lengths', 2: 'Four lengths', 3: 'Six lengths' },
      min: 1,
      max: 3,
      default: 1
    }
  ],
  // Lane swimming is available only at the stadium pool.
  locations: ['palaestra_stadium'],
  suggest: 'sometimes',
  suggestAt: { palaestra_stadium: 'often' },
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls:
    'Hold Space (or J) for each stroke and let go to glide. W or ↑ takes a breath, S or ↓ turns at the wall. The buttons under the water do the same for a pointer.',
  skillBrief:
    'A good swimmer has a long, even stroke learned in lessons or on a team, breathes without breaking her rhythm, turns cleanly and has the fitness to hold her pace to the end; a poor one thrashes, comes up gasping, fumbles her turns and fades after the first length.'
}

export default SWIM_RACE
