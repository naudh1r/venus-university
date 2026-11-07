import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installMods, type ModDef } from '@shared/mods'
import type { Result, SceneLine } from '@shared/types'
import { character as girl, restoreApi, stubApi } from '../fixtures'

// Exercise the hook's external-store contract without a DOM or a renderer test harness.
const hook = vi.hoisted(() => ({ read: null as null | (() => unknown) }))
vi.mock('react', async original => ({
  ...await original<typeof import('react')>(),
  useRef: <T,>(value: T) => (hook as { ref?: { current: T } }).ref ??= { current: value },
  useSyncExternalStore: (_subscribe: unknown, read: () => unknown) => {
    hook.read = read
    return read()
  }
}))
stubApi({ jobs: { onProgress: () => () => {} } })
const view = await import('../../src/renderer/mods/sceneView')
const { useGameStore: game } = await import('../../src/renderer/stores/gameStore')
const { replyRowOfferOf } = await import('../../src/renderer/stores/loop/playback')
const { resetLoopState } = await import('../../src/renderer/stores/loop/state')
const { GRADUATION_DATE } = await import('../../src/renderer/prompts/occasions')
const { isGraduationSlot } = await import('../../src/renderer/prompts/graduation')

function def(id: string, extra: Partial<ModDef> = {}): ModDef {
  return { id, name: id, author: 'test', version: '1.0.0', scope: 'anytime', defaultOn: true, blurb: '', ...extra }
}
const code = (result: Result<unknown>) => (result.ok ? null : result.error.code)
const line = (speaker: string, text: string, bg?: string): SceneLine => ({ speaker, text, ...(bg ? { bg } : {}) })

beforeAll(() => installMods([def('scene-mod'), def('scene-off', { defaultOn: false })]))
beforeEach(() => {
  stubApi({ jobs: { onProgress: () => () => {} } })
  game.getState().reset()
  resetLoopState()
  ;(hook as { ref?: unknown }).ref = undefined
  game.setState({
    playthroughId: '1',
    characters: { a: girl({ charId: 'a', firstName: 'Ana' }), b: girl({ charId: 'b', firstName: 'Bea' }) },
    charKeyToId: { ANA: 'a', BEA: 'b' },
    cast: ['a', 'b'],
    departed: ['b'],
    slots: [null, 'a', null],
    currentSceneTranscript: [line('reader', 'Darts?'), line('ANA', 'Sure.', 'lounge'), line('', 'She grins.'), line('OLD', 'Hm.')],
    sceneLog: [line('', 'Here.', 'dorm'), line('ANA', 'Sure.', 'lounge'), line('', 'Later.')],
    sceneLocation: 'pino_cola_lounge',
    awaitingInput: true
  })
})
afterEach(() => { restoreApi(); vi.restoreAllMocks() })

