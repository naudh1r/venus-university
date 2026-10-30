import type { Result, StructuredRequest } from '@shared/types'

/** A mod's call group, kept apart from the game's and every other mod's. */
function groupOf(modId: string, group: string): string {
  return `mod:${modId}:${group}`
}

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
  const group = options.group === undefined ? undefined : groupOf(modId, options.group)
  return window.api.llm.completeMod(modId, request, group) as Promise<Result<T>>
}

/** Aborts the mod's calls still out under `group`; the mod's other groups, and the game's, run on. */
export async function cancelCalls(modId: string, group: string): Promise<void> {
  await window.api.jobs.cancelGroup(groupOf(modId, group))
}
