import { registerTermCarry } from '@vx/modkit/shared'
import { readStartingChallenge, type StartingChallenge } from './startingChallenge'

// Erased in-repo legacy typing; public-barrel augmentation must migrate as one set.
declare module './modCarry' {
  interface ModCarryFields { exStartingChallenge?: StartingChallenge }
}
registerTermCarry('exStartingChallenge', save => readStartingChallenge(save.exStartingChallenge))
