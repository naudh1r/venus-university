import type { TimeSlot } from '@vx/modkit/shared'
import { isGraduationSlot, isOrientationSlot } from '@vx/modkit/renderer'

/** What of the scene says whether its screen has the game seat on it. */
export interface ScreenState {
  date: number
  time: TimeSlot
  semesterIndex: number
  createdScene: unknown
  replaying: unknown
  activeGameOver: unknown
}

/**
 * Whether a table could open on this scene's screen: the seat stands where the calendar does,
 * which a screen the game wrote end to end (the orientation, the graduation epilogue, a game
 * over), a created scene and a replay all leave off. Nothing is offered or agreed elsewhere: a
 * game agreed there would never start, and she would be set up for it turn after turn.
 */
export function tableCanOpen(state: ScreenState): boolean {
  if (state.replaying || state.createdScene || state.activeGameOver) return false
  if (isOrientationSlot(state.date, state.time, state.semesterIndex)) return false
  return !isGraduationSlot(state.date, state.time)
}
