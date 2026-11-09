import { scene, sceneField, type ModHooks } from '@vx/modkit/renderer'
import { DOCUMENT_SIZE_ERROR, fitsDocumentLimit, SCENE_NOTES, sceneDocumentLines, type SceneDocument } from '../../shared/sceneNotes'
import { legacyNotes, notesAvailable } from './host'
export const sceneNotes = sceneField<{ document: SceneDocument | null; historyStart?: number; revision?: string } | null>(SCENE_NOTES, { empty: null })
export function readStoredSceneNotes(): SceneDocument | null {
  const saved = sceneNotes.read()
  return saved ? saved.document : legacyNotes()
}
/** The document available to scene prompts and laptop sessions. */
export function readSceneNotes(): SceneDocument | null {
  const document = readStoredSceneNotes()
  return document && fitsDocumentLimit(document) ? document : null
}
export async function saveSceneNotes(document: SceneDocument | null) {
  if (!notesAvailable()) return { ok: false as const, error: { code: 'NOTES_NO_SCENE', message: 'Open notes while a scene is active.' } }
  if (document && !fitsDocumentLimit(document)) return { ok: false as const, error: { code: 'NOTES_TOO_LARGE', message: DOCUMENT_SIZE_ERROR } }
  const previous = readStoredSceneNotes(), saved = sceneNotes.read()
  const changed = previous?.name !== document?.name || previous?.text !== document?.text
  const historyStart = changed && (previous || saved?.historyStart !== undefined)
    ? (scene()?.lines.length ?? 0) : saved?.historyStart
  const next = { document, historyStart, revision: changed ? crypto.randomUUID() : saved?.revision }
  // Created scenes have no playthrough autosave; keep notes on the active scene.
  if (scene()?.created) {
    sceneNotes.set(next)
    return { ok: true as const, data: null }
  }
  return sceneNotes.save(next)
}
export function notesConversationScope() {
  const view = scene(), saved = sceneNotes.read()
  return { revision: saved?.revision ?? '',
    replaced: saved?.historyStart !== undefined,
    transcript: (view?.lines ?? []).slice(saved?.historyStart ?? 0) }
}
interface NotesPromptState {
  document: SceneDocument | null
  unavailable: boolean
}

export const sceneNotesHooks: Pick<ModHooks, 'promptState' | 'prompts'> = {
  promptState: { scene: (): NotesPromptState => {
    const stored = readStoredSceneNotes()
    if (stored && fitsDocumentLimit(stored)) return { document: stored, unavailable: false }
    return {
      document: null,
      unavailable: Boolean(stored || sceneNotes.read()?.historyStart !== undefined)
    }
  } },
  prompts: { scene: { lines: ({ state }) => {
    const notes = state.ex?.[SCENE_NOTES] as NotesPromptState | undefined
    if (notes?.document) return sceneDocumentLines(notes.document)
    return notes?.unavailable
      ? ['No uploaded document is currently available. Do not use previous uploads or their discussion as reference material.']
      : []
  } } }
}
