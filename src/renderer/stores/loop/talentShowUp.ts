import { showUpHeart } from '@shared/talentShowUp'
import type { LedgerResponse } from '@shared/types'
import { useGameStore } from '../gameStore'
import { ledgerMemories } from '../sceneSanitizer'
import { loopState } from './state'

/** Uses the same persisted meeting and validated ledger in previews and settlement. */
export function showUpHeartForScene(
  ledger: LedgerResponse | null,
  sick: boolean,
  game = useGameStore.getState(),
  projectWork = loopState.projectWork !== null
): number {
  if (!ledger || !game.playthroughId || game.replaying || game.createdScene || sick ||
      game.sceneClass !== null || game.sceneJob !== null || game.sceneProject !== null || projectWork) return 0
  return showUpHeart(game.exTalents, {
    term: game.semesterIndex, date: game.date, time: game.time,
    cast: game.cast, acceptedInvite: game.sceneTextLedgerSkip, events: game.events,
    memories: ledgerMemories(ledger, false)
  })
}
