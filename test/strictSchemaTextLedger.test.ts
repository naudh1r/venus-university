import { expect, it, vi } from 'vitest'
import { character, charactersById, charInfo } from './fixtures'
import type { SchedulePromptInput } from '../src/renderer/prompts/schedulePrompt'

it('routes the actual texting ledger through gated request hooks while preserving plans and other mod fields', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { buildTextLedgerPrompt } = await import('../src/renderer/prompts/textLedgerPrompt')
  const { strictLedgerRequest } = await import('../src/renderer/mods/strictSchema/requests')
  await import('../src/renderer/modEntries/strict-schema')
  const girl = character()
  const schedule: SchedulePromptInput = {
    date: 7, time: 0, characters: charactersById(girl), planned: [],
    threads: [{ charKey: 'sarah_rose', firstName: 'Sarah', messages: [{
      id: 'agreement', sender: 'contact', text: "I'll come to your room tomorrow night.", date: 7, time: 0
    }] }]
  }
  const info = { [girl.charId]: charInfo() }
  const enabled = new Set<string>()
  hooks.setHookRules({ isOn: id => enabled.has(id), order: id => id === 'strict-schema' ? 1 : 0 })
  const base = buildTextLedgerPrompt(schedule, info)
  const snapshot = structuredClone(base)
  expect(base.minThinking).toBe('high')
  hooks.registerHooks('other-ledger-mod', { requests: { 'text-ledger': (request, ctx) => {
    expect(ctx.schedule).toBe(schedule)
    expect(ctx.charInfo).toBe(info)
    return { ...request, user: request.user + '\nOther mod data', schema: { ...request.schema, schema: {
      ...request.schema.schema, properties: { ...request.schema.schema.properties as object, extension: { type: 'string' } }
    } } }
  } } })
  enabled.add('other-ledger-mod')
  const extended = buildTextLedgerPrompt(schedule, info)
  expect(extended.schema.schema.properties).toHaveProperty('extension')
  enabled.add('strict-schema')
  const strict = buildTextLedgerPrompt(schedule, info)
  expect(strict).toEqual(strictLedgerRequest(extended))
  expect(strict).not.toHaveProperty('minThinking')
  expect(strict.schema).toEqual(extended.schema)
  expect(strict.user).toBe(extended.user)
  expect(strict.cacheKey).toBe(base.cacheKey)
  expect(strict.logFrom).toBe(base.logFrom)
  expect(base).toEqual(snapshot)
  enabled.delete('strict-schema')
  expect(buildTextLedgerPrompt(schedule, info)).toEqual(extended)
  enabled.clear()
  expect(buildTextLedgerPrompt(schedule, info)).toEqual(base)
  // Requests already assembled for prefetching or retries keep the captured rules.
  expect(strict).toEqual(strictLedgerRequest(extended))
})
