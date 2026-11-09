import { createElement, lazy, Suspense } from 'react'
import { SOUNDTRACK_MOD } from '../../shared/soundtracks'
import { registerHooks, type ScreenSlotProps } from '@vx/modkit/renderer'

const LazySettings = lazy(() => import('../views/SoundtrackSettings').then(module => ({
  default: module.SoundtrackSettings
})))

function Settings(props: ScreenSlotProps['settingsSection']): ReturnType<typeof createElement> {
  return createElement(Suspense, { fallback: null }, createElement(LazySettings, props))
}

registerHooks(SOUNDTRACK_MOD, { settingsSection: Settings })
