import { scene, sceneField, type ModHooks } from '@vx/modkit/renderer'
import { SCENE_NOTES, CURRENT_DOCUMENT_RULE, sceneDocumentLines, type SceneDocument } from '../../shared/sceneNotes'
import { legacyNotes, notesAvailable } from './host'
export const sceneNotes = sceneField<{ document: SceneDocument | null; historyStart?: number; revision?: string } | null>(SCENE_NOTES, { empty: null })
export function readSceneNotes(): SceneDocument | null {
  const saved = sceneNotes.read()
  return saved ? saved.document : legacyNotes()
}
export async function saveSceneNotes(document: SceneDocument | null) {
  if (!notesAvailable()) return { ok: false as const, error: { code: 'NOTES_NO_SCENE', message: 'Open notes while a scene is active.' } }
  const previous = readSceneNotes(), saved = sceneNotes.read()
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
interface NotesPromptState { document: SceneDocument | null; scope: ReturnType<typeof notesConversationScope> }
export const sceneNotesHooks: Pick<ModHooks, 'promptState' | 'prompts' | 'requests'> = {
  promptState: { scene: () => ({ document: readSceneNotes(), scope: notesConversationScope() }) },
  prompts: { scene: { lines: ({ state }) => sceneDocumentLines((state.ex?.[SCENE_NOTES] as NotesPromptState | undefined)?.document ?? null) } },
  requests: { scene: (request, { state }) => {
    const notes = state.ex?.[SCENE_NOTES] as NotesPromptState | undefined
    if (!notes || (!notes.document && !notes.scope.replaced)) return request
    let user = request.user
    // Use the builder's typed blocks; preserve the saved log and the current reader action.
    const parts = request.parts?.map(part => {
      if (!notes.scope.replaced || part.role !== 'user' || !['storySoFar', 'sceneSoFar'].includes(part.id)) return part
      const text = part.id === 'storySoFar'
        ? 'The previous document has been replaced. Its earlier study discussion is no longer reference material.'
        : 'CONVERSATION SINCE DOCUMENT REPLACEMENT\n' + JSON.stringify(notes.scope.transcript.map(({ speaker, text }) => ({ speaker, text })))
      user = user.replace(part.text, text)
      return { ...part, text }
    })
    const instruction = notes.document ? CURRENT_DOCUMENT_RULE : 'The reader removed the document. No uploaded document is currently available; do not use previous uploads as reference material.'
    return { ...request, parts, user, system: request.system + '\n\n' + instruction }
  } }
}
