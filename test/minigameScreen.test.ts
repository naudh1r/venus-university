import { describe, expect, it, vi } from 'vitest'
import { tableCanOpen, type ScreenState } from '../src/renderer/minigames/screen'
import { GRADUATION_DATE } from '../src/renderer/prompts/occasions'

// The kit's renderer entry loads the game's stores; these tests take each name from its own module.
vi.mock('@vx/modkit/renderer', async () => (await import('./fixtures/miniGamesKit')).miniGamesKit())

/** Where a game can be offered at all: only on a screen that has the seat to open its table. */

const scene = (over: Partial<ScreenState> = {}): ScreenState => ({
  date: 5,
  time: 1,
  semesterIndex: 0,
  createdScene: null,
  replaying: null,
  activeGameOver: null,
  ...over
})

describe('tableCanOpen', () => {
  it('is open in an ordinary scene', () => {
    expect(tableCanOpen(scene())).toBe(true)
    // A later semester's first slot is an ordinary one.
    expect(tableCanOpen(scene({ date: 0, time: 0, semesterIndex: 1 }))).toBe(true)
  })

  it('is shut at orientation, where a challenge would never start', () => {
    expect(tableCanOpen(scene({ date: 0, time: 0, semesterIndex: 0 }))).toBe(false)
  })

  it('is shut on the epilogue, a created scene, a replay and a game over', () => {
    expect(tableCanOpen(scene({ date: GRADUATION_DATE, time: 0 }))).toBe(false)
    expect(tableCanOpen(scene({ createdScene: {} }))).toBe(false)
    expect(tableCanOpen(scene({ replaying: {} }))).toBe(false)
    expect(tableCanOpen(scene({ activeGameOver: 'expelled' }))).toBe(false)
  })
})
