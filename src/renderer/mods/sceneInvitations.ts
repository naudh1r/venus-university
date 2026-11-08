import { useGameStore } from '../stores/gameStore'
import { charUnavailableNow, charOverlayGroupNow, isHomebound } from '../stores/timetable'
import { sceneActiveOf } from '../stores/textingLoop'
import { isOrientationSlot } from '../prompts/introScript'
import { isGraduationSlot } from '../prompts/graduation'
import { modIsOn } from '../stores/modsStore'
import { currentRun, loopState, runStale } from '../stores/loop/state'
import { manualSaveOffer } from '../stores/loop/saves'

/** True between ordinary playable scenes, while the reader can start an encounter. */
export function canInviteToScene(): boolean {
  const g = useGameStore.getState()
  return Boolean(manualSaveOffer() === 'open' && g.playthroughId && !g.activeGameOver && !g.createdScene && !g.replaying && !g.busy && !g.streaming &&
    !g.sceneEnding && !g.endingInFlight && !sceneActiveOf(g) && !isOrientationSlot(g.date,g.time,g.semesterIndex) &&
    !isGraduationSlot(g.date,g.time))
}

/** Apply the native timetable, resting, group and event rules to the current slot. */
export function freeForInvitation(id: string): boolean {
  const g = useGameStore.getState()
  return Boolean(g.playthroughId && g.chars.includes(id) && g.charInfo[id]?.nameKnown &&
    !charUnavailableNow(id) && !isHomebound(g.charInfo[id],g.date,g.time) && !charOverlayGroupNow(id) &&
    !g.events.some(event => event.date === g.date && event.time === g.time && event.charIds.includes(id)))
}

/** Re-evaluate invitation availability, including changes within the same slot. */
export function subscribeInvitations(listener: () => void): () => void {
  return useGameStore.subscribe(listener)
}

/** Open an ordinary native scene with one invited participant. Initialize the mod's field
 * through its own handle after staging and before the first prompt. */
export async function startInvitedScene(modId: string, id: string, action: string, initialize: () => void, eligible: () => boolean = () => true): Promise<void> {
  const run = currentRun()
  const original = useGameStore.getState()
  const { enterInvitedScene } = await import('../stores/loop/invitedScene')
  const now = useGameStore.getState()
  if (runStale(run) || original.loads !== now.loads || original.date !== now.date || original.time !== now.time ||
      !modIsOn(modId, loopState.record) || !canInviteToScene() || !freeForInvitation(id) || !eligible() || !action.trim() || action.length > 4000) {
    throw Error('This invitation is no longer available.')
  }
  await enterInvitedScene(modId, id, action, initialize)
}
