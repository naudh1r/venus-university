import type { SocialPost } from './types'

/**
 * Whether a post is out: on her feed for anybody to read, rather than filed and still waiting
 * for the picture it was written for.
 *
 * A post with a picture is written to the save the moment the slot writes it, so nothing can lose
 * it between then and the render, and kept off every list until the picture lands or fails. The
 * lists that show posts — the Updates tab, the posts a thin feed is filled out with, her page —
 * each ask this, and that is the whole of the rule.
 */
export function postIsOut(post: SocialPost): boolean {
  return post.photo?.held !== true
}
