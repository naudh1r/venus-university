import { registerTermCarry } from '@vx/modkit/shared'

// This erased declaration is compatibility typing for the in-repo legacy carry.
// Augmenting the public barrel alone shadows other legacy fields; migrate those together.
declare module './modCarry' { interface ModCarryFields { exPlotTwist?: string } }

// Old, already-prepared semester continuations can still carry mods.exPlotTwist.
// Keep accepting that field into their opening save so saveField.normalize can read it.
// Current saves no longer write it: their continuation uses saveField.carry and carry.ex.
registerTermCarry('exPlotTwist', save => typeof save.exPlotTwist === 'string' ? save.exPlotTwist : undefined)
