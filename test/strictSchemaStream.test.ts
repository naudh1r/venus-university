import { afterEach, expect, it, vi } from 'vitest'
import type { Result, SceneResponse, StructuredRequest } from '@shared/types'
import { endEmptyScene, sceneBoundary } from '../src/renderer/mods/strictSchema/ending'
import { character, charactersById, restoreApi, stubApi } from './fixtures'

afterEach(restoreApi)

it('releases a later cast entrance in order in both streaming and final passes', async () => {
  vi.resetModules()
  let emit!: (delta: string) => void
  let resolve!: (result: Result<SceneResponse>) => void
  stubApi({ llm: {
    onSceneDelta: listener => { emit = listener; return () => {} },
    completeScene: () => new Promise(answer => { resolve = answer })
  } })
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.registerHooks('strict-schema', { sceneLines: sceneBoundary, sceneResult: endEmptyScene })
  const { useGameStore, buildCharKeyToId } = await import('../src/renderer/stores/gameStore')
  const { resetLoopState } = await import('../src/renderer/stores/loop/state')
  const { streamScene } = await import('../src/renderer/stores/loop/stream')
  const sarah = character()
  const mina = character({ charId: 'mina', firstName: 'Mina', lastName: 'Okafor' })
  const characters = charactersById(sarah, mina)
  useGameStore.getState().reset()
  resetLoopState()
  useGameStore.setState({ playthroughId: 'p1', characters, cast: [sarah.charId, mina.charId],
    charKeyToId: buildCharKeyToId(characters), slots: [sarah.charId, null, null] })
  hooks.setHookRules({ isOn: id => id === 'strict-schema', order: () => 0 })
  const request: StructuredRequest = { system: '', user: '', schema: { name: 'scene', schema: {
    properties: { lines: { type: 'array' }, summary: { type: 'string' }, end_scene: { type: 'boolean' } }
  } } }
  const lines = [
    { speaker: '', text: 'Sarah leaves.', actions: ['hide:sarah_rose'] },
    { speaker: '', text: 'Footsteps approach.' },
    { speaker: '', text: 'Mina arrives.', actions: ['show:mina_okafor'] }
  ]
  const pending = streamScene(request, undefined, { stage: ['sarah_rose'], fits: () => true })
  emit('{"lines":[' + JSON.stringify(lines[0]) + ',' + JSON.stringify(lines[1]) + ',')
  expect(useGameStore.getState().currentSceneTranscript.map(line => line.text)).toEqual(['Sarah leaves.'])
  emit(JSON.stringify(lines[2]) + '],"summary":"Sarah left and Mina arrived.","end_scene":false}')
  expect(useGameStore.getState().currentSceneTranscript.map(line => line.text)).toEqual(lines.map(line => line.text))
  resolve({ ok: true, data: { lines, summary: 'Sarah left and Mina arrived.', end_scene: false } })
  const result = await pending
  if (!result.ok) throw Error('Scene failed.')
  expect(result.data.lines.map(line => line.text)).toEqual(lines.map(line => line.text))
  expect(result.data.summary).toBe('Sarah left and Mina arrived.')
  expect(result.data.end).toBe(false)
})

it('never delivers post-departure messages in either pass or saves their invented recap', async () => {
  vi.resetModules()
  let emit!: (delta: string) => void
  let resolve!: (result: Result<SceneResponse>) => void
  const call = new Promise<Result<SceneResponse>>(answer => { resolve = answer })
  stubApi({ llm: {
    onSceneDelta: listener => { emit = listener; return () => {} },
    completeScene: () => call
  } })
  const hooks = await import('../src/renderer/mods/hooks')
  let enabled = true
  hooks.registerHooks('strict-schema', { sceneLines: sceneBoundary, sceneResult: endEmptyScene })
  const { useGameStore, buildCharKeyToId } = await import('../src/renderer/stores/gameStore')
  const { resetLoopState } = await import('../src/renderer/stores/loop/state')
  const { streamScene } = await import('../src/renderer/stores/loop/stream')
  const sarah = character()
  const characters = charactersById(sarah)
  useGameStore.getState().reset()
  resetLoopState()
  useGameStore.setState({
    playthroughId: 'p1', characters, cast: [sarah.charId],
    charKeyToId: buildCharKeyToId(characters), slots: [sarah.charId, null, null]
  })
  const request: StructuredRequest = { system: '', user: '', schema: { name: 'scene', schema: {
    properties: { lines: { type: 'array' }, summary: { type: 'string' }, end_scene: { type: 'boolean' } }
  } } }
  const response: SceneResponse = {
    lines: [
      { speaker: '', text: 'She says goodbye. She closes the door.', actions: ['hide:sarah_rose'] },
      { speaker: '', text: 'Her: is that a date' },
      { speaker: '', text: 'You agree to Friday night.' }
    ],
    summary: 'The reader accepted a date in a later DM.', end_scene: false
  }
  // Combined mods import their store during loop initialization, which installs production rules.
  hooks.setHookRules({ isOn: () => enabled, order: () => 0 })
  const pending = streamScene(request, undefined, { stage: ['sarah_rose'], fits: text => text.length <= 20 })
  enabled = false
  emit(JSON.stringify(response))
  const delivered = useGameStore.getState().currentSceneTranscript
  expect(delivered.map(line => line.text)).toEqual(['She says goodbye.', 'She closes the door.'])
  resolve({ ok: true, data: response })
  const result = await pending
  expect(result.ok).toBe(true)
  if (!result.ok) throw Error('Scene failed.')
  expect(result.data.lines.map(line => line.text)).toEqual(delivered.map(line => line.text))
  expect(result.data.summary).toBeNull()
  expect(result.data.end).toBe(true)
  expect(useGameStore.getState().currentSceneTranscript).toEqual(delivered)
})
