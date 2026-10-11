import type { CSSProperties, JSX } from 'react'
import { hashString } from '@shared/hash'
import { shownComments, type PostComment } from '@shared/postComments'
import { profileUrl, useSpriteVersion } from '../stores/characterStore'
import { useGameStore } from '../stores/gameStore'
import '../vu_styles/PostComments.css'

/**
 * What other students said under one post, as much of it as has arrived.
 *
 * Every reply was written when the post was filed, but each carries the slot it turns up in, so a
 * post picks up answers over the day rather than arriving finished. The date and slot are read
 * from the store rather than taken as props, so the row that draws this keeps its own signature.
 *
 * A roster girl wears her own profile picture; a stranger's face is her emoji on a hue hashed
 * off the handle, so she is the same colour every time she comments.
 */
export function PostComments({ comments }: { comments: readonly PostComment[] }): JSX.Element | null {
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  const said = shownComments(comments, date, time)
  if (said.length === 0) return null

  return (
    <ul className="vu-bb-comments">
      {said.map((comment) => (
        <li className="vu-bb-comment" key={comment.id}>
          {comment.charId ? (
            <RosterFace charId={comment.charId} />
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
            <span className="vu-bb-comment-who">@{comment.handle}</span> {comment.text}
          </span>
        </li>
      ))}
    </ul>
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
