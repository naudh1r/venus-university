import { afterEach, beforeEach, expect, it } from 'vitest'
import { PLOT_TWIST_MOD } from '@shared/plotTwists'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { buildScenePrompt, buildContinuationPrompt, buildClosingPrompt, buildSoloPrompt } from '../src/renderer/prompts/scenePrompt'
import { character, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/modEntries/plot-twist')
const { plotTwist } = await import('../src/renderer/stores/plotTwist')
const { promptState } = await import('../src/renderer/stores/loop/promptState')

const direction = 'A comet will pass the campus tonight.'
beforeEach(() => {
  useGameStore.getState().reset()
  plotTwist.set(direction)
  useModsStore.setState({ switches: { on: {}, options: {} } })
})
afterEach(restoreApi)

function requests() {
  const state = { ...promptState(), seedWord: 'aspen' }
  const cast = [character()]
  return [
    buildScenePrompt(cast, 'Talk.', state, '', ''),
    buildContinuationPrompt(cast, 'Talk.', [], state, '', '', null, 1),
    buildClosingPrompt(cast, [], state, '', '', null),
    buildSoloPrompt('Study.', state, '', '')
  ]
}

it('routes the saved direction once to each scene request, leaving schema and system unchanged', () => {
  const enabled = requests()
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
  const disabled = requests()
  for (let i = 0; i < enabled.length; i++) {
    expect(enabled[i].user.split(direction)).toHaveLength(2)
    expect(disabled[i].user).not.toContain(direction)
    expect(enabled[i].system).toBe(disabled[i].system)
    expect(enabled[i].schema).toEqual(disabled[i].schema)
  }
  expect(useGameStore.getState().toGameSave().ex?.[PLOT_TWIST_MOD]?.data).toBe(direction)
  useModsStore.setState({ switches: { on: {}, options: {} } })
  expect(promptState().ex?.[PLOT_TWIST_MOD]).toBe(direction)
})

it('does not mutate a captured request when the player later edits the twist', () => {
  const before = requests()[0]
  plotTwist.set('The library is closing.')
  expect(before.user).toContain(direction)
  expect(requests()[0].user).not.toContain(direction)
})

it('formats a captured state from its own twist, rather than the subsequently edited live field', () => {
  const state = promptState()
  plotTwist.set('The library is closing.')
  const request = buildScenePrompt([character()], 'Talk.', state, '', '')
  expect(request.user).toContain(direction)
  expect(request.user).not.toContain('The library is closing.')
})

it('captures only bounded prompt text without truncating the saved legacy direction', () => {
  const legacy = 'x'.repeat(10_050)
  plotTwist.set(legacy)
  expect(promptState().ex?.[PLOT_TWIST_MOD]).toHaveLength(10_000)
  expect(plotTwist.read()).toBe(legacy)
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
  expect(promptState().ex).not.toHaveProperty(PLOT_TWIST_MOD)
  expect(plotTwist.read()).toBe(legacy)
})

it('does not read newly enabled live data into a snapshot captured while disabled', () => {
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: false }, options: {} } })
  const state = promptState()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  expect(buildScenePrompt([character()], 'Talk.', state, '', '').user).not.toContain(direction)
  expect(requests()[0].user).toContain(direction)
})
