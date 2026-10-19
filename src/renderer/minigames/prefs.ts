import { create } from 'zustand'
import { MINI_GAMES_LIST, tuned, type GamePrefs, type MiniGameDef } from '@shared/minigames'

/**
 * What the player has set for each game on its page of the Mods screen. Kept on this computer,
 * beside no save: it is how he likes his games, not something a playthrough depends on.
 */

const KEPT = 'vu-minigames:prefs'

function kept(): Record<string, GamePrefs> {
  try {
    const raw = localStorage.getItem(KEPT)
    const read: unknown = raw ? JSON.parse(raw) : null
    return read && typeof read === 'object' ? (read as Record<string, GamePrefs>) : {}
  } catch {
    return {}
  }
}

interface PrefsState {
  byGame: Record<string, GamePrefs>
  /** Sets one game's preferences; nothing left set forgets the game. */
  set: (gameId: string, prefs: GamePrefs) => void
}

export const usePrefsStore = create<PrefsState>((set) => ({
  byGame: kept(),
  set: (gameId, prefs) =>
    set((state) => {
      const byGame = { ...state.byGame }
      const empty =
        !prefs.suggest &&
        prefs.stepped === undefined &&
        prefs.playByPlay === undefined &&
        Object.keys(prefs.aids ?? {}).length === 0 &&
        Object.keys(prefs.options ?? {}).length === 0
      if (empty) delete byGame[gameId]
      else byGame[gameId] = prefs
      try {
        localStorage.setItem(KEPT, JSON.stringify(byGame))
      } catch {
        // Kept for this sitting only.
      }
      return { byGame }
    })
}))

/** A game as the player has it set. */
export function tunedGame(game: MiniGameDef): MiniGameDef {
  return tuned(game, usePrefsStore.getState().byGame[game.id])
}

/** A game in this build by its id, as the player has it set. */
export function gameById(gameId: string): MiniGameDef | undefined {
  const game = MINI_GAMES_LIST.find((entry) => entry.id === gameId)
  return game && tunedGame(game)
}
