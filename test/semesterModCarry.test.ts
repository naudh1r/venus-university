import { describe, expect, it } from 'vitest'
import { carriedModFields, registerTermCarry } from '../src/shared/modCarry'
import { modFieldsLeaving } from '../src/renderer/stores/semesterModCarry'
import type { SaveDraft } from '../src/shared/types'

declare module '../src/shared/modCarry' {
  interface ModCarryFields {
    exTestCarry?: { day: number; term: number; playthrough: string }
  }
}

describe("a mod's fields across New Game+", () => {
  registerTermCarry('exTestCarry', (save, { back, term }) => {
    // A mod declares its own field on the save; the test reads it as one would.
    const held = (save as { exTestCarry?: { day: number } }).exTestCarry
    return held ? { day: held.day - back, term, playthrough: save.playthroughId } : undefined
  })

  it("reads each field off the ending with the mod's adapter, dates moved by the semester shift", () => {
    const ending = { exTestCarry: { day: 100, term: 0, playthrough: '' } } as unknown as SaveDraft
    const spring = modFieldsLeaving(ending, {
      playthroughId: '7',
      index: 0,
      season: 'spring',
      characters: {}
    })
    expect(spring.exTestCarry).toEqual({ day: -110, term: 0, playthrough: '7' })
    const fall = modFieldsLeaving(ending, {
      playthroughId: '7',
      index: 1,
      season: 'fall',
      characters: {}
    })
    expect(fall.exTestCarry).toEqual({ day: -55, term: 1, playthrough: '7' })
  })

  it('leaves out a field the ending does not hold', () => {
    const carried = modFieldsLeaving({} as SaveDraft, {
      playthroughId: '7',
      index: 0,
      season: 'spring',
      characters: {}
    })
    expect(carried).not.toHaveProperty('exTestCarry')
  })

  it('lets only registered fields into the opening save', () => {
    const carried = { exTestCarry: { day: 1, term: 0, playthrough: '7' }, stray: 1 } as never
    expect(carriedModFields(carried)).toEqual({ exTestCarry: { day: 1, term: 0, playthrough: '7' } })
  })
})
