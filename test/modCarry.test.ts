import { expect, it } from 'vitest'
import { carryModFields, carriedModFields, registerTermCarry } from '@shared/modCarry'
import type { GameSave } from '@shared/types'

declare module '@shared/modCarry' {
  interface ModCarryFields { testCarry?: { date: number; text: string } }
}

it('rebases a registered field without copying unrelated fields or mutating its source', () => {
  const save = { date: 80, bio: 'Not an extension' } as GameSave
  registerTermCarry('testCarry', (s, ctx) => ({ date: s.date - ctx.back, text: 'Kept' }))
  const carried = carryModFields(save, { term: 0, back: 120, characters: {} })
  expect(carried).toEqual({ testCarry: { date: -40, text: 'Kept' } })
  expect(carriedModFields({ ...carried, bio: 'Ignored' } as typeof carried)).toEqual(carried)
  expect(save.date).toBe(80)
})
