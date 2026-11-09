import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { editStoryEncounter, formatStoryRecall, normalizeStoryMemory, storySnapshot, type StoryFact } from '@shared/storyMemory'
import type { SaveDraft } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { writeStoryMemory, writesSettled } from '../src/renderer/stores/loop/saves'
import { resetTextingLoop } from '../src/renderer/stores/textingLoop'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'

const game = () => useGameStore.getState()
const encounterId = 'encounter:1:0'
const fact: StoryFact = { id: 'manual:test', subject: 'a', category: 'other', text: 'An original fact.',
  timeline: 'current', certainty: 'event', claimant: null, knownBy: ['a', 'reader'], public: false,
  date: 1, time: 0, evidence: '', source: 'Player-added fact', supersedes: [], manual: true }
let saved: SaveDraft | undefined
beforeEach(() => {
  resetTextingLoop(); resetLoopState(); game().reset(); useBunnyboardStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  useGameStore.setState({ playthroughId: '123', date: 7, time: 0, chars: ['a'],
    characters: charactersById(character({ charId: 'a' })), charInfo: { a: charInfo({ nameKnown: true }) },
    history: { 1: { 0: 'Sarah discussed the atlas.' } },
    exStoryMemory: normalizeStoryMemory({ facts: [fact], hidden: [fact.id], encounterEdits: { [encounterId]: { hidden: true } } }) })
  saved = undefined
  stubApi({ saves: { autosave: async (id, draft) => {
    saved = structuredClone(draft)
    return { ok: true, data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 } }
  } } })
})
afterEach(async () => { await writesSettled(); restoreApi(); vi.restoreAllMocks() })
const inspect = () => formatStoryRecall({ ...storySnapshot(game())!, cast: ['a'], query: 'atlas' })

// Exercise the same edit helper used by the modal through the real save and recall
// composition. No mounted React/DOM harness or paid model request is needed.
describe('QA4 memory editor payload composition', () => {
  it('editing a hidden encounter through the editor update keeps it hidden after saving', async () => {
    expect(inspect().included).not.toContain(encounterId)
    const previous = game().exStoryMemory
    const editorPayload = editStoryEncounter(previous, encounterId, 'Sarah corrected her account of the atlas.')
    await writeStoryMemory(editorPayload, { playthroughId: '123', loads: game().loads, previous })
    expect(saved?.exStoryMemory?.encounterEdits[encounterId]).toEqual({ text: 'Sarah corrected her account of the atlas.', hidden: true })
    expect(game().exStoryMemory.encounterEdits[encounterId].hidden).toBe(true)
    expect(inspect().included).not.toContain(encounterId)
    expect(inspect().text).not.toContain('Sarah corrected her account of the atlas.')
  })
  it('control: fact edits retain their independent hidden list and remain excluded from recall', async () => {
    const previous = game().exStoryMemory
    const editorPayload = { ...previous, edits: { ...previous.edits, [fact.id]: { ...fact, text: 'A corrected fact.' } } }
    await writeStoryMemory(editorPayload, { playthroughId: '123', loads: game().loads, previous })
    expect(saved?.exStoryMemory?.hidden).toContain(fact.id)
    expect(inspect().included).not.toContain(fact.id)
  })
  it('control: preserving the encounter hidden flag keeps a text edit out of future recall', async () => {
    const previous = game().exStoryMemory
    const editorPayload = { ...previous, encounterEdits: { ...previous.encounterEdits,
      [encounterId]: { ...previous.encounterEdits[encounterId], text: 'Sarah corrected her account of the atlas.' } } }
    await writeStoryMemory(editorPayload, { playthroughId: '123', loads: game().loads, previous })
    expect(saved?.exStoryMemory?.encounterEdits[encounterId].hidden).toBe(true)
    expect(inspect().included).not.toContain(encounterId)
  })
})
