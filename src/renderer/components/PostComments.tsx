import { useState, type CSSProperties, type JSX } from 'react'
import { motion } from 'motion/react'
import { hashString } from '@shared/hash'
import { shownComments, type PostComment } from '@shared/postComments'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'
import { leavePlayerComment } from '../stores/loop/feedThreads'
import { gestures, quietLift, quietPress } from '../views/motion'
import '../vu_styles/PostComments.css'

/**
 * What people said under one post, as much of it as has arrived, each reply nested under the
 * comment it answers. On a contact's post the reader can comment on the post or answer a comment
 * left on it, and she answers him at the next slot.
 *
 * A roster girl wears her own profile picture; a stranger's face is her emoji on a hue hashed
 * off the handle, so she is the same colour every time she comments.
 */
export function PostComments({
  comments,
  posterId,
  postId,
  canComment
}: {
  comments: readonly PostComment[]
  posterId?: string
  postId?: string
  /** He may write under this post: a contact's own, outside the epilogue. */
  canComment: boolean
}): JSX.Element | null {
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  const [replyTo, setReplyTo] = useState<PostComment | null>(null)
  const said = shownComments(comments, date, time)
  if (said.length === 0 && !canComment) return null

  // One level of nesting: a reply to a reply sits under the comment its chain started from.
  const byId = new Map(said.map((one) => [one.id, one]))
  const rootOf = (one: PostComment): string => {
    let at = one
    for (let hops = 0; at.replyTo && byId.has(at.replyTo) && hops < said.length; hops++) {
      at = byId.get(at.replyTo) as PostComment
    }
    return at.id
  }
  const roots = said.filter((one) => !one.replyTo || !byId.has(one.replyTo))
  const repliesTo = new Map<string, PostComment[]>()
  for (const one of said) {
    if (!one.replyTo || !byId.has(one.replyTo)) continue
    const root = rootOf(one)
    repliesTo.set(root, [...(repliesTo.get(root) ?? []), one])
  }

  // Only a comment on the post itself takes a reply; the replies under it do not.
  const row = (comment: PostComment, root: boolean): JSX.Element => (
    <CommentRow
      key={comment.id}
      comment={comment}
      poster={Boolean(posterId) && comment.charId === posterId}
      onReply={canComment && root ? () => setReplyTo(comment) : undefined}
    />
  )

  return (
    <div className="vu-bb-thread">
      {said.length > 0 && (
        <ul className="vu-bb-comments">
          {roots.map((root) => (
            <li className="vu-bb-comment-group" key={root.id}>
              {row(root, true)}
              {repliesTo.has(root.id) && (
                <ul className="vu-bb-comments vu-bb-comments--replies">
                  {repliesTo.get(root.id)?.map((one) => <li key={one.id}>{row(one, false)}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      {canComment && posterId && postId && (
        <CommentField
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onSend={(text) => {
            leavePlayerComment(posterId, postId, text, replyTo?.id)
            setReplyTo(null)
          }}
        />
      )}
    </div>
  )
}

/** One comment: a face, the handle running into what was said, and Reply where he may answer. */
function CommentRow({
  comment,
  poster,
  onReply
}: {
  comment: PostComment
  poster: boolean
  onReply?: () => void
}): JSX.Element {
  return (
    <div className="vu-bb-comment">
      {comment.charId ? (
        <RosterFace charId={comment.charId} />
      ) : comment.player ? (
        <span className="vu-bb-comment-face vu-bb-comment-face--player" aria-hidden>
          you
        </span>
      ) : (
        <span
          className="vu-bb-comment-face"
          style={{ '--vu-face-hue': hashString(comment.handle) % 360 } as CSSProperties}
          aria-hidden
        >
          {comment.emoji}
        </span>
      )}
      <span className="vu-bb-comment-said">
        <span className="vu-bb-comment-who">
          {comment.player ? 'you' : `@${comment.handle}`}
        </span>
        {poster && <span className="vu-bb-comment-tag">author</span>} {comment.text}
        {onReply && (
          <motion.button
            type="button"
            className="vu-bb-comment-reply"
            {...gestures(false, quietLift, quietPress)}
            onClick={onReply}
          >
            Reply
          </motion.button>
        )}
      </span>
    </div>
  )
}

/** A roster girl's profile picture in the disc a stranger's emoji sits in. */
function RosterFace({ charId }: { charId: string }): JSX.Element {
  const version = useSpriteVersion(charId)
  return (
    <span className="vu-bb-comment-face vu-bb-comment-face--roster" aria-hidden>
      <img src={profileUrl(charId, version)} alt="" />
    </span>
  )
}

/** The one-line well under a thread: a comment on the post, or an answer to the one picked. */
function CommentField({
  replyTo,
  onCancelReply,
  onSend
}: {
  replyTo: PostComment | null
  onCancelReply: () => void
  onSend: (text: string) => void
}): JSX.Element {
  const [draft, setDraft] = useState('')
  const send = (): void => {
    if (!draft.trim()) return
    onSend(draft)
    setDraft('')
  }

  return (
    <div className="vu-bb-comment-compose">
      {replyTo && (
        <div className="vu-bb-comment-replying">
          <span>
            Replying to {replyTo.player ? 'yourself' : `@${replyTo.handle}`}
          </span>
          <motion.button
            type="button"
            className="vu-bb-comment-reply"
            {...gestures(false, quietLift, quietPress)}
            onClick={onCancelReply}
          >
            Cancel
          </motion.button>
        </div>
      )}
      <input
        className="vu-input vu-bb-comment-input"
        value={draft}
        aria-label={replyTo ? 'Reply' : 'Comment'}
        placeholder={replyTo ? 'Write a reply…' : 'Add a comment…'}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return
          // Keep the window-level Enter handler from advancing the scene under the phone.
          e.stopPropagation()
          e.preventDefault()
          send()
        }}
      />
    </div>
  )
}
