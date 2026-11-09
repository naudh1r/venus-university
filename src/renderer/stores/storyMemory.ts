import { storySnapshot, type StorySnapshot, type StoryRecall } from '../../shared/storyMemory'
import { useGameStore } from './gameStore'
import { modIsOn } from '@vx/modkit/renderer'

/** Optional input shared by pure scene, text and opening builders. */
export function currentStorySnapshot(): StorySnapshot | undefined {
  const game = useGameStore.getState()
  return modIsOn('story-memory') && !game.createdScene && !game.replaying ? storySnapshot(game) : undefined
}

export async function inspectCurrentStoryMemory(
  cast: string[],
  query: string
): Promise<StoryRecall | null> {
  const game = useGameStore.getState(),
    snapshot = currentStorySnapshot()
  if (!snapshot) return null
  const result = await window.api.storyMemory.inspect({
    ...snapshot,
    cast,
    query: query.slice(0, 4000)
  })
  const live = useGameStore.getState()
  if (
    game.playthroughId !== live.playthroughId ||
    game.loads !== live.loads ||
    game.exStoryMemory !== live.exStoryMemory ||
    game.history !== live.history
  )
    return null
  if (!result.ok) throw Error(result.error.message)
  return result.data
}
