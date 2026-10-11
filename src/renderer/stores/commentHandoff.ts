import type { ComponentType } from 'react'
import type { PhotoTier } from '@shared/photoGate'
import type { PostComment } from '@shared/postComments'

/**
 * Where another mod may take over the replies under a post: what the slot opening is told to
 * write, the field it writes them in, how they are dressed once the post is filed, and how they
 * are drawn. Photo Feature keeps its own plain replies whenever nothing has taken them over.
 */

/** What the row drawing a post hands to whatever draws its replies. */
export interface CommentViewProps {
  comments: readonly PostComment[]
  /** Whose post it is; absent for the slot's random student. */
  charId?: string
  postId?: string
  /** Somebody he has no contact info for. */
  stranger?: boolean
}

/** One mod's way of writing and drawing a post's replies. */
export interface CommentHandoff {
  /** Whether it is acting right now; read at every use, so its own switch decides. */
  active: () => boolean
  /** The slot opening's lines about the replies, in place of Photo Feature's. */
  lines: () => readonly string[]
  /** The schema of each post's `comments` field, in place of Photo Feature's. */
  field: () => Record<string, unknown>
  /** The replies as filed, from what the reply wrote and how far her picture goes. */
  dress: (charId: string, written: unknown, photoTier: PhotoTier) => PostComment[]
  View: ComponentType<CommentViewProps>
  /** Drawn beside the post's like, where it has something to put there. */
  Action?: ComponentType<CommentViewProps>
  /**
   * A comment only this mod could have written. Asked whether or not it is acting, so Photo
   * Feature's own view leaves such comments out while the mod is off, and they come back with it.
   */
  claims?: (comment: PostComment) => boolean
}

let taken: CommentHandoff | null = null

/** Registers the mod taking over; called once, from its own files, at boot. */
export function handOffComments(handoff: CommentHandoff): void {
  taken = handoff
}

/** The comments Photo Feature's own view draws: every one no registered mod claims. */
export function plainComments(comments: readonly PostComment[]): PostComment[] {
  const claims = taken?.claims
  return claims ? comments.filter((comment) => !claims(comment)) : [...comments]
}

/** The mod that has taken over the replies, while it is acting; null leaves them to Photo Feature. */
export function commentHandoff(): CommentHandoff | null {
  return taken?.active() ? taken : null
}
