import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlotIntroResponse, LedgerResponse, Result, StructuredRequest } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { currentStorySnapshot } from '../src/renderer/stores/storyMemory'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { claimTextLedger, fetchEndingOpening, prefetchTextLedger } from '../src/renderer/stores/loop/hooks'
import * as introPrompt from '../src/renderer/prompts/slotIntroPrompt'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// Stand in only for the saved prompt edits; exercise the real ending and request builders.
vi.mock('../src/renderer/stores/promptStudioStore', async (original) => ({
  ...await original<typeof import('../src/renderer/stores/promptStudioStore')>(),
  textEditsNow: () => ({ global: {
    'persona.solo': 'Keep the player-authored bookkeeping instructions.',
    'persona.narration': 'Keep the player-authored opening instructions.'
  } })
}))

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/stores/gameLoop')

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  useModsStore.setState({ switches: { on: { 'story-memory': true }, options: {} } })
  useGameStore.setState({
    playthroughId: '123456789', date: 7, time: 0,
    chars: ['a'], characters: { a: character({ charId: 'a' }) },
    charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo() },
    history: { 6: { 0: 'Sarah promised to bring her violin to the next meeting.' } },
    exCharacterDynamics: { version: 1, characters: { a: { traits: ['guarded'] } } },
    bunnyboard: { ...useGameStore.getState().bunnyboard, conversations: {
      a: { charId: 'a', unread: 0, summary: null, messages: [
        { id: 'message', sender: 'player', text: 'See you tomorrow.', date: 7, time: 0 }
      ] }
    } }
  })
})

afterEach(() => { resetLoopState(); restoreApi(); vi.restoreAllMocks() })

describe('mod context through the guarded ending builders', () => {
  it.each([false, true])('preserves global edits in the texting ledger (prefetched=%s)', async (prefetched) => {
    const completeLedger = vi.fn(async (_request: StructuredRequest): Promise<Result<LedgerResponse>> =>
      ({ ok: true, data: {} }))
    stubApi({ llm: { completeLedger } })
    if (prefetched) prefetchTextLedger()
    await claimTextLedger(7, 0)
    expect(completeLedger).toHaveBeenCalledTimes(1)
    expect(completeLedger.mock.calls[0][0].system).toBe('Keep the player-authored bookkeeping instructions.')
  })

  it('carries Story Memory, Character Dynamics and global edits into the next opening', async () => {
    const build = vi.spyOn(introPrompt, 'buildSlotIntroPrompt')
    const completeIntro = vi.fn(async (_request: StructuredRequest): Promise<Result<SlotIntroResponse>> =>
      ({ ok: true, data: { lines: [], hangouts: [], posts: [] } }))
    stubApi({ llm: { completeIntro } })
    const expectedMemory = currentStorySnapshot()
    expect(expectedMemory).toBeDefined()
    const opening = await fetchEndingOpening({})
    expect(opening).not.toBeNull()
    expect(build).toHaveBeenCalledTimes(1)
    expect(build.mock.calls[0][0]).toMatchObject({
      storyMemory: expectedMemory,
      exCharacterDynamics: useGameStore.getState().exCharacterDynamics
    })
    expect(completeIntro).toHaveBeenCalledTimes(1)
    expect(completeIntro.mock.calls[0][0].system).toContain('Keep the player-authored opening instructions.')
  })
})
