import { jobDefOf } from '@shared/jobs'
import { ensureWhisperAuthor, observeWhisperSlot, type WhisperPresence } from '../../shared/venusWhisper'
import type { SlotSettled } from '@vx/modkit/renderer'
import { useGameStore } from './gameStore'
import { charAwayNow, charClassNow, charHiddenLocationNow, charJobNow } from './timetable'

/** Runs inside the native boundary save; never rolls encounters or reads a private scene. */
export function recordWhisperObservations({ before, closingCast }: SlotSettled): void {
  const game = useGameStore.getState()
  if (!game.playthroughId || game.createdScene || game.replaying || game.playthroughId !== before.playthroughId ||
      game.loads !== before.loads || game.date !== before.date || game.time !== before.time ||
      !game.chars.some(id => game.characters[id] && game.charInfo[id])) return
  const state = ensureWhisperAuthor(game, Math.random), author = state.author!
  const excluded = [...new Set([...before.cast, ...game.cast, ...closingCast.map(c => c.charId)])]
  let presence: WhisperPresence | null = null
  if (game.chars.includes(author.id) && !excluded.includes(author.id) && !charAwayNow(author.id)) {
    const classCode = charClassNow(author.id)
    const job = charJobNow(author.id)
    const location = job ? jobDefOf(job)?.locationId : charHiddenLocationNow(author.id)
    presence = classCode ? { classCode } : { ...(location ? { location } : {}), working: !!job }
  }
  useGameStore.setState({ exVenusWhisper: observeWhisperSlot({ ...game, exVenusWhisper: state }, before.npcRelationships, presence, excluded) })
}
