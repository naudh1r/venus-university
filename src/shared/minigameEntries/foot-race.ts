import type { MiniGameDef } from '../minigameKit'

const FOOT_RACE: MiniGameDef = {
  id: 'foot-race',
  modId: 'morrowkiln-sports',
  name: 'Foot Race',
  calledAs: ['race', 'sprint'],
  icon: '🏃',
  blurb: 'a race on foot over a measured distance, side by side in lanes, from a starting call to the line',
  format:
    'One race, run once, everyone in a lane of their own: alone the reader runs against the clock, and one to three girls can race him. A starter calls "on your marks", "set" and then "go" after a wait nobody can predict. Anyone moving before "go" has false-started and everyone is called back; a first false start is only a warning, and a second costs that runner a short hold in the blocks after the gun, never a disqualification. Running hard empties a runner, and one who goes out too fast in a longer race fades badly before the line, so those are paced and the kick is saved for the finish. First across the line wins and the rest are placed in order with their times; the same time to the hundredth of a second is a dead heat, which is a draw. Anyone not home when the race is called off, long after the rest, did not finish and is placed last. There are no heats, no best of three and no handicaps or head starts.',
  options: [
    {
      id: 'distance',
      describe:
        'how far the race is: 1 is a 100 metre sprint, all start and leg speed; 2 is 400 metres, one lap; 3 is 800 metres, two laps, a race of pacing',
      label: 'Distance',
      values: { 1: '100 m', 2: '400 m', 3: '800 m' },
      min: 1,
      max: 3,
      default: 1
    }
  ],
  // Somewhere with room to run: the track above all, the grass, the quad and the sand.
  locations: ['palaestra_stadium', 'green_hill_park', 'venus_quad', 'selkie_beach'],
  suggest: 'sometimes',
  suggestAt: { palaestra_stadium: 'often' },
  surface: 'board',
  keys: true,
  players: { min: 0, max: 3 },
  controls: 'Alternate Left and Right (the arrow keys, A and D, or the two buttons) to stride: faster is harder. Wait for GO; in the 400 and 800 m hold the pace in the band.',
  skillBrief:
    'A good runner is fit and fast, trains or plays a sport, is quick off the mark and knows how to pace a lap; a poor one is unfit or never runs, is slow away, goes out too fast and fades, or trips over her own feet.'
}

export default FOOT_RACE
