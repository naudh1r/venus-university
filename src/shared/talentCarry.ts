import { registerTermCarry } from '@vx/modkit/shared'
import { normalizeTalents, type TalentState } from './campusTalents'
import { trainingAfterBreak } from './talentTrading'

// Erased in-repo legacy typing; public-barrel augmentation must migrate as one set.
declare module './modCarry' { interface ModCarryFields { exTalents?: TalentState } }
registerTermCarry('exTalents', (save, context) => {
  if (!save.exTalents) return undefined
  const s=normalizeTalents(save.exTalents)
  delete s.abilities.eureka
  delete s.abilities.farewell
  delete s.abilities.silverLining
  if (s.initialized) s.training=trainingAfterBreak(save.stats,context.term+1)
  return s
})
