import type { ChatMessage, Conversation, TextingResponse, TimeSlot } from '@vx/modkit/shared'

export const TEXT_REGENERATION_MOD = 'text-regeneration'

export interface ReplyTarget {
  conversation: Conversation
  sent: ChatMessage
  index: number
  replies: ChatMessage[]
}

/** Only a completed trailing reply in this slot may be rewritten. */
export function latestTextReply(
  conversation: Conversation | undefined, date: number, time: TimeSlot
): ReplyTarget | null {
  if (!conversation || conversation.pendingHangout) return null
  const messages = conversation.messages
  let index = messages.length - 1
  while (index >= 0 && messages[index].sender === 'contact' && !messages[index].invite) index--
  const sent = messages[index]
  const replies = messages.slice(index + 1)
  if (!sent || sent.sender !== 'player' || sent.error || !replies.length) return null
  if ([sent, ...replies].some(m => m.date !== date || m.time !== time || m.error)) return null
  if (replies.some(m => m.exReplyTo && m.exReplyTo !== sent.id)) return null
  // Answering an invitation can have consequences beyond the message list.
  if (messages[index - 1]?.invite) return null
  const base = conversation.exTextBase
  if (base?.replyTo === sent.id && base.regenerable === false) return null
  return { conversation, sent, index, replies }
}

/** A summary after the rejected reply must never be fed back into its replacement. */
export function beforeTextReply(target: ReplyTarget): Conversation {
  const base = target.conversation.exTextBase
  const summary = base?.replyTo === target.sent.id && typeof base.summary === 'string'
    ? base.summary : null
  return { ...target.conversation, messages: target.conversation.messages.slice(0, target.index), summary }
}

/** Ignore read receipts, but fence every story-bearing change to this thread. */
export function textReplyFingerprint(conversation: Conversation | undefined): string {
  return JSON.stringify({ ...conversation, unread: 0 })
}

export function checkedTextReplacement(value: TextingResponse): { messages: string[]; summary: string } {
  if (value.blocked) throw Error('The replacement would block you. Your original reply was kept.')
  if (!Array.isArray(value.messages) || !value.messages.length || value.messages.length > 12 ||
      value.messages.some(text => typeof text !== 'string' || !text.trim() || text.length > 4000) ||
      typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 12000) {
    throw Error('The replacement was incomplete or too long. Your original reply was kept.')
  }
  return { messages: value.messages.map(text => text.trim()), summary: value.summary.trim() }
}

/** Replace the complete response as one unit, retaining the player's message and earlier turns. */
export function replaceTextReply(
  target: ReplyTarget, replacement: { messages: string[]; summary: string }, id: () => string
): Conversation {
  return {
    ...target.conversation,
    messages: [...target.conversation.messages.slice(0, target.index + 1), ...replacement.messages.map(text => ({
      id: id(), sender: 'contact' as const, text, date: target.sent.date, time: target.sent.time,
      exReplyTo: target.sent.id
    }))],
    summary: replacement.summary
  }
}
