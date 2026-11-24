/** Serializable scene checkpoints, not individual game simulations. */
export interface MiniGameInvitation { gameId: string; location: string | null }
export interface MiniGameAgreement extends MiniGameInvitation {
  charIds: string[]
  stake: string
  options: Record<string, number>
}
export interface MiniGameResult {
  outcome: 'won' | 'lost' | 'draw' | 'played' | 'abandoned' | 'broken'
  summary: string
  account?: readonly string[]
}
export interface MiniGameScene {
  invitation?: MiniGameInvitation
  invitationAt?: { at: number; tail: string }
  match?: MiniGameAgreement & {
    id: string
    status: 'playing' | 'result'
    result?: MiniGameResult
    names?: string[]
  }
}

const OUTCOMES: readonly MiniGameResult['outcome'][] = ['won', 'lost', 'draw', 'played', 'abandoned', 'broken']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTexts(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function invitationOf(value: unknown): MiniGameInvitation | undefined {
  if (!isRecord(value) || typeof value.gameId !== 'string') return undefined
  if (value.location !== null && typeof value.location !== 'string') return undefined
  return { gameId: value.gameId, location: value.location }
}

function resultOf(value: unknown): MiniGameResult | undefined {
  if (!isRecord(value) || typeof value.summary !== 'string') return undefined
  if (!OUTCOMES.includes(value.outcome as MiniGameResult['outcome'])) return undefined
  if (value.account !== undefined && !isTexts(value.account)) return undefined
  const result: MiniGameResult = { outcome: value.outcome as MiniGameResult['outcome'], summary: value.summary }
  if (value.account !== undefined) result.account = value.account
  return result
}

function matchOf(value: unknown): MiniGameScene['match'] {
  if (!isRecord(value)) return undefined
  const invitation = invitationOf(value)
  const { id, charIds, stake, options, status, names } = value
  if (!invitation || typeof id !== 'string' || !isTexts(charIds) || typeof stake !== 'string') return undefined
  if (status !== 'playing' && status !== 'result') return undefined
  if (!isRecord(options) || !Object.values(options).every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return undefined
  }
  if (names !== undefined && !isTexts(names)) return undefined
  const result = value.result === undefined ? undefined : resultOf(value.result)
  // A settled match is only ever told from its result; without one there is nothing to tell.
  if (status === 'result' && !result) return undefined
  const match: NonNullable<MiniGameScene['match']> = {
    ...invitation, id, charIds, stake, options: options as Record<string, number>, status
  }
  if (result) match.result = result
  if (names !== undefined) match.names = names
  return match
}

/**
 * A mini-game value a save brought back, as this version keeps it: whatever part of it does not
 * have the shape it should is left out, so a damaged or older save opens no table it can't play.
 */
export function miniGameSceneOf(stored: unknown): MiniGameScene {
  if (!isRecord(stored)) return {}
  const scene: MiniGameScene = {}
  const invitation = invitationOf(stored.invitation)
  if (invitation) scene.invitation = invitation
  const mark = stored.invitationAt
  if (invitation && isRecord(mark) && Number.isSafeInteger(mark.at) && typeof mark.tail === 'string') {
    scene.invitationAt = { at: mark.at as number, tail: mark.tail }
  }
  const match = matchOf(stored.match)
  if (match) scene.match = match
  return scene
}
