import type { ModDef } from '@vx/modkit/shared'
import { RECKONING_AFFECTION_MIN } from '../reckoning'

const mod: ModDef = {
  id: 'reckoning',
  name: 'Breaking Through the Silence',
  author: 'Maestro Leeds',
  version: '0.7.12',
  scope: 'anytime',
  defaultOn: false,
  requires: ['breakthrough'],
  blurb: `At ${RECKONING_AFFECTION_MIN}+ affection and 100 spirit, help a girl challenge three limiting beliefs and earn her own Character Dynamics growth tag.`,
  offNote: 'Keeps saved encounters and earned tags. Character Dynamics can still apply earned growth when that mod is active.',
  options: [
    {
      id: 'prepare-questions',
      label: 'Prepare questions in the background',
      default: false,
      hint: 'Off by default: generate questions when you open them. Turn on to prepare thoughts for eligible girls in the current scene at 100 spirit. Uses your text provider even if you never start.'
    },
    {
      id: 'glitch-effects',
      label: 'Glitch effects',
      default: true,
      hint: 'A stronger wordless burst when the link opens, plus brief interference during private whispers and reflection questions. Off keeps whispers as calm translucent text. Respects reduced motion; also in Echoes > Your Echo > Stage.'
    }
  ]
}
export default mod
