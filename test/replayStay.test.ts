import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SlotReplay } from '@shared/replays'
import { READER_SPEAKER, type GameSave, type Result, type SceneState } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { openingScene } from '../src/renderer/stores/loop/saves'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

/**
 * The game a calendar replay is read over is held in memory and entered again afterwards. A
 * hold that comes back different is written over the autosave by the next leave, so the game
 * must come back exactly as it was left.
 */

// `gameLoop` reaches `jobStore`, which subscribes to `jobs:progress` at module scope — so the
// bridge has to exist before the import, not the call.
stubApi({ jobs: { onProgress: () => () => {} } })
const { endReplay, enterGame, enterReplay } = await import('../src/renderer/stores/gameLoop')

/** A save of the store as it starts, holding `scene` and one replay. */
function saveOf(scene: SceneState): GameSave {
  useGameStore.getState().reset()
  return {
    ...useGameStore.getState().toGameSave(),
    playthroughId: 'p1',
    saveId: 'manual07',
    saveDate: 0,
    replays: { 3: { 0: '0123456789abcdef0123456789abcdef' } },
    scene
  }
}

/** A solo scene of day 3's morning: his action and her answer. */
const REPLAY: SlotReplay = {
  schemaVersion: 1,
  date: 3,
  time: 0,
  cast: [],
  keys: {},
  transcript: [{ speaker: READER_SPEAKER, text: 'Hello.' }, ...sceneLines('She waves.')]
}

/** Reads the replay over the game standing now and comes back from it. */
async function roundTrip(): Promise<void> {
  await enterReplay(REPLAY, 'half a thought')
  expect(useGameStore.getState().replaying).not.toBeNull()
  endReplay()
}

beforeEach(() => {
  resetLoopState()
  stubApi({
    jobs: { cancelGroup: vi.fn(async (): Promise<Result<void>> => ({ ok: true, data: undefined })) },
    saves: {
      readProfilePicture: vi.fn(
        async (): Promise<Result<Uint8Array<ArrayBuffer> | null>> => ({ ok: true, data: null })
      )
    }
  })
})

afterEach(() => {
  restoreApi()
  vi.restoreAllMocks()
})

describe('a game held for a replay', () => {
  it('comes back to its decision point as it was left', async () => {
    const lines = sceneLines('Hi there.')
    const scene: SceneState = {
      ...openingScene([]),
      transcript: lines,
      summary: 'They talked.',
      sceneLog: lines,
      currentLine: lines[0]
    }
    enterGame(saveOf(scene), playthroughRecord(), {})
    const before = useGameStore.getState().toGameSave()
    const point = loopState.decisionSave
    expect(point).not.toBeNull()

    await roundTrip()

    const game = useGameStore.getState()
    expect(game.replaying).toBeNull()
    expect(game.toGameSave()).toEqual(before)
    expect(loopState.decisionSave).toBe(point)
    expect(game.inputDraft).toBe('half a thought')
  })

  it('comes back to its landing as it was left', async () => {
    const narration = sceneLines('Morning, and the quad is loud.')
    const scene: SceneState = { ...openingScene([]), sceneLog: narration, currentLine: narration[0] }
    enterGame(saveOf(scene), playthroughRecord(), {})
    const before = useGameStore.getState().toGameSave()

    await roundTrip()

    expect(useGameStore.getState().toGameSave()).toEqual(before)
    expect(loopState.decisionSave).toBeNull()
    expect(useGameStore.getState().awaitingInput).toBe(true)
  })
})
