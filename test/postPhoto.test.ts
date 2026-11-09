import { describe, expect, it } from 'vitest'
import { allowedPostTier, settlePhoto } from '../src/shared/photoGate'

/**
 * A feed post is public, so nothing about one reader decides what it may show. The cap is flat
 * and the caption is read against it, exactly as a DM's is — what changes is only the ceiling.
 */
describe('allowedPostTier', () => {
  it('lets a post be flirty, and no further', () => {
    expect(allowedPostTier(false)).toBe('suggestive')
  })

  it("drops to ordinary under the player's switch", () => {
    expect(allowedPostTier(true)).toBe('everyday')
  })
})

describe('a caption settled against the public cap', () => {
  const settle = (caption: string, noNsfwImages = false): ReturnType<typeof settlePhoto> =>
    settlePhoto({
      sendPhoto: true,
      photoPrompt: caption,
      allowed: allowedPostTier(noNsfwImages)
    })

  it('posts the everyday ones', () => {
    expect(settle('a bowl of noodles on a rainy windowsill').send).toBe(true)
  })

  it('posts a swimsuit, which is what a feed is full of', () => {
    const verdict = settle('her in a black bikini on the sand, squinting into the sun')
    expect(verdict.send).toBe(true)
    expect(verdict.tier).toBe('suggestive')
  })

  /** The one rule a public feed has: refused outright rather than quietly softened. */
  it('refuses one that undresses her, whatever the post says', () => {
    expect(settle('her lying on her bed with nothing on').send).toBe(false)
  })

  it('refuses a swimsuit too once the player has asked for none', () => {
    expect(settle('her in a black bikini on the sand', true).send).toBe(false)
  })
})
