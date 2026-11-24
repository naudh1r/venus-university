import { expect, it } from 'vitest'
import { carryBreakthrough } from '@shared/breakthroughCarry'
import { normalizeBreakthrough } from '@shared/breakthrough'
import type { GameSave } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'

it('carries spirit and outcomes twice, resets settlement and preserves original dates', () => {
  const save: GameSave = { ...useGameStore.getState().toGameSave(), playthroughId: '123', saveId: 'end', saveDate: 0, date: 100, time: 1, exBreakthrough: {
    meters: { a: 65 }, settled: { '0:0': true }, pending: null,
    moments: { a: [{ id: 'moment', date: 20, time: 1, outcome: 'They reconciled.', transcriptStart: 2, transcriptCount: 3 },
      { id: 'future', date: 101, time: 0, outcome: 'Not yet.' }] }
  } }
  const before = structuredClone(save)
  const first = carryBreakthrough(save, { term: 0, back: 120, characters: {} })!
  expect(first.meters.a).toBe(65)
  expect(first.settled).toEqual({})
  expect(first.moments.a).toEqual([{ id: 'moment', date: -100, time: 1, outcome: 'They reconciled.', origin: { term: 0, day: 20 } }])
  const second = normalizeBreakthrough(carryBreakthrough({ ...save, exBreakthrough: first }, { term: 1, back: 150, characters: {} }))
  expect(second.moments.a[0]).toMatchObject({ date: -250, origin: { term: 0, day: 20 } })
  expect(save).toEqual(before)
})
