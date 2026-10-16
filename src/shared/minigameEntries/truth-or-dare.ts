import type { MiniGameDef } from '../minigameKit'

const TRUTH_OR_DARE: MiniGameDef = {
  id: 'truth-or-dare',
  modId: 'morrowkiln-party-games',
  name: 'Truth or Dare',
  icon: '🍾',
  blurb:
    'the party game: on your turn you pick truth or dare, and the player before you asks the question or sets the dare',
  format:
    'Turns go round the table, the reader first and then each girl in the order they sit, everyone getting the same number of turns. Whoever\'s turn it is picks truth or dare, and the player just before them in that order asks the question or sets the dare: with one girl the two simply ask each other. A truth is answered out loud and a dare is done on the spot, right here, in a moment; nobody leaves the table for one. Anyone may back out of a turn. A truth answered straight or a dare done scores a point; dodging the question or backing out scores nothing, and a question or dare that goes past what was agreed is void and scores for nobody. The most points wins and a shared top is a draw. How far the questions and dares go is settled before the first turn and holds for the whole game.',
  options: [
    {
      id: 'rounds',
      label: 'Turns each',
      describe:
        'how many turns each player gets, which is how many times round the table the game goes ("a quick one" is 1, "a few rounds" is 3)',
      min: 1,
      max: 5,
      default: 2
    },
    {
      id: 'heat',
      label: 'How far it goes',
      describe:
        'how far the questions and dares may go: 1 is mild, harmless fun between friends ("keep it clean", "nothing weird"); 2 is flirty, with teasing, crushes and a little closeness; 3 is bold, frank about attraction and daring, a kiss at most and never explicit ("no holding back", "make it spicy"). Pick what was said out loud, and no higher than she would be comfortable with given how close she and the reader are',
      values: { 1: 'Mild', 2: 'Flirty', 3: 'Bold' },
      min: 1,
      max: 3,
      default: 2
    }
  ],
  locations: [
    'room',
    'lowrise_dorms',
    'stalestein_bar',
    'pino_cola_lounge',
    'apogee_club',
    'selkie_beach',
    'green_hill_park',
    'cutetea'
  ],
  // A game for a room with the door shut or a table with drinks on it.
  suggest: 'never',
  suggestAt: { room: 'sometimes', lowrise_dorms: 'sometimes', stalestein_bar: 'sometimes' },
  players: { min: 1, max: 3 },
  surface: 'table',
  // Played in words: the line under the dialogue box is the game's, live when it asks for typing.
  typed: true,
  stepped: true,
  playByPlay: true,
  controls:
    'Pick Truth or Dare on your turn, and type in the line under the dialogue box when the game asks: your answer, what you do for a dare, or your question or dare for her. A suggestion can be tapped instead of typing one, and Back out passes on your turn.',
  skillBrief:
    'Nerve and quickness at this game: a good player answers straight, goes through with dares and asks questions that land; a poor one dodges, backs out and asks safe ones.'
}

export default TRUTH_OR_DARE
