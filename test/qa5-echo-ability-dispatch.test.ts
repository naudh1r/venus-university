import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEcho } from '@shared/echo'
import { normalizeBreakthrough } from '@shared/breakthrough'
import { ECHO_BREAKTHROUGH_ABILITIES } from '@shared/echoBreakthrough'
import type { StructuredRequest } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useAssetStore } from '../src/renderer/stores/assetStore'
import { activateBreakthrough } from '../src/renderer/stores/breakthrough'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { character, charactersById, charInfo, playthroughRecord, restoreApi, sceneLines, stubApi } from './fixtures'

const capture = vi.hoisted(() => ({ requests: [] as StructuredRequest[] }))
vi.mock('../src/renderer/stores/loop/stream', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/stream')>(),
  streamScene: vi.fn((request: StructuredRequest) => { capture.requests.push(request); return new Promise(() => {}) })
}))
vi.mock('../src/renderer/stores/loop/turn', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/turn')>(),
  runSceneTurn: vi.fn(async () => {})
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { interject } = await import('../src/renderer/stores/gameLoop')
const game = () => useGameStore.getState()
const girl = character({ charId: 'a', firstName: 'Nina' })
beforeEach(() => {
  game().reset(); resetLoopState(); capture.requests.length = 0
  const lines = sceneLines('The first read line.', 'The second read line.', 'The abandoned unread line.')
  useModsStore.setState({ switches: { on: { echo: true, breakthrough: true, reckoning: false }, options: {} } })
  useAssetStore.setState({ backgrounds: { interior: [], exterior: ['quad'] } })
  loopState.record = playthroughRecord({ chars: ['a'] })
  useGameStore.setState({ playthroughId: 'echo-dispatch', date: 7, time: 0, chars: ['a'], cast: ['a'],
    characters: charactersById(girl), charInfo: { a: charInfo({ nameKnown: true }) },
    currentSceneTranscript: lines, sceneLog: lines.slice(0, 2), currentLine: lines[1], pendingLines: [lines[2]],
    awaitingInput: false, exBreakthrough: normalizeBreakthrough({ meters: { a: 60 } }),
    exEcho: normalizeEcho({ player: { aspect: 'stoneward', name: 'Steady Light' }, girls: {} }) })
  stubApi({ jobs: { onProgress: () => () => {}, cancelGroup: async () => ({ ok: true, data: undefined }) },
    saves: { autosave: async (id, draft) => ({ ok: true, data: { ...draft, playthroughId: id, saveId: 'autosave', saveDate: 0 } }) } })
})
afterEach(async () => { await writesSettled(); resetLoopState(); restoreApi(); useAssetStore.setState({ backgrounds: { interior: [], exterior: [] } }) })

describe('QA5: Echo abilities use native interjection boundaries', () => {
  it.each([false, true])('keeps exact pending price/preset through unread cut (rewound=%s)', async rewound => {
    if (rewound) expect(game().rewindLine()).toBe(true)
    const expectedRead = rewound ? 1 : 2
    activateBreakthrough('a', 'Ignored caller text.', interject, 'stoneward')
    await writesSettled()
    expect(capture.requests).toHaveLength(1)
    expect(game().exBreakthrough.meters.a).toBe(35)
    expect(game().exBreakthrough.pending).toMatchObject({ echoAspect: 'stoneward', spent: 25, direction: ECHO_BREAKTHROUGH_ABILITIES.stoneward.action })
    expect(loopState.lastTurn?.breakthrough).toEqual(game().exBreakthrough.pending)
    expect(game().currentSceneTranscript).toHaveLength(expectedRead + 1)
    expect(game().currentSceneTranscript.at(-1)?.text).toBe(ECHO_BREAKTHROUGH_ABILITIES.stoneward.action)
    expect(game().currentSceneTranscript.some(line => line.text === 'The abandoned unread line.')).toBe(false)
    expect(loopState.decisionSave?.transcript).toHaveLength(expectedRead)
  })
})
