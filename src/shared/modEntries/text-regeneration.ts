import type { ModDef } from '@vx/modkit/shared'
import { TEXT_REGENERATION_MOD } from '../textRegeneration'

const mod: ModDef = {
  id: TEXT_REGENERATION_MOD, name: 'Text Regeneration', author: 'Maestro Leeds', version: '1.0.0',
  scope: 'anytime', defaultOn: true,
  blurb: 'Regenerate the whole latest phone reply, including every message in it.',
  offNote: 'Existing messages and reply checkpoints stay saved. Regeneration uses your configured AI.'
}
export default mod
