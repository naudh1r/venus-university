import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { playthroughRecord, restoreApi, stubApi } from '../fixtures'
import { MODS, type ModDef } from '../../src/shared/mods'

stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore: game } = await import('../../src/renderer/stores/gameStore')
const { useModsStore } = await import('../../src/renderer/stores/modsStore')
const { loopState, resetLoopState } = await import('../../src/renderer/stores/loop/state')
const {
  setSceneSuggestionsPaused: pause,
  sceneSuggestionsPaused: paused,
  subscribeSceneSuggestionsPaused: subscribe
} = await import('../../src/renderer/mods/sceneSuggestions')

const fixtures: ModDef[] = [
  { id: 'activity-a', scope: 'anytime' as const },
  { id: 'activity-b', scope: 'anytime' as const },
  { id: 'saved-activity', scope: 'playthrough' as const }
].map(mod => ({ ...mod, name: mod.id, author: 'fixture', version: '1', defaultOn: true, blurb: '' }))
const mods = MODS as ModDef[]
const originalSwitches = useModsStore.getState().switches

beforeAll(() => { mods.push(...fixtures) })
beforeEach(() => {
  resetLoopState()
  game.getState().reset()
})
afterEach(() => {
  for (const mod of fixtures) pause(mod.id, false)
  useModsStore.setState({ switches: originalSwitches })
  resetLoopState()
})
afterAll(() => {
  for (const mod of fixtures) mods.splice(mods.indexOf(mod), 1)
  restoreApi()
})

it('allows ordinary scenes and waits until every overlapping activity stops', () => {
  expect(paused()).toBe(false)
  pause('activity-a', true)
  pause('activity-b', true)
  expect(paused()).toBe(true)
  pause('activity-a', false)
  expect(paused()).toBe(true)
  pause('activity-b', false)
  expect(paused()).toBe(false)
})

it('ignores a disabled activity and expires its pause on load or leaving the game', () => {
  pause('activity-a', true)
  useModsStore.setState({ switches: { on: { 'activity-a': false }, options: {} } })
  expect(paused()).toBe(false)
  useModsStore.setState({ switches: { on: { 'activity-a': true }, options: {} } })
  expect(paused()).toBe(true)
  game.setState(state => ({ loads: state.loads + 1 }))
  expect(paused()).toBe(false)
  pause('activity-a', true)
  expect(paused()).toBe(true)
  resetLoopState()
  expect(paused()).toBe(false)
})

it('uses the loaded playthrough selection even when new games use the opposite setting', () => {
  useModsStore.setState({ switches: { on: { 'saved-activity': false }, options: {} } })
  loopState.record = playthroughRecord({ mods: ['saved-activity'] })
  pause('saved-activity', true)
  expect(paused()).toBe(true)

  useModsStore.setState({ switches: { on: { 'saved-activity': true }, options: {} } })
  loopState.record = playthroughRecord({ mods: [] })
  expect(paused()).toBe(false)
})

it('notifies only when the combined pause changes, including across switches and loads', () => {
  const changes: boolean[] = []
  const stop = subscribe(() => changes.push(paused()))
  try {
    const before = game.getState()
    const switches = useModsStore.getState().switches
    pause('activity-a', true)
    pause('activity-a', true)
    pause('activity-b', true)
    pause('activity-a', false)
    expect(game.getState()).toBe(before)
    expect(useModsStore.getState().switches).toBe(switches)
    for (let i = 0; i < 50; i++) game.setState(state => ({ money: state.money + 1 }))
    expect(changes).toEqual([true])

    useModsStore.setState({ switches: { on: { 'activity-b': false }, options: {} } })
    useModsStore.setState({ switches })
    game.setState(state => ({ loads: state.loads + 1 }))
    expect(changes).toEqual([true, false, true, false])
  } finally {
    stop()
  }
  pause('activity-b', true)
  expect(changes).toEqual([true, false, true, false])
})

it('observes record selection and leaving the game without waiting for another store write', () => {
  loopState.record = playthroughRecord({ mods: [] })
  pause('saved-activity', true)
  const onChange = vi.fn()
  const stop = subscribe(onChange)
  try {
    loopState.record = playthroughRecord({ mods: ['saved-activity'] })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(paused()).toBe(true)
    resetLoopState()
    expect(onChange).toHaveBeenCalledTimes(2)
    expect(paused()).toBe(false)
  } finally {
    stop()
  }
})
