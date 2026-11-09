import { STAT_KEYS, type PlayerStats } from './playerStats'

/** Shared by settlement and the menu; stat scaling applies after these base rewards. */
export const TALENT_BP_REWARDS = { liked: 1, loved: 2 } as const

// Interpolate current stats, not the starting challenge or display tier. These
// anchors preserve extra BP for deep-negative recovery without scaling stat gains.
const RATE_ANCHORS = [[-100, 3], [-80, 2.8], [-60, 2.6], [-30, 1.5], [-15, 1.25], [0, 1], [100, .5]] as const

/** Every intermediate stat value matters; only the final reward rate is bounded. */
export function talentBondRate(stats: PlayerStats): { average: number; multiplier: number } {
  const average = STAT_KEYS.reduce((sum, key) => {
    const n = stats[key]
    return sum + (Number.isFinite(n) ? n / STAT_KEYS.length : 0)
  }, 0)
  if (average <= RATE_ANCHORS[0][0]) return { average, multiplier: RATE_ANCHORS[0][1] }
  for (let i = 1; i < RATE_ANCHORS.length; i++) {
    const [x, y] = RATE_ANCHORS[i], [previousX, previousY] = RATE_ANCHORS[i - 1]
    if (average <= x) return { average, multiplier: previousY + (y - previousY) * (average - previousX) / (x - previousX) }
  }
  return { average, multiplier: RATE_ANCHORS[RATE_ANCHORS.length - 1][1] }
}

/** Save fractions separately from the spendable integer wallet. */
export function readBondFraction(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1
    ? value : undefined
}
