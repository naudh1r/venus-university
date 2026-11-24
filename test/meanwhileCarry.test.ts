import { expect, it } from 'vitest'
import { carryMeanwhile } from '@shared/meanwhileCarry'
import { normalizeMeanwhile, meanwhileEvents, type MeanwhileScene } from '@shared/meanwhile'
import type { GameSave } from '@shared/types'

it('keeps a saved conversation readable after a participant leaves and never invents new scenes', () => {
  const scene: MeanwhileScene = { id: 'scene', date: 20, participants: ['a','b'], title: 'A debate', where: 'Park', ref: 'green_hill_park', kind: 'hangout', positive: true,
    participantNames: { a: 'Aster', b: 'Bea' }, lines: Array.from({ length: 6 }, (_, i) => ({ speaker: i % 2 ? 'b' : 'a', text: 'Saved dialogue.' })) }
  const save = { date: 100, exNpcWatch: { version: 1, scenes: [scene, { ...scene, id: 'future', date: 101 }] } } as GameSave
  const first = carryMeanwhile(save, { term: 0, back: 120, characters: {} })!
  const second = normalizeMeanwhile(carryMeanwhile({ ...save, exNpcWatch: first }, { term: 1, back: 150, characters: {} }))
  expect(second.scenes).toHaveLength(1)
  expect(second.scenes[0]).toMatchObject({ id: 'term:0:scene', date: -250, origin: { term: 0, day: 20 }, participantNames: { b: 'Bea' } })
  expect(meanwhileEvents({ date: 0, characters: {}, charInfo: {}, classes: {}, npcRelationships: {}, exNpcWatch: second })).toEqual(second.scenes)
  expect(save.exNpcWatch!.scenes[0].date).toBe(20)
})
