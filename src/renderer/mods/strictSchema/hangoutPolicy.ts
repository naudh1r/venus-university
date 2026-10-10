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
      'Classify THE MESSAGE and THE REPLY; BACKGROUND only resolves references. outcome is authoritative:',
      'accepted: the reader proposes or accepts meeting this slot and she clearly agrees. declined: the reader refuses. deferred: his message says not now, maybe later, or proposes a future slot. new_offer: her reply newly invites him now, without his refusal. none: otherwise, including her refusal.',
      'A current reader refusal or deferral overrides her renewed offer. An old refusal does not override new consent. References to old plans and vague future possibilities are not new offers.',
      'Evidence: playerQuote copies the entire latest reader message for accepted/declined/deferred; replyQuote copies one complete latest reply bubble for accepted/new_offer. Copy exactly; use empty strings when unnecessary.',
      'Set playerAsked true only for accepted and characterOffered true only for new_offer; otherwise false. description is the base-format plan only for accepted/new_offer, otherwise empty. Preserve other schema fields and return only JSON.'
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
