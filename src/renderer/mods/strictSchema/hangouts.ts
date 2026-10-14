import { globalSlotOf } from '@shared/jobs'
import type { HangoutContext, HangoutResolution, ModHooks } from '../hooks'
import { useGameStore } from '../../stores/gameStore'
import { invitationCoolingDown, readHangoutDecision } from './hangoutPolicy'

function recordRefusal(charId: string, occasionId?: string, deferred = false): void {
  const game = useGameStore.getState()
  game.setPendingHangout(charId, null)
  game.setIgnoredInvitation(charId, false)
  game.bumpDeclined(charId, globalSlotOf(game.date, game.time))
  if (occasionId) game.markOccasionDeclined(occasionId)
  if (!deferred && game.charInfo[charId]?.flags?.isLover) game.setTurnedDown(charId)
}

export const strictHangoutAnswer: NonNullable<ModHooks['hangoutAnswer']> = ({ charId, yes, pending }) => {
  if (yes) return false
  const game = useGameStore.getState()
  game.appendChatMessage(charId, {
    id: crypto.randomUUID(), sender: 'player', text: 'No thanks, not this time.', date: game.date, time: game.time
  }, 0)
  recordRefusal(charId, pending.occasionId)
  return true
}

export function strictHangoutResult(result: HangoutResolution, ctx: HangoutContext & { reply: unknown }): HangoutResolution {
  const decision = readHangoutDecision(ctx.reply, ctx)
  const charId = ctx.character.charId
  const game = useGameStore.getState()
  if (decision.kind === 'declined' || decision.kind === 'deferred') {
    if (decision.kind === 'declined' || ctx.invited)
      recordRefusal(charId, ctx.invited?.occasionId, decision.kind === 'deferred')
    return { ...result, verdict: null, settled: true }
  }
  if (decision.kind === 'accepted') return {
    ...result, verdict: { initiatedBy: 'player', description: decision.description }, settled: true
  }
  if (decision.kind === 'new_offer' && !ctx.invited && strictHangoutOfferAllowed(charId))
    return { ...result, verdict: { initiatedBy: 'contact', description: decision.description } }
  if (ctx.invited) game.setPendingHangout(charId, ctx.invited)
  return { ...result, verdict: null, settled: true }
}

export function strictHangoutOfferAllowed(charId: string): boolean {
  const game = useGameStore.getState()
  return !invitationCoolingDown(game.bunnyboard.conversations[charId], globalSlotOf(game.date, game.time))
}