describe('the scene view', () => {
  it('names speakers by id, leaves narration and unknown keys as narration, and shares nothing', () => {
    const scene = view.scene()!
    expect(scene.lines).toEqual([
      { speaker: 'reader', text: 'Darts?' },
      { speaker: 'a', text: 'Sure.' },
      { speaker: '', text: 'She grins.' },
      { speaker: '', text: 'Hm.' }
    ])
    expect(scene.cast).toEqual(['a', 'b'])
    expect(scene.present).toEqual(['a'])
    expect(scene.stage).toEqual([null, 'a', null])
    expect(scene.background).toBe('lounge')
    expect(scene.location).toBe('pino_cola_lounge')
    for (const part of [scene, scene.lines, scene.lines[1], scene.cast, scene.present, scene.stage]) {
      expect(Object.isFrozen(part)).toBe(true)
    }
    expect(() => (scene.cast as string[]).push('c')).toThrow()
    expect(game.getState().cast).toEqual(['a', 'b'])
    expect(scene.cast).not.toBe(game.getState().cast)
  })

  it('is the same object until something in it changes', () => {
    const first = view.scene()
    game.setState({ bunnyboard: { ...game.getState().bunnyboard, contactsBadge: 3 } })
    expect(view.scene()).toBe(first)
    game.setState({ departed: [] })
    const next = view.scene()!
    expect(next).not.toBe(first)
    expect(next.present).toEqual(['a', 'b'])
    expect(next.lines).toBe(first!.lines)
  })

  it('is null on the menu', () => {
    game.getState().reset()
    expect(view.scene()).toBeNull()
  })

  it('reads a created scene, which has no playthrough, and lets a mod hold its turn', () => {
    const ana = game.getState().characters.a
    // Set on graduation morning: a created scene only shares the date, so it is not scripted.
    game.getState().loadCreatedScene(
      { setup: {} as never },
      { date: GRADUATION_DATE, time: 0, chars: ['a'] } as never,
      { a: ana }
    )
    const key = Object.keys(game.getState().charKeyToId).find((one) => game.getState().charKeyToId[one] === 'a')!
    game.setState({ cast: ['a'], currentSceneTranscript: [line(key, 'Hi.')], awaitingInput: true })
    expect(game.getState().playthroughId).toBeNull()
    expect(isGraduationSlot(game.getState().date, game.getState().time)).toBe(true)
    const scene = view.scene()!
    expect(scene).toMatchObject({ created: true, replay: false, scripted: null, atTurn: true, cast: ['a'] })
    expect(scene.lines).toEqual([{ speaker: 'a', text: 'Hi.' }])
    expect(code(view.holdTurn('scene-mod'))).toBeNull()
  })

  it('reads a calendar replay, which has no playthrough and never hands back the turn', () => {
    const ana = game.getState().characters.a
    game.getState().loadReplay({ date: 3, time: 1, chars: ['a'], charKeyToId: { ANA: 'a' } } as never, { a: ana })
    game.setState({ cast: ['a'], currentSceneTranscript: [line('ANA', 'Again.')] })
    expect(game.getState().playthroughId).toBeNull()
    const scene = view.scene()!
    expect(scene).toMatchObject({ created: false, replay: true, scripted: null, atTurn: false })
    expect(scene.lines).toEqual([{ speaker: 'a', text: 'Again.' }])
    expect(code(view.holdTurn('scene-mod'))).toBe('MOD_WRITE_WAIT')
  })

  it.each([
    ['at his turn', {}],
    ['busy', { busy: true }],
    ['lines still to read', { pendingLines: [line('ANA', 'One more.')] }],
    ['a reply on screen', { awaitingInput: false, pendingLines: [line('ANA', 'One more.')] }],
    ['a replay', { replaying: {} }]
  ] as const)('answers the turn with the game\'s own predicates: %s', (_name, change) => {
    game.setState(change as never)
    const state = game.getState()
    const scene = view.scene()!
    expect(scene.atTurn).toBe(state.awaitingInput && !state.busy && state.pendingLines.length === 0)
    expect(scene.canInterject).toBe(replyRowOfferOf(state) === 'open')
    expect(scene.busy).toBe(state.busy)
    expect(scene.replay).toBe(state.replaying !== null)
  })

  it('subscribes to what a mod selects, and nothing else', () => {
    const changed = vi.fn()
    const stop = view.subscribeScene(changed, (scene) => scene?.present)
    game.setState({ sceneLocation: 'gym' })
    expect(changed).not.toHaveBeenCalled()
    game.setState({ departed: [] })
    expect(changed).toHaveBeenCalledOnce()
    stop()
    game.setState({ departed: ['a'] })
    expect(changed).toHaveBeenCalledOnce()
  })

  it('gives a component the same selection until the view changes', () => {
    const select = vi.fn((scene: Parameters<typeof view.useScene>[0] extends (v: infer V) => unknown ? V : never) =>
      scene?.lines.filter((one) => one.speaker === 'a'))
    const picked = view.useScene(select)
    expect(hook.read!()).toBe(picked)
    game.setState({ sceneLocation: 'gym' })
    expect(hook.read!()).not.toBe(picked)
    expect(select).toHaveBeenCalledTimes(2)
  })
})

describe('holding the turn', () => {
  it('holds the turn at his turn and gives it back once', () => {
    const held = view.holdTurn('scene-mod')
    expect(held.ok).toBe(true)
    expect(view.scene()!.busy).toBe(true)
    expect(view.scene()!.atTurn).toBe(false)
    expect(code(view.holdTurn('scene-mod'))).toBe('MOD_WRITE_WAIT')
    if (!held.ok) return
    held.data()
    expect(view.scene()!.atTurn).toBe(true)
    // A second release must not give back a turn something else has taken since.
    game.setState({ busy: true })
    held.data()
    expect(game.getState().busy).toBe(true)
  })

  it('leaves a game it no longer belongs to alone', () => {
    const held = view.holdTurn('scene-mod')
    if (!held.ok) throw new Error('not held')
    resetLoopState()
    game.setState({ busy: true })
    held.data()
    expect(game.getState().busy).toBe(true)
  })

  it.each([
    ['MOD_WRITE_OFF', 'scene-off', () => {}],
    ['MOD_WRITE_NO_GAME', 'scene-mod', () => game.setState({ playthroughId: null })],
    ['MOD_WRITE_WAIT', 'scene-mod', () => game.setState({ awaitingInput: false })],
    ['MOD_WRITE_WAIT', 'scene-mod', () => game.setState({ pendingLines: [line('ANA', 'Wait.')] })]
  ])('refuses with %s, changing nothing', (expected, modId, setUp) => {
    setUp()
    const before = game.getState().busy
    expect(code(view.holdTurn(modId))).toBe(expected)
    expect(game.getState().busy).toBe(before)
  })
})
