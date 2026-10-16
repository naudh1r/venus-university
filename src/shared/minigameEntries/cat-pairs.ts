import type { MiniGameDef } from '../minigameKit'

const CAT_PAIRS: MiniGameDef = {
  id: 'cat-pairs',
  modId: 'morrowkiln-card-games',
  name: 'Cat Pairs',
  calledAs: ['pairs', 'matching game', 'memory game'],
  icon: '🐾',
  blurb:
    "a calm memory game with the café's own deck: cards lie face down, each café cat is on two of them, and players turn two at a time looking for pairs",
  format:
    "The cards are laid face down in a grid, every café cat on exactly two of them. The player whose turn it is turns two cards face up for everyone to see: if they show the same cat it is a pair, which that player keeps, and the same player goes again; if not, both are turned face down again where they lay and the turn passes. The reader goes first, then each girl in the order they sit. It ends when every pair is taken: most pairs wins, and sharing the most is a draw. With the café cat in play, a couple of times a game, between turns and never while cards are face up, a cat walks across the table and two face-down cards trade places in plain sight. Played alone it is the same table with nobody to beat, counted in turns.",
  options: [
    {
      id: 'pairs',
      label: 'Pairs on the table',
      describe: 'how many pairs of cats are laid out, which is how long the game is',
      min: 6,
      max: 12,
      default: 9
    },
    {
      id: 'cats',
      label: 'Café cat swaps cards',
      values: { 0: 'No cat', 1: 'With the cat' },
      describe:
        'whether a café cat is let near the table to swap face-down cards now and then: 1 with the cat, 0 for a plain game with no swaps',
      min: 0,
      max: 1,
      default: 1
    }
  ],
  locations: ['cat_cafe', 'cutetea'],
  // The café keeps the deck on its tables; at the tea room it is one of the games on the shelf.
  suggest: 'sometimes',
  suggestAt: { cat_cafe: 'often', cutetea: 'sometimes' },
  players: { min: 0, max: 3 },
  surface: 'table',
  controls: 'On your turn, click two face-down cards to turn them.',
  stepped: false,
  skillBrief:
    'A good player remembers where every card that has been turned lies, follows the cards a cat moves, and never turns a card blind when a pair is known; a poor one forgets what was shown a turn ago and mostly guesses.'
}

export default CAT_PAIRS
