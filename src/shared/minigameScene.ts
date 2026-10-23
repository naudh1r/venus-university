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
export function copyMiniGameScene(value: MiniGameScene | null | undefined): MiniGameScene | null {
  if (!value) return null
  return {
    ...(value.invitationAt ? { invitationAt: { ...value.invitationAt } } : {}),
    ...(value.invitation ? { invitation: { ...value.invitation } } : {}),
    ...(value.match ? { match: { ...value.match, charIds: [...value.match.charIds], options: { ...value.match.options },
      ...(value.match.names ? { names: [...value.match.names] } : {}),
      ...(value.match.result ? { result: { ...value.match.result, ...(value.match.result.account ? { account: [...value.match.result.account] } : {}) } } : {})
    } } : {})
  }
}
