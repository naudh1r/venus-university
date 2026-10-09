import { expect, it, vi } from 'vitest'
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

it('carries every registered mod’s files in turn, past one that fails', async () => {
  const { carryModFiles, registerTermFiles } = await import('@shared/modCarry')
  const seen: string[] = []
  registerTermFiles('slow', async ({ from, to }) => {
    await new Promise((resolve) => setTimeout(resolve, 5))
    seen.push(`slow ${from}->${to}`)
  })
  registerTermFiles('broken', async () => {
    throw Error('no disk')
  })
  registerTermFiles('after', async () => {
    seen.push('after')
  })
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  await carryModFiles({ from: 'old', to: 'new' })
  expect(seen).toEqual(['slow old->new', 'after'])
  expect(warn).toHaveBeenCalledOnce()
  warn.mockRestore()
})
