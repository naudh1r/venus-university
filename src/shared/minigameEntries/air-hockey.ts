import type { MiniGameDef } from '../minigameKit'

const AIR_HOCKEY: MiniGameDef = {
  id: 'air-hockey',
  modId: 'morrowkiln-arcade-games',
  name: 'Air Hockey',
  calledAs: ['hockey'],
  icon: '🏒',
  blurb:
    'a fast table game: each player has a mallet and bats a floating puck at the goal in the other end',
  format:
    'One table, a mallet each, one puck. Each player keeps to their own half and knocks the puck off the walls and past the other into the goal at their end; after a goal the puck is served toward whoever conceded. It is played in real time with no turns, and the first to five goals wins unless they agree another number, so there is always a winner.',
  options: [
    {
      id: 'goals',
      label: 'Goals to win',
      describe: 'how many goals win the game: the first to reach it wins',
      min: 3,
      max: 9,
      default: 5
    }
  ],
  // A table that needs a room built around it: the arcade, the student lounge, the boardwalk.
  locations: ['btb_arcade', 'bowling_alley', 'pino_cola_lounge', 'pier_44'],
  suggest: 'never',
  suggestAt: { btb_arcade: 'often', bowling_alley: 'sometimes' },
  players: { min: 1, max: 1 },
  surface: 'board',
  controls: 'Your mallet follows the pointer.',
  skillBrief:
    'A good player has quick hands and reads the angles, getting the mallet behind the puck before it arrives and hitting bank shots off the walls; a poor one chases the puck and leaves the goal open.'
}

export default AIR_HOCKEY
