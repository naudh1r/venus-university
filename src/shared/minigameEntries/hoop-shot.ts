import type { MiniGameDef } from '../minigameKit'

const HOOP_SHOT: MiniGameDef = {
  trainingStat: 'body',
  trainingActivity: 'by shooting hoops',
  id: 'hoop-shot',
  modId: 'morrowkiln-arcade-games',
  name: 'Hoop Shot',
  calledAs: ['hoop', 'basketball'],
  icon: '🏀',
  blurb:
    'an arcade basketball machine: a row of cabinets side by side, everyone shooting as many baskets as they can before the buzzer',
  format:
    'One round on the clock, 30 seconds unless a longer one was agreed. Everyone playing has a cabinet of their own and shoots at the same time, ball after ball, each ball coming back to the hand a moment after it is thrown. A basket is 2 points. In the last third of the round the hoop starts sliding from side to side and a basket is 3. Three baskets in a row put a shooter on fire, and every basket from the third on is worth 1 more until a miss ends the run. A ball in the air at the buzzer still counts. Alone the reader shoots for a score. With girls the most points at the buzzer wins; the top score shared is a draw between those who share it.',
  options: [
    {
      id: 'seconds',
      label: 'Round length',
      describe:
        'how long the round runs: 1 is 30 seconds, 2 is 45 seconds, 3 is a full minute',
      values: { 1: '30 seconds', 2: '45 seconds', 3: '60 seconds' },
      min: 1,
      max: 3,
      default: 1
    }
  ],
  // A row of cabinets: it is played where they stand.
  locations: ['btb_arcade'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls:
    'Space, or the Shoot button, as the power meter crosses the marked band. The ball takes a moment to come back, so shoot in rhythm.',
  skillBrief:
    'A good shooter has a soft, repeatable touch, plays or has played basketball, finds a rhythm and keeps it when the hoop starts moving; a poor one heaves the ball, rushes, and loses the hoop as soon as it slides.'
}

export default HOOP_SHOT
