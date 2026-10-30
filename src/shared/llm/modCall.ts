import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { appError } from '../errors'
import { cancelGroup, runAbortable } from '../jobQueue'
import type { StructuredRequest } from './cloudLlm'

/** The mod's id, checked here rather than trusted from the window. */
function checkedModId(modId: unknown, what: string): string {
  if (typeof modId !== 'string' || !MOD_ID_RULE.test(modId)) {
    throw appError('MOD_ID_INVALID', `${what} was asked for without a mod id.`, String(modId))
  }
  return modId
}

/** A mod's call group as the queue knows it: kept apart from the game's and every other mod's. */
function modCallGroup(modId: string, group: unknown): string {
  if (typeof group !== 'string') {
    throw appError('MOD_GROUP_INVALID', "A mod's call group must be a string.", String(group))
  }
  return `mod:${modId}:${group}`
}

/**
 * A mod's own structured call, the one channel every mod's calls share: sent through `complete`,
 * the same function the game's own calls on that side go through, and the reply parsed but not
 * checked, since only the mod knows its shape. Under the mod's `group`, {@link cancelModCalls}
 * with the same mod and group aborts it; without one it runs to the end. The mod is named in the
 * log beside the call.
 */
export function completeModRequest(
  complete: (request: StructuredRequest, signal?: AbortSignal) => Promise<unknown>,
  modId: unknown,
  request: StructuredRequest,
  group?: unknown
): Promise<unknown> {
  const id = checkedModId(modId, 'A model call')
  const queued = group === undefined ? undefined : modCallGroup(id, group)
  console.log(`[llm] a call for ${id}: ${request.schema.name}`)
  return queued ? runAbortable(queued, (signal) => complete(request, signal)) : complete(request)
}

/** Aborts the mod's calls still out under its `group`; its other groups, and the game's, run on. */
export function cancelModCalls(modId: unknown, group: unknown): Promise<void> {
  return cancelGroup(modCallGroup(checkedModId(modId, 'A cancel'), group))
}
