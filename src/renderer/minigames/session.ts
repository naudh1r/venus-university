import { create } from 'zustand'
import { useGameStore } from '../stores/gameStore'

/**
 * What stands between a game being asked for and being played: the reader's proposal while the
 * turn carrying it is out, and the game a girl agreed to until the table opens on it. The save
 * knows nothing of either. An agreed game is kept beside it, against the point of the scene it
 * was agreed at, so a game reloaded there still has its table to open.
 */

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
  proposal: Proposal | null
  agreed: Agreed | null
  played: Played | null
  setPlayed: (played: Played | null) => void
  setProposal: (proposal: Proposal | null) => void
  setAgreed: (agreed: Agreed | null) => void
  /** Lets go of the agreed game in hand, leaving what is kept beside the save where it is. */
  dropAgreed: () => void
}

/** Where the agreed game is kept across a reload. */
const KEPT = 'vu-minigames:agreed'

/** The point of a scene an agreement belongs to: the playthrough, and how far its scene had got. */
function sceneMark(): { playthrough: string | null; at: number } {
  const game = useGameStore.getState()
  return { playthrough: game.playthroughId, at: game.currentSceneTranscript.length }
}

function keep(agreed: Agreed | null): void {
  try {
    if (agreed) localStorage.setItem(KEPT, JSON.stringify({ ...sceneMark(), agreed }))
    else localStorage.removeItem(KEPT)
  } catch {
    // Kept for this sitting only.
  }
}

/**
 * The game she agreed to at exactly the point the loaded scene stands at, or null: one agreed in
 * another playthrough, or before lines the scene has since gained or lost, is not this scene's.
 */
export function keptAgreed(): Agreed | null {
  try {
    const raw = localStorage.getItem(KEPT)
    if (!raw) return null
    const { playthrough, at, agreed } = JSON.parse(raw) as {
      playthrough?: unknown
      at?: unknown
      agreed?: Agreed & { charId?: string }
    }
    const mark = sceneMark()
    if (!agreed || playthrough !== mark.playthrough || at !== mark.at) return null
    // One kept before a table seated more than one girl names only her.
    if (!Array.isArray(agreed.charIds)) {
      if (typeof agreed.charId !== 'string') return null
      return { ...agreed, charIds: [agreed.charId] }
    }
    return agreed
  } catch {
    return null
  }
}

export const useTableStore = create<TableState>((set) => ({
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

/** An unanswered NPC invitation, scoped to the exact conversation prefix and slot. */
export interface Invitation { gameId: string; location: string | null }
const INVITE = 'vu-minigames:invitation'
let invitationMemory: string | null = null
export function keepInvitation(invitation: Invitation | null): void {
  const game = useGameStore.getState()
  invitationMemory = invitation ? JSON.stringify({ invitation, playthrough: game.playthroughId,
    date: game.date, time: game.time, transcript: game.currentSceneTranscript }) : null
  try {
    if (invitationMemory) localStorage.setItem(INVITE, invitationMemory)
    else localStorage.removeItem(INVITE)
  } catch { /* Memory remains available without browser storage. */ }
}
export function keptInvitation(): Invitation | null {
  try {
    const raw = typeof localStorage === 'undefined' ? invitationMemory : localStorage.getItem(INVITE) ?? invitationMemory
    if (!raw) return null
    const saved = JSON.parse(raw)
    const game = useGameStore.getState()
    const before = saved.transcript
    const now = game.currentSceneTranscript
    if (!Array.isArray(before) || before.length === 0 || now.length < before.length || now.length > before.length + 1 ||
      saved.playthrough !== game.playthroughId || saved.date !== game.date || saved.time !== game.time ||
      JSON.stringify(now.slice(0, before.length)) !== JSON.stringify(before)) return null
    return saved.invitation && typeof saved.invitation.gameId === 'string' ? saved.invitation : null
  } catch { return null }
}

/** An agreement is not a travel shortcut or an override for a disabled game. */
export function agreementAvailable(agreed: Agreed, location: string | null, offered: readonly { id: string }[]): boolean {
  return (!agreed.location || agreed.location === location) && offered.some(game => game.id === agreed.gameId)
}
