import type { ModDef } from '@vx/modkit/shared'
import { MEANWHILE_MOD } from '../meanwhile'

const mod: ModDef = {
  id: MEANWHILE_MOD, name: 'Meanwhile conversations', author: 'Maestro Leeds', version: '1.0.0',
  scope: 'anytime', defaultOn: true,
  blurb: 'Watch optional two-NPC conversations from a dedicated Meanwhile menu.',
  offNote: 'Saved replays stay in the playthrough. Watching changes no relationships, memories, or time.'
}
export default mod
