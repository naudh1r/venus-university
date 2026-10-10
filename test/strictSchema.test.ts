import { describe, expect, it, vi } from 'vitest'
import type { Settings, StructuredRequest } from '@shared/types'
import { reasoningToSend } from '@shared/providers'
import { strictDmRequest, strictFeedRequest, strictSceneRequest } from '../src/renderer/mods/strictSchema/requests'

/** A request carrying extension fields that must survive stricter scene requirements. */
function request(actions = true): StructuredRequest {
  return {
    system: 'persona and other mod context',
    user: 'scene context and reader action',
    cacheKey: 'playthrough-1',
    logFrom: 12,
    minThinking: 'low',
    schema: {
      name: 'scene',
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['lines', 'summary', 'memory'],
        properties: {
          lines: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['speaker', 'text', 'extension'],
              properties: {
                speaker: { type: 'string', enum: ['', 'sarah_rose'] },
                ...(actions ? { actions: { type: 'array', items: { type: 'string', enum: ['show:sarah_rose', 'sprite:sarah_rose,happy_custom'] } } } : {}),
                bg: { type: 'string', enum: ['quad', 'sarah_room', 'custom_cafe'] },
                text: { type: 'string' },
                extension: { type: 'string' }
              }
            }
          },
          summary: { type: 'string' },
          memory: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
}

function lineSchema(reply: StructuredRequest) {
  return (reply.schema.schema as unknown as {
    properties: { lines: { items: { required: string[]; properties: Record<string, { enum?: string[] }> } } }
  }).properties.lines.items
}

describe('strict scene request composition', () => {
  it('preserves extension fields, action vocabularies, metadata, and the original request', () => {
    const original = request()
    const snapshot = structuredClone(original)
    const result = strictSceneRequest(original)
    const before = lineSchema(original)
    const after = lineSchema(result)
    expect(after.required).toEqual(expect.arrayContaining(['speaker', 'bg', 'actions', 'text', 'extension']))
    expect(after.properties.bg.enum).toEqual(['quad', 'sarah_room', 'custom_cafe', 'unchanged'])
    expect(after.properties.actions).toEqual(before.properties.actions)
    expect(after.properties.extension).toEqual(before.properties.extension)
    expect(result.schema.schema.required).toEqual(original.schema.schema.required)
    expect(Object.keys(result.schema.schema.properties as object)).toEqual(['lines', 'summary', 'memory'])
    expect(result).toMatchObject({ user: original.user, cacheKey: original.cacheKey, logFrom: original.logFrom, minThinking: 'low' })
    expect(result.system.startsWith(original.system)).toBe(true)
    expect(original).toEqual(snapshot)
    expect(strictSceneRequest(result).schema).toEqual(result.schema)
  })

  it('does not invent actions for a solo schema or an ending signal for a closing schema', () => {
    const result = strictSceneRequest(request(false))
    expect(lineSchema(result).required).toEqual(expect.arrayContaining(['speaker', 'bg', 'text', 'extension']))
    expect(lineSchema(result).required).not.toContain('actions')
    expect(lineSchema(result).properties).not.toHaveProperty('actions')
    expect(result.schema.schema.properties).not.toHaveProperty('end_scene')
  })

  it('requires the ending decision on continuations while preserving the opening contract', () => {
    const original = request()
    const properties = original.schema.schema.properties as Record<string, unknown>
    properties.end_scene = { type: 'boolean' }
    const result = strictSceneRequest(original)
    expect(result.schema.schema.properties).toHaveProperty('end_scene', { type: 'boolean' })
    expect(result.schema.schema.required).toContain('end_scene')
    delete properties.summary
    original.schema.schema.required = ['lines', 'memory']
    expect(strictSceneRequest(original).schema.schema.required).not.toContain('end_scene')
  })
})

it('leaves photo and feed extension schemas intact', () => {
  const dm = request()
  dm.schema = { name: 'texting', schema: {
    type: 'object', required: ['messages', 'summary', 'blocked', 'sendPhoto'],
    properties: { messages: { type: 'array', items: { type: 'string' } }, sendPhoto: { type: 'boolean' }, photoPrompt: { type: 'string' } }
  } }
  const feed = request()
  feed.schema = { name: 'slot_intro', schema: {
    type: 'object', properties: { posts: { type: 'array', items: {
      properties: { char: { type: 'string' }, image: { type: 'string' }, comments: { type: 'array', items: { type: 'string' } } }
    } }, hangouts: { type: 'array' }, breakups: { type: 'array' } }
  } }
  expect(strictDmRequest(dm).schema).toBe(dm.schema)
  expect(strictFeedRequest(feed).schema).toBe(feed.schema)
})

it('uses the existing hook gate and keeps fields added by earlier request hooks', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  let enabled = false
  hooks.setHookRules({ isOn: id => id !== 'strict-schema' || enabled, order: id => id === 'strict-schema' ? 1 : 0 })
  hooks.registerHooks('memory', { requests: { scene: original => ({ ...original, user: original.user + '\nrecalled facts' }) } })
  await import('../src/renderer/modEntries/strict-schema')
  const original = request()
  original.minThinking = 'high'
  const ctx = {} as Parameters<typeof hooks.modRequest<'scene'>>[1]
  const off = hooks.modRequest('scene', ctx, original)
  expect(off.schema).toBe(original.schema)
  const ledgerCtx = {} as Parameters<typeof hooks.modRequest<'ledger'>>[1]
  const settings = { apiProvider: 'openai', reasoningEffort: 'low' } as Settings
  const offLedger = hooks.modRequest('ledger', ledgerCtx, original)
  expect(reasoningToSend(settings, 'deepseek-test', offLedger.minThinking)).toBe('high')
  enabled = true
  const on = hooks.modRequest('scene', ctx, original)
  expect(on.user).toBe(off.user)
  expect(lineSchema(on).required).toContain('bg')
  const onLedger = hooks.modRequest('ledger', ledgerCtx, original)
  expect(onLedger).not.toHaveProperty('minThinking')
  expect(onLedger.schema).toBe(original.schema)
  expect(onLedger.user).toBe(original.user)
  expect(reasoningToSend(settings, 'deepseek-test', onLedger.minThinking)).toBe('low')
  settings.reasoningEffort = 'medium'
  expect(reasoningToSend(settings, 'deepseek-test', onLedger.minThinking)).toBe('medium')
  expect(original.minThinking).toBe('high')
  enabled = false
  expect(hooks.modRequest('scene', ctx, original)).toEqual(off)
  expect(hooks.modRequest('ledger', ledgerCtx, original)).toEqual(offLedger)
})
