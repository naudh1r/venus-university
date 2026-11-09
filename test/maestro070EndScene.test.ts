import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LedgerResponse, Result, StructuredRequest } from '@shared/types'
import { READER_SPEAKER } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { endSceneOpenOf, interjectOfferOf } from '../src/renderer/stores/loop/playback'
import { talentSceneOpen } from '../src/renderer/stores/talentActions'
import { character, charInfo, restoreApi, sceneLines, stubApi } from './fixtures'
import '../src/renderer/modEntries/story-memory'

stubApi({ jobs: { onProgress: () => () => {} } })
const { endScene, dropEnding } = await import('../src/renderer/stores/gameLoop')

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  useModsStore.setState({ switches: { on: { 'story-memory': true }, options: {} } })
})
afterEach(() => { dropEnding(); resetLoopState(); restoreApi(); vi.restoreAllMocks() })

describe('manual scene endings with Maestro mods', () => {
  it('cuts unread content before Story Memory extraction and asks for the native recap alongside it', async () => {
    const read = sceneLines('We agreed to meet tomorrow.')[0]
    const unread = sceneLines('UNREAD_SECRET_MUST_NOT_REACH_LEDGER')[0]
    const action = { speaker: READER_SPEAKER, text: 'I ask about tomorrow.' }
    useGameStore.setState({
      playthroughId: '7000001', date: 7, time: 0,
      characters: { a: character({ charId: 'a' }) }, chars: ['a'], cast: ['a'],
      charKeyToId: { sarah_rose: 'a' }, charInfo: { a: charInfo() },
      currentSceneTranscript: [action, read, unread], sceneLog: [action, read],
      currentLine: read, pendingLines: [unread], streaming: true, busy: true
    })
    let answer!: (result: Result<LedgerResponse>) => void
    const deferred = new Promise<Result<LedgerResponse>>(resolve => { answer = resolve })
    const ledger = vi.fn((_request: StructuredRequest) => deferred)
    const autosave = vi.fn()
    stubApi({
      jobs: { onProgress: () => () => {}, cancelGroup: vi.fn(async (): Promise<Result<void>> => ({ ok: true, data: undefined })) },
      llm: { completeLedger: ledger }, saves: { autosave }
    })
    expect(endSceneOpenOf(useGameStore.getState())).toBe(true)
    expect(endScene()).toBe(true)
    await vi.waitFor(() => expect(ledger).toHaveBeenCalledTimes(1))
    const request = ledger.mock.calls[0][0]
    const schema = request.schema.schema as { required: string[]; properties: Record<string, unknown> }
    expect(schema.required).toContain('summary')
    expect(schema.properties).toHaveProperty('summary')
    expect(schema.properties).toHaveProperty('exStoryFacts')
    expect(request.user).toContain(read.text)
    expect(request.user).not.toContain(unread.text)
    expect(useGameStore.getState().currentSceneTranscript).toEqual([action, read])
    expect(useGameStore.getState().sceneEndedByHand).toBe(true)
    expect(interjectOfferOf(useGameStore.getState())).toBe('none')
    expect(talentSceneOpen(useGameStore.getState())).toBe(false)
    expect(endScene()).toBe(false)
    // A save change while the ledger is in flight must discard the entire old ending.
    dropEnding()
    answer({ ok: true, data: { summary: 'Discarded old scene recap.' } })
    await vi.waitFor(() => expect(loopState.pendingLedgerResult).toBeNull())
    expect(autosave).not.toHaveBeenCalled()
  })
})
