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

declare module './types' {
  interface ModSceneFields {
    /** The mini-game invitation and match kept with the scene. */
    miniGame?: MiniGameScene
  }
}
