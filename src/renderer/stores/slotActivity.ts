import { useGameStore } from './gameStore'
import { submitAction } from './gameLoop'
import { writeAutosave } from './loop/saves'
import { currentRun, runStale } from './loop/state'

/** No points move here. The existing scene boundary owns that transaction. */
export async function finishSlotActivity(owner: string, id: string, completed: boolean, result: string): Promise<boolean> {
  const game = useGameStore.getState()
  const activity = game.sceneActivity
  if (!activity || activity.owner !== owner || activity.id !== id || activity.status !== 'pending') return false
  useGameStore.setState({ sceneActivity: { ...activity, status: completed ? 'completed' : 'abandoned', result } })
  await resumeSlotActivity()
  return true
}

/** Recovered settled results resume their closing; they never replay the game for a reward. */
export async function resumeSlotActivity(): Promise<void> {
  const game = useGameStore.getState()
  const activity = game.sceneActivity
  if (!activity || activity.status === 'pending' || game.busy || game.turnError || game.sceneEnding || !game.awaitingInput) return
  const run = currentRun()
  // Lock during persistence, before a second effect/callback can submit this closing.
  useGameStore.setState({ busy: true })
  await writeAutosave(game.captureScene())
  if (runStale(run)) return
  useGameStore.setState({ busy: false })
  await submitAction(`The activity is over. ${activity.result ?? 'The session ended without completion.'}`)
}
