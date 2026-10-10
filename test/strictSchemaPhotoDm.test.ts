import { expect, it, vi } from 'vitest'
import { character, charInfo } from './fixtures'
import type { TextingPromptState } from '../src/renderer/prompts/textingPrompt'

it('replaces only built-in DM instructions while retaining context and enabled mod additions', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { buildTextingPrompt } = await import('../src/renderer/prompts/textingPrompt')
  await import('../src/renderer/modEntries/strict-schema')
  const { strictPhotoDmBase } = await import('../src/renderer/mods/strictSchema/photoDm')
  const enabled = new Set<string>()
  hooks.setHookRules({ isOn: id => enabled.has(id), order: id => id === 'strict-schema' ? 1 : 0 })
  const state: TextingPromptState = { date: 7, time: 0, roster: [], charInfo: {}, npcRelationships: {},
    classes: {}, playerSchedule: {}, playerJob: null, occasions: [], memoryBudget: 20 }
  const girl = character()
  const conversation = { charId: girl.charId, unread: 0, summary: 'Context mentions YOUR TURN and BLOCKING literally.',
    messages: [{ id: 'a', sender: 'contact' as const, text: 'Previous text', date: 7, time: 0 as const }] }
  const ctx = { character: girl, info: charInfo(), state, conversation, newMessage: 'New text' }
  const build = () => buildTextingPrompt(girl, ctx.info, conversation, ctx.newMessage, state, 'Reader context')
  const base = build()
  // A switch for an uninstalled mod cannot activate the replacement.
  enabled.add('photo-feature')
  enabled.add('strict-schema')
  expect(strictPhotoDmBase(ctx)).toBeUndefined()
  const strictOnly = build()
  expect(strictOnly.user).toBe(base.user)
  expect(strictOnly.system.startsWith(base.system)).toBe(true)
  hooks.registerHooks('photo-feature', { prompts: { dm: {
    lines: () => ['Photo instructions supplied by the photo mod'],
    fields: () => ({ sendPhoto: { type: 'boolean' }, photoPrompt: { type: 'string' }, photoTier: { type: 'string', enum: ['none', 'everyday'] } }),
    required: () => ['sendPhoto', 'photoPrompt', 'photoTier']
  } }, dmHistoryNote: () => ' [photo history context]' })
  enabled.delete('strict-schema')
  const photoOnly = build()
  expect(photoOnly.system).toBe(base.system)
  enabled.add('memory-test')
  hooks.registerHooks('memory-test', { prompts: { dm: { lines: () => ['Other mod context'] } },
    requests: { dm: request => ({ ...request, user: request.user + '\nOther request context' }) } })
  enabled.add('strict-schema')
  const both = build()
  const replacement = strictPhotoDmBase(ctx)!
  expect(both.system.startsWith(replacement.system)).toBe(true)
  expect(both.system).not.toContain(base.system)
  expect(both.schema).toEqual(photoOnly.schema)
  // Context before the built-in turn is retained byte-for-byte, including history notes.
  const turnStart = photoOnly.user.lastIndexOf('\nYOUR TURN\n')
  expect(both.user.slice(0, turnStart)).toBe(photoOnly.user.slice(0, turnStart))
  expect(both.user).toContain(replacement.turn.join('\n'))
  expect(both.user).toContain(replacement.result.join('\n'))
  expect(both.user).toContain('Photo instructions supplied by the photo mod')
  expect(both.user).toContain('Other mod context')
  expect(both.user.endsWith('Other request context')).toBe(true)
  enabled.delete('photo-feature')
  enabled.delete('memory-test')
  expect(build()).toEqual(strictOnly)
  enabled.delete('strict-schema')
  expect(build()).toEqual(base)
  // Replacement ownership follows mod order, without discarding additions from later mods.
  enabled.add('first-owner')
  enabled.add('strict-schema')
  enabled.add('photo-feature')
  const first = { system: 'first', turn: ['turn'], result: ['result'] }
  hooks.registerHooks('first-owner', { dmBasePrompt: () => first })
  expect(hooks.dmBasePrompt(ctx, first)).toBe(first)
})
