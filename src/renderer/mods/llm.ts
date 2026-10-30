import { MOD_ID_RULE } from '@vx/modkit/host/shared'
import type { Result, StructuredRequest } from '@shared/types'

/**
 * Sends a mod's own structured request, as the game sends its own: the player's model, key and
 * settings, the schema enforced by the provider. The reply comes back parsed, not checked, so the
 * mod reads it as `T` at its own risk. Under a `group`, {@link cancelCalls} with the same group
 * aborts it, and it resolves `CANCELLED`. Never throws; a failure is the `Result`'s error.
 */
export function completeStructured<T>(
  modId: string,
  request: StructuredRequest,
  options: { group?: string } = {}
): Promise<Result<T>> {
  return window.api.llm.completeMod(modId, request, options.group) as Promise<Result<T>>
}

/**
 * Aborts the mod's calls still out under `group`; the mod's other groups, and the game's, run on.
 * An id no mod can have cancels nothing, so it never reaches another mod's group.
 */
export async function cancelCalls(modId: string, group: string): Promise<void> {
  if (!MOD_ID_RULE.test(modId)) {
    console.warn(`[llm] cancelCalls was asked for an invalid mod id: ${String(modId)}`)
    return
  }
  await window.api.llm.cancelMod(modId, group)
}
