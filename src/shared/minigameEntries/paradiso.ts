import type { MiniGameDef } from '../minigameKit'

const PARADISO: MiniGameDef = {
  id: 'paradiso',
  modId: 'morrowkiln-arcade-games',
  name: 'PARADISO',
  calledAs: [
    'ddr',
    'dance dance revolution',
    'dance dance',
    'dance',
    'dancing',
    'rhythm game',
    'pump it up',
    'stepmania'
  ],
  icon: '💃',
  blurb:
    'an arcade dance machine: arrows climb the screen and the dancer stamps the matching pad on the beat',
  format:
    'One song, a little under a minute. Arrows rise up the screen in four lanes, left, down, up and right, and each is stepped on as it reaches the top; a step is judged Perfect, Great, Good or a Miss by how close to the beat it lands, steps in a row without a miss build a combo, and the score is graded from AAA down to D. Alone the reader dances for a grade. With a girl the two stand side by side on the two pads and dance the same steps at the same time, and the higher score wins; equal scores are a draw.',
  options: [
    {
      id: 'difficulty',
      label: 'Difficulty',
      describe:
        'how hard the song is, from 1, slow with a step on most beats, to 5, fast and crowded with steps between the beats and two pads at once',
      values: { 1: '1 · easy', 2: '2', 3: '3', 4: '4', 5: '5 · hard' },
      min: 1,
      max: 5,
      default: 2
    }
  ],
  // A cabinet: it is played where it stands, and it is what people come to the arcade for.
  locations: ['btb_arcade'],
  suggest: 'often',
  surface: 'board',
  keys: true,
  players: { min: 0, max: 1 },
  controls: 'Arrow keys, or D F J K, as each arrow reaches the top. The targets can be clicked too.',
  skillBrief:
    'A good dancer has rhythm, some dance or music behind her, the fitness to keep it up for a whole song and hours already spent on arcade machines; a poor one is stiff, off the beat, quickly winded or has never stood on a dance pad.'
}

export default PARADISO
