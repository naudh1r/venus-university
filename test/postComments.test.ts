import { describe, expect, it } from 'vitest'
import {
  MAX_POSTER_REPLIES,
  shownComments,
  threadWork,
  type PostComment
} from '../src/shared/postComments'

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

/** What the once-a-slot thread call still owes a post, read off the comments alone. */
describe('threadWork', () => {
  const comment = (id: string, at: number, extra: Partial<PostComment> = {}): PostComment => ({
    id,
    handle: 'someone',
    emoji: '',
    text: 'hi',
    at,
    ...extra
  })

  it('owes the reader an answer until she gives one, whatever round already ran', () => {
    const mine = comment('p1', 5, { player: true })
    // The round for slot 5 already ran before he wrote it.
    expect(threadWork([mine], 'her', 5, 6)?.player).toEqual([mine])
    const answered = [mine, comment('r1', 6, { charId: 'her', replyTo: 'p1' })]
    expect(threadWork(answered, 'her', 6, 7)).toBeNull()
  })

  it('stops offering other people\'s comments once her cap is spent', () => {
    const others = Array.from({ length: MAX_POSTER_REPLIES }, (_, i) => comment(`s${i}`, 1))
    const replies = others.map((one, i) =>
      comment(`r${i}`, 2, { charId: 'her', replyTo: one.id })
    )
    expect(threadWork([...others, ...replies, comment('late', 3)], 'her', 2, 3)).toBeNull()
  })
})
