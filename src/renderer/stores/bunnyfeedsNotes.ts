import { feedNotes, unreadFeedNotes, type FeedNote } from '@shared/bunnyfeeds'
import { globalSlotOf } from '@shared/jobs'
import type { CharInfo } from '@shared/types'
import { postVisible } from '../mods/hooks'
import { useGameStore } from './gameStore'

type GameState = ReturnType<typeof useGameStore.getState>

/** Every reply to the reader under a post the feed shows, newest first. */
export function feedNotesOf(state: Pick<GameState, 'charInfo' | 'date' | 'time'>): FeedNote[] {
  const posts = Object.entries(state.charInfo).flatMap(([posterId, info]) =>
    (info.feed ?? []).filter(postVisible).map((post) => ({ posterId, post }))
  )
  return feedNotes(posts, globalSlotOf(state.date, state.time))
}

/** How many replies to him he has yet to read. */
export function unreadFeedNotesOf(state: GameState): number {
  return unreadFeedNotes(feedNotesOf(state), state.bunnyboard.feedReadThrough)
}

/** One reply marked read, on the post it was left under; inert once it is gone. */
export function markFeedNoteRead(note: FeedNote): void {
  useGameStore.setState((state) => {
    const info: CharInfo | undefined = state.charInfo[note.posterId]
    const post = info?.feed?.find((one) => one.id === note.postId)
    if (!info?.feed || !post?.comments?.some((one) => one.id === note.comment.id && !one.read)) {
      return {}
    }
    const comments = post.comments.map((one) =>
      one.id === note.comment.id ? { ...one, read: true as const } : one
    )
    const feed = info.feed.map((one) => (one.id === post.id ? { ...one, comments } : one))
    return { charInfo: { ...state.charInfo, [note.posterId]: { ...info, feed } } }
  })
}

/** Every reply that has arrived by now marked read at once. */
export function markAllFeedNotesRead(): void {
  useGameStore.setState((state) => ({
    bunnyboard: { ...state.bunnyboard, feedReadThrough: globalSlotOf(state.date, state.time) }
  }))
}

/**
 * Settles the read mark as a game is entered: a save without one (from before Notifications)
 * reads everything so far as read, and a mark from a later clock, as after New Game+ moves the
 * feed back a semester, comes down to now so the new semester's replies count again.
 */
export function settleFeedReadMark(): void {
  useGameStore.setState((state) => {
    const mark = state.bunnyboard.feedReadThrough
    const now = globalSlotOf(state.date, state.time)
    if (mark !== undefined && mark <= now) return {}
    return { bunnyboard: { ...state.bunnyboard, feedReadThrough: now } }
  })
}
