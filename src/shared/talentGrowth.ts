import { STAT_KEYS, type PlayerStats } from './playerStats'

/** Read-only compatibility with early test saves. These fractions do not affect new gains. */
export type TalentGrowth = PlayerStats
export function readTalentGrowth(value: unknown): TalentGrowth | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const row = value as Record<string, unknown>
  return Object.fromEntries(STAT_KEYS.map(key => {
    const n = row[key]
    return [key, typeof n === 'number' && Number.isFinite(n) && n >= 0 && n < 1 ? n : 0]
  })) as unknown as TalentGrowth
}
