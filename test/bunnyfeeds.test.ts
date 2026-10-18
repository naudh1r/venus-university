import { describe, expect, it } from 'vitest'
import {
  carriedThread,
  MAX_POSTER_REPLIES,
  threadWork,
  WRAP_UP_AFTER
} from '../src/shared/bunnyfeeds'
import { globalSlotOf } from '../src/shared/jobs'
import type { SocialPost } from '../src/shared/types'
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

  it('winds the thread down once the reader has written enough under it', () => {
    const mine = (count: number) =>
      Array.from({ length: count }, (_, i) => comment(`p${i}`, i, { player: true }))
    expect(threadWork(mine(WRAP_UP_AFTER - 1), 'her', undefined, 99)?.windingDown).toBe(false)
    expect(threadWork(mine(WRAP_UP_AFTER), 'her', undefined, 99)?.windingDown).toBe(true)
  })
})

/** New Game+ moves a post back onto the next semester's clock; its thread moves with it. */
describe('carriedThread', () => {
  it('moves the last round and every held memory back the same days, leaving the rest', () => {
    const post = {
      id: 'p',
      text: 'hi',
      date: 90,
      time: 1,
      threadedThrough: globalSlotOf(90, 1),
      heldMemories: [{ charId: 'her', at: globalSlotOf(91, 0), type: 'liked', desc: 'the reader' }]
    } as SocialPost
    const carried = carriedThread(post, 100)
    expect(carried.threadedThrough).toBe(globalSlotOf(-10, 1))
    expect(carried.heldMemories?.[0]).toMatchObject({ at: globalSlotOf(-9, 0), desc: 'the reader' })
    expect(carried.date).toBe(90)
    expect(post.threadedThrough).toBe(globalSlotOf(90, 1))
  })
})
