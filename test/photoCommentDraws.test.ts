import { afterEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'
stubApi({ jobs: { onProgress: () => () => {} } })
const { useGameStore } = await import('../src/renderer/stores/gameStore')
const { useGrabBagStore } = await import('../src/renderer/stores/grabBagStore')
const { FEED_EMOJI_BAG, FEED_HANDLE_BAG } = await import('../src/renderer/prompts/feedRandoms')
const { setPhotoSwitches } = await import('../src/shared/photoSwitches')
const { rollComments } = await import('../src/renderer/stores/photoComments')

afterEach(() => {
  vi.restoreAllMocks()
  restoreApi()
})

it('draws a handle then a face for every kept comment, in the written order', () => {
  stubApi({ jobs: { onProgress: () => () => {} } })
  setPhotoSwitches({ on: true })
  useGameStore.setState({ playthroughId: 'one', date: 2, time: 0 })
  vi.spyOn(Math, 'random').mockReturnValue(0.99)
  const draw = vi.spyOn(useGrabBagStore.getState(), 'drawMany')
  const lines = ['first', 'second', 'third']
  const comments = rollComments('poster', lines, 'suggestive')
  expect(comments.length).toBeGreaterThan(0)
  expect(comments.map(one => one.text)).toEqual(lines.slice(0, comments.length))
  expect(draw.mock.calls.map(([bag, , count]) => [bag, count])).toEqual([
    [FEED_HANDLE_BAG, comments.length],
    [FEED_EMOJI_BAG, comments.length]
  ])
  const handles = draw.mock.results[0].value as { handle: string }[]
  expect(comments.map(one => one.handle)).toEqual(handles.map(one => one.handle))
  expect(comments.map(one => one.emoji)).toEqual(draw.mock.results[1].value)
})
