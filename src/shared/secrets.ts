import { dispositionOf, type Disposition } from './relationship'
import type { CharInfo, CharSecret, CharState, SecretTier } from './types'

/** The tiers a secret is told at, lowest first: the order secrets are asked for and told in. */
export const SECRET_TIERS: readonly SecretTier[] = ['friendly', 'trusted', 'devoted']

/** How far up the tiers each disposition stands; below `friendly` opens no secret. */
const TIER_RANK: Partial<Record<Disposition, number>> = { friendly: 0, trusted: 1, devoted: 2 }

/** A secret as it is kept: trimmed and closed with a stop, the app owning the stop. */
export function secretText(text: string): string {
  const trimmed = text.trim()
  return /[.!?…]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * Her untold secrets after one more reading of her affection: every one whose tier she stands at
 * or above is marked reached, a tier jumped over counting, and no mark is ever taken back. Same
 * array when nothing moved.
 */
export function observedSecretTiers(
  secrets: CharState['secrets'],
  affection: number
): CharState['secrets'] {
  const rank = TIER_RANK[dispositionOf(affection)]
  if (!secrets || rank === undefined) return secrets
  let next: CharSecret[] | undefined
  secrets.forEach((secret, index) => {
    if (secret.reached || SECRET_TIERS.indexOf(secret.tier) > rank) return
    next ??= [...secrets]
    next[index] = { ...secret, reached: true }
  })
  return next ?? secrets
}

/**
 * The secret she tells in the next scene she is alone in: the reached, untold one of the lowest
 * tier, the first written breaking a tie; none while nothing is reached.
 */
export function pendingSecretOf(info: Pick<CharInfo, 'secrets'> | undefined): string | undefined {
  let best: CharSecret | undefined
  for (const secret of info?.secrets ?? []) {
    if (!secret.reached) continue
    if (!best || SECRET_TIERS.indexOf(secret.tier) < SECRET_TIERS.indexOf(best.tier)) best = secret
  }
  return best?.text
}

/**
 * The entries once a scene's one girl has told its secret: the first untold secret with that
 * text moved onto the end of her told list. Same object when the scene told nothing — no
 * secret, a cast that is not one girl, or a secret she no longer holds untold.
 */
export function withSecretTold(
  charInfo: Record<string, CharInfo>,
  cast: readonly string[],
  secret: string | null | undefined
): Record<string, CharInfo> {
  if (!secret || cast.length !== 1) return charInfo
  const charId = cast[0]
  const info = charInfo[charId]
  const index = info?.secrets?.findIndex((entry) => entry.text === secret) ?? -1
  if (!info?.secrets || index < 0) return charInfo
  const secrets = info.secrets.filter((_, at) => at !== index)
  const { secrets: _told, ...rest } = info
  return {
    ...charInfo,
    [charId]: {
      ...rest,
      ...(secrets.length > 0 ? { secrets } : {}),
      toldSecrets: [...(info.toldSecrets ?? []), secret]
    }
  }
}

/**
 * The tiers a semester's Start asks secrets for: all three for a girl new to the playthrough or
 * one who holds none, told or untold; one at `devoted` for anybody else returning.
 */
export function secretTiersWanted(
  state: Pick<CharState, 'secrets' | 'toldSecrets'> | undefined
): readonly SecretTier[] {
  const held = (state?.secrets?.length ?? 0) + (state?.toldSecrets?.length ?? 0)
  return held > 0 ? ['devoted'] : SECRET_TIERS
}

/** Every secret she holds, told first and then untold, for a Start asking for one unlike them. */
export function heldSecretsOf(
  state: Pick<CharState, 'secrets' | 'toldSecrets'> | undefined
): string[] {
  return [...(state?.toldSecrets ?? []), ...(state?.secrets ?? []).map((secret) => secret.text)]
}
