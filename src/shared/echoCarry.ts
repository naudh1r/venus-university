import { registerTermCarry } from '@vx/modkit/shared'
import { normalizeEcho, type EchoState } from './echo'

// Erased in-repo legacy typing; public-barrel augmentation must migrate as one set.
declare module './modCarry' { interface ModCarryFields { exEcho?: EchoState } }
registerTermCarry('exEcho', save => save.exEcho ? normalizeEcho(save.exEcho) : undefined)
