import type { Conversation, StructuredRequest } from '@shared/types'
import type { HangoutContext } from '../hooks'
import { askCooldownOver, declineCooldownSlots, lastInvitationResponseSlotOf } from '../../stores/slotAskers'

export function invitationCoolingDown(conversation: Conversation | undefined, slot: number): boolean {
  return (conversation?.declined ?? 0) > 0 && !askCooldownOver(
    lastInvitationResponseSlotOf(conversation), slot, declineCooldownSlots(conversation?.declined ?? 0)
  )
}

/** Keep the base flags for other handlers, while requiring a reason grounded in this exchange. */
export function strictHangoutRequest(request: StructuredRequest): StructuredRequest {
  const result = { ...request }
  delete result.minThinking
  const fields = {
    outcome: { type: 'string', enum: ['accepted', 'declined', 'deferred', 'new_offer', 'none'] },
    playerQuote: { type: 'string' }, replyQuote: { type: 'string' }
  }
  return {
    ...result,
    system: [request.system, '', 'LATEST EXCHANGE DECISION',
      'The outcome field is authoritative. Read THE MESSAGE and THE REPLY, using BACKGROUND only to resolve references.',
      'outcome: accepted when the reader proposes or accepts meeting in the current slot and she clearly agrees; declined when the reader refuses; deferred when THE MESSAGE says not now, maybe later, or proposes a future slot; new_offer only for her new immediate invitation without a reader refusal; otherwise none.',
      'If she refuses the reader\'s proposal, use none. declined always means the reader refused, not her.',
      'A refusal or deferral in THE MESSAGE takes precedence over her asking again in THE REPLY. Never classify it as accepted or new_offer.',
      'An old refusal does not override a new explicit agreement in THE MESSAGE. The reader may change his mind.',
      'playerQuote must copy the entire text of THE MESSAGE exactly for accepted, declined, and deferred. replyQuote must copy one complete text bubble from THE REPLY exactly for accepted and new_offer. Use empty strings when no evidence is needed.',
      'Set playerAsked true only for accepted, characterOffered true only for new_offer. Both are false for all other outcomes. Keep description empty unless accepted or new_offer.',
      'A reference to an old invitation, acknowledgement of a refusal, or vague future possibility is not a new offer.',
      'Return only the JSON object matching the supplied schema.'
    ].join('\n'),
    schema: { ...request.schema, schema: {
      ...request.schema.schema,
      required: [...new Set([...(request.schema.schema.required as string[] ?? []), 'outcome', 'playerQuote', 'replyQuote'])],
      properties: { ...fields, ...(request.schema.schema.properties as Record<string, unknown>), ...fields }
    } }
  }
}

type Decision = { kind: 'accepted' | 'declined' | 'deferred' | 'new_offer' | 'none'; description: string }

/** Narrow, obvious refusals are protected even if the classifier contradicts its own evidence. */
function obviousRefusal(ctx: HangoutContext): 'declined' | 'deferred' | null {
  const text = ctx.sent.text.trim().toLowerCase().replaceAll('’', "'")
  const aboutMeeting = Boolean(ctx.invited) || /\b(?:hang\s*out|meet|come over|go out|coffee)\b/.test(text)
  const brief = /^(?:no(?:pe)?(?: thanks| thank you)?|not now|not today|maybe later|another time)[.!]*$/.test(text)
  if (!aboutMeeting && !brief) return null
  if (/^(?:not now|not today|maybe later|another time)\b/.test(text)) return 'deferred'
  if (/^(?:no(?:pe)?(?: thanks| thank you)?[.!]*$|no thanks[, ]+not this time|no[, ]+i (?:have work|have class|can't|cannot)|i (?:can't|cannot)\b|can't\b|cannot\b|i(?:'m| am) busy[.!]*$)/.test(text)) return 'declined'
  return null
}

export function readHangoutDecision(reply: unknown, ctx: HangoutContext): Decision {
  const refused = obviousRefusal(ctx)
  if (refused) return { kind: refused, description: '' }
  const value = reply && typeof reply === 'object' ? reply as Record<string, unknown> : {}
  const playerEvidence = typeof value.playerQuote === 'string' && value.playerQuote.trim() === ctx.sent.text.trim()
  const replyEvidence = typeof value.replyQuote === 'string' && value.replyQuote.trim().length > 0 &&
    ctx.replies.some(message => message.text.trim() === (value.replyQuote as string).trim())
  if ((value.outcome === 'declined' || value.outcome === 'deferred') && playerEvidence)
    return { kind: value.outcome, description: '' }
  const description = typeof value.description === 'string' ? value.description.trim() : ''
  if (value.outcome === 'accepted' && value.playerAsked === true && value.characterOffered === false && playerEvidence && replyEvidence && description)
    return { kind: 'accepted', description }
  if (value.outcome === 'new_offer' && value.characterOffered === true && value.playerAsked === false && replyEvidence && description)
    return { kind: 'new_offer', description }
  return { kind: 'none', description: '' }
}
