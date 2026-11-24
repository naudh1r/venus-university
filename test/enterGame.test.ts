import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BankedOpening,
  GameSave,
  LedgerResponse,
  Result,
  SceneState,
  TextingResponse
} from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { openingScene } from '../src/renderer/stores/loop/saves'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { character, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'
import { useLorebookStore } from '../src/renderer/stores/lorebookStore'
import type { LorebookRecord } from '../src/shared/lorebookRecord'

/**
 * Where a loaded save puts playback. A load that reads its marks wrong either replays lines the
 * reader already had, skips the ones still queued, or holds a decision point where there is
 * none — and leaving then writes that point over the autosave.
 */

// `gameLoop` reaches `jobStore`, which subscribes to `jobs:progress` at module scope — so the
// bridge has to exist before the import, not the call.
stubApi({ jobs: { onProgress: () => () => {} } })
const { enterGame } = await import('../src/renderer/stores/gameLoop')

/** A save of the store as it starts, under `saveId`, holding `scene`. */
function saveOf(scene: SceneState, saveId = 'manual07'): GameSave {
  useGameStore.getState().reset()
  return {
    ...useGameStore.getState().toGameSave(),
    playthroughId: 'p1',
    saveId,
    saveDate: 0,
    scene
  }
}

/** A solo scene's reply, `read` lines of it read and `queued` more to come. */
function replyScene(read: string[], queued: string[]): SceneState {
  const lines = sceneLines(...read)
  return {
    ...openingScene(sceneLines(...queued)),
    transcript: [...lines, ...sceneLines(...queued)],
    summary: 'They talked.',
    sceneLog: lines,
    currentLine: lines[lines.length - 1] ?? null
  }
}

beforeEach(() => {
  resetLoopState()
  stubApi({
    // Mods are on here, so an unversioned game is told so and remembered.
    mods: { unversionedSeen: vi.fn(async (): Promise<Result<void>> => ({ ok: true, data: undefined })) },
    saves: {
      readProfilePicture: vi.fn(
        async (): Promise<Result<Uint8Array<ArrayBuffer> | null>> => ({ ok: true, data: null })
      )
    },
    lorebook: {
      read: vi.fn(async (): Promise<Result<LorebookRecord | null>> => ({ ok: true, data: null }))
    }
  })
})

afterEach(() => {
  restoreApi()
  vi.restoreAllMocks()
})

describe('enterGame', () => {
  it('shows a mid-reply save on its line, with the rest of the reply still queued', () => {
    const scene = { ...replyScene(['One.'], ['Two.', 'Three.', 'Four.']), resumeOnLine: true as const }
    enterGame(saveOf(scene), playthroughRecord(), {})

    const game = useGameStore.getState()
    expect(game.awaitingInput).toBe(false)
    expect(game.currentLine).toEqual({ speaker: '', text: 'One.' })
    expect(game.pendingLines).toEqual(sceneLines('Two.', 'Three.', 'Four.'))
    // Not a decision point: leaving from it writes nothing over the autosave.
    expect(loopState.decisionSave).toBeNull()
  })

  it('opens the input on a decision point and holds it for the way out', () => {
    const scene = replyScene(['Hello.'], [])
    const save = saveOf(scene)
    enterGame(save, playthroughRecord(), {})

    expect(useGameStore.getState().awaitingInput).toBe(true)
    expect(loopState.decisionSave).toBe(save.scene)
  })

  it('opens the input on a landing without making it a decision point', () => {
    // A live landing is not one either: nothing has been said that a reload could lose.
    const narration = sceneLines('Morning, and the quad is loud.')
    const scene: SceneState = {
      ...openingScene([]),
      sceneLog: narration,
      currentLine: narration[0]
    }
    enterGame(saveOf(scene), playthroughRecord(), {})

    expect(useGameStore.getState().awaitingInput).toBe(true)
    expect(loopState.decisionSave).toBeNull()
  })

  it('resumes an ending on its line, with what the ending banked restored', () => {
    const ledger: LedgerResponse = {}
    const opening = {
      lines: sceneLines('Evening.'),
      hangouts: [],
      events: [],
      cancellations: []
    } as unknown as BankedOpening
    const scene: SceneState = {
      ...replyScene(['Goodbye.'], []),
      endPending: true,
      ledger,
      opening,
      resumeOnLine: true
    }
    enterGame(saveOf(scene), playthroughRecord(), {})

    const game = useGameStore.getState()
    expect(game.sceneEnding).toBe(true)
    expect(loopState.pendingLedgerResult).toBe(ledger)
    expect(loopState.bankedOpening).toEqual(opening)
    // Nothing has advanced: the last line is still up and the status sequence not yet raised.
    expect(game.currentLine).toEqual({ speaker: '', text: 'Goodbye.' })
    expect(game.statusShown).toBe(false)
    expect(game.awaitingInput).toBe(false)
  })

  it('folds a slot opening back only into a boundary save', () => {
    const scene = replyScene(['Hello.'], [])
    enterGame(saveOf(scene, '1700000000000'), playthroughRecord(), {})
    expect(loopState.slotSaveId).toBe('1700000000000')

    enterGame(saveOf(scene, 'autosave'), playthroughRecord(), {})
    expect(loopState.slotSaveId).toBeNull()

    enterGame(saveOf(scene, 'manual07'), playthroughRecord(), {})
    expect(loopState.slotSaveId).toBeNull()
  })
})

describe('a held reply the save left unfinished', () => {
  /** A landing save whose only chat ends on a busy-time text still waiting for her reply. */
  function heldSave(): GameSave {
    const narration = sceneLines('Morning.')
    const save = saveOf({ ...openingScene([]), sceneLog: narration, currentLine: narration[0] })
    const text = { id: 'text', sender: 'player' as const, text: 'Out of class yet?', date: save.date,
      time: save.time, awaitingReply: true as const }
    return { ...save, bunnyboard: { ...save.bunnyboard, conversations: {
      'char-1': { charId: 'char-1', messages: [text], unread: 0, summary: null,
        heldReply: { until: { date: save.date + 1, time: 0 }, firstPlayerId: 'text', messageIds: [] } }
    } } }
  }

  /** Holds the playthrough's lorebook read open, and records the lorebook's state at each reply sent. */
  function stubHeldRead(): { finish: () => void; sentWhile: string[] } {
    let finish = (): void => {}
    const read = new Promise<Result<LorebookRecord | null>>(resolve => {
      finish = () => resolve({ ok: true, data: null })
    })
    const sentWhile: string[] = []
    stubApi({
      saves: { readProfilePicture: vi.fn(async (): Promise<Result<Uint8Array<ArrayBuffer> | null>> => ({ ok: true, data: null })) },
      lorebook: { read: vi.fn(() => read) },
      llm: {
        onTextingDelta: () => () => {},
        completeTexting: vi.fn((): Promise<Result<TextingResponse>> => {
          sentWhile.push(useLorebookStore.getState().status)
          return new Promise(() => {})
        })
      }
    })
    return { finish: () => finish(), sentWhile }
  }

  it('is written only once the playthrough\'s lorebook has been read', async () => {
    const { finish, sentWhile } = stubHeldRead()
    enterGame(heldSave(), playthroughRecord(), { 'char-1': character() })
    await Promise.resolve()
    expect(sentWhile).toEqual([])

    finish()
    await vi.waitFor(() => expect(sentWhile).toEqual(['ready']))
  })

  it('is not written for a game left before the read finished', async () => {
    const { finish, sentWhile } = stubHeldRead()
    enterGame(heldSave(), playthroughRecord(), { 'char-1': character() })
    resetLoopState()

    finish()
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(sentWhile).toEqual([])
  })
})

describe('a save the night ending wrote', () => {
  it('keeps the night\'s paid ledger for its row to claim', () => {
    const narration = sceneLines('Late.')
    const save = saveOf({ ...openingScene([]), sceneLog: narration, currentLine: narration[0] })
    const bank = { key: '15|mia:t1', reply: { stats: {} } as LedgerResponse }
    enterGame({ ...save, heldNightLedger: bank }, playthroughRecord(), {})
    expect(loopState.nightLedger).toEqual(bank)

    enterGame(save, playthroughRecord(), {})
    expect(loopState.nightLedger).toBeNull()
  })

  it('opens the morning from the opening it already wrote, without asking for another', async () => {
    const slotIntro = vi.fn()
    stubApi({
      saves: {
        readProfilePicture: vi.fn(async (): Promise<Result<Uint8Array<ArrayBuffer> | null>> => ({ ok: true, data: null })),
        overwrite: vi.fn(async (): Promise<Result<GameSave>> => ({ ok: true, data: {} as GameSave }))
      },
      lorebook: { read: vi.fn(async (): Promise<Result<LorebookRecord | null>> => ({ ok: true, data: null })) },
      // Any request at all fails the test; delta listeners only subscribe.
      llm: new Proxy({}, { get: (_, name) => String(name).startsWith('on') ? () => () => {} : slotIntro })
    })
    const morningOpening = { lines: sceneLines('You wake to the hall waking up.'), hangouts: [], events: [], cancellations: [] }
    // An ordinary morning, past move-in week's authored openings.
    enterGame({ ...saveOf(null as unknown as SceneState, '1700000000000'), date: 15, time: 0, scene: null, morningOpening },
      playthroughRecord(), {})

    await vi.waitFor(() => expect(useGameStore.getState().currentLine?.text).toBe('You wake to the hall waking up.'))
    expect(slotIntro).not.toHaveBeenCalled()
  })
})
