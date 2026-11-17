import { recordField, saveField } from '@vx/modkit/renderer'
import { globalSlotOf, type PostComment, type SocialPost } from '@vx/modkit/shared'
import {
  BUNNYFEEDS,
  BUNNY_MEMORY_TYPES,
  MAX_POSTER_REPLIES,
  WRAP_UP_AFTER,
  type BunnyCommentData,
  type BunnyPostData,
  type FeedNote,
  type FeedNoteKind,
  type HeldFeedMemory,
  type ThreadWork
} from '../../shared/bunnyfeeds'

/** A JSON object, or an empty object for a malformed saved value. */
function objectOf(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** A recorded id, kept exactly as written when it is nonblank. */
function idOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

/** Reads the five comment fields from its slice, or from a pre-switch comment. */
function normalizeComment(stored: unknown, legacy: Readonly<Record<string, unknown>>): BunnyCommentData {
  const value = objectOf(stored !== undefined ? stored : legacy)
  const charId = idOf(value.charId)
  const replyTo = idOf(value.replyTo)
  const tags = Array.isArray(value.tags)
    ? value.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim()))
    : []
  return {
    ...(charId ? { charId } : {}),
    ...(value.player === true ? { player: true } : {}),
    ...(value.read === true ? { read: true } : {}),
    ...(replyTo ? { replyTo } : {}),
    ...(tags.length ? { tags } : {})
  }
}

/** Reads one valid memory waiting for its reply to arrive. */
function heldMemory(value: unknown): HeldFeedMemory[] {
  const one = objectOf(value)
  const charId = idOf(one.charId)
  const type = BUNNY_MEMORY_TYPES.find(type => type === one.type)
  if (!charId || !type || !Number.isSafeInteger(one.at) ||
      typeof one.desc !== 'string' || !one.desc.trim()) return []
  const posterId = idOf(one.posterId)
  return [{ charId, at: one.at as number, type, desc: one.desc,
    ...(posterId ? { posterId } : {}) }]
}

/** Reads thread progress and held memories from a post of either storage format. */
function normalizePost(stored: unknown, legacy: Readonly<Record<string, unknown>>): BunnyPostData {
  const value = objectOf(stored !== undefined ? stored : legacy)
  return {
    ...(Number.isSafeInteger(value.threadedThrough)
      ? { threadedThrough: value.threadedThrough as number } : {}),
    ...(Array.isArray(value.heldMemories)
      ? { heldMemories: value.heldMemories.flatMap(heldMemory) } : {})
  }
}

export const commentData = recordField<BunnyCommentData>(BUNNYFEEDS, {
  empty: {},
  legacy: ['charId', 'player', 'read', 'replyTo', 'tags'],
  normalize: normalizeComment
})

export const postData = recordField<BunnyPostData>(BUNNYFEEDS, {
  empty: {},
  legacy: ['threadedThrough', 'heldMemories'],
  normalize: normalizePost
})

export const feedData = saveField<{ readThrough?: number }>(BUNNYFEEDS, {
  empty: {},
  normalize: (stored) => {
    const value = objectOf(stored)
    return Number.isSafeInteger(value.readThrough) ? { readThrough: value.readThrough as number } : {}
  },
  carry: value => value
})

/** What the thread owes now, using the comment handle for both legacy and migrated records. */
export function threadWork(
  comments: readonly PostComment[] | undefined,
  posterId: string,
  threadedThrough: number | undefined,
  now: number
): ThreadWork | null {
  if (!comments || comments.length === 0) return null
  const player = comments.filter(one =>
    commentData.read(one).player && one.at <= now &&
    !comments.some(reply => commentData.read(reply).replyTo === one.id &&
      commentData.read(reply).charId === posterId)
  )
  if (player.length === 0) return null
  const since = threadedThrough ?? Number.NEGATIVE_INFINITY
  const answeredOthers = comments.filter(one => {
    const data = commentData.read(one)
    if (data.charId !== posterId || !data.replyTo) return false
    const target = comments.find(target => target.id === data.replyTo)
    return !target || !commentData.read(target).player
  }).length
  const othersLeft = Math.max(0, MAX_POSTER_REPLIES - answeredOthers)
  const others = othersLeft > 0 ? comments.filter(one =>
    one.at > since && one.at <= now && !commentData.read(one).player &&
    commentData.read(one).charId !== posterId
  ) : []
  const windingDown = comments.filter(one =>
    commentData.read(one).player && one.at <= now
  ).length >= WRAP_UP_AFTER
  return { player, others, othersLeft, windingDown }
}

/** Moves post metadata with the native comment clock at New Game+. */
export function carriedThread(post: SocialPost, days: number): SocialPost {
  const data = postData.read(post)
  if (data.threadedThrough === undefined && !data.heldMemories) return post
  const back = globalSlotOf(days, 0)
  return postData.with(post, {
    ...(data.threadedThrough !== undefined ? { threadedThrough: data.threadedThrough - back } : {}),
    ...(data.heldMemories ? {
      heldMemories: data.heldMemories.map(memory => ({ ...memory, at: memory.at - back }))
    } : {})
  })
}

/** Replies to his comments, read from either format and sorted as the feed shows them. */
export function feedNotes(
  posts: ReadonlyArray<{ posterId: string; post: SocialPost }>,
  now: number
): FeedNote[] {
  const notes = posts.flatMap(({ posterId, post }) => {
    const said = (post.comments ?? []).filter(one => one.at <= now)
    const his = new Map(said.filter(one => commentData.read(one).player).map(one => [one.id, one]))
    return said.flatMap((one): FeedNote[] => {
      const data = commentData.read(one)
      const target = data.replyTo && !data.player ? his.get(data.replyTo) : undefined
      if (!target) return []
      const kind: FeedNoteKind = data.charId === posterId ? 'poster' : 'reply'
      return [{ posterId, postId: post.id, comment: one, kind }]
    })
  })
  return notes.sort((a, b) => b.comment.at - a.comment.at)
}

/** A reply neither marked read nor covered by the board-wide read mark. */
export function feedNoteUnread(note: FeedNote, readThrough: number | undefined): boolean {
  return !commentData.read(note.comment).read &&
    note.comment.at > (readThrough ?? Number.NEGATIVE_INFINITY)
}

/** How many of the current notifications remain unread. */
export function unreadFeedNotes(notes: readonly FeedNote[], readThrough: number | undefined): number {
  return notes.filter(note => feedNoteUnread(note, readThrough)).length
}
