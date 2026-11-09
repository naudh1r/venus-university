import { expect, it } from 'vitest'
import { carryStoryMemory } from '@shared/storyMemoryCarry'
import { normalizeStoryMemory, storySnapshot } from '@shared/storyMemory'
import type { GameSave } from '@shared/types'
import { character, charactersById } from './fixtures'
import { useGameStore } from '../src/renderer/stores/gameStore'

it('retains recap corrections, hidden entries and original semester through successive carries', () => {
  const characters = charactersById(character({ charId: 'a' }))
  const save: GameSave = { ...useGameStore.getState().toGameSave(), playthroughId: '123', saveId: 'end', saveDate: 0, date: 100, time: 1, history: { 20: { 0: 'Original conversation', 1: 'Hidden conversation' }, 101: { 0: 'Future conversation' } },
    exStoryMemory: normalizeStoryMemory({ encounterEdits: { 'encounter:20:0': { text: 'Corrected conversation' }, 'encounter:20:1': { hidden: true } }, encounterSubjects: { 'encounter:20:0': ['a'] } }) }
  const before = structuredClone(save)
  const first = carryStoryMemory(save, { term: 0, back: 120, characters })!
  const second = carryStoryMemory({ ...save, history: {}, exStoryMemory: first }, { term: 1, back: 150, characters: {} })!
  const snapshot = storySnapshot({ playthroughId: '123', date: 0, time: 0, history: {}, characters: {}, exStoryMemory: second })!
  expect(snapshot.records).toHaveLength(1)
  expect(snapshot.records[0]).toMatchObject({ id: 'term:0:encounter:20:0', date: -250, text: 'Corrected conversation', origin: { term: 0, day: 20 } })
  expect(second.pastEncounters?.some(e => e.text === 'Original conversation')).toBe(true)
  expect(second.encounterEdits['term:0:encounter:20:1'].hidden).toBe(true)
  expect(snapshot.names.a).toBeDefined()
  expect(save).toEqual(before)
})
