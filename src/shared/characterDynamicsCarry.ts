import { registerTermCarry } from '@vx/modkit/shared'
import { readCharacterDynamics, type CharacterDynamics } from './characterDynamics'

declare module './modCarry' {
  interface ModCarryFields { exCharacterDynamics?: CharacterDynamics }
}

// Retain even absent girls and unrecognized future tags. Applying a tag is the prompt's job.
registerTermCarry('exCharacterDynamics', save => readCharacterDynamics(save))
