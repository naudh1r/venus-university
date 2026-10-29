import { beforeEach, describe, expect, it, vi } from 'vitest'
import { stubApi } from '../fixtures'

async function setup() {
  const hooks = await import('../../packages/modkit/src/renderer/hooks')
  hooks.setHookRules({ isOn: () => true, order: () => 0 })
  return hooks
}

beforeEach(() => vi.resetModules())

describe('scene prompt state snapshots', () => {
  it('captures each enabled mod once under its own id, with no core-field override', async () => {
    const h = await setup()
    const capture = vi.fn(() => ({ date: 900, text: 'chosen development' }))
    const off = vi.fn(() => 'hidden')
    h.registerHooks('twist', { promptState: { scene: capture } })
    h.registerHooks('memory', { promptState: { scene: () => ({ date: 12 }) } })
    h.registerHooks('off', { promptState: { scene: off } })
    h.setHookRules({ isOn: id => id !== 'off', order: () => 0 })
    expect(h.promptStateParts('scene')).toEqual({
      twist: { date: 900, text: 'chosen development' }, memory: { date: 12 }
    })
    expect(capture).toHaveBeenCalledTimes(1)
    expect(off).not.toHaveBeenCalled()
  })

  it('detaches nested values from live state and from later requests', async () => {
    const h = await setup()
    const live = { facts: ['first'], nested: { text: 'original' } }
    h.registerHooks('twist', { promptState: { scene: () => live } })
    const first = h.promptStateParts('scene')
    live.facts.push('second')
    live.nested.text = 'edited'
    const second = h.promptStateParts('scene')
    expect(first.twist).toEqual({ facts: ['first'], nested: { text: 'original' } })
    expect(second.twist).toEqual(live)
    expect(second.twist).not.toBe(live)
  })

  it('omits undefined answers, preserves null, and has no inherited keys', async () => {
    const h = await setup()
    h.registerHooks('empty', { promptState: { scene: () => undefined } })
    h.registerHooks('null', { promptState: { scene: () => null } })
    const parts = h.promptStateParts('scene')
    expect(Object.keys(parts)).toEqual(['null'])
    expect(parts.null).toBeNull()
    expect(parts.constructor).toBeUndefined()
  })

  it('reports a duplicate owner instead of silently replacing its snapshot', async () => {
    const h = await setup()
    h.registerHooks('twist', { promptState: { scene: () => 'first' } })
    h.registerHooks('twist', { promptState: { scene: () => 'second' } })
    expect(() => h.promptStateParts('scene')).toThrow(/twist.*promptState.scene/)
  })

  it('names the mod if its callback throws or returns a non-cloneable value', async () => {
    const h = await setup()
    h.registerHooks('broken', { promptState: { scene: () => () => 'not data' } })
    expect(() => h.promptStateParts('scene')).toThrow(/broken.*promptState.scene/)
    h.setHookRules({ isOn: id => id === 'throws', order: () => 0 })
    h.registerHooks('throws', { promptState: { scene: () => { throw Error('failed') } } })
    expect(() => h.promptStateParts('scene')).toThrow(/throws.*promptState.scene/)
  })

  it('rejects undeclared registration and recognizes older cores lacking this hook', async () => {
    const h = await setup()
    const compat = await import('../../packages/modkit/src/shared/compat')
    const refused = vi.fn()
    h.setDeclaredHooks({ declared: () => [], onRefused: refused })
    h.registerHooks('undeclared', { promptState: { scene: () => 'hidden' } })
    expect(refused).toHaveBeenCalledWith('undeclared', expect.stringContaining('promptState.scene'))
    expect(h.promptStateParts('scene')).toEqual({})
    expect(compat.hookNamesOf({ promptState: { scene: () => 'x' } })).toEqual(['promptState.scene'])
    const old = { ...compat.CORE_SURFACE, hooks: compat.CORE_SURFACE.hooks.filter(n => n !== 'promptState.scene') }
    expect(compat.checkCompat(['promptState.scene'], undefined, old).status).toBe('needs-update')
    expect(compat.checkCompat(['promptState.scene']).status).toBe('loads')
  })

  it('is captured by the actual game prompt builder without altering native fields', async () => {
    stubApi({ jobs: { onProgress: () => () => {} } })
    const { promptState } = await import('../../src/renderer/stores/loop/promptState')
    const h = await setup()
    const original = promptState()
    let text = 'before editing'
    h.registerHooks('twist', { promptState: { scene: () => text } })
    const captured = promptState()
    text = 'after editing'
    expect(captured.ex?.twist).toBe('before editing')
    expect(promptState().ex?.twist).toBe('after editing')
    expect(captured.date).toBe(original.date)
    expect(captured.stats).toEqual(original.stats)
    h.setHookRules({ isOn: () => false, order: () => 0 })
    expect(promptState().ex?.twist).toBeUndefined()
  })
})
