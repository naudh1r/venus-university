import { parseAction } from '@shared/sceneActions'
import type { SceneLine } from '@shared/types'
import type { SceneResult, SceneResultContext } from '../hooks'

function contract(ctx: SceneResultContext): { canEnd: boolean; continuation: boolean } {
  const properties = ctx.request.schema.schema.properties as Record<string, unknown> | undefined
  return {
    canEnd: Boolean(properties && Object.hasOwn(properties, 'end_scene')),
    continuation: Boolean(properties && Object.hasOwn(properties, 'summary'))
  }
}

/** Hold empty-stage narration until an entrance proves this reply is a cast handoff. */
export function sceneBoundary(ctx: SceneResultContext): (line: SceneLine) => SceneLine[] {
  const { canEnd, continuation } = contract(ctx)
  if (!canEnd) return line => [line]
  const present = new Set(ctx.stage)
  const stale = continuation && present.size === 0
  let waiting = false
  let held: SceneLine[] = []
  return line => {
    if (stale) return []
    let departed = false
    for (const written of line.actions ?? []) {
      const action = parseAction(written)
      if (action?.kind === 'show') present.add(action.charKey)
      else if (action?.kind === 'hide' && present.delete(action.charKey)) departed = true
    }
    if (waiting) {
      held.push(line)
      if (present.size === 0) return []
      waiting = false
      const resumed = held
      held = []
      return resumed
    }
    if (departed && present.size === 0) waiting = true
    return [line]
  }
}

/** An explicit final departure cannot leave the reader at an empty-stage decision point. */
export function endEmptyScene(result: SceneResult, ctx: SceneResultContext): SceneResult {
  const { canEnd, continuation } = contract(ctx)
  // Solo scenes and closing requests do not offer an ending signal.
  if (result.end || !canEnd) return result
  if (continuation && ctx.stage.length === 0) return { ...result, end: true }

  const present = new Set(ctx.stage)
  let departed = false
  for (const line of result.lines) {
    for (const written of line.actions ?? []) {
      const action = parseAction(written)
      if (action?.kind === 'show') present.add(action.charKey)
      else if (action?.kind === 'hide' && present.delete(action.charKey)) departed = true
    }
  }
  return departed && present.size === 0 ? { ...result, end: true } : result
}
