import type { ChatMessage, TimeSlot } from './types'
import { messageSlotOf } from './chatVisibility'

/** Finds who opened this slot's thread, skipping system lines; an empty thread defaults to the reader. */
export function threadStartedBy(
  messages: readonly ChatMessage[],
  date: number,
  time: TimeSlot
): 'reader' | 'her' {
  const first = messages.find(message => {
    const at = messageSlotOf(message)
    return at.date === date && at.time === time && message.sender !== 'system'
  })
  return first?.sender === 'contact' ? 'her' : 'reader'
}

/** Finds the latest player turn whose held reply still needs to be written. */
export function waitingText(messages: readonly ChatMessage[]): ChatMessage | undefined {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index]
    if (message.sender === 'player' && message.awaitingReply === true) return message
  }
  return undefined
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
