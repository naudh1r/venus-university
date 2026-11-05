import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { character, charInfo, restoreApi, stubApi } from './fixtures'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useGrabBagStore } from '../src/renderer/stores/grabBagStore'
import { FEED_EMOJI_BAG, FEED_HANDLE_BAG } from '../src/renderer/prompts/feedRandoms'
import { rollFeedComments } from '../src/renderer/stores/bunnyfeedsReplies'
import { useBunnyboardStore } from '../src/renderer/stores/bunnyboardStore'
import { markCommented, takeCommented } from '../src/renderer/stores/bunnyfeedsVisit'
import { armFeedThreads } from '../src/renderer/stores/bunnyfeedsThreads'

vi.mock('../src/renderer/stores/jobStore', () => ({ useJobStore: {} }))

vi.mock('../src/renderer/stores/bunnyfeedsThreads', () => ({
  armFeedThreads: vi.fn(),
  leavePlayerComment: vi.fn()
}))

beforeEach(() => {
  stubApi({ jobs: { onProgress: () => () => {} } })
  useGameStore.getState().reset()
  useBunnyboardStore.setState({ open: false, viewingCharId: null })
  takeCommented()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  restoreApi()
})

describe('Bunnyfeeds through the kit readers', () => {
  it('draws only strangers, handles before faces, and keeps their order around a friend', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99)
    useGameStore.setState({
      playthroughId: 'one',
      characters: { friend: character({ charId: 'friend' }) },
      charInfo: { friend: charInfo({ handle: 'known' }) }
    })
    const draw = vi.spyOn(useGrabBagStore.getState(), 'drawMany')
    const comments = rollFeedComments('poster', [
      { text: 'first' },
      { charId: 'friend', text: 'friend' },
      { text: 'second' }
    ], true)
    const strangers = comments.filter(one => !one.charId)
    expect(draw.mock.calls.map(([bag, , count]) => [bag, count])).toEqual([
      [FEED_HANDLE_BAG, strangers.length],
      [FEED_EMOJI_BAG, strangers.length]
    ])
    const handles = draw.mock.results[0].value as { handle: string }[]
    expect(strangers.map(one => one.handle)).toEqual(handles.map(one => one.handle))
    expect(strangers.map(one => one.emoji)).toEqual(draw.mock.results[1].value)
    expect(comments.find(one => one.charId === 'friend')).toMatchObject({ handle: 'known', emoji: '' })
  })

  it('sends one commented visit on closing the phone, never on navigation or a quiet visit', async () => {
    await import('../src/renderer/modEntries/bunnyfeeds')
    markCommented()
    useBunnyboardStore.setState({ viewingCharId: 'first' })
    useBunnyboardStore.setState({ open: true })
    useBunnyboardStore.setState({ viewingCharId: 'second' })
    expect(armFeedThreads).not.toHaveBeenCalled()
    useBunnyboardStore.setState({ open: false })
    await vi.dynamicImportSettled()
    expect(armFeedThreads).toHaveBeenCalledExactlyOnceWith('next')
    useBunnyboardStore.setState({ viewingCharId: null })
    useBunnyboardStore.setState({ open: true })
    useBunnyboardStore.setState({ open: false })
    await vi.dynamicImportSettled()
    expect(armFeedThreads).toHaveBeenCalledTimes(1)
  })
})
