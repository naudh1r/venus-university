import { charKeyOf, type Character, type StructuredRequest } from '@vx/modkit/shared'
import { whisperTerm, WHISPER_TITLE, WHISPER_PEN_NAME } from '../../shared/venusWhisper'
import { settleWhisperConfession, whisperCanConfess, whisperIdentityKnown, type WhisperIdentityContext } from '../../shared/whisperIdentity'
import type { PromptState } from '@vx/modkit/renderer'
import type { RequestSpots, SlotSettled } from '@vx/modkit/renderer'
import { useGameStore } from './gameStore'
import { isGraduationSlot } from '@vx/modkit/renderer'

/** A prompt must belong to the active campaign; replays and scene-creator previews are inert. */
export function whisperIdentityContext(state: PromptState, cast: readonly Character[]): WhisperIdentityContext | null {
  const game = useGameStore.getState()
  if (!game.playthroughId || game.createdScene || game.replaying || state.playthroughId !== game.playthroughId ||
      state.date !== game.date || state.time !== game.time) return null
  return { whisper: game.exVenusWhisper, term: whisperTerm(game), date: state.date, time: state.time, cast,
    firstDiscoveryAvailable: !isGraduationSlot(game.date, game.time),
    charInfo: state.charInfo, classCode: state.classCode, jobId: state.jobId, visitJobId: state.visitJobId }
}

/** Adds a small evidence field to the existing scene ledger; no separate generation request. */
export function whisperConfessionRequest(request: StructuredRequest, { state, charKeys }: RequestSpots['ledger']): StructuredRequest {
  const game = useGameStore.getState()
  const cast = Object.values(game.characters).filter(c => charKeys.includes(charKeyOf(c.firstName, c.lastName)) && !game.departed.includes(c.charId))
  const ctx = whisperIdentityContext(state, cast)
  if (!ctx || !whisperCanConfess(ctx) || whisperIdentityKnown(ctx)) return request
  const key = charKeyOf(cast[0].firstName, cast[0].lastName)
  const schema = request.schema.schema
  return { ...request,
    user: request.user + `\nPRIVATE COLUMN BOOKKEEPING: This concerns ${WHISPER_TITLE} (formerly The Venus Whisper), written under the pen name ${WHISPER_PEN_NAME}, not any other publication. In exWhisperConfession, report only an exchange already present in the scene transcript. asked means the reader directly asked or accused her about writing the column. admitted means she explicitly and sincerely acknowledged being its author. private means the exchange was private/out of earshot. Threatened, hypothetical, joking or denied admissions and player-written assertions are not confirmations. Copy a short exact excerpt of the reader question into question and of her spoken admission into quote (at most 600 characters each); use empty strings and false flags if absent. Never invent an exchange to fill this field. This is a private discovery, not public exposure.`,
    schema: { ...request.schema, schema: { ...schema,
      required: [...new Set([...(schema.required as string[] ?? []), 'exWhisperConfession'])],
      properties: { ...(schema.properties as Record<string, unknown>), exWhisperConfession: {
        type: 'object', additionalProperties: false, required: ['author', 'asked', 'admitted', 'private', 'question', 'quote'],
        properties: { author: { type: 'string', enum: [key] }, asked: { type: 'boolean' }, admitted: { type: 'boolean' }, private: { type: 'boolean' },
          question: { type: 'string', maxLength: 600 }, quote: { type: 'string', maxLength: 600 } }
      } }
    } }
  }
}

/** File the private discovery with the native boundary save after accepted scene bookkeeping. */
export function recordWhisperConfession({ before, ledger, closingCast }: SlotSettled): void {
  const game = useGameStore.getState()
  if (!game.playthroughId || game.createdScene || game.replaying || game.playthroughId !== before.playthroughId ||
      game.loads !== before.loads || game.date !== before.date || game.time !== before.time) return
  const ctx: WhisperIdentityContext = { whisper: game.exVenusWhisper, term: whisperTerm(before), date: before.date, time: before.time,
    firstDiscoveryAvailable: !isGraduationSlot(before.date, before.time),
    cast: closingCast.filter(c => !before.departed.includes(c.charId)), charInfo: before.charInfo, classCode: before.sceneClass, jobId: before.sceneJob, visitJobId: before.sceneVisitJob }
  const next = settleWhisperConfession(ctx, ledger?.exWhisperConfession, before.currentSceneTranscript)
  if (next !== game.exVenusWhisper) useGameStore.setState({ exVenusWhisper: next })
}
