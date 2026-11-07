import { scene, useScene, type SceneView } from '@vx/modkit/renderer'
import { restoreSceneDocument } from '../../shared/sceneNotes'

export function notesAvailable(view: SceneView | null = scene()): boolean {
  return Boolean(view?.lines.length && !view.replay && !view.ending && !view.resolved && !view.over)
}

export function useNotesAvailable(): boolean {
  return useScene(notesAvailable)
}

// Previous local builds stored notes in the study mod's own field. Only that mod reads it.
let previousDocument: (() => unknown) | undefined
let cached: { value: unknown; document: ReturnType<typeof restoreSceneDocument> } | undefined
export function registerPreviousDocument(reader: () => unknown): void {
  previousDocument = reader
}
export function legacyNotes() {
  const value = previousDocument?.()
  if (!cached || cached.value !== value) cached = { value, document: restoreSceneDocument(value) }
  return cached.document
}
