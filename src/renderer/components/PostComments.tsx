import type { CSSProperties, JSX } from 'react'
import { hashString } from '@shared/hash'
import { shownComments, type PostComment } from '@shared/postComments'
import { useGameStore } from '../stores/gameStore'
import { usePhotosVisible } from '../stores/photoSwitchHooks'
import '../vu_styles/PostComments.css'

/**
 * What other students said under one post, as much of it as has arrived.
 *
 * Every reply was written when the post was filed, but each carries the slot it turns up in, so a
 * post picks up answers over the day rather than arriving finished. The date and slot are read
 * from the store rather than taken as props, so the row that draws this keeps its own signature.
 *
 * The face is the handle's own: a hue hashed off the name, so one stranger is the same colour
 * every time she comments without anything being stored about her.
 */
export function PostComments({ comments }: { comments: readonly PostComment[] }): JSX.Element | null {
  const date = useGameStore((s) => s.date)
  const time = useGameStore((s) => s.time)
  const visible = usePhotosVisible()
  const said = shownComments(comments, date, time)
  // The mod's comments, hidden with the rest of it while it is off unless the player keeps them.
  if (!visible || said.length === 0) return null

  return (
    <ul className="vu-bb-comments">
      {said.map((comment) => (
        <li className="vu-bb-comment" key={comment.id}>
          <span
            className="vu-bb-comment-face"
            style={{ '--vu-face-hue': hashString(comment.handle) % 360 } as CSSProperties}
            aria-hidden
          >
            {comment.emoji}
          </span>
          <span className="vu-bb-comment-said">
            <span className="vu-bb-comment-who">@{comment.handle}</span> {comment.text}
          </span>
        </li>
      ))}
    </ul>
  )
}
