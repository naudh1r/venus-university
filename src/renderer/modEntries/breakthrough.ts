// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/breakthroughCarry'
import { BREAKTHROUGH_MOD } from '../../shared/breakthrough'
import { breakthroughContinuity } from '../prompts/breakthroughPrompt'
import { settleSpirit } from '../stores/breakthrough'
import { useGameStore } from '../stores/gameStore'
import { registerHooks } from '@vx/modkit/renderer'

registerHooks(BREAKTHROUGH_MOD, {
  prompts: {
    scene: { lines: ({ cast, state }) => state.breakthrough ? [breakthroughContinuity(state.breakthrough, [...cast], state.date, state.time)] : [] },
    dm: { lines: ({ character, state }) => {
      const progress = state.breakthrough ?? useGameStore.getState().exBreakthrough
      return [breakthroughContinuity(progress, [character], state.date, state.time)]
    } }
  },
  slotSettled: ({ before }) => settleSpirit(before)
})
