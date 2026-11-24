/**
 * The last time each game's screen failed, by game id: what a bug report from its page, or from
 * the table it broke off at, carries. Kept for this sitting only.
 */
const faults = new Map<string, { message: string; at: string }>()

/** A game's screen failed and was taken down: kept for the bug report. */
export function noteFault(gameId: string, error: unknown): void {
  const message = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  faults.set(gameId, { message: message.trim().slice(0, 1500), at: new Date().toISOString() })
}

/** The last failure of a game's screen this sitting, if it had one. */
export function faultOf(gameId: string): { message: string; at: string } | undefined {
  return faults.get(gameId)
}
