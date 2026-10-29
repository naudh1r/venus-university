import type { JSX } from 'react'
import {
  ownedComments,
  postCommentsOwner,
  postPicture,
  type PostCommentsProps,
  type PostPictureProps
} from '../mods/hooks'
import { useModsStore } from '../stores/modsStore'

/**
 * The places on a post a mod draws into: its picture, the comments under it, and a control beside
 * its like. The game draws none of them itself. Each reads the switches, so a mod turned on or
 * off redraws the posts it draws on.
 */

/** A post's picture, drawn by the first mod on that draws one; nothing otherwise. */
export function PostPicture(props: PostPictureProps): JSX.Element | null {
  useModsStore((s) => s.switches)
  const Picture = postPicture()
  return Picture ? <Picture {...props} /> : null
}

/** The comments under a post, drawn by the mod drawing them; nothing while none is on. */
export function PostCommentsView(props: PostCommentsProps): JSX.Element | null {
  useModsStore((s) => s.switches)
  const owner = postCommentsOwner()
  if (!owner) return null
  const { View } = owner.spot
  return <View {...props} comments={ownedComments(props.comments, owner.modId)} />
}

/** What the mod drawing the comments puts beside the post's like; nothing otherwise. */
export function PostCommentAction(props: PostCommentsProps): JSX.Element | null {
  useModsStore((s) => s.switches)
  const owner = postCommentsOwner()
  const Action = owner?.spot.Action
  return owner && Action ? (
    <Action {...props} comments={ownedComments(props.comments, owner.modId)} />
  ) : null
}
