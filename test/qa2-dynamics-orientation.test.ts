import './fixtures/maestroModelKit'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterDynamics } from '@shared/characterDynamics'
import type { StructuredRequest } from '@shared/types'
import { character, charInfo, charactersById, playthroughRecord, restoreApi, stubApi } from './fixtures'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { loopState, resetLoopState } from '../src/renderer/stores/loop/state'
import '../src/renderer/modEntries/character-dynamics'

const capture = vi.hoisted(() => ({ requests: [] as StructuredRequest[] }))
vi.mock('../src/renderer/stores/loop/stream', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/stream')>(),
  streamScene: vi.fn((request: StructuredRequest) => {
    capture.requests.push(request)
    return new Promise(() => {})
  })
}))
vi.mock('../src/renderer/stores/loop/turn', async importOriginal => ({
  ...await importOriginal<typeof import('../src/renderer/stores/loop/turn')>(),
  runSceneTurn: vi.fn(async () => {})
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const { retryTurn } = await import('../src/renderer/stores/gameLoop')

beforeEach(() => {
  capture.requests.length = 0
  useGameStore.getState().reset()
  resetLoopState()
  useModsStore.setState({ switches: { on: { 'character-dynamics': true, echo: false, reckoning: false }, options: {} } })
  stubApi({
    jobs: { onProgress: () => () => {}, cancelGroup: async () => ({ ok: true, data: undefined }) },
    chars: {
      cgs: async () => ({ ok: true, data: {} as never }),
      outfits: async () => ({ ok: true, data: {} as never }),
      room: async () => ({ ok: true, data: {} as never })
    }
  })
})
afterEach(() => { resetLoopState(); restoreApi() })

describe('QA: Dynamics acquaintance must survive the first orientation cast', () => {
  it.each([1, 2])('does not introduce a known ex-girlfriend as a stranger (year %i)', async year => {
    const girls = Array.from({ length: 12 }, (_, i) => character({ charId: `girl-${i}`, firstName: `Girl${i}` }))
    const dynamics: CharacterDynamics = { version: 1, characters: Object.fromEntries(girls.map(girl => [girl.charId, {
      traits: [], relationship: { kind: 'ex-girlfriend', reason: 'They dated throughout high school and separated amicably last summer.' }
    }])) }
    const record = playthroughRecord({ chars: girls.map(girl => girl.charId), mods: ['character-dynamics'] })
    loopState.record = record
    useGameStore.setState({
      playthroughId: '123', date: 0, time: 0,
      chars: record.chars, characters: charactersById(...girls),
      charKeyToId: Object.fromEntries(girls.map(girl => [`${girl.firstName.toLowerCase()}_rose`, girl.charId])),
      charInfo: Object.fromEntries(girls.map(girl => [girl.charId, charInfo({ year, nameKnown: true,
        flags: { ...charInfo().flags, hasMet: true } })])),
      exCharacterDynamics: dynamics,
      turnError: { code: 'QA_OFFLINE', message: 'Synthetic initial scene retry' }
    })
    // Retry dispatches the same startOrientationScene path as the initial slot opening.
    loopState.lastTurn = { intro: true, action: '', scene: null }
    retryTurn()
    await vi.waitFor(() => expect(capture.requests).toHaveLength(1))
    const state = useGameStore.getState(), request = capture.requests[0]
    expect(state.cast).toHaveLength(1)
    expect(state.charInfo[state.cast[0]].flags.hasMet).toBe(true)
    expect(request.user).toContain(dynamics.characters[state.cast[0]].relationship!.reason)
    // Behavioral conflict: the scene direction must not negate the player's saved acquaintance.
    expect(/Neither of them knows anybody here yet|two people who have just met/.test(request.user)).toBe(false)
  })
})
