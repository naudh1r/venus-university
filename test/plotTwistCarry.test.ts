import { afterEach, expect, it } from 'vitest'
import { NO_SWITCHES } from '@shared/mods'
import { activePlotTwist, PLOT_TWIST_MOD } from '@shared/plotTwists'
import { modSlicesLeaving } from '../src/renderer/stores/semesterModCarry'
import { stampSave } from '@shared/saveRules'
import { carriedModFields } from '@shared/modCarry'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { modIsOn, useModsStore } from '../src/renderer/stores/modsStore'
import { playthroughRecord, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { plotTwist } = await import('../src/renderer/stores/plotTwist')
await import('../src/renderer/modEntries/plot-twist')

it.each([true, false])('accepts an old prepared semester continuation with the switch %s', enabled => {
  const game = () => useGameStore.getState()
  game().reset()
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: enabled }, options: {} } })
  const oldCarry = JSON.parse('{"exPlotTwist":"A direction carried by the previous build."}')
  const opening = stampSave({ ...game().toGameSave(), ...carriedModFields(oldCarry) }, '123', 'next', 1)
  game().loadSave(opening, playthroughRecord({ chars: [] }), {})
  expect(plotTwist.read()).toBe(oldCarry.exPlotTwist)
  expect(game().toGameSave()).not.toHaveProperty('exPlotTwist')
})

afterEach(() => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: NO_SWITCHES })
  restoreApi()
})

it.each([true, false])('retains a legacy twist through New Game+ with its switch %s', enabled => {
  const game = () => useGameStore.getState()
  game().reset()
  useModsStore.setState({ switches: { on: { [PLOT_TWIST_MOD]: enabled }, options: {} } })
  const twist = 'A character knows why the observatory closed.'
  const save = stampSave({ ...game().toGameSave(), exPlotTwist: twist }, '123', 'end', 0)
  game().loadSave(save, playthroughRecord({ chars: [] }), {})
  const ex = modSlicesLeaving(game().modData, game().modValues, {
    playthroughId: '123', index: 0, season: 'spring', characters: {}
  })
  const opening = stampSave({ ...game().toGameSave(), ex }, '123', 'next-semester', 1)
  game().loadSave(JSON.parse(JSON.stringify(opening)), playthroughRecord({ chars: [] }), {})
  expect(plotTwist.read()).toBe(twist)
  expect(activePlotTwist(plotTwist.read(), modIsOn(PLOT_TWIST_MOD))).toBe(enabled ? twist : '')
  expect(save.exPlotTwist).toBe(twist)
  expect(opening).not.toHaveProperty('exPlotTwist')
  game().reset()
  expect(plotTwist.read()).toBe('')
})

it.each([undefined, ''])('keeps a missing or explicitly cleared twist blank (%s)', twist => {
  const game = () => useGameStore.getState()
  game().reset()
  const save = stampSave({ ...game().toGameSave(), exPlotTwist: twist }, '123', 'end', 0)
  game().loadSave(save, playthroughRecord({ chars: [] }), {})
  const ex = modSlicesLeaving(game().modData, game().modValues, {
    playthroughId: '123', index: 0, season: 'spring', characters: {}
  })
  expect(ex?.[PLOT_TWIST_MOD]?.data ?? '').toBe('')
})
