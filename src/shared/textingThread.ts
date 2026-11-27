import type { ChatMessage, TimeSlot } from './types'
import { messageSlotOf } from './chatVisibility'

/**
 * Finds who opened this slot's thread, skipping system lines; an empty thread defaults to the reader.
 * Her first text here counts as the reader's thread when it answers his earlier texts (a reply that
 * arrived late) rather than reaching out or inviting.
 */
export function threadStartedBy(
  messages: readonly ChatMessage[],
  date: number,
  time: TimeSlot
): 'reader' | 'her' {
  const index = messages.findIndex(message => {
    const at = messageSlotOf(message)
    return at.date === date && at.time === time && message.sender !== 'system'
  })
  const first = messages[index]
  if (first?.sender !== 'contact') return 'reader'
  if (first.reachOut || first.invite) return 'her'
  const before = messages.slice(0, index).reverse().find(message => message.sender !== 'system')
  return before?.sender === 'player' ? 'reader' : 'her'
}

/** The unclaimed texts filed at a slot's ending, or only its held late-night exchange. */
export function ledgerMessages(
  messages: readonly ChatMessage[], date: number, time: TimeSlot, night = false
): ChatMessage[] {
  return messages.filter(message => message.date === date && message.time === time &&
    !message.ledgered && (!night || message.late === true))
}

/** Marks the exact messages a completed ledger took, leaving later arrivals unclaimed. */
export function claimLedgerMessages(messages: readonly ChatMessage[], ids: ReadonlySet<string>): ChatMessage[] {
  return messages.map(message => ids.has(message.id) ? { ...message, ledgered: true } : message)
}
