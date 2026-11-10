import { PHOTO_FEATURE_ID, PHOTO_FEATURE_MOD } from '../photoDefinition'
import type { ModDef } from '@vx/modkit/shared'

const mod: ModDef = {
  ...PHOTO_FEATURE_MOD,
  id: PHOTO_FEATURE_ID,
  version: '1.7.2',
  // A built-in mod only acts on `invoke`; an installed release's manifest lists everything.
  hooks: ['invoke']
}
export default mod
