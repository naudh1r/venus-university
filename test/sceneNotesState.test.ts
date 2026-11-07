import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ field: null as any, game: { currentSceneTranscript: [] as any[], createdScene: {} as any }, legacy: null as any }))
vi.mock('@vx/modkit/renderer', () => ({ scene: () => ({lines:state.game.currentSceneTranscript,created:Boolean(state.game.createdScene)}), sceneField: () => ({ read: () => state.field, set: (v: unknown) => { state.field = v } }) }))
vi.mock('../src/renderer/sceneNotes/host', () => ({ legacyNotes: () => state.legacy, notesAvailable: () => true, useNotesHost: { getState: () => state.game } }))
import { saveSceneNotes, readSceneNotes, notesConversationScope, sceneNotesHooks } from '../src/renderer/sceneNotes/state'
beforeEach(() => { state.field = null; state.legacy = null; state.game = { currentSceneTranscript: [{ speaker: 'girl', text: 'Old discussion.' }], createdScene: {} } })

it('starts a new document scope even when a replacement has the same filename, without deleting the log', async () => {
  const log = state.game.currentSceneTranscript
  await saveSceneNotes({ name: 'notes.md', text: 'First document.' })
  expect(notesConversationScope().transcript).toEqual(log)
  const firstRevision = notesConversationScope().revision
  await saveSceneNotes({ name: 'notes.md', text: 'Second document.' })
  expect(readSceneNotes()?.text).toBe('Second document.')
  expect(notesConversationScope().revision).not.toBe(firstRevision)
  expect(notesConversationScope().transcript).toEqual([])
  expect(state.game.currentSceneTranscript).toBe(log)
  state.game.currentSceneTranscript.push({ speaker: 'girl', text: 'New discussion.' })
  state.field = JSON.parse(JSON.stringify(state.field))
  expect(notesConversationScope().transcript.map(l => l.text)).toEqual(['New discussion.'])
  const revision = notesConversationScope().revision
  await saveSceneNotes({ name: 'notes.md', text: 'Second document.' })
  expect(notesConversationScope().revision).toBe(revision)
  expect(notesConversationScope().transcript).toHaveLength(1)
})

it('excludes old summaries and dialogue from the next AI request while preserving the new question and character context', async () => {
  state.legacy = { name: 'old.txt', text: 'Old document.' }
  await saveSceneNotes({ name: 'new.txt', text: 'New document.' })
  state.game.currentSceneTranscript.push({ speaker: 'reader', text: 'A new discussion.' })
  const notes = sceneNotesHooks.promptState!.scene!()
  const request = { system: 'Keep her personality.', user: 'Character facts.\nOld summary.\nOld discussion.\nExplain the new file.',
    parts: [{ id: 'storySoFar', role: 'user', text: 'Old summary.' }, { id: 'sceneSoFar', role: 'user', text: 'Old discussion.' }], schema: {} } as any
  const next = sceneNotesHooks.requests!.scene!(request, { state: { ex: { 'scene-notes': notes } } } as any)
  expect(next.user).not.toContain('Old summary.')
  expect(next.user).not.toContain('Old discussion.')
  expect(next.user).toContain('A new discussion.')
  expect(next.user).toContain('Character facts.')
  expect(next.user).toContain('Explain the new file.')
  expect(next.system).toContain('ONLY active document source')
  expect(request.user).toContain('Old discussion.')
})

it('keeps removed uploads out of future context and does not restore legacy notes', async () => {
  state.legacy = { name: 'old.md', text: 'Old material.' }
  await saveSceneNotes(null)
  expect(readSceneNotes()).toBeNull()
  expect(notesConversationScope().replaced).toBe(true)
  const notes = sceneNotesHooks.promptState!.scene!()
  const next = sceneNotesHooks.requests!.scene!({ system: '', user: '', schema: {} } as any, { state: { ex: { 'scene-notes': notes } } } as any)
  expect(next.system).toContain('No uploaded document is currently available')
})
