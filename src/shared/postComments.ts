import { globalSlotOf } from './jobs'
import type { TimeSlot } from './types'

/**
 * The replies under a post on the feed. The game draws none of its own: a mod writes them and
 * draws them (`postComments` in the hooks), and the game keeps their shape, when each one turns
 * up, and moves them with the post when New Game+ carries her feed on. A mod adds its own fields
 * to `PostComment` by declaration merging.
 */

/** One reply under a post. */
export interface PostComment {
  /** crypto.randomUUID(); the list key. */
  id: string
  handle: string
  emoji: string
  text: string
  /**
   * The global slot it appears in. A comment can be written ahead of its slot and kept back until
   * the slot arrives, so a post picks up replies over the day rather than arriving finished.
   */
  at: number
}

/** The comments that have arrived by now: each carries the slot it turns up in. */
export function shownComments(
  comments: readonly PostComment[] | undefined,
  date: number,
  time: TimeSlot
): PostComment[] {
  if (!comments) return []
  const now = globalSlotOf(date, time)
  return comments.filter((comment) => comment.at <= now)
}

/**
 * A post's comments moved back `days`, as New Game+ moves the post onto the next semester's
 * clock: each keeps its place in the day, so a carried thread shows as it did.
 */
export function carriedComments<P extends { comments?: PostComment[] }>(post: P, days: number): P {
  if (!post.comments) return post
  const back = globalSlotOf(days, 0)
  return {
    ...post,
    comments: post.comments.map((comment) => ({ ...comment, at: comment.at - back }))
  }
}
