import type { PostComment } from './postComments'

/**
 * Feed Comments' saved shape and its one rule: what a post's thread still owes the reader. The
 * fields it adds are all optional, so a save written without the mod loads as it always did.
 */

export const FEED_COMMENTS = 'feed-comments'

declare module './postComments' {
  interface PostComment {
    /** The roster girl who wrote it, the poster's own answers included; absent for a stranger. */
    charId?: string
    /** The reader wrote it. */
    player?: true
    /** The comment it answers; absent for one left on the post itself. */
    replyTo?: string
    /** The contacts the reader tagged in it, each of whom answers it. */
    tags?: string[]
  }
}

declare module './types' {
  interface SocialPost {
    /** The last global slot whose comments the thread call answered (`threadWork`). */
    threadedThrough?: number
  }
}

/**
 * The thread call's reply: new comments, each naming the comment it answers by the short ref the
 * prompt gave it, and what each poster made of the reader's comments. `from` is a roster key, or
 * empty for a stranger.
 */
export interface FeedThreadsResponse {
  replies?: Array<{ to: string; from: string; text: string }>
  memories?: Array<{ char: string; type: string; desc: string }>
}

/** How many comments by other people the poster herself answers under one post. */
export const MAX_POSTER_REPLIES = 3

/** What one post's thread still owes: the comments that need an answer this round. */
export interface ThreadWork {
  /** The reader's comments she has not answered yet; each one gets an answer from the poster. */
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
  // Owed until she answers it, whenever in the slot he wrote it.
  const player = comments.filter(
    (one) =>
      one.player &&
      one.at <= now &&
      !comments.some((reply) => reply.replyTo === one.id && reply.charId === posterId)
  )
  // A thread he has not written in costs nothing: other people's comments ride on his.
  if (player.length === 0) return null
  const since = threadedThrough ?? Number.NEGATIVE_INFINITY
  const answeredOthers = comments.filter((one) => {
    if (one.charId !== posterId || !one.replyTo) return false
    return !comments.find((target) => target.id === one.replyTo)?.player
  }).length
  const othersLeft = Math.max(0, MAX_POSTER_REPLIES - answeredOthers)
  const others =
    othersLeft > 0
      ? comments.filter(
          (one) => one.at > since && one.at <= now && !one.player && one.charId !== posterId
        )
      : []
  return { player, others, othersLeft }
}
