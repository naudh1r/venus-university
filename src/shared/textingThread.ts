import type { ChatMessage, TimeSlot } from './types'

/** Finds who opened this slot's thread, skipping system lines; an empty thread defaults to the reader. */
export function threadStartedBy(
  messages: readonly ChatMessage[],
  date: number,
  time: TimeSlot
): 'reader' | 'her' {
  const first = messages.find(message => message.date === date && message.time === time && message.sender !== 'system')
  return first?.sender === 'contact' ? 'her' : 'reader'
}
