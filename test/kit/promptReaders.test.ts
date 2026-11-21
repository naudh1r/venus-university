import { beforeEach, expect, it } from 'vitest'
import { attractionInPlay, emptyFlags } from '@shared/relationship'
import { useGameStore } from '../../src/renderer/stores/gameStore'
import {
  memoryLines as nativeMemoryLines,
  profileLines as nativeProfileLines
} from '../../src/renderer/prompts/scenePrompt'
import { relationshipLines as nativeRelationshipLines } from '../../src/renderer/prompts/relationship'
import { character, stubApi } from '../fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { memoryLines, profileLines, relationshipLines } = await import('@vx/modkit/renderer')

const sam = character({ charId: 'sam', firstName: 'Sam', gender: 'male' })
const flags = emptyFlags()

beforeEach(() => {
  useGameStore.getState().reset()
  useGameStore.setState({ playerPronouns: 'she', romance: { female: 'all', male: 'all' } })
})

it('keeps the profile reader call while supplying the active attraction', () => {
  const game = useGameStore.getState()
  const attraction = attractionInPlay(sam, undefined, game.romance, game.playerPronouns)
  expect(profileLines(sam, flags, 1)).toEqual(nativeProfileLines(sam, flags, attraction, 1))
})

it('keeps the memory reader call while supplying the reader pronouns', () => {
  const memories = [{ date: 1, type: 'liked' as const, desc: 'you were kind to yourself' }]
  expect(memoryLines(sam, memories, undefined, 'spring')).toEqual(
    nativeMemoryLines(sam, memories, undefined, 'spring', 'she')
  )
})

it('keeps the relationship reader arguments and created-scene override', () => {
  const stats = { brain: 100, heart: 100, body: 100 }
  expect(
    relationshipLines(sam, flags, true, 10, undefined, stats, undefined, undefined, false)
  ).toEqual(
    nativeRelationshipLines(sam, flags, true, 10, undefined, {
      stats,
      attractionGate: false,
      romanceable: true,
      loyal: false,
      readerPronouns: 'she'
    })
  )
})
