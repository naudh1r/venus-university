import { describe, expect, it } from 'vitest'
import { MAX_POSTER_REPLIES, threadWork } from '../src/shared/feedComments'
import type { PostComment } from '../src/shared/postComments'

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

  it('owes nothing on a thread the reader has not written in', () => {
    expect(threadWork([comment('s1', 1)], 'her', undefined, 2)).toBeNull()
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
    const mine = comment('p1', 3, { player: true })
    const owed = threadWork([...others, ...replies, comment('late', 3), mine], 'her', 2, 3)
    expect(owed?.others).toEqual([])
    expect(owed?.player).toEqual([mine])
  })
})
