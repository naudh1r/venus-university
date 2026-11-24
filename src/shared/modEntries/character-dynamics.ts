import type { ModDef } from '@vx/modkit/shared'
import { CHARACTER_DYNAMICS_MOD } from '../characterDynamics'

const mod: ModDef = {
  id: CHARACTER_DYNAMICS_MOD,
  name: 'Character Dynamics',
  author: 'Maestro Leeds',
  version: '1.0.2', game: '0.9.2',
  scope: 'playthrough',
  defaultOn: false,
  blurb: 'Choose shared history and gentle personality nudges for individual characters when starting a playthrough. Multiple tags, one setup screen.',
  requires: [],
  options: []
}
export default mod
