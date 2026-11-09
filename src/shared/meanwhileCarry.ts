import { normalizeMeanwhile, type MeanwhileStore } from './meanwhile'
import { registerTermCarry, type TermCarryContext } from '@vx/modkit/shared'
import type { GameSave } from '@vx/modkit/shared'

declare module './modCarry' { interface ModCarryFields { exNpcWatch?: MeanwhileStore } }

export function carryMeanwhile(save: GameSave, context: TermCarryContext): MeanwhileStore | undefined {
  const { term, back, characters } = context
  const result: { exNpcWatch?: MeanwhileStore } = {}
  if (save.exNpcWatch) {
    result.exNpcWatch = {
      version: 1,
      scenes: normalizeMeanwhile(save.exNpcWatch)
        .scenes.filter((s) => s.date <= save.date)
        .map((s) => ({
          ...s,
          id: s.origin ? s.id : `term:${term}:${s.id}`,
          date: s.date - back,
          origin: s.origin ?? { term, day: s.date },
          participantNames: Object.fromEntries(
            s.participants.map((id) => [
              id,
              s.participantNames?.[id] ??
                (characters[id]
                  ? `${characters[id].firstName} ${characters[id].lastName}`.trim()
                  : id)
            ])
          )
        }))
    }
  }
  return result.exNpcWatch
}

registerTermCarry('exNpcWatch', carryMeanwhile)
