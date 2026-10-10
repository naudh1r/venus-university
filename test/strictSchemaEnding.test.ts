import { describe, expect, it, vi } from 'vitest'
import type { SceneResult, SceneResultContext } from '../src/renderer/mods/hooks'
import { endEmptyScene, sceneBoundary } from '../src/renderer/mods/strictSchema/ending'

function context(stage: string[], canEnd = true, continuation = false): SceneResultContext {
  return {
    stage,
    request: { system: '', user: '', schema: { name: 'scene', schema: {
      properties: { lines: { type: 'array' }, ...(canEnd ? { end_scene: { type: 'boolean' } } : {}), ...(continuation ? { summary: { type: 'string' } } : {}) }
    } } }
  }
}

function reply(...actions: string[]): SceneResult {
  return { lines: [{ speaker: '', text: 'She leaves.', actions }, { speaker: '', text: 'Back to work.' }], summary: 'The reader returns to work.', end: false }
}

describe('empty-stage ending guard', () => {
  it('ends the reported departure without changing lines, summary, or the original result', () => {
    const original = reply('hide:april_valentine')
    const result = endEmptyScene(original, context(['april_valentine']))
    expect(result.end).toBe(true)
    expect(result.lines).toBe(original.lines)
    expect(result.summary).toBe(original.summary)
    expect(original.end).toBe(false)
  })

  it('ends when the last character enters and leaves within a single reply', () => {
    expect(endEmptyScene(reply('show:sarah_rose', 'hide:sarah_rose'), context([])).end).toBe(true)
  })

  it('continues when someone remains or returns before the reply finishes', () => {
    expect(endEmptyScene(reply('hide:sarah_rose'), context(['sarah_rose', 'mina_okafor'])).end).toBe(false)
    expect(endEmptyScene(reply('hide:sarah_rose', 'show:sarah_rose'), context(['sarah_rose'])).end).toBe(false)
    expect(endEmptyScene(reply('hide:sarah_rose', 'show:mina_okafor'), context(['sarah_rose'])).end).toBe(false)
  })

  it('does not infer an ending from prose, an already empty stage, or a redundant hide', () => {
    const original = reply()
    expect(endEmptyScene(original, context([]))).toBe(original)
    expect(endEmptyScene(original, context(['sarah_rose']))).toBe(original)
    const redundant = reply('hide:sarah_rose')
    expect(endEmptyScene(redundant, context([]))).toBe(redundant)
  })

  it('leaves closing and solo contracts and explicit endings alone', () => {
    const original = reply('hide:sarah_rose')
    expect(endEmptyScene(original, context(['sarah_rose'], false))).toBe(original)
    const ended = { ...original, end: true }
    expect(endEmptyScene(ended, context(['sarah_rose']))).toBe(ended)
  })
})

describe('scene departure boundary', () => {
  it('keeps the final departure but suppresses invented later events before playback', () => {
    const transform = sceneBoundary(context(['april_valentine'], true, true))
    const original = reply('hide:april_valentine')
    expect(transform(original.lines[0])).toEqual([original.lines[0]])
    expect(transform({ speaker: '', text: 'Her: is that a date' })).toEqual([])
    expect(transform({ speaker: '', text: 'You agree to Friday night.' })).toEqual([])
  })

  it('closes a stale continuation with nobody present while leaving solo and opening calls alone', () => {
    const line = { speaker: '', text: 'Her: a new message' }
    const ctx = context([], true, true)
    expect(sceneBoundary(ctx)(line)).toEqual([])
    expect(endEmptyScene({ lines: [], summary: null, end: false }, ctx).end).toBe(true)
    expect(sceneBoundary(context([], false, true))(line)).toEqual([line])
    expect(sceneBoundary(context([]))(line)).toEqual([line])
  })

  it('continues with remaining characters or a same-line handoff', () => {
    const line = reply('hide:sarah_rose').lines[0]
    const later = { speaker: 'mina_okafor', text: 'Still here.' }
    const remaining = sceneBoundary(context(['sarah_rose', 'mina_okafor']))
    expect(remaining(line)).toEqual([line])
    expect(remaining(later)).toEqual([later])
    const handoff = sceneBoundary(context(['sarah_rose']))
    const both = reply('show:mina_okafor', 'hide:sarah_rose').lines[0]
    expect(handoff(both)).toEqual([both])
    expect(handoff(later)).toEqual([later])
  })
})

it('captures enabled handlers and starting stage once for an in-flight call', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  let enabled = true
  hooks.setHookRules({ isOn: () => enabled, order: () => 0 })
  hooks.registerHooks('strict-schema', { sceneResult: endEmptyScene })
  const initialStage = ['sarah_rose']
  const ctx = context(initialStage)
  const enabledCall = hooks.captureSceneResult(ctx)
  enabled = false
  const disabledCall = hooks.captureSceneResult(ctx)
  initialStage.splice(0)
  const original = reply('hide:sarah_rose')
  expect(enabledCall(original).end).toBe(true)
  enabled = true
  expect(disabledCall(original)).toBe(original)
})

it('composes result handlers in mod order without losing prior result fields', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: () => true, order: id => id === 'strict-schema' ? 1 : 0 })
  hooks.registerHooks('strict-schema', { sceneResult: endEmptyScene })
  hooks.registerHooks('memory', { sceneResult: result => ({ ...result, summary: 'An earlier hook kept this recap.' }) })
  const result = hooks.captureSceneResult(context(['sarah_rose']))(reply('hide:sarah_rose'))
  expect(result.end).toBe(true)
  expect(result.summary).toBe('An earlier hook kept this recap.')
})

it('captures independent line transforms for preview and final passes and respects the mod switch', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  let enabled = true
  hooks.setHookRules({ isOn: () => enabled, order: () => 0 })
  hooks.registerHooks('strict-schema', { sceneLines: sceneBoundary })
  const ctx = context(['sarah_rose'], true, true)
  const preview = hooks.captureSceneLines(ctx)
  const final = hooks.captureSceneLines(ctx)
  enabled = false
  const off = hooks.captureSceneLines(ctx)
  const original = reply('hide:sarah_rose')
  expect(original.lines.flatMap(preview)).toEqual([original.lines[0]])
  expect(original.lines.flatMap(final)).toEqual([original.lines[0]])
  enabled = true
  expect(original.lines.flatMap(off)).toEqual(original.lines)
})
