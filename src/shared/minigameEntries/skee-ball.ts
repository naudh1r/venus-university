import type { MiniGameDef } from '../minigameKit'

const SKEE_BALL: MiniGameDef = {
  id: 'skee-ball',
  modId: 'morrowkiln-arcade-games',
  name: 'Skee-Ball',
  calledAs: ['skeeball'],
  icon: '🎯',
  blurb:
    'skee-ball on an arcade alley: balls rolled up a ramp to hop into rings worth 10 to 50, with two small 100 pockets in the top corners',
  format:
    'Skee-Ball. A ball is rolled up the ramp and hops onto a board of rings: up the middle a 20, a 30, a 40 and a small 50 at the top, with two small 100 pockets in the top corners. A ball that drops in a ring scores it; a ball that falls short, goes off the back wall or lands between the rings rolls down to the gutter and scores 10, and one that lands on a rim can drop either way. The corner pockets are small and next to nothing but gutter, so going for one is a gamble. Everyone playing rolls the same number of balls, one ball each in turn, the reader first and then each girl, and the highest total wins; the top total shared is a draw between those who share it. Alone, the reader rolls his balls for a score.',
  options: [
    {
      id: 'balls',
      label: 'Balls each',
      describe: 'how many balls each player rolls: 6 is the usual game, 9 a full rack, 3 a quick one',
      min: 3,
      max: 9,
      default: 6
    }
  ],
  locations: ['btb_arcade'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls: 'Space or a click, twice: your line across the lane, then your power.',
  stepped: false,
  skillBrief:
    'A good player has a smooth, repeatable roll and a feel for the weight, lands the 40s and 50s ball after ball and knows when a corner pocket is worth the gamble; a poor one sprays balls into the gutter and cannot resist the 100s.'
}

export default SKEE_BALL
