import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from '../fixtures'
const control = vi.hoisted(() => ({ enabled: new Set(['activity-a', 'activity-b']) }))
vi.mock('../../src/renderer/stores/modsStore', async original => ({ ...await original<object>(), modIsOn: (id: string) => control.enabled.has(id) }))
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore: game } = await import('../../src/renderer/stores/gameStore')
const { resetLoopState } = await import('../../src/renderer/stores/loop/state')
const { setSceneSuggestionsPaused: pause, sceneSuggestionsPaused: paused, subscribeSceneSuggestionsPaused: subscribe } = await import('../../src/renderer/mods/sceneSuggestions')
beforeEach(() => {
  game.getState().reset(); resetLoopState(); control.enabled = new Set(['activity-a', 'activity-b'])
  pause('activity-a', false); pause('activity-b', false)
})
afterEach(() => { pause('activity-a', false); pause('activity-b', false); restoreApi() })

it('allows ordinary scenes and waits until every overlapping activity stops', () => {
  expect(paused()).toBe(false)
  pause('activity-a', true); pause('activity-b', true)
  expect(paused()).toBe(true)
  pause('activity-a', false); expect(paused()).toBe(true)
  pause('activity-b', false); expect(paused()).toBe(false)
})
it('does not retain a disabled activity or a pause from another loaded game', () => {
  pause('activity-a', true); control.enabled.delete('activity-a'); expect(paused()).toBe(false)
  control.enabled.add('activity-a'); expect(paused()).toBe(true)
  game.setState(state => ({ loads: state.loads + 1 })); expect(paused()).toBe(false)
  pause('activity-a', true); expect(paused()).toBe(true)
  resetLoopState(); expect(paused()).toBe(false)
})
it('notifies synchronous activity changes without touching the game or saved switches', () => {
  const before = game.getState(), listener = vi.fn(), stop = subscribe(listener)
  pause('activity-a', true); expect(listener).toHaveBeenCalledTimes(1)
  pause('activity-a', true); expect(listener).toHaveBeenCalledTimes(1)
  expect(game.getState()).toBe(before)
  pause('activity-a', false); expect(listener).toHaveBeenCalledTimes(2)
  stop(); pause('activity-b', true); expect(listener).toHaveBeenCalledTimes(2)
})
