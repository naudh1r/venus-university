import { useMemo, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { slotFromId } from '@shared/jobs'
import { fullNameOf, type Season } from '@shared/types'
import { feedNoteUnread, type FeedNote } from '@shared/bunnyfeeds'
import { FEED_PAGE } from '../stores/feedView'
import { useGameStore } from '../stores/gameStore'
import {
  feedNotesOf,
  markAllFeedNotesRead,
  markFeedNoteRead,
  unreadFeedNotesOf
} from '../stores/bunnyfeedsNotes'
import { formatNumericGameDate, slotHalf } from '../prompts/gameDate'
import { dealt, gestures, quietLift, quietPress, rowLift, rowPress, slideInQuick } from '../views/motion'
import { CommentFace, PostViewHost, usePostView } from './BunnyfeedsThread'
import { SentText } from './TextSpots'
import '../vu_styles/Bunnyfeeds.css'

/** The rows dealing themselves out, as every list on the phone does. */
const LIST_DEAL = dealt(0, 0.03)

/** The day a run of replies turned up, over them: today, yesterday, or its date. */
function dayHeading(day: number, today: number, season: Season): string {
  if (day === today) return 'Today'
  if (day === today - 1) return 'Yesterday'
  return formatNumericGameDate(day, season)
}

/**
 * Notifications, under the Updates tab's title: every reply to the reader's comments, newest
 * first, under a heading for each day one turned up, a page at a time as the feed is. A row
 * opens its post over the screen, at the reply, and counts it read; one he has not read offers
 * to mark it read where it stands.
 */
export function FeedNotificationsPage(): JSX.Element {
  const charInfo = useGameStore((s) => s.charInfo)
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  const notes = useMemo(() => feedNotesOf({ charInfo, date, time }), [charInfo, date, time])
  // How much of the list is mounted: a page, and one more per click of Load more, as the feed.
  const [pages, setPages] = useState(1)
  const more = pages * FEED_PAGE < notes.length
  const readThrough = useGameStore((s) => s.bunnyboard.feedReadThrough)
  const season = useGameStore((s) => s.calendar.season)
  // The rows mounted, cut into days, newest first as they already are.
  const days = useMemo(() => {
    const cut: Array<{ day: number; notes: FeedNote[] }> = []
    for (const note of notes.slice(0, pages * FEED_PAGE)) {
      const day = slotFromId(note.comment.at).date
      const last = cut[cut.length - 1]
      if (last?.day === day) last.notes.push(note)
      else cut.push({ day, notes: [note] })
    }
    return cut
  }, [notes, pages])

  return (
    <>
      <div className="vu-bb-scroll">
        {notes.length === 0 ? (
          <p className="vu-empty vu-empty--flush">
            No replies yet. Comment on a friend&apos;s post and her answers turn up here.
          </p>
        ) : (
          days.map(({ day, notes: those }) => (
            <section key={day} className="vu-bf-notes-day">
              <h3 className="vu-bb-section">{dayHeading(day, date, season)}</h3>
              <motion.ul className="vu-rows" variants={LIST_DEAL}>
                {those.map((note) => (
                  <motion.li key={note.comment.id} variants={slideInQuick}>
                    <NoteRow note={note} unread={feedNoteUnread(note, readThrough)} />
                  </motion.li>
                ))}
              </motion.ul>
            </section>
          ))
        )}
        {more && (
          <motion.button
            id="bf-notes-more"
            className="vu-bb-more"
            type="button"
            variants={slideInQuick}
            {...gestures(false, rowLift, rowPress)}
            onClick={() => setPages((loaded) => loaded + 1)}
          >
            Load more
          </motion.button>
        )}
      </div>
      <PostViewHost />
    </>
  )
}

/** Over the list while any reply is unread: every one marked read at once. */
export function MarkAllFeedNotes(): JSX.Element | null {
  const unread = useGameStore(unreadFeedNotesOf)
  if (unread === 0) return null
  return (
    <motion.button
      type="button"
      className="vu-bf-comment-reply"
      {...gestures(false, quietLift, quietPress)}
      onClick={markAllFeedNotesRead}
    >
      Mark all as read
    </motion.button>
  )
}

/**
 * One reply: who wrote it, where, what she said, and the half of its day it turned up in, or
 * while he has not read it, the way to mark it read. Two controls side by side, as a chat row's face and body are.
 */
function NoteRow({ note, unread }: { note: FeedNote; unread: boolean }): JSX.Element {
  const { comment, kind } = note
  // A girl he has not learned the name of is her handle here, as she is in the thread.
  const character = useGameStore((s) =>
    comment.charId && s.charInfo[comment.charId]?.nameKnown
      ? s.characters[comment.charId]
      : undefined
  )
  // The post's girl, named the same way: her first name once he knows it, else her handle.
  const poster = useGameStore((s) =>
    s.charInfo[note.posterId]?.nameKnown
      ? s.characters[note.posterId]?.firstName
      : `@${s.charInfo[note.posterId]?.handle ?? ''}`
  )
  const show = usePostView((s) => s.show)
  const who = character?.firstName ?? `@${comment.handle}`
  const what =
    kind === 'poster'
      ? `${who} replied to your comment`
      : `${who} replied to your comment under ${poster}'s post`

  return (
    <motion.div
      className={`vu-row vu-bf-note${unread ? ' vu-bf-note--new' : ''}`}
      {...gestures(false, rowLift, rowPress)}
    >
      <button
        type="button"
        className="vu-bf-note-hit"
        onClick={() => {
          markFeedNoteRead(note)
          show({ charId: note.posterId, postId: note.postId, commentId: comment.id })
        }}
      >
        <CommentFace comment={comment} size="md" />
        <span className="vu-bb-chat-main">
          <span className="vu-bb-chat-top">
            <span className="vu-bb-name">{character ? fullNameOf(character) : comment.handle}</span>
            <span className="vu-bf-comment-who">@{comment.handle}</span>
          </span>
          <span className="vu-bf-note-what">{what}</span>
          <span className="vu-bb-preview">
            <SentText text={comment.text} big={false} />
          </span>
        </span>
        <span className="vu-bb-stamp">{slotHalf(slotFromId(comment.at).time)}</span>
      </button>
      {unread && (
        <motion.button
          type="button"
          className="vu-bf-comment-reply vu-bf-note-read"
          {...gestures(false, quietLift, quietPress)}
          onClick={() => markFeedNoteRead(note)}
        >
          Mark as read
        </motion.button>
      )}
    </motion.div>
  )
}
