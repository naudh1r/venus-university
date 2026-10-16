import type { MiniGameDef } from '../minigameKit'

const POKER: MiniGameDef = {
  id: 'poker',
  modId: 'morrowkiln-card-games',
  name: 'Poker',
  calledAs: ['hold em', 'cards', 'card game'],
  icon: '🃏',
  blurb:
    "Texas hold'em for play chips, heads-up or around a table: two cards each, five on the board, bet or fold, and the most chips at the end wins",
  format:
    "No-limit Texas hold'em between the reader and every girl playing, each for herself, with play chips: the chips are only counters and are worth nothing themselves, so anything really at stake is whatever was agreed in words, and it goes on who wins the game. Everyone starts with the same stack and the blinds are 5 and 10 throughout, moving round with the button each hand, and a player too short for a blind is all-in for what she has; heads-up the button posts the small blind and acts first before the flop. Each hand is two cards face down each, then betting, the flop of three cards, the turn and the river, with betting after each; on his turn the reader folds, checks or calls, or bets or raises half the pot, the pot or all-in. A player all-in for less can win only the part of the pot she matched, the rest going to a side pot; the best five cards of seven win at the showdown and equal hands split the pot. Folded hands are never shown. A player with no chips is out. The game is a set number of hands, ending early if the reader loses all his chips or one player holds them all; whoever has the most chips at the end wins, and level at the top is a draw. There are no rebuys, no antes and no rising blinds.",
  options: [
    {
      id: 'hands',
      label: 'Hands in a game',
      describe: 'how many hands are played at most, whoever is playing',
      min: 3,
      max: 10,
      default: 5
    },
    {
      id: 'stack',
      label: 'Starting chips',
      describe:
        'how deep everyone starts, in tens of big blinds: 1 is 100 chips (short and fast), 2 is 200, 3 is 300, 4 is 400, 5 is 500 (deep)',
      values: { 1: '100 chips', 2: '200 chips', 3: '300 chips', 4: '400 chips', 5: '500 chips' },
      min: 1,
      max: 5,
      default: 2
    }
  ],
  // A deck and something to count with: it comes up over a drink or a slow evening in.
  suggest: 'never',
  suggestAt: {
    lowrise_dorms: 'sometimes',
    room: 'sometimes',
    stalestein_bar: 'sometimes',
    pino_cola_lounge: 'sometimes'
  },
  players: { min: 1, max: 3 },
  surface: 'board',
  controls: 'Click Fold, Check or Call, or a size to bet or raise: half the pot, the pot or all-in.',
  stepped: false,
  skillBrief:
    'A good player weighs how strong her hand is against the price of a call, bets her good hands, folds her bad ones and bluffs rarely and well; a poor one calls too much, bluffs at the wrong moments or is frightened off the best hand.'
}

export default POKER
