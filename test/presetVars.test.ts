import './fixtures/maestroModelKit'
import { beforeEach, expect, it } from 'vitest'
import { PROMPT_STUDIO_MOD } from '@shared/presets/types'
import { stampSave } from '@shared/saveRules'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { commitPresetVars, cutPresetVars, presetVars } from '../src/renderer/stores/promptStudioVars'
import { playthroughRecord } from './fixtures'

beforeEach(() => useGameStore.getState().reset())

it('moves an older save\'s variables into the mod\'s slice, and a cut takes replies\' changes back', () => {
  const game = useGameStore.getState()
  const save = stampSave(game.toGameSave(), '123', '456', 1)
  game.loadSave({ ...save, presetVars: { mood: 'wary', n: 4 } } as typeof save, playthroughRecord(), {})
  expect(presetVars.read()).toEqual({ mood: 'wary' })
  const saved = useGameStore.getState().toGameSave()
  expect(saved).not.toHaveProperty('presetVars')
  expect(saved.ex?.[PROMPT_STUDIO_MOD]?.data).toEqual({ mood: 'wary' })

  presetVars.set({ n: '0' })
  commitPresetVars({ n: '1' }, 1)
  commitPresetVars({ n: '2' }, 3)
  cutPresetVars(4)
  expect(presetVars.read()).toEqual({ n: '2' })
  cutPresetVars(3)
  expect(presetVars.read()).toEqual({ n: '1' })
  cutPresetVars(1)
  expect(presetVars.read()).toEqual({ n: '0' })
})
