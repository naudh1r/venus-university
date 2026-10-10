import { expect, it, vi } from 'vitest'
import type { StructuredRequest } from '@shared/types'
import type { RequestSpots } from '../src/renderer/mods/hooks'
import { character, charInfo } from './fixtures'

function request(): StructuredRequest {
  return { system: 'base instructions', user: 'photo rules and context', cacheKey: 'save-id', kind: 'slotIntro', schema: {
    name: 'slot_intro', schema: { type: 'object', additionalProperties: false, required: ['lines'], properties: {
      lines: { type: 'array', items: { type: 'object' } },
      hangouts: { type: 'array' }, breakups: { type: 'array' },
      posts: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['char', 'text', 'image', 'comments', 'extension'], properties: {
          char: { type: 'string' }, text: { type: 'string' }, image: { type: 'string' },
          comments: { type: 'array', items: { type: 'string' } }, extension: { type: 'boolean' }
        }
      } }
    } }
  } }
}

function context(keys: string[]): RequestSpots['slot-intro'] {
  return { input: {
    playthroughId: 'save-id', date: 7, time: 0, lessNsfwText: false,
    opening: 'The morning begins.', recent: [], askers: [], breakups: [], occasions: [],
    posters: keys.map(charKey => ({ charKey, character: character(), info: charInfo(), texted: false }))
  } }
}

it('constrains selected posters and photo comments without mutating extensions or other slot output', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { strictFeedRequest } = await import('../src/renderer/mods/strictSchema/requests')
  hooks.registerHooks('photo-feature', {})
  hooks.setHookRules({ isOn: () => true, order: () => 0 })
  const original = request()
  const snapshot = structuredClone(original)
  const result = strictFeedRequest(original, context(['winter_yang', 'tulip_sasaki']))
  const properties = result.schema.schema.properties as Record<string, any>
  const before = original.schema.schema.properties as Record<string, any>
  expect(result.schema.schema.required).toEqual(['lines', 'posts'])
  expect(properties.posts).toMatchObject({ minItems: 2, maxItems: 2 })
  expect(properties.posts.items.properties.char.enum).toEqual(['winter_yang', 'tulip_sasaki'])
  expect(properties.posts.items.properties.comments).toEqual({ type: 'array', items: { type: 'string' }, maxItems: 5 })
  expect(properties.posts.items.required).toEqual(before.posts.items.required)
  expect(properties.posts.items.properties.image).toBe(before.posts.items.properties.image)
  expect(properties.posts.items.properties.extension).toBe(before.posts.items.properties.extension)
  for (const key of ['lines', 'hangouts', 'breakups']) expect(properties[key]).toBe(before[key])
  expect(result).toMatchObject({ user: original.user, cacheKey: original.cacheKey, kind: original.kind })
  expect(original).toEqual(snapshot)
  expect(strictFeedRequest(result, context(['winter_yang', 'tulip_sasaki'])).schema).toEqual(result.schema)
  before.posts.items.properties.comments.maxItems = 2
  const tighter = strictFeedRequest(original, context(['winter_yang']))
  expect((tighter.schema.schema.properties as Record<string, any>).posts.items.properties.comments.maxItems).toBe(2)
})

it('handles no posters and absent photo fields without adding a photo dependency', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  const { strictFeedRequest } = await import('../src/renderer/mods/strictSchema/requests')
  hooks.setHookRules({ isOn: () => true, order: () => 0 })
  const original = request()
  const posts = (original.schema.schema.properties as Record<string, any>).posts
  delete posts.items.properties.image
  delete posts.items.properties.comments
  posts.items.required = ['char', 'text', 'extension']
  const empty = strictFeedRequest(original, context([]))
  expect((empty.schema.schema.properties as Record<string, any>).posts).toMatchObject({ minItems: 0, maxItems: 0 })
  expect(empty.schema.schema.required).toEqual(['lines'])
  expect(JSON.stringify(empty.schema)).not.toContain('"enum":[]')
  const selected = strictFeedRequest(original, context(['winter_yang']))
  expect(Object.keys((selected.schema.schema.properties as Record<string, any>).posts.items.properties)).toEqual(['char', 'text', 'extension'])
})

it('changes the assembled schema only while Strict Schema is enabled', async () => {
  vi.resetModules()
  const hooks = await import('../src/renderer/mods/hooks')
  await import('../src/renderer/modEntries/strict-schema')
  let enabled = false
  hooks.setHookRules({ isOn: id => id === 'strict-schema' && enabled, order: () => 0 })
  const original = request()
  const ctx = context(['winter_yang'])
  expect(hooks.modRequest('slot-intro', ctx, original)).toBe(original)
  enabled = true
  expect(hooks.modRequest('slot-intro', ctx, original).schema.schema.required).toContain('posts')
  enabled = false
  expect(hooks.modRequest('slot-intro', ctx, original)).toBe(original)
})
