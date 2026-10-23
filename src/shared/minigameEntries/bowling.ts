import type { MiniGameDef } from '../minigameKit'

const BOWLING: MiniGameDef = {
  trainingStat: 'body',
  trainingActivity: 'by practising bowling',
  id: 'bowling',
  modId: 'morrowkiln-arcade-games',
  name: 'Bowling',
  calledAs: ['bowl'],
  icon: '🎳',
  blurb:
    'ten-pin bowling on a short lane: two balls a frame at ten pins, strikes and spares scored as they are in any alley',
  format:
    'Ten-pin bowling. Each frame a bowler has two balls at ten pins; all ten with the first is a strike and scores ten plus the next two balls, all ten with both is a spare and scores ten plus the next ball, and in the last frame a strike or a spare earns the extra balls to settle it. Everyone playing bowls each frame in turn, the reader first and then each girl, all bowling the same number of frames, and the highest total wins; the top total shared is a draw between those who share it.',
  options: [
    {
      id: 'frames',
      label: 'Frames in a game',
      describe: 'how many frames each bowler plays: 10 is a full game, fewer is a quick one',
      min: 3,
      max: 10,
      default: 5
    }
  ],
  // Lanes are where the lanes are: City Life's bowling alley. Without that mod nobody is ever
  // stood in one, and the game is simply not on offer.
  locations: ['bowling_alley'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls: 'Space or a click, three times: your spot, your power, your hook.',
  stepped: false,
  skillBrief:
    'A good bowler has the coordination and the practice to put the ball in the pocket time after time, the strength to carry the pins and the focus to pick up her spares; a poor one sprays it about and finds the gutter.'
}

export default BOWLING
