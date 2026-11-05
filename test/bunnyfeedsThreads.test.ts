import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFeedThreadsPrompt } from '../src/renderer/prompts/bunnyfeedsPrompt'
import { armFeedThreads } from '../src/renderer/stores/bunnyfeedsThreads'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useGrabBagStore } from '../src/renderer/stores/grabBagStore'
import { FEED_HANDLE_BAG, FEED_EMOJI_BAG } from '../src/renderer/prompts/feedRandoms'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// The thread call needs no generation-job subscription.
vi.mock('../src/renderer/stores/jobStore', () => ({ useJobStore: {} }))
vi.mock('../src/renderer/prompts/bunnyfeedsPrompt', () => ({
  buildFeedThreadsPrompt: vi.fn(() => ({}))
}))
vi.mock('../src/renderer/stores/loop/promptState', () => ({
  lessNsfwTextNow: () => false,
  reader: () => ''
}))

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  vi.clearAllMocks()
  stubApi({
    llm: { completeFeedThreads: async () => ({ ok: true, data: { replies: [], memories: [] } }) }
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  useGameStore.getState().reset()
  resetLoopState()
  restoreApi()
})

/** The picture's companion reaches the thread call even when she is no friend of the poster. */
describe('feed thread picture context', () => {
  it.each([
    { with: 'other', present: true, name: 'Lia' },
    { with: undefined, present: true, name: undefined },
    { with: 'other', present: false, name: undefined }
  ])('passes the companion name for $with with character present: $present', async (test) => {
    useGameStore.setState({
      date: 2,
      time: 0,
      chars: ['poster'],
      characters: {
        poster: character({ charId: 'poster' }),
        ...(test.present ? { other: character({ charId: 'other', firstName: 'Lia' }) } : {})
      },
      charInfo: {
        poster: charInfo({
          feed: [
            {
              id: 'post',
              text: 'At the stadium',
              date: 2,
              time: 0,
              likes: 0,
              photo: { tier: 'sfw', scene: 'her and her friend at the stadium', with: test.with },
              comments: [
                { id: 'mine', player: true, handle: 'you', emoji: '', text: 'Who is that?', at: 4 }
              ]
            }
          ]
        })
      }
    })

    await armFeedThreads()

    const prompt = vi.mocked(buildFeedThreadsPrompt)
    expect(prompt).toHaveBeenCalledOnce()
    const post = prompt.mock.calls[0][0].threads[0].post
    expect(post.picture).toBe('her and her friend at the stadium')
    if (test.name) expect(post.pictureWith).toBe(test.name)
    else expect(post).not.toHaveProperty('pictureWith')
  })
})

/** Filing a reply spends only the identity pieces it does not already have. */
describe('feed thread identity draws', () => {
  it.each([
    { from: 'poster', handle: 'known', bags: [] },
    { from: 'poster', handle: undefined, bags: [FEED_HANDLE_BAG] },
    { from: '@old', handle: 'known', bags: [] },
    { from: '', handle: 'known', bags: [FEED_HANDLE_BAG, FEED_EMOJI_BAG] }
  ])('keeps the existing identity for $from with poster handle $handle', async ({ from, handle, bags }) => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const draw = vi.spyOn(useGrabBagStore.getState(), 'drawMany')
    useGameStore.setState({
      date: 2,
      time: 0,
      chars: ['poster'],
      characters: { poster: character({ charId: 'poster' }) },
      charKeyToId: { poster: 'poster' },
      charInfo: {
        poster: charInfo({
          handle,
          feed: [{
            id: 'post', text: 'hi', date: 2, time: 0, likes: 0,
            comments: [
              { id: 'old', handle: 'old', emoji: '', text: 'hi', at: 3 },
              { id: 'mine', player: true, handle: 'you', emoji: '', text: 'hi', at: 4,
                replyTo: 'old' }
            ]
          }]
        })
      }
    })
    stubApi({ llm: { completeFeedThreads: async () => ({
      ok: true,
      data: { replies: [{ to: 'c2', from, text: 'answer' }], memories: [] }
    }) } })

    await armFeedThreads()

    expect(draw.mock.calls.map(([bag, , count]) => [bag, count]))
      .toEqual(bags.map(bag => [bag, 1]))
    const reply = useGameStore.getState().charInfo.poster.feed?.[0].comments?.at(-1)
    expect(reply?.text).toBe('answer')
    if (from === '@old') expect(reply).toMatchObject({ handle: 'old', emoji: '' })
  })
})
