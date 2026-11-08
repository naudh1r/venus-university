import type { ModDef } from '@vx/modkit/shared'

export const SOUNDTRACK_MOD = 'custom-soundtracks'
const SOUNDTRACK_DEF: ModDef = {
  id: SOUNDTRACK_MOD, name: 'Custom soundtracks', author: 'Maestro Leeds', version: '1.1.1',
  scope: 'anytime', defaultOn: true,
  blurb: 'Replace the game’s music with your own local audio files. Open Custom soundtracks in Settings.',
  offNote: 'Turning this off plays the original music. Your imported tracks and choices are kept.'
}

export default SOUNDTRACK_DEF
