import type { MiniGameDef } from '../minigameKit'

const WHACK_A_BUN: MiniGameDef = {
  id: 'whack-a-bun',
  modId: 'morrowkiln-arcade-games',
  name: 'Whack-a-Bun',
  calledAs: ['whack a mole', 'bunnies'],
  icon: '🔨',
  blurb:
    'an arcade cabinet with nine holes: toy bunnies pop up for a moment and are bopped with a padded mallet before they duck, for points against the clock',
  format:
    'One round against the clock, of 30, 45 or 60 seconds. Each player has a cabinet of her own with nine holes, side by side, and every cabinet runs the same pattern at the same time: bunnies pop up for a moment and are bopped before they duck, faster as the round goes on, and two at once later. A bunny is 10 points. Now and then a golden bunny comes up, gone sooner and worth triple; and now and then a carrot comes up in place of a bunny, which costs 20 points if it is hit and nothing if it is left alone. Hits in a row build a small bonus, half again on every hit from the fifth in a row and double from the tenth; a bunny that gets away, a carrot hit or a swing at an empty hole ends the run, and the empty hole costs 5 points as well. A mallet takes a moment to come back after any swing, so swinging at everything loses to watching. Nobody takes turns. When the time runs out the highest score wins; the top score shared is a draw between those who share it. Alone the reader plays for a score.',
  options: [
    {
      id: 'seconds',
      label: 'Length of a round',
      describe: 'how long the round lasts: 1 is 30 seconds, 2 is 45 seconds, 3 is a full minute',
      values: { 1: '30 seconds', 2: '45 seconds', 3: '60 seconds' },
      min: 1,
      max: 3,
      default: 1
    },
    {
      id: 'pace',
      label: 'Pace',
      describe:
        'how fast the bunnies come: 1 is relaxed, 2 is lively, the usual game, 3 is frantic',
      values: { 1: 'relaxed', 2: 'lively', 3: 'frantic' },
      min: 1,
      max: 3,
      default: 2
    }
  ],
  // A cabinet: it is played where it stands, and it is what people come to the arcade for.
  locations: ['btb_arcade'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls:
    'Click a bunny as it pops up, or press its hole on the number pad: 7 8 9, 4 5 6, 1 2 3 (the number row works too). The three-by-three block of letter keys at the left of the keyboard does the same, Q W E, A S D, Z X C on a US layout, by where the keys are and not what is printed on them. Leave the carrots alone; a swing at an empty hole costs 5.',
  skillBrief:
    'A good player has quick hands and quick eyes, gets to the golden ones before they duck and never swings at a carrot; a poor one is slow off the mark, lets bunnies get away and whacks whatever comes up.'
}

export default WHACK_A_BUN
