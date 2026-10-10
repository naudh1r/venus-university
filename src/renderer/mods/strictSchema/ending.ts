import { parseAction } from '@shared/sceneActions'
import type { SceneResult, SceneResultContext } from '../hooks'

/** An explicit final departure cannot leave the reader at an empty-stage decision point. */
export function endEmptyScene(result: SceneResult, ctx: SceneResultContext): SceneResult {
  const properties = ctx.request.schema.schema.properties as Record<string, unknown> | undefined
  // Solo scenes and closing requests do not offer an ending signal.
  if (result.end || !properties || !Object.hasOwn(properties, 'end_scene')) return result

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
