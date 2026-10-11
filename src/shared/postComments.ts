import { globalSlotOf } from './jobs'
import type { TimeSlot } from './types'

/**
 * The replies under a post on the feed.
 *
 * The lines themselves are the model's: they arrive with the post, in the same call that writes
 * it and describes its picture, because a canned line cannot answer what she actually posted.
 * What is kept here is when each one turns up; how many a post keeps is `postAudience`'s.
 */

/** One reply under a post. */
export interface PostComment {
  /** crypto.randomUUID(); the list key. */
  id: string
  /** The roster girl who wrote it, the poster's own replies included; absent for a stranger. */
  charId?: string
  /** The reader wrote it. */
  player?: true
  /** The comment it answers; absent for one left on the post itself. */
  replyTo?: string
  /** The contacts the reader tagged in it, each of whom answers it. */
  tags?: string[]
  handle: string
  emoji: string
  text: string
  /**
   * The global slot it appears in, which is the post's own or one of the two after it. Every
   * comment is rolled when the post is filed and then kept back until its slot arrives, so a
   * post picks up replies over the day rather than arriving finished.
   */
  at: number
}

/**
 * The comments that have arrived by now. They are all rolled when the post is filed — the call
 * that could answer the post is long over by the time the later ones show — but each carries the
 * slot it turns up in, so the thread grows while the day does.
 */
export function shownComments(
  comments: readonly PostComment[] | undefined,
  date: number,
  time: TimeSlot
): PostComment[] {
  if (!comments) return []
  const now = globalSlotOf(date, time)
  return comments.filter((comment) => comment.at <= now)
}

/** How many comments by other people the poster herself answers under one post. */
export const MAX_POSTER_REPLIES = 3

/** What one post's thread still owes: the comments that need an answer this round. */
export interface ThreadWork {
  /** The reader's comments nobody has answered yet; each one gets an answer from the poster. */
  player: PostComment[]
  /** Other people's comments she may still answer, within what her reply cap has left. */
  others: PostComment[]
  /** How many of `others` she may answer. */
  othersLeft: number
}

/**
 * What a post's thread owes as of global slot `now`: every comment of the reader's she has not
 * answered yet, and with them everybody else's that arrived since the last round. Null unless he
 * has a comment waiting, which is most posts.
 */
export function threadWork(
  comments: readonly PostComment[] | undefined,
  posterId: string,
  threadedThrough: number | undefined,
  now: number
): ThreadWork | null {
  if (!comments || comments.length === 0) return null
  const since = threadedThrough ?? Number.NEGATIVE_INFINITY
  const fresh = comments.filter((one) => one.at > since && one.at <= now)
  // Owed until she answers it, whenever in the slot he wrote it.
  const player = comments.filter(
    (one) =>
      one.player &&
      one.at <= now &&
      !comments.some((reply) => reply.replyTo === one.id && reply.charId === posterId)
  )
  const answeredOthers = comments.filter((one) => {
    if (one.charId !== posterId || !one.replyTo) return false
    return !comments.find((target) => target.id === one.replyTo)?.player
  }).length
  const othersLeft = Math.max(0, MAX_POSTER_REPLIES - answeredOthers)
  const others =
    othersLeft > 0 ? fresh.filter((one) => !one.player && one.charId !== posterId) : []
  // A thread he has not written in costs nothing: other people's comments ride on his.
  if (player.length === 0) return null
  return { player, others, othersLeft }
}
