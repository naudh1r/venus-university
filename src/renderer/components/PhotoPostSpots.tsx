import { useEffect, useId, useState, type CSSProperties, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { hashString, shownComments } from '@vx/modkit/shared'
import {
  type PostCommentsProps,
  type PostPictureProps,
  gestures,
  noteIn,
  quietPress,
  toggleLift
} from '@vx/modkit/renderer'
import { photoFriendHandle } from '../../shared/photoDuo'
import { useGameStore } from '../stores/gameStore'
import { usePhotosVisible } from '../stores/photoSwitchHooks'
import { PostPhoto } from './PhotoBubble'
import '../vu_styles/PostComments.css'

/**
 * What Photo Feature draws on a post, through the game's places for it: her picture, and what
 * other students said under it.
 */

/** Her picture under the post's text, read off the post itself. */
export function PhotoPostPicture({ charId, postId }: PostPictureProps): JSX.Element | null {
  const photo = useGameStore(
    (s) => s.charInfo[charId]?.feed?.find((post) => post.id === postId)?.photo
  )
  const handle = useGameStore((s) =>
    photoFriendHandle(s.npcRelationships, charId, photo?.with, s.charInfo)
  )
  const visible = usePhotosVisible()
  const [tagShown, setTagShown] = useState(false)
  const tagId = useId()
  useEffect(() => {
    setTagShown(false)
  }, [charId, postId, photo?.with, photo?.file, photo?.pending, photo?.failed, handle, visible])
  if (!photo || !visible) return null
  const taggable = Boolean(handle && photo.file && !photo.pending && !photo.failed)
  const showing = taggable && tagShown
  return (
    <div
      className="vu-bb-post-shot"
      onClickCapture={(event) => {
        if (!showing) return
        event.preventDefault()
        event.stopPropagation()
        setTagShown(false)
      }}
    >
      <PostPhoto charId={charId} postId={postId} photo={photo} />
      {taggable && (
        <>
          <motion.button
            type="button"
            className="vu-bb-photo-tags-toggle"
            aria-label={showing ? 'Hide who is in this photo' : 'Show who is in this photo'}
            aria-expanded={showing}
            aria-controls={tagId}
            {...gestures(false, toggleLift, quietPress)}
            onClick={(event) => {
              event.stopPropagation()
              setTagShown((shown) => !shown)
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              <circle cx="12" cy="7.5" r="4" />
              <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
            </svg>
          </motion.button>
          <span className="vu-bb-photo-tag-seat">
            <AnimatePresence>
              {showing && (
                <motion.span
                  id={tagId}
                  className="vu-bb-photo-tag"
                  role="status"
                  variants={noteIn}
                  initial="hidden"
                  animate="shown"
                  exit="gone"
                >
                  @{handle}
                </motion.span>
              )}
            </AnimatePresence>
          </span>
        </>
      )}
    </div>
  )
}

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
export function PhotoComments({ comments }: PostCommentsProps): JSX.Element | null {
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
