import { useSyncExternalStore } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useModsStore, modIsOn } from '../stores/modsStore'
import { useModSessionStore } from '../stores/modSessionStore'
import { currentRun, runStale } from '../stores/loop/state'
import { refusedAsForeign } from '../../../packages/modkit/src/renderer/attribution'

const paused = new Map<string, { run: object; loads: number }>()
const listeners = new Set<() => void>()

/** Temporarily pause optional scene suggestions for this mod's active activity.
 * Does not block scene input or change persisted switches. Clear on activity stop.
 * Disabled mods and a different loaded game cannot retain a pause. @since 0.8.0
 */
export function setSceneSuggestionsPaused(modId: string, active: boolean): void {
  if (refusedAsForeign(modId, 'scene suggestion activity')) return
  const old = paused.get(modId), loads = useGameStore.getState().loads
  if (active) {
    if (old && !runStale(old.run) && old.loads === loads) return
    paused.set(modId, { run: currentRun(), loads })
  } else if (!paused.delete(modId)) return
  for (const listener of [...listeners]) listener()
}

/** Whether any enabled mod currently pauses optional scene suggestions. @since 0.8.0 */
export function sceneSuggestionsPaused(): boolean {
  const loads = useGameStore.getState().loads
  return [...paused].some(([id, hold]) => !runStale(hold.run) && hold.loads === loads && modIsOn(id))
}

/** Observe suggestion policy/activity changes, including game loads and mod switches. @since 0.8.0 */
export function subscribeSceneSuggestionsPaused(listener: () => void): () => void {
  listeners.add(listener)
  const stops = [useGameStore.subscribe(listener), useModsStore.subscribe(listener), useModSessionStore.subscribe(listener)]
  return () => { listeners.delete(listener); for (const stop of stops) stop() }
}

/** Reactive optional-suggestion pause; activity and mod/game changes update it. @since 0.8.0 */
export function useSceneSuggestionsPaused(): boolean {
  return useSyncExternalStore(subscribeSceneSuggestionsPaused, sceneSuggestionsPaused, sceneSuggestionsPaused)
}
