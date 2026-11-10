import { beforeEach, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ field: null as any, game: { currentSceneTranscript: [] as any[], createdScene: {} as any }, legacy: null as any }))
vi.mock('@vx/modkit/renderer', () => ({ scene: () => ({lines:state.game.currentSceneTranscript,created:Boolean(state.game.createdScene)}), sceneField: () => ({ read: () => state.field, set: (v: unknown) => { state.field = v } }) }))
vi.mock('../src/renderer/sceneNotes/host', () => ({ legacyNotes: () => state.legacy, notesAvailable: () => true }))
vi.mock('@vx/modkit/shared', () => ({ sharedModOn: vi.fn(() => true) }))
import { sharedModOn } from '@vx/modkit/shared'
import { saveSceneNotes, readSceneNotes, readStoredSceneNotes, notesConversationScope, sceneNotesHooks } from '../src/renderer/sceneNotes/state'
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


function promptLines() {
  const notes = sceneNotesHooks.promptState!.scene!()
  return sceneNotesHooks.prompts!.scene!.lines!({ state: { ex: { 'scene-notes': notes } } } as any)
}

it('refuses a pending upload or removal when the last parent is switched off', async () => {
  const active = { name: 'current.txt', text: 'Keep this.' }
  await saveSceneNotes(active)
  vi.mocked(sharedModOn).mockReturnValue(false)
  try {
    expect((await saveSceneNotes(null)).ok).toBe(false)
    expect((await saveSceneNotes({ name: 'later.md', text: 'New.' })).ok).toBe(false)
    expect(readStoredSceneNotes()).toEqual(active)
  } finally {
    vi.mocked(sharedModOn).mockReturnValue(true)
  }
})

it('only contributes mod lines, leaving core in charge of the summary, named transcript, window and retry', async () => {
  expect(promptLines()).toEqual([])
  await saveSceneNotes({ name: 'notes.md', text: 'Old document.' })
  await saveSceneNotes({ name: 'notes.md', text: '# New document\nLiteral $& and $$.' })
  expect(sceneNotesHooks).not.toHaveProperty('requests')
  const prompt = promptLines().join('\n')
  expect(prompt.split('ONLY active document source')).toHaveLength(2)
  expect(prompt).toContain('> # New document\n> Literal $& and $$.')
  expect(prompt).not.toContain('Old document.')
})

it('adds one removal notice and keeps the old upload out after reload', async () => {
  state.legacy = { name: 'old.md', text: 'Old material.' }
  await saveSceneNotes(null)
  state.field = JSON.parse(JSON.stringify(state.field))
  expect(readSceneNotes()).toBeNull()
  expect(notesConversationScope().replaced).toBe(true)
  expect(promptLines()).toEqual([expect.stringContaining('No uploaded document is currently available')])
})

it.each(['library', 'study preview'])('retains an oversized %s document in the save and withholds it from consumers', async source => {
  const large = { name: 'old.md', text: 'é'.repeat(256_001) }
  if (source === 'library') state.field = { document: large }
  else state.legacy = large
  expect(readStoredSceneNotes()).toEqual(large)
  expect(readSceneNotes()).toBeNull()
  expect(promptLines()).toEqual([expect.stringContaining('No uploaded document is currently available')])
  expect((await saveSceneNotes(large)).ok).toBe(false)
  expect(readStoredSceneNotes()).toEqual(large)
  const small = { name: 'new.md', text: 'Replacement.' }
  await saveSceneNotes(small)
  expect(readSceneNotes()).toEqual(small)
  expect(promptLines().join('\n')).toContain('Replacement.')
})
