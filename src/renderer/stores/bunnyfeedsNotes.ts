import { useSyncExternalStore } from 'react'
import { globalSlotOf } from '@vx/modkit/shared'
import { feedReadThrough, subscribeFeedReadThrough, postVisible } from '@vx/modkit/renderer'
import type { FeedNote } from '../../shared/bunnyfeeds'
import { commentData, feedData, feedNotes, unreadFeedNotes } from './bunnyfeedsData'
import { readBunnyfeedsContext, type BunnyfeedsContext } from './bunnyfeedsReadContext'

/** The own read mark, falling back to the old board key until it has been migrated. */
export function feedReadMark(): number | undefined {
  const own = feedData.read().readThrough
  if (own !== undefined) return own
  const legacy = feedReadThrough()
  return Number.isSafeInteger(legacy) ? legacy : undefined
}

/** Follows the own marker and the legacy fallback while an old save is entered. */
export function useFeedReadMark(): number | undefined {
  feedData.use()
  return useSyncExternalStore(subscribeFeedReadThrough, feedReadMark, feedReadMark)
}

/** Every reply to the reader under a post the feed shows, newest first. */
export function feedNotesOf(
  state: Pick<BunnyfeedsContext, 'charInfo' | 'date' | 'time' | 'heldSlot'> = readBunnyfeedsContext()
): FeedNote[] {
  const posts = Object.entries(state.charInfo).flatMap(([posterId, info]) =>
    (info.feed ?? []).filter(postVisible).map(post => ({ posterId, post }))
  )
  return feedNotes(posts, globalSlotOf(state.date, state.time), state.heldSlot)
}

/** The last count, with the game it was read from and the read mark it was counted against. */
let counted: { state: BunnyfeedsContext; mark: number | undefined; unread: number } | undefined

/**
 * How many replies to him he has yet to read. The phone's badge asks on every render of the
 * scene, so the answer is kept until the game it was read from or the read mark changes: the
 * context is a new object only once something it reads has changed.
 */
export function unreadFeedNotesOf(): number {
  const state = readBunnyfeedsContext()
  const mark = feedReadMark()
  if (counted?.state === state && counted.mark === mark) return counted.unread
  const unread = unreadFeedNotes(feedNotesOf(state), mark)
  counted = { state, mark, unread }
  return unread
}

/** Marks one live comment through its own slice; a deleted target is an inert refusal. */
export function markFeedNoteRead(note: FeedNote): void {
  commentData.update({
    kind: 'comment', charId: note.posterId, postId: note.postId, commentId: note.comment.id
  }, data => data.read ? undefined : { ...data, read: true })
}

/**
 * Every reply that has arrived by now marked read at once. During a held night the read mark
 * stays on the evening and the replies already due at the morning, which show, are marked one by
 * one, so an answer to a night comment still on its way is not marked read before it arrives.
 */
export function markAllFeedNotesRead(): void {
  const game = readBunnyfeedsContext()
  if (!game.playthroughId) return
  const now = globalSlotOf(game.date, game.time)
  feedData.set({ readThrough: now })
  if (game.heldSlot === undefined) return
  for (const note of feedNotesOf(game)) if (note.comment.at > now) markFeedNoteRead(note)
}

/** Seeds the own marker on entry, and clamps a marker carried from a later semester clock. */
export function settleFeedReadMark(): void {
  const game = readBunnyfeedsContext()
  if (!game.playthroughId) return
  const own = feedData.read().readThrough
  const mark = feedReadMark()
  const now = globalSlotOf(game.date, game.time)
  if (own !== undefined && own <= now) return
  feedData.set({ readThrough: mark !== undefined && mark <= now ? mark : now })
}
