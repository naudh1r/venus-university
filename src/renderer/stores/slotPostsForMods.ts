import type { SlotIntroReply } from './slotIntroReply'

/**
 * The posts of a sanitized slot-opening reply, each carrying the fields the mods asked for (the
 * sanitizer keeps only the post's text). The model sometimes files a girl's post under
 * "hangouts": one who was asked to post and has not is given it back as her post, where the
 * sanitizer would drop it with the other invitations nobody asked for.
 */
export function postsWithModFields(
  raw: unknown,
  reply: SlotIntroReply,
  askers: readonly { charKey: string }[],
  posters: readonly { charKey: string }[]
): SlotIntroReply['posts'] {
  const entries = (field: string): Record<string, unknown>[] => {
    const list = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[field] : null
    return Array.isArray(list)
      ? list.filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
      : []
  }
  const rawPosts = entries('posts')
  const posts: SlotIntroReply['posts'] = reply.posts.map((post) => ({
    ...(rawPosts.find((entry) => entry.char === post.char) ?? {}),
    char: post.char,
    text: post.text
  }))
  const posted = new Set(posts.map(({ char }) => char))
  const askerKeys = new Set(askers.map(({ charKey }) => charKey))
  const posterKeys = new Set(posters.map(({ charKey }) => charKey))
  for (const hangout of entries('hangouts')) {
    const char = hangout.char
    const text = typeof hangout.text === 'string' ? hangout.text.trim() : ''
    if (typeof char !== 'string' || !text || askerKeys.has(char) || posted.has(char)) continue
    if (!posterKeys.has(char)) continue
    posts.push({ char, text })
    posted.add(char)
    console.warn(`[slot] filed invite from ${char} as her post: she was asked to post`)
  }
  return posts
}
