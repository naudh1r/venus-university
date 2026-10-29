import { activePlotTwist, PLOT_TWIST_MOD } from '../../shared/plotTwists'
import { plotTwistBlock } from '../prompts/plotTwist'
import { registerHooks } from '@vx/modkit/renderer'
import { plotTwist } from '../stores/plotTwist'
import { createElement, lazy, Suspense } from 'react'
import type { GameModalProps, ScreenSlotProps } from '@vx/modkit/renderer'

// The save field registers at boot; the editor UI still loads only when opened.
const screens = () => import('../views/PlotTwistEntry')
const Menu = lazy(() => screens().then(module => ({ default: module.PlotTwistMenuEntry })))
const Panel = lazy(() => screens().then(module => ({ default: module.PlotTwistPanel })))

registerHooks(PLOT_TWIST_MOD, {
  promptState: { scene: () => activePlotTwist(plotTwist.read(), true) },
  gameMenuEntry: (props: ScreenSlotProps['gameMenuEntry']) => createElement(Suspense, { fallback: null }, createElement(Menu, props)),
  gameModals: {
    'plot-twist': (props: GameModalProps) => createElement(Suspense, { fallback: null }, createElement(Panel, props))
  },
  prompts: { scene: { lines: ({ state }) => plotTwistBlock(state.ex?.[PLOT_TWIST_MOD]) } }
})
