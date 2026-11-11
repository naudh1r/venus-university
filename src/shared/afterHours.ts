export const AFTER_HOURS_MOD = 'after-hours'

/** The reader's phone status for this semester. */
export interface AfterHours {
  busy: boolean
}

/** Only an explicit true restores the Busy status. */
export function normalize(stored: unknown): AfterHours {
  return { busy: typeof stored === 'object' && stored !== null && 'busy' in stored && stored.busy === true }
}

/** Busy drops her new immediate invitation in a thread the reader opened this slot. */
export function busyDrops(
  verdict: { initiatedBy: 'player' | 'contact' } | null,
  ctx: { startedBy: 'reader' | 'her'; answeringInvite: boolean },
  busy: boolean
): boolean {
  return busy && verdict?.initiatedBy === 'contact' && ctx.startedBy === 'reader' && !ctx.answeringInvite
}
