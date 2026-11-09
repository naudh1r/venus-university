import type { MiniGameDef } from '../minigameKit'

const POOL: MiniGameDef = {
  trainingStat: 'brain',
  trainingActivity: 'by practising pool',
  id: 'pool',
  modId: 'morrowkiln-arcade-games',
  name: 'Pool',
  calledAs: ['billiards', 'eight ball', '8 ball'],
  icon: '🎱',
  blurb:
    'eight-ball on a pool table: each player pots their seven balls, solids or stripes, and then the black eight',
  format:
    'Eight-ball, played in turns on one table. The reader breaks the first rack and the break alternates after it; whoever breaks may put the cue ball anywhere behind the head string first. The table is open until someone pots a ball, and the first ball potted makes that player solids or stripes for the rack; an eight that drops on the break is put back. A player who pots one of their own balls shoots again, otherwise the turn passes. Potting the cue ball, hitting nothing, or hitting the wrong ball first (the other group, or the eight too soon) is a foul: the turn passes and the other player places the cue ball anywhere. Whoever clears their group and then pots the eight wins the rack; potting the eight early, fouling on the shot that pots it, or potting the cue ball when shooting at the eight loses it, so a rack always has a winner. Shots are not called and a safety is not declared, only played: with no pot on she plays to hit one of her own balls and leave the cue ball awkwardly. It is one rack unless they agree best of three. Alone, the reader simply clears the table and counts his shots.',
  options: [
    {
      id: 'race',
      label: 'Racks to win',
      describe:
        'how many racks win the match: 1 is a single rack, 2 is best of three racks (first to two)',
      values: { 1: 'A single rack', 2: 'Best of three' },
      min: 1,
      max: 2,
      default: 1
    }
  ],
  // Where a table stands: the bar and the student lounge, the dorm common room, the club's back room.
  locations: ['stalestein_bar', 'pino_cola_lounge', 'lowrise_dorms', 'apogee_club'],
  suggest: 'sometimes',
  suggestAt: {
    stalestein_bar: 'often',
    pino_cola_lounge: 'often',
    lowrise_dorms: 'sometimes',
    apogee_club: 'sometimes'
  },
  players: { min: 0, max: 1 },
  surface: 'board',
  controls: 'Aim with the pointer; hold the button while the power rises and falls, and let go to shoot. Before a break you may click behind the head string to move the cue ball there. After a foul against you, click the table to put the cue ball down.',
  stepped: false,
  skillBrief:
    'A good player picks the shot that is on, cues straight with the right weight and strings several pots together; a poor one takes on hard cuts, misses by a ball\'s width and sometimes sends the cue ball into a pocket.'
}

export default POOL
