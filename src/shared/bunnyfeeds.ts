import type { PostComment, MemoryType } from '@vx/modkit/shared'

/** Bunnyfeeds' private saved fields and the thread call's reply shape. */

export const BUNNYFEEDS = 'bunnyfeeds'

export const BUNNY_MEMORY_TYPES: readonly MemoryType[] = ['loved', 'liked', 'disliked', 'hated']

/** The fields Bunnyfeeds keeps on one native comment. */
export interface BunnyCommentData {
  charId?: string
  player?: true
  read?: true
  replyTo?: string
  tags?: string[]
}

/** The thread progress and memories kept on one native post. */
export interface BunnyPostData {
  threadedThrough?: number
  heldMemories?: HeldFeedMemory[]
}

/** One girl's memory of a thread, waiting for the slot its answers show. */
export interface HeldFeedMemory {
  charId: string
  at: number
  type: MemoryType
  desc: string
  /** The girl whose post it happened under; her own when it is the poster's memory. */
  posterId?: string
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

/** How many comments the reader leaves under one post before she starts wrapping the thread up. */
export const WRAP_UP_AFTER = 6

/** What one post's thread still owes: the comments that need an answer this round. */
export interface ThreadWork {
  /** The reader's comments she has not answered yet; each one gets an answer from the poster. */
  player: PostComment[]
  /** Other people's comments she may still answer, within what her reply cap has left. */
  others: PostComment[]
  /** How many of `others` she may answer. */
  othersLeft: number
  /** The thread has run long: she starts winding it down and only girls he tagged join in. */
  windingDown: boolean
}

/** Who answered the reader: the poster under her own post, or anybody else. */
export type FeedNoteKind = 'poster' | 'reply'

/** One reply to the reader, under one of her posts. */
export interface FeedNote {
  posterId: string
  postId: string
  comment: PostComment
  kind: FeedNoteKind
}
