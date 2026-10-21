import { describe, expect, it } from 'vitest'
import {
  carriedThread,
  feedNotes,
  unreadFeedNotes,
  MAX_POSTER_REPLIES,
  threadWork,
  WRAP_UP_AFTER
} from '../src/shared/bunnyfeeds'
import {
  followerChance,
  pickJoiningFriend,
  pickOpeningFriend
} from '../src/shared/bunnyfeedsCrowd'
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

/** The replies Notifications lists, and how many of them he has yet to read. */
describe('feedNotes', () => {
  const comment = (id: string, at: number, extra: Partial<PostComment> = {}): PostComment => ({
    id,
    handle: 'someone',
    emoji: '',
    text: 'hi',
    at,
    ...extra
  })
  const post = (comments: PostComment[]): SocialPost =>
    ({ id: 'post', comments }) as unknown as SocialPost

  it('lists only replies to the reader that have arrived, newest first, named for who wrote them', () => {
    const comments = [
      comment('p1', 1, { player: true, tags: ['friend'] }),
      comment('s1', 1),
      comment('r-other', 2, { charId: 'her', replyTo: 's1' }),
      comment('r-her', 2, { charId: 'her', replyTo: 'p1' }),
      comment('r-friend', 3, { charId: 'friend', replyTo: 'p1' }),
      comment('r-stranger', 3, { replyTo: 'p1' }),
      comment('r-later', 9, { charId: 'her', replyTo: 'p1' }),
      comment('p2', 3, { player: true, replyTo: 'r-her' })
    ]
    const notes = feedNotes([{ posterId: 'her', post: post(comments) }], 3)
    expect(notes.map((note) => [note.comment.id, note.kind])).toEqual([
      ['r-friend', 'reply'],
      ['r-stranger', 'reply'],
      ['r-her', 'poster']
    ])
    expect(unreadFeedNotes(notes, 2)).toBe(2)
    expect(unreadFeedNotes(notes, undefined)).toBe(3)
    // One marked read stops counting, whatever mark all as read last covered.
    const read = notes.map((note) =>
      note.comment.id === 'r-friend' ? { ...note, comment: { ...note.comment, read: true as const } } : note
    )
    expect(unreadFeedNotes(read, 2)).toBe(1)
  })
})

/** Who besides the poster the game lets into a thread: rolled, so a crowd is never a given. */
describe('who joins a thread', () => {
  /** Hands out `values` in order, then the last one forever. */
  const rolls = (...values: number[]) => () => values.length > 1 ? (values.shift() as number) : values[0]

  it('offers one of her friends under a new post only when the roll lands, and nobody without friends', () => {
    expect(pickOpeningFriend(['a', 'b'], rolls(0.1, 0.6))).toBe('b')
    expect(pickOpeningFriend(['a', 'b'], rolls(0.5))).toBeNull()
    expect(pickOpeningFriend([], rolls(0))).toBeNull()
  })

  it('tries a mutual friend first, then one of her other friends, and at most one', () => {
    expect(pickJoiningFriend(['m'], ['o'], rolls(0.5, 0))).toBe('m')
    // The mutual roll misses, the other-friend roll lands.
    expect(pickJoiningFriend(['m'], ['o'], rolls(0.7, 0.1, 0))).toBe('o')
    expect(pickJoiningFriend(['m'], ['o'], rolls(0.7, 0.3))).toBeNull()
    expect(pickJoiningFriend([], [], rolls(0))).toBeNull()
  })

  it('lets a follower in more often under a popular girl, between 30% and 60%', () => {
    expect(followerChance(40)).toBeCloseTo(0.3)
    expect(followerChance(500)).toBeCloseTo(0.6)
    expect(followerChance(1000)).toBeCloseTo(0.6)
  })
})
