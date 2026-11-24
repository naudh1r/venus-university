import { registerTermCarry } from '@vx/modkit/shared'
import type { ReckoningState } from './reckoning'

// Erased in-repo legacy typing; public-barrel augmentation must migrate as one set.
declare module './modCarry' { interface ModCarryFields { exReckoning?: ReckoningState } }
registerTermCarry('exReckoning', () => ({ version: 1, active: null }))
