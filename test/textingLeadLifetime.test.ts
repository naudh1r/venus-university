import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Conversation, Result, TextingResponse } from '@shared/types'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { resetTextingLoop, cancelAllTexts, sendMessage } from '../src/renderer/stores/textingLoop'
import { writesSettled } from '../src/renderer/stores/loop/saves'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { character, charactersById, charInfo, sceneLines, restoreApi, stubApi } from './fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const { leaveToMenu } = await import('../src/renderer/stores/gameLoop')
const game = () => useGameStore.getState()
const chars = charactersById(character({ charId: 'a' }), character({ charId: 'b', firstName: 'Mina' }))
const answer: TextingResponse = { messages: [], summary: 'Fresh summary', blocked: false }
const thread = (charId: string): Conversation => ({ charId, unread: 0, summary: null, messages: [] })
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(yes => { resolve = yes })
  return { promise, resolve }
}
beforeEach(() => {
  resetTextingLoop(); resetLoopState(); game().reset(); useBunnyboardStore.getState().reset()
  useGameStore.setState({ playthroughId: '123', date: 7, time: 0, chars: ['a', 'b'], characters: chars,
    charKeyToId: { sarah_rose: 'a', mina_rose: 'b' },
    charInfo: { a: charInfo({ nameKnown: true }), b: charInfo({ nameKnown: true }) },
    bunnyboard: { ...game().bunnyboard, conversations: { a: thread('a'), b: thread('b') } } })
})
afterEach(async () => { resetTextingLoop(); await writesSettled(); resetLoopState(); restoreApi(); vi.restoreAllMocks() })



const hooks = await import('../src/renderer/mods/hooks')
let nextId = 0
function listen(sceneAfterLanding = false) {
  const id = `lead-test-${nextId++}`
  hooks.setHookRules({ isOn: current => current === id, order: () => 0 })
  let signal: AbortSignal | undefined
  let landed = false
  hooks.registerHooks(id, {
    dmReplyLead: ctx => { signal = ctx.signal },
    afterDmReply: () => {
      landed = true
      if (sceneAfterLanding) useGameStore.setState({ currentSceneTranscript: sceneLines('A scene.') })
    }
  })
  return { signal: () => signal, landed: () => landed }
}
function bridge(complete: (emit: (text: string) => void) => Promise<Result<TextingResponse>>) {
  let delta: (group: string, text: string) => void = () => {}
  stubApi({ jobs: { cancelGroup: async () => ({ ok: true, data: undefined }) }, llm: {
    onTextingDelta: listener => { delta = listener; return () => {} },
    completeTexting: () => complete(text => delta('texting:a', text)),
    classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } })
  } })
}
const prefix = '{"lead":true,"messages":['

it.each(['landed', 'scene-after-landing', 'cancelled', 'failed', 'blocked', 'throws'] as const)(
  'ends provisional work correctly when the reply is %s', async outcome => {
    const heard = listen(outcome === 'scene-after-landing')
    bridge(async emit => {
      emit(prefix)
      if (outcome === 'throws') throw Error('transport failed')
      if (outcome === 'cancelled' || outcome === 'failed') return { ok: false, error: { code: outcome === 'cancelled' ? 'CANCELLED' : 'FAILED', message: 'test' } }
      return { ok: true, data: { ...answer, blocked: outcome === 'blocked' } }
    })
    const turn = sendMessage('a', 'Hello')
    if (outcome === 'throws') await expect(turn).rejects.toThrow('transport failed')
    else await turn
    const landed = outcome === 'landed' || outcome === 'scene-after-landing'
    expect(heard.landed()).toBe(landed)
    expect(heard.signal()).toBeDefined()
    expect(heard.signal()?.aborted).toBe(!landed)
  }
)

it.each(['reset', 'scene', 'leaving'] as const)('aborts immediately on %s while completion is still pending', async action => {
  const heard = listen()
  const pending = deferred<Result<TextingResponse>>()
  bridge(async emit => { emit(prefix); return pending.promise })
  const turn = sendMessage('a', 'Hello')
  expect(heard.signal()?.aborted).toBe(false)
  if (action === 'reset') resetTextingLoop()
  else if (action === 'scene') cancelAllTexts()
  else await leaveToMenu()
  expect(heard.signal()?.aborted).toBe(true)
  pending.resolve({ ok: true, data: answer })
  await turn
  expect(heard.landed()).toBe(false)
})

it('aborts abandonment after completion before the reply lands', async () => {
  const heard = listen()
  bridge(async emit => { emit(prefix); queueMicrotask(() => resetTextingLoop()); return { ok: true, data: answer } })
  await sendMessage('a', 'Hello')
  expect(heard.signal()?.aborted).toBe(true)
  expect(heard.landed()).toBe(false)
})

it('aborts abandonment during pacing', async () => {
  vi.useFakeTimers()
  const heard = listen()
  try {
    bridge(async emit => { emit(prefix); return { ok: true, data: { ...answer, messages: ['right'] } } })
    const turn = sendMessage('a', 'Hello')
    await vi.advanceTimersByTimeAsync(0)
    cancelAllTexts()
    expect(heard.signal()?.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(60000)
    await turn
    expect(heard.landed()).toBe(false)
  } finally { vi.useRealTimers() }
})

it.each([
  '{"lead":{"messages":["wrong"]},"messages":["right"]}',
  '{"lead":"messages","other":["wrong"],"messages":["right"]}'
])('delivers only the authoritative top-level messages from a streamed reply', async streamed => {
  vi.useFakeTimers()
  listen()
  try {
    bridge(async emit => { emit(streamed); return { ok: true, data: { ...answer, messages: ['right'] } } })
    const turn = sendMessage('a', 'Hello')
    await vi.advanceTimersByTimeAsync(60000)
    await turn
    expect(game().bunnyboard.conversations.a.messages.filter(message => message.sender === 'contact').map(message => message.text)).toEqual(['right'])
  } finally { vi.useRealTimers() }
})

it('keeps trailing field definitions and unique requirements when mod fields collide', async () => {
  hooks.registerHooks('schema-lead', { prompts: { dm: {
    lead: true, fields: () => ({ shared: { type: 'boolean' } }), required: () => ['shared']
  } } })
  hooks.registerHooks('schema-trailing', { prompts: { dm: {
    fields: () => ({ shared: { type: 'string' }, tail: { type: 'integer' } }), required: () => ['shared', 'tail']
  } } })
  hooks.setHookRules({ isOn: id => id === 'schema-lead' || id === 'schema-trailing', order: () => 0 })
  let schema: Record<string, unknown> | undefined
  stubApi({ llm: {
    onTextingDelta: () => () => {},
    completeTexting: async request => { schema = request.schema.schema; return { ok: true, data: answer } },
    classifyHangout: async () => ({ ok: true, data: { playerAsked: false, characterOffered: false, description: '' } })
  } })
  await sendMessage('a', 'Hello')
  expect(schema?.properties).toMatchObject({ shared: { type: 'string' }, tail: { type: 'integer' } })
  const required = schema?.required as string[]
  expect(required).toContain('shared')
  expect(required).toContain('tail')
  expect(required.length).toBe(new Set(required).size)
})
