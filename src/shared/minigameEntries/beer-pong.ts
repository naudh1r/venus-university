import type { MiniGameDef } from '../minigameKit'

const BEER_PONG: MiniGameDef = {
  id: 'beer-pong',
  modId: 'morrowkiln-party-games',
  name: 'Beer Pong',
  calledAs: ['pong'],
  icon: '🍺',
  blurb:
    'beer pong across a table: a triangle of cups at each end, a ball lobbed into the other side\'s cups, and whoever\'s cup is hit drinks it',
  format:
    'Beer pong. Each side has a triangle of cups and throws at the other\'s. With one girl it is the reader against her; with two it is the reader alone against the two of them as a team; with three it is two teams of two, the reader partnered with the first girl named and the other two together. Sides take turns, the reader\'s side first; a turn is two throws, one each where a side has two players, both by the same player where it has one. A ball in a cup takes that cup away and the side it belonged to drinks it, sharing the cups between its players; a ball may catch a rim and go either way. Both throws of a turn sunk is balls back: that side throws two more, once a turn. Once in the game, when the cups it is throwing at are down to four, three or two, a side may have them re-racked tight together. The more a side has drunk, the worse it throws. The side that clears the other\'s cups first wins, unless the other makes its redemption: it throws until it misses, and if it clears every cup left without a miss the game goes to overtime, three cups a side, played the same way, the side that cleared first throwing first. There are no draws and no bounce shots, and nobody swats a ball away.',
  options: [
    {
      id: 'cups',
      label: 'Cups a side',
      values: { 1: 'Six cups', 2: 'Ten cups' },
      describe: 'how many cups each side racks: 1 is six cups, the usual quick game, and 2 is ten cups, the full long one',
      min: 1,
      max: 2,
      default: 1
    }
  ],
  locations: ['stalestein_bar', 'lowrise_dorms', 'room', 'apogee_club', 'pino_cola_lounge'],
  suggest: 'never',
  suggestAt: { stalestein_bar: 'often', lowrise_dorms: 'sometimes', apogee_club: 'sometimes' },
  surface: 'board',
  keys: true,
  players: { min: 1, max: 3 },
  controls: 'Space or a click, twice: your aim, then your arc. A button calls your one re-rack.',
  stepped: false,
  skillBrief:
    'A good player has a soft, repeatable lob and a steady hand that holds up after a few drinks, and picks her cup; a poor one flings it at the rack and hopes, and gets wilder with every cup.'
}

export default BEER_PONG
