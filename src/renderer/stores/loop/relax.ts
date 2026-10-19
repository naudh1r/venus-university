import type { TimeSlot } from '@shared/types'
import { playerActs } from '../../mods/hooks'
import { isGraduationSlot } from '../../prompts/graduation'
import { useGameStore } from '../gameStore'
import { runQuietEnding } from './exams'
import { advance } from './hooks'
import { applyCast } from './promptState'
import { currentRun, loopState, runStale } from './state'
import { queueLines, sceneInProgress } from './stream'

/** A slot spent doing nothing in particular: no scene, only the books the phone kept. */

/** The slot's history entry. */
const RELAX_SUMMARY = 'The reader did nothing in particular.'

/** The one line a relaxed slot plays before its ending. */
function relaxLine(time: TimeSlot): string {
  return (
    'You stay in and take it easy, doing nothing in particular. ' +
    (time === 0 ? "Before you know it, it's evening." : "Before you know it, it's time for bed.")
  )
}

/**
 * The landing's Relax: the hour settled as a scene start with nobody cast settles it, then one
 * authored line over the ending an exam runs — the texting ledger, the next slot's opening, one
 * write.
 */
export async function relax(): Promise<void> {
  const run = currentRun()
  const game = useGameStore.getState()
  if (game.busy || !game.awaitingInput || sceneInProgress()) return
  if (game.createdScene || game.replaying || game.activeGameOver !== null) return
  if (isGraduationSlot(game.date, game.time)) return

  game.setInputDraft('')
  game.setAwaitingInput(false)
  game.setBusy(true)
  // Raised before the first await, so the landing reports the wait and no second click lands.
  game.setWaitingForLine(true)
  // Spending the hour is committing to it, as an action is; Relax never passes through
  // `submitAction`, so it tells the mods itself.
  playerActs()
  loopState.jobShift = null
  loopState.projectWork = null

  // Stands up this slot's plans, settles its invitations and fires the texting ledger.
  await applyCast([])
  if (runStale(run)) return

  const live = useGameStore.getState()
  // The slot's history entry, and `sceneInProgress()`'s marker.
  live.setSceneSummary(RELAX_SUMMARY, live.currentSceneTranscript.length)
  queueLines([relaxLine(live.time)])

  live.setSceneEnding(true)
  live.setEndingInFlight(true)
  loopState.endingAbandoned = false
  loopState.endBase = null
  loopState.endLines = null
  live.setBusy(false)
  // Lowered before `advance()`, which is inert while it is up.
  live.setWaitingForLine(false)
  void runQuietEnding()
  advance()
}
