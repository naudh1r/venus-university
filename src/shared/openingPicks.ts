import type { OpeningPicks } from './types'

/** The kept picks with the girls a bonus scene spent with him taken off the invitations and reach-out. */
export function picksWithout(picks: OpeningPicks, charKeys: readonly string[]): OpeningPicks {
  const gone = new Set(charKeys)
  return {
    ...picks,
    askers: picks.askers.filter((key) => !gone.has(key)),
    invites: Object.fromEntries(Object.entries(picks.invites).filter(([key]) => !gone.has(key))),
    reachOut: picks.reachOut && gone.has(picks.reachOut.charKey) ? null : picks.reachOut
  }
}
