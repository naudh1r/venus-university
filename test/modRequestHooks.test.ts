import { expect, it, vi } from 'vitest'
import type { StructuredRequest } from '@shared/types'
import type { RequestSpots, SlotSettled } from '../src/renderer/mods/hooks'

it('composes enabled request extensions in list order without losing earlier fields', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: id => id !== 'off', order: id => ['first', 'second', 'off'].indexOf(id) })
  hooks.registerHooks('second', { requests: { dm: request => ({ ...request, user: request.user + ' second' }) } })
  hooks.registerHooks('first', { requests: { dm: request => ({ ...request, user: request.user + ' first' }) } })
  const disabled = vi.fn(() => { throw Error('Disabled extension ran') })
  hooks.registerHooks('off', { requests: { dm: disabled } })
  const original: StructuredRequest = { system: 'system', user: 'base', schema: { name: 'reply', schema: { type: 'object' } } }
  const result = hooks.modRequest('dm', {} as RequestSpots['dm'], original)
  expect(result).toEqual({ ...original, user: 'base first second' })
  expect(original.user).toBe('base')
  expect(disabled).not.toHaveBeenCalled()
})

it('settles active mods synchronously in list order with the supplied boundary snapshot', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const seen: string[] = []
  let enabled = true
  hooks.setHookRules({ isOn: () => enabled, order: id => ['first', 'second'].indexOf(id) })
  const ctx = { ledger: null, closingCast: [] } as unknown as SlotSettled
  hooks.registerHooks('second', { slotSettled: received => { expect(received).toBe(ctx); seen.push('second') } })
  hooks.registerHooks('first', { slotSettled: () => { seen.push('first') } })
  hooks.slotSettled(ctx)
  expect(seen).toEqual(['first', 'second'])
  enabled = false
  hooks.slotSettled(ctx)
  expect(seen).toHaveLength(2)
})

it('excludes disabled and duplicate phone pages while protecting native tabs', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  hooks.setHookRules({ isOn: id => id !== 'off', order: () => 0 })
  const page = { id: 'campus', word: 'CAMPUS', Mark: () => null, Page: () => null }
  hooks.registerHooks('first', { bunnyboardPage: page })
  hooks.registerHooks('second', { bunnyboardPage: page })
  hooks.registerHooks('off', { bunnyboardPage: { ...page, id: 'hidden' } })
  hooks.registerHooks('native', { bunnyboardPage: { ...page, id: 'chats' } })
  expect(hooks.bunnyboardPages()).toEqual([page])
})
