import { createElement, lazy, Suspense } from 'react'
import { registerHooks, type SceneSeatProps, type GameModalProps } from '@vx/modkit/renderer'
import { sceneNotesHooks } from '../sceneNotes/state'
const view = () => import('../sceneNotes/SceneNotes')
const Seat = lazy(() => view().then(m => ({ default: m.NotesSeat })))
const Panel = lazy(() => view().then(m => ({ default: m.SceneNotes })))
registerHooks('scene-notes', {
  ...sceneNotesHooks,
  scenePlay: { Seat: (p: SceneSeatProps) => createElement(Suspense, { fallback: null }, createElement(Seat, p)), Panel: () => null },
  gameModals: { 'scene-notes': (p: GameModalProps) => createElement(Suspense, { fallback: null }, createElement(Panel, p)) }
})
