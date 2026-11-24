import type { PlayerStats, StatKey } from '@vx/modkit/shared'

export const STARTING_CHALLENGE_MOD = 'starting-challenge'
export const STARTING_CHALLENGES = {
  'uphill-battle': { name: 'Uphill Battle', points: -30 },
  'rock-bottom': { name: 'Rock Bottom', points: -60 }
} as const
export type StartingChallenge = keyof typeof STARTING_CHALLENGES | {
  version: 2
  floors: Record<StatKey, ChallengeFloor>
}
declare module './types' {
  interface GameSave { exStartingChallenge?: StartingChallenge }
  interface ModEnrollmentFields { exStartingChallenge?: StartingChallenge }
}

export type ChallengeFloor = -15 | -30 | -60 | -80 | -100
export type ChallengeStatTier = -4 | -3 | -2 | -1
export const MIN_CHALLENGE_TIER: ChallengeStatTier = -4
const CHALLENGE_FLOORS: readonly number[] = [-15, -30, -60, -80, -100]

export const CHALLENGE_TIERS = {
  '-4': { name: 'Peaked in the Womb', points: -100 },
  '-3': { name: 'Life’s Punchline', points: -80 },
  '-2': { name: 'Rock Bottom', points: -60 },
  '-1': { name: 'Struggling', points: -30 }
} as const

/** Read both the original whole-reader modes and independently chosen stat floors. */
export function readStartingChallenge(value: unknown): StartingChallenge | undefined {
  if (value === 'uphill-battle' || value === 'rock-bottom') return value
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 2 || !('floors' in value)) return undefined
  const floors = value.floors
  if (!floors || typeof floors !== 'object') return undefined
  const row = floors as Record<string, unknown>
  if (!['brain', 'body', 'heart'].every(key => typeof row[key] === 'number' && CHALLENGE_FLOORS.includes(row[key] as number))) return undefined
  return { version: 2, floors: { brain: row.brain, body: row.body, heart: row.heart } as Record<StatKey, ChallengeFloor> }
}

/** Freeze the starting choice; resumed registrations never consult today's switches. */
export function startingChallengeForSetup(
  saved: { exStartingChallenge?: unknown } | undefined,
  enabled: boolean
): StartingChallenge | undefined {
  if (saved) return readStartingChallenge(saved.exStartingChallenge)
  return enabled ? { version: 2, floors: { brain: -100, body: -100, heart: -100 } } : undefined
}

/** Replace all three opening stats once, when a fresh reader is named. */
export function challengeStartingStats(stats: PlayerStats, mode?: StartingChallenge): PlayerStats {
  if (!mode || typeof mode === 'object') return { ...stats }
  const points = STARTING_CHALLENGES[mode].points
  return { brain: points, body: points, heart: points }
}

/** Record opening floors, never recalculate them from earned progress on load or carry. */
export function challengeForStartingStats(stats: PlayerStats, mode?: StartingChallenge): StartingChallenge | undefined {
  if (!mode || typeof mode === 'string') return mode
  const floor = (points: number): ChallengeFloor => points < -80 ? -100 : points < -60 ? -80 : points < -30 ? -60 : points < -15 ? -30 : -15
  return { version: 2, floors: { brain: floor(stats.brain), body: floor(stats.body), heart: floor(stats.heart) } }
}

/** Each selected floor remains fixed even after that stat has recovered. */
export function challengeStatFloor(value: unknown, key: StatKey): number | undefined {
  const mode = readStartingChallenge(value)
  return typeof mode === 'string' ? STARTING_CHALLENGES[mode].points : mode?.floors[key]
}
