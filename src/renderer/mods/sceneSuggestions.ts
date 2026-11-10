import { useSyncExternalStore } from 'react'
import { useGameStore } from '../stores/gameStore'
import { modIsOn } from '../stores/modsStore'
import { currentRun, loopState, runStale } from '../stores/loop/state'
import { subscribeHookRules } from './hooks'
import { refusedAsForeign } from '../../../packages/modkit/src/renderer/attribution'

const paused = new Map<string, { run: object; loads: number }>()
const listeners = new Set<() => void>()

/** Pause optional scene suggestions for this mod until it releases its pause or the game is left or loaded.
 * A pause is ignored while its mod is off. Release it on stop, failure and switch-off. @since 0.8.0
 */
export function setSceneSuggestionsPaused(modId: string, active: boolean): void {
  if (refusedAsForeign(modId, 'scene suggestion activity')) return
  if (active) {
    const old = paused.get(modId)
    const loads = useGameStore.getState().loads
    if (old && !runStale(old.run) && old.loads === loads) return
    paused.set(modId, { run: currentRun(), loads })
  } else if (!paused.delete(modId)) return
  for (const listener of [...listeners]) listener()
}

/** Whether any enabled mod currently pauses optional scene suggestions. @since 0.8.0 */
export function sceneSuggestionsPaused(): boolean {
  const loads = useGameStore.getState().loads
  for (const [id, hold] of paused) {
    if (!runStale(hold.run) && hold.loads === loads && modIsOn(id, loopState.record)) return true
  }
  return false
}

/** Call the listener when the combined pause changes, including on load, exit or switch changes. @since 0.8.0 */
export function subscribeSceneSuggestionsPaused(listener: () => void): () => void {
  let previous = sceneSuggestionsPaused()
  function check() {
    const next = sceneSuggestionsPaused()
    if (next === previous) return
    previous = next
    listener()
  }

  listeners.add(check)
  const stopRules = subscribeHookRules(check)
  let run = currentRun()
  const stopGame = useGameStore.subscribe((state, before) => {
    if (state.loads === before.loads && !runStale(run)) return
    run = currentRun()
    check()
  })
  return () => {
    listeners.delete(check)
    stopRules()
    stopGame()
  }
}

/** Reactive optional-suggestion pause; activity and mod/game changes update it. @since 0.8.0 */
export function useSceneSuggestionsPaused(): boolean {
  return useSyncExternalStore(subscribeSceneSuggestionsPaused, sceneSuggestionsPaused, sceneSuggestionsPaused)
}
