import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import { appError } from '../errors'
import { runAbortable } from '../jobQueue'
import { completeStructured, type StructuredRequest } from './cloudLlm'

/**
 * A mod's own structured call, the one channel every mod's calls share: the request is sent as
 * the game sends its own, and the reply parsed but not checked, since only the mod knows its
 * shape. Under a `group`, cancelling that group aborts it; without one it runs to the end. The
 * mod is named in the log beside the call.
 */
export function completeModRequest(
  modId: unknown,
  request: StructuredRequest,
  group?: string
): Promise<unknown> {
  if (typeof modId !== 'string' || !MOD_ID_RULE.test(modId)) {
    throw appError('MOD_ID_INVALID', 'A model call was asked for without a mod id.', String(modId))
  }
  console.log(`[llm] a call for ${modId}: ${request.schema.name}`)
  return group
    ? runAbortable(group, (signal) => completeStructured<unknown>(request, signal))
    : completeStructured<unknown>(request)
}
