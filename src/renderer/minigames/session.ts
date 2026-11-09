import { create } from 'zustand'
import { sceneField } from '@vx/modkit/renderer'
import type { Result } from '@vx/modkit/shared'
import { MINI_GAMES } from '@shared/minigames'
import { miniGameSceneOf, type MiniGameInvitation, type MiniGameResult, type MiniGameScene } from '@shared/minigameScene'
import { useGameStore } from '../stores/gameStore'

/** Proposals are transient; invitations, match setup and outcomes live in scene saves. */

/** The key builds before the scene field kept the state under, which a save may still hold. */
const LEGACY_KEY = 'miniGame'

const field = sceneField<MiniGameScene>(MINI_GAMES, {
  empty: {},
  legacy: LEGACY_KEY,
  normalize: miniGameSceneOf
})

/** The mini-game state kept with the scene being played. */
export function sceneMiniGame(): MiniGameScene {
  return field.read()
}

/** The same, for a component: it renders again when the state changes. */
export function useSceneMiniGame(): MiniGameScene {
  return field.use()
}

/** The mini-game state a save holds, under either key, read as {@link sceneMiniGame} reads it. */
export function savedMiniGame(mods: object): MiniGameScene {
  const values = mods as Readonly<Record<string, unknown>>
  return miniGameSceneOf(Object.hasOwn(values, MINI_GAMES) ? values[MINI_GAMES] : values[LEGACY_KEY])
}

/** Writes the mini-game state as it stands into the save a reload lands on. */
export function saveSceneMiniGame(): Promise<Result<null>> {
  return field.save(field.read())
}

/** Replaces the mini-game state kept with the scene, leaving every other mod's as it is. */
function setSceneMiniGame(next: MiniGameScene): void {
  field.set(Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined)))
}

/** A game the reader has asked a girl, or several, to play, in the words he asked with. */
export interface Proposal {
  gameId: string
  /** Everyone he asked. */
  charIds: string[]
  text: string
}

/** A game she said yes to, and what the two of them put on it. */
export interface Agreed {
  /** A destination agreement may open only after playback reaches this venue. */
  location?: string | null
  gameId: string
  /** Everyone who is in, in the order they sit. */
  charIds: string[]
  /** What is riding on the game, as the scene settled it; empty where nothing is. */
  stake: string
  /** How the game is to be played, by the options it declares. */
  options: Record<string, number>
}

/** A game just played with a girl, while the turn that tells the scene about it is out. */
export interface Played {
  /** The turn's own words: the result as the scene is told it. */
  text: string
  /** What rides with that turn's prompt and is never shown: the account, and the stake. */
  brief: readonly string[]
  /** A game played alone: the brief rides with the next turn, whatever its words. */
  next?: boolean
}

interface TableState {
  active: boolean
  proposal: Proposal | null
  agreed: Agreed | null
  played: Played | null
  setPlayed: (played: Played | null) => void
  setProposal: (proposal: Proposal | null) => void
  setAgreed: (agreed: Agreed | null) => void
  /** Lets go of the agreed game in hand, preserving the scene checkpoint for restart. */
  dropAgreed: () => void
}

/** A running save restarts this match; a settled result must never reopen it. */
export function keptAgreed(): Agreed | null {
  const match = sceneMiniGame().match
  return match?.status === 'playing' ? { ...match, location: match.location } : null
}
function keep(agreed: Agreed | null): void {
  const state = sceneMiniGame()
  // Submitting the persisted result must not erase its recovery checkpoint.
  if (!agreed && state.match?.status === 'result') return
  if (!agreed) {
    const { match: _match, ...rest } = state
    setSceneMiniGame(rest)
    return
  }
  if (state.match?.status === 'result') return
  const existing = state.match
  const same = existing?.status === 'playing' && existing.gameId === agreed.gameId &&
    JSON.stringify(existing.charIds) === JSON.stringify(agreed.charIds) && JSON.stringify(existing.options) === JSON.stringify(agreed.options)
  setSceneMiniGame({ ...state, invitation: undefined, match: {
    ...agreed, location: agreed.location ?? null, id: same ? existing.id : crypto.randomUUID(), status: 'playing'
  } })
}

export const useTableStore = create<TableState>((set) => ({
  active: false,
  proposal: null,
  agreed: null,
  played: null,
  setPlayed: (played) => set({ played }),
  setProposal: (proposal) => set({ proposal }),
  setAgreed: (agreed) => {
    keep(agreed)
    set({ agreed })
  },
  dropAgreed: () => set({ agreed: null })
}))

export type Invitation = MiniGameInvitation

/** Keeps a girl's unanswered invitation with the scene, against the line it was made on; null drops it. */
export function keepInvitation(invitation: Invitation | null): void {
  const game = useGameStore.getState()
  const state = sceneMiniGame()
  const transcript = game.currentSceneTranscript
  setSceneMiniGame({ ...state, invitation: invitation ?? undefined,
    invitationAt: invitation ? { at: transcript.length, tail: JSON.stringify(transcript.at(-1) ?? null) } : undefined })
}

/** The invitation still awaiting the reader's answer, or null once the scene has moved past it. */
export function keptInvitation(): Invitation | null {
  const game = useGameStore.getState()
  const state = sceneMiniGame()
  const mark = state.invitationAt
  if (mark && (game.currentSceneTranscript.length < mark.at || game.currentSceneTranscript.length > mark.at + 1 ||
    JSON.stringify(game.currentSceneTranscript[mark.at - 1] ?? null) !== mark.tail)) return null
  return state.invitation ?? null
}

/** Result is recorded immediately, including during the final animation/dialogue. */
export function checkpointResult(result: MiniGameResult, names: readonly string[]): void {
  const state = sceneMiniGame()
  if (!state.match || state.match.status === 'result') return
  setSceneMiniGame({ ...state, match: { ...state.match, status: 'result', result: { ...result }, names: [...names] } })
}

/** One opening of the table, from the panel showing it to the panel closing. */
export interface OpenTable {
  /** The reader stood up from it before its first move: nothing seats it again. */
  left: boolean
}

/**
 * Sets the match at an open table and writes it into the save a reload lands on. Does nothing
 * once the reader has stood up from it: a game that fails as it first draws stands him up before
 * the panel's seating has run.
 */
export async function seatMatch(table: OpenTable, agreed: Agreed): Promise<void> {
  if (table.left) return
  useTableStore.getState().setAgreed(agreed)
  useTableStore.getState().dropAgreed()
  await saveSceneMiniGame()
}

/**
 * Lets go of a table before its first move: the match leaves the scene, and the save a reload
 * lands on, which took it when the table was set. A settled result is kept, as `setAgreed` keeps it.
 */
export function cancelMatch(table: OpenTable): Promise<Result<null>> {
  table.left = true
  useTableStore.getState().setAgreed(null)
  return saveSceneMiniGame()
}

/** Drops the match kept with the scene, once its result has been told. */
export function clearMatch(): void {
  const state = sceneMiniGame()
  if (!state.match) return
  setSceneMiniGame({ ...state, match: undefined })
}

/** An agreement is not a travel shortcut or an override for a disabled game. */
export function agreementAvailable(agreed: Agreed, location: string | null, offered: readonly { id: string }[]): boolean {
  return (!agreed.location || agreed.location === location) && offered.some(game => game.id === agreed.gameId)
}
