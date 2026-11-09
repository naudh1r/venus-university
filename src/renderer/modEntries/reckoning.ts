// Carry registration follows catalogue loading and runs even while switched off.
import '../../shared/reckoningCarry'
import { unspokenSceneBoundary } from '@shared/unspokenVoice'
import { CHARACTER_DYNAMICS_MOD } from '@shared/characterDynamics'
import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type ScreenSlotProps } from '@vx/modkit/renderer'
import { earnedGrowthLines } from '../prompts/characterDynamics'
import { modIsOn } from '@vx/modkit/renderer'
import { loopState } from '../stores/loop/state'

const dynamicsOn = (): boolean => modIsOn(CHARACTER_DYNAMICS_MOD, loopState.record)

const LazyMapPin = lazy(() => import('../views/ReckoningDungeon').then(module => ({
  default: module.ReckoningDungeonMapPin
})))
const LazyPanelLayer = lazy(() => import('../views/ReckoningPanelLayer').then(module => ({
  default: module.ReckoningPanelLayer
})))

function DungeonEntrance({ canTravel, close }: ScreenSlotProps['mapOverlay']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null },
    createElement(LazyMapPin, { canTravel, onEnter: close }))
}

function ScenePresence(props: ScreenSlotProps['panelLayer']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazyPanelLayer, props))
}

// Character Dynamics supplies this history when enabled. Do not duplicate its prompt.
registerHooks('reckoning', {
  mapOverlay: DungeonEntrance,
  panelLayer: ScenePresence,
  prompts: {
    scene: { lines: ({ cast, state }) => [...(dynamicsOn() ? [] : earnedGrowthLines(cast, state.exCharacterDynamics)),...unspokenSceneBoundary(state.exReckoning)] },
    dm: { lines: ({ character, state }) => dynamicsOn() ? [] : earnedGrowthLines([character], state.exCharacterDynamics) }
  },
  requests: {
    'slot-intro': (request, { input }) => {
      if (dynamicsOn()) return request
      const lines = earnedGrowthLines([...input.askers, ...input.breakups, ...input.posters].map(person => person.character), input.exCharacterDynamics)
      return lines.length ? { ...request, user: `${request.user}\n\n${lines.join('\n')}` } : request
    }
  }
})
