import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type ModDetailProps, type ScenePanelProps, type SceneSeatProps, type ScreenSlotProps } from '@vx/modkit/renderer'
import { STORY_ASSISTANT } from '../../shared/storyAssistant'

// Registering the hooks loads no screen and no store: each loads when it is first drawn.
const panel = () => import('../views/StoryAssistantPanel')
const Seat = lazy(() => panel().then(module => ({ default: module.StoryAssistantSeat })))
const Panel = lazy(() => panel().then(module => ({ default: module.StoryAssistantPanel })))
const Stage = lazy(() => import('../views/StoryAssistantStage').then(module => ({ default: module.StoryAssistantStage })))
const Page = lazy(() => import('../views/StoryAssistantPage').then(module => ({ default: module.StoryAssistantPage })))

/** The mod's page on the Mods screen, the same component every time it is asked for. */
function StoryAssistantDetail(props: ModDetailProps): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(Page, props))
}

registerHooks(STORY_ASSISTANT, {
  scenePlay: {
    Seat: (props: SceneSeatProps) => createElement(Suspense, { fallback: null }, createElement(Seat, props)),
    Panel: (props: ScenePanelProps) => createElement(Suspense, { fallback: null }, createElement(Panel, props))
  },
  stageLayer: (props: ScreenSlotProps['stageLayer']) => createElement(Suspense, { fallback: null }, createElement(Stage, props)),
  modDetail: (mod) => (mod.id === STORY_ASSISTANT ? StoryAssistantDetail : undefined)
})
