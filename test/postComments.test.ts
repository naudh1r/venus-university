import { describe, expect, it } from 'vitest'
import { shownComments, type PostComment } from '../src/shared/postComments'

/** Every reply is rolled when the post is filed, and each carries the slot it turns up in. */
describe('shownComments', () => {
  const at = (slot: number): PostComment => ({
    id: `c${slot}`,
    handle: 'someone',
    emoji: '🙂',
    text: 'hi',
    at: slot
  })

  it('holds back a reply whose slot has not arrived', () => {
    // Day 0, slot 0 is global slot 0; a reply stamped later is not shown yet.
    const said = shownComments([at(0), at(99)], 0, 0)
    expect(said).toHaveLength(1)
    expect(said[0].at).toBe(0)
  })

  it('answers nothing where a post has no replies', () => {
    expect(shownComments(undefined, 0, 0)).toEqual([])
  })
})
