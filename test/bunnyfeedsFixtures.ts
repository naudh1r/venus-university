import type { CharInfo, PostComment, SocialPost } from '@vx/modkit/shared'
import type { BunnyCommentData, BunnyPostData } from '../src/shared/bunnyfeeds'
import { charInfo } from './fixtures'

export type LegacyBunnyPost = Omit<SocialPost, 'comments'> & BunnyPostData & {
  comments?: Array<PostComment & BunnyCommentData>
}

/** Builds pre-switch data without adding its optional keys to the game's current types. */
export function legacyCharInfo(
  over: Omit<Partial<CharInfo>, 'feed'> & { feed?: LegacyBunnyPost[] } = {}
): CharInfo {
  return charInfo(over)
}
