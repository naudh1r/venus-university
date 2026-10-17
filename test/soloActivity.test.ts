import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerHooks, setHookRules } from '../src/renderer/mods/hooks'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { registerLoopHooks } from '../src/renderer/stores/loop/hooks'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { runSceneTurn } from '../src/renderer/stores/loop/turn'
import type { SceneCall } from '../src/renderer/stores/loop/stream'
import type { Character } from '@shared/types'
import { restoreApi, sceneLines, stubApi } from './fixtures'

const runEnding = vi.fn(async () => {})
registerHooks('test-solo-activity', {
  afterSceneReply: (ctx) => {
    if (ctx.solo && ctx.reply.activity === 'ready') ctx.keepOpen = true
    if (ctx.reply.activity === 'finished') ctx.finishSolo = true
  }
})

beforeEach(() => {
  setHookRules({ isOn: (id) => id === 'test-solo-activity', order: () => 0 })
  useGameStore.getState().reset()
  resetLoopState()
  runEnding.mockClear()
  registerLoopHooks({
    advance: vi.fn(), runEnding, fetchEndingOpening: vi.fn(async () => null),
    dispatchTurn: vi.fn(), prefetchTextLedger: vi.fn(), claimTextLedger: vi.fn(async () => ({}))
  })
  stubApi({})
})
afterEach(restoreApi)

function response(activity?: string, end = false): SceneCall {
  const lines = sceneLines('You stand at the toe line, ready to play.')
  return Promise.resolve({ ok: true, data: { lines, summary: null, end, applied: false, at: 0, reply: { lines, activity } } })
}

it('hands a solo scene to an interactive activity instead of running the forced ending', async () => {
  await runSceneTurn(response('ready'), { scene: null, action: 'play darts at pino cola lounge' }, [], [], true)
  expect(runEnding).not.toHaveBeenCalled()
  expect(useGameStore.getState()).toMatchObject({ sceneEnding: false, busy: false, endingInFlight: false })
  expect(useGameStore.getState().currentSceneTranscript.at(-1)?.text).toContain('toe line')
})

it('still finishes an ordinary solo scene with no queued activity', async () => {
  await runSceneTurn(response(), { scene: null, action: 'take a walk' }, [], [], true)
  expect(runEnding).toHaveBeenCalledExactlyOnceWith(true)
  expect(useGameStore.getState().sceneEnding).toBe(true)
})

it('preserves a normal scene ending when no activity holds it open', async () => {
  await runSceneTurn(response(undefined, true), { scene: null, action: 'say goodbye' }, [], [], false)
  expect(runEnding).toHaveBeenCalledExactlyOnceWith(false)
  expect(useGameStore.getState().sceneEnding).toBe(true)
})

it('closes a held solo scene after its aftermath, running bookkeeping without a second goodbye', async () => {
  await runSceneTurn(response('finished'), { scene: null, action: 'You won at darts.' }, [], [], false)
  expect(runEnding).toHaveBeenCalledExactlyOnceWith(true)
  expect(useGameStore.getState().sceneEnding).toBe(true)
})

it('does not treat an aftermath with an NPC present as a completed solo scene', async () => {
  const npc = { charId: 'maddy', firstName: 'Maddy', lastName: 'Katherine' } as Character
  await runSceneTurn(response('finished'), { scene: null, action: 'You won at darts.' }, ['maddy'], [npc], false)
  expect(runEnding).not.toHaveBeenCalled()
  expect(useGameStore.getState().sceneEnding).toBe(false)
})
