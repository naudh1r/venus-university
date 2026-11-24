import type { SceneView } from '@vx/modkit/renderer'

/**
 * Whether a table could open on this scene's screen: the seat stands where the calendar does,
 * which a screen the game wrote end to end (the orientation, the graduation epilogue, a game
 * over), a created scene and a replay all leave off. Nothing is offered or agreed elsewhere: a
 * game agreed there would never start, and she would be set up for it turn after turn.
 */
export function tableCanOpen(view: SceneView | null): boolean {
  return view !== null && !view.replay && !view.created && !view.over && view.scripted === null
}
