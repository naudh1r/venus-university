import type { MiniGameDef } from '../minigameKit'

const DARTS: MiniGameDef = {
  id: 'darts',
  modId: 'naudh1r-darts',
  name: 'Double or Nothing',
  calledAs: ['darts', 'dart', 'dartboard'],
  icon: '🎯',
  blurb:
    'darts at the lounge dartboard: alone against the score the house has posted, or with her, as a team against the house or against each other at 301',
  format:
    'Darts at a dartboard, three darts a visit. A dart scores the number it hits, double on the outer ring and treble on the inner ring, 25 for the outer bull, 50 for the bullseye and nothing off the board. Alone, the reader plays Beat the House: five visits, every point counting, against the score the house has posted. More than the house wins, less loses and the same is a draw. With a girl the two either team up or play each other, taking alternate visits with the reader first. As a team they share one countdown from 301 (or 501 or 701 if agreed) and must bring it to exactly zero within five visits in all. Zero beats the house, and anything left when the visits run out loses to it. Against each other each counts down from 301 on their own. The first to reach exactly zero wins at once, so a reader who checks out ends the game before she replies. After six visits each with nobody out, the lower score left wins, and level is a draw. In both countdowns a dart that takes a score below zero is a bust: the visit ends and scores nothing. There is no need to finish on a double.',
  options: [
    {
      id: 'match',
      label: 'With her',
      describe:
        'how a game of darts with her is played: 0 to team up against the house, sharing one countdown, or 1 to play against each other, 301 each, first to exactly zero',
      values: { 0: 'Team up against the house', 1: 'Against each other, 301' },
      min: 0,
      max: 1,
      default: 0
    },
    {
      id: 'countdown',
      label: 'Team countdown',
      describe:
        'the score a team game counts down from: 0 for 301, 1 for 501, 2 for 701. It is ignored against each other, which is always 301',
      values: { 0: '301', 1: '501', 2: '701' },
      min: 0,
      max: 2,
      default: 0
    }
  ],
  // The board hangs in the lounge, so that is the one place it is played.
  locations: ['pino_cola_lounge'],
  suggest: 'never',
  suggestAt: { pino_cola_lounge: 'sometimes' },
  surface: 'board',
  keys: true,
  players: { min: 0, max: 1 },
  controls:
    'Aim with the pointer or the arrow keys, hold the click or Space to lock the aim, and let go when the moving dot is where you want the dart.',
  stepped: false,
  skillBrief:
    'A good darts player groups her darts tightly where she aims, stays steady from dart to dart and keeps her nerve on a finish, and a poor one sprays them round the board and busts when it gets close.'
}

export default DARTS
