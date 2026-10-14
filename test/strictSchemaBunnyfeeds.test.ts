import { afterEach, expect, it, vi } from 'vitest'
import { character, charactersById, charInfo, restoreApi, stubApi } from './fixtures'
import type { SlotIntroInput } from '../src/renderer/prompts/slotIntroPrompt'

afterEach(restoreApi)

it('preserves Bunnyfeeds author/text comment objects with Strict Schema and Photo Feature enabled', async () => {
  vi.resetModules()
  stubApi({ jobs: { onProgress: () => () => {} } })
  await import('../src/renderer/mods')
  const { useModsStore } = await import('../src/renderer/stores/modsStore')
  const { useGameStore } = await import('../src/renderer/stores/gameStore')
  const { NO_SWITCHES, withMod } = await import('../src/shared/mods')
  const { buildSlotIntroPrompt } = await import('../src/renderer/prompts/slotIntroPrompt')
  const { writtenComments } = await import('../src/renderer/stores/feedComments')
  const sarah = character({ charId: 'sarah' })
  const winter = character({ charId: 'winter', firstName: 'Winter', lastName: 'Yang' })
  useGameStore.getState().reset()
  useGameStore.setState({ chars: ['sarah', 'winter'], characters: charactersById(sarah, winter),
    charInfo: { sarah: charInfo(), winter: charInfo() }, charKeyToId: { sarah_rose: 'sarah', winter_yang: 'winter' } })
  const switches = withMod(withMod(NO_SWITCHES, 'bunnyfeeds', true), 'photo-feature', true)
  useModsStore.setState({ switches: withMod(switches, 'strict-schema', false) })
  const input: SlotIntroInput = { playthroughId: 'p', date: 7, time: 0, lessNsfwText: false,
    opening: 'A new morning.', recent: [], askers: [], breakups: [], occasions: [],
    posters: [{ character: sarah, charKey: 'sarah_rose', info: charInfo(), texted: false }] }
  const base = buildSlotIntroPrompt(input, '', '')
  const snapshot = structuredClone(base.schema)
  useModsStore.setState({ switches: withMod(switches, 'strict-schema', true) })
  const combined = buildSlotIntroPrompt(input, '', '')
  type PostSchema = { posts: { minItems?: number; maxItems?: number; items: { properties: Record<string, unknown> } } }
  const before = base.schema.schema.properties as PostSchema
  const after = combined.schema.schema.properties as PostSchema
  expect(after.posts).toMatchObject({ minItems: 1, maxItems: 1 })
  expect(after.posts.items.properties.comments).toEqual({
    ...before.posts.items.properties.comments as object, maxItems: 5
  })
  expect(after.posts.items.properties.comments).toMatchObject({ items: {
    type: 'object', required: ['from', 'text'], properties: { from: { type: 'string' }, text: { type: 'string' } }
  } })
  expect(after.posts.items.properties.image).toEqual(before.posts.items.properties.image)
  expect(base.schema).toEqual(snapshot)
  expect(writtenComments([{ from: 'winter_yang', text: 'save me a seat' }, { from: '', text: 'nice' }], 'sarah'))
    .toEqual([{ charId: 'winter', text: 'save me a seat' }, { text: 'nice' }])
  useModsStore.setState({ switches: withMod(switches, 'strict-schema', false) })
  expect(buildSlotIntroPrompt(input, '', '').schema).toEqual(snapshot)
})
