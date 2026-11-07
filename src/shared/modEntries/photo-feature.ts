import { PHOTO_FEATURE_ID, PHOTO_FEATURE_MOD } from '../photoDefinition'
import type { ModDef } from '@vx/modkit/shared'

const mod: ModDef = {
  ...PHOTO_FEATURE_MOD,
  id: PHOTO_FEATURE_ID,
  version: '1.7.1',
  hooks: [
    'invoke', 'renderer:invoke', 'shared:sharedModOn',
    'renderer:modOptionOn', 'renderer:useModOn', 'renderer:useModOption',
    'main:modOptionOn'
  ]
}
export default mod
