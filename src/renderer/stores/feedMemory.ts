import type { HeldFeedMemory } from '@shared/feedComments'
import type { CharMemory } from '@shared/types'
import { useGameStore } from './gameStore'

/** How a memory from the feed says where it happened, and how the last one is found again. */
const FEED_MEMORY_TAG = ', on the feed'
/** The tag earlier test builds wrote, still found so their memory is replaced, not kept beside. */
const OLD_FEED_MEMORY_TAG = ', on Bunnyboard'

/**
 * Files what his comments left her with as one of her own memories, replacing the last one the
 * feed left her: one at a time, the newest winning, as her texting memory does.
 */
function fileFeedMemory(charId: string, entry: CharMemory): void {
  const store = useGameStore.getState()
  const previous = store.charInfo[charId]?.memories.find(
    (one) => one.desc.endsWith(FEED_MEMORY_TAG) || one.desc.endsWith(OLD_FEED_MEMORY_TAG)
  )
  if (previous) store.replaceMemory(charId, previous, null)
  store.recordMemory(charId, { ...entry, desc: `${entry.desc}${FEED_MEMORY_TAG}` })
}

/** Keeps a thread's memories on one of its posts until the slot its answers show. */
export function holdFeedMemories(
  posterId: string,
  postId: string,
  memories: readonly HeldFeedMemory[]
): void {
  if (memories.length === 0) return
  useGameStore.setState((state) => {
    const info = state.charInfo[posterId]
    if (!info?.feed?.some((post) => post.id === postId)) return {}
    const feed = info.feed.map((post) =>
      post.id === postId
        ? { ...post, heldMemories: [...(post.heldMemories ?? []), ...memories] }
        : post
    )
    return { charInfo: { ...state.charInfo, [posterId]: { ...info, feed } } }
  })
}

/** Files every held memory whose answers show by global slot `through`, dated today. */
export function fileDueFeedMemories(through: number): void {
  const game = useGameStore.getState()
  const due: HeldFeedMemory[] = []
  for (const charId of game.chars) {
    const feed = game.charInfo[charId]?.feed
    if (!feed?.some((post) => post.heldMemories?.some((one) => one.at <= through))) continue
    for (const post of feed) due.push(...(post.heldMemories ?? []).filter((one) => one.at <= through))
    useGameStore.setState((state) => {
      const info = state.charInfo[charId]
      if (!info?.feed) return {}
      const kept = info.feed.map((post) => {
        const left = (post.heldMemories ?? []).filter((one) => one.at > through)
        if (left.length === (post.heldMemories ?? []).length) return post
        const { heldMemories: _, ...rest } = post
        return left.length > 0 ? { ...rest, heldMemories: left } : rest
      })
      return { charInfo: { ...state.charInfo, [charId]: { ...info, feed: kept } } }
    })
  }
  const { date } = useGameStore.getState()
  for (const { charId, type, desc } of due) fileFeedMemory(charId, { date, type, desc })
}
