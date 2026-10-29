import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFeedThreadsPrompt } from '../src/renderer/prompts/bunnyfeedsPrompt'
import { armFeedThreads } from '../src/renderer/stores/bunnyfeedsThreads'
import { useGameStore } from '../src/renderer/stores/gameStore'
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
