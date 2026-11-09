import { normalizeBreakthrough, type BreakthroughState } from './breakthrough'
import { registerTermCarry, type TermCarryContext } from '@vx/modkit/shared'
import type { GameSave } from '@vx/modkit/shared'

declare module './modCarry' { interface ModCarryFields { exBreakthrough?: BreakthroughState } }

export function carryBreakthrough(save: GameSave, context: TermCarryContext): BreakthroughState | undefined {
  const { term, back } = context
  const result: { exBreakthrough?: BreakthroughState } = {}
  if (save.exBreakthrough) {
    const state = normalizeBreakthrough(save.exBreakthrough, true)
    result.exBreakthrough = {
      ...state,
      settled: {},
      pending: null,
      moments: Object.fromEntries(
        Object.entries(state.moments).map(([id, moments]) => [
          id,
          moments
            .filter((m) => m.date < save.date || (m.date === save.date && m.time <= save.time))
            .map((m) => ({
              id: m.id,
              date: m.date - back,
              time: m.time,
              outcome: m.outcome,
              origin: m.origin ?? { term, day: m.date }
            }))
        ])
      )
    }
  }
  return result.exBreakthrough
}

registerTermCarry('exBreakthrough', carryBreakthrough)
