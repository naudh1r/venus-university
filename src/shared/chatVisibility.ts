import type { ChatMessage, Conversation, TimeSlot } from './types'

export type ChatClock = { date: number; time: TimeSlot }

/** The slot a phone stamp names; late texts read as the half before their ledger slot. */
export function messageSlotOf(message: Pick<ChatMessage, 'date' | 'time' | 'late'>): ChatClock {
  if (!message.late) return { date: message.date, time: message.time }
  return message.time === 0 ? { date: message.date - 1, time: 1 } : { date: message.date, time: 0 }
}

/** A future-stamped message becomes visible when the opened clock reaches its slot. */
export function messageShown(message: Pick<ChatMessage, 'date' | 'time' | 'late'>, clock: ChatClock): boolean {
  const slot = messageSlotOf(message)
  return slot.date * 2 + slot.time <= clock.date * 2 + clock.time
}

/** The last landing opened to texts, rather than a clock advanced under the curtain. */
export function chatClockOf(game: ChatClock & { chatShownThrough?: ChatClock | null }): ChatClock {
  return game.chatShownThrough ?? game
}

/** The messages a thread can expose at the opened chat clock. */
export function shownMessages<T extends Pick<ChatMessage, 'date' | 'time' | 'late'>>(
  messages: readonly T[], clock: ChatClock
): readonly T[] {
  return messages.every(message => messageShown(message, clock))
    ? messages : messages.filter(message => messageShown(message, clock))
}

const threads = new WeakMap<Conversation, { slot: number; value: Conversation }>()

/** Caches each native thread's projection by the opened slot. */
export function shownConversation(thread: Conversation | undefined, clock: ChatClock): Conversation | undefined {
  if (!thread) return undefined
  const slot = clock.date * 2 + clock.time
  const cached = threads.get(thread)
  if (cached?.slot === slot) return cached.value
  const messages = shownMessages(thread.messages, clock)
  const previous = cached?.value
  const value = messages === thread.messages ? thread
    : previous && previous.messages.length === messages.length && previous.messages.every((message, index) => message === messages[index])
      ? previous : { ...thread, messages: [...messages] }
  threads.set(thread, { slot, value })
  return value
}

/** Adds only newly shown contact texts; held replies account for their own delivery. */
export function unreadAfterOpening(thread: Conversation, before: ChatClock, clock: ChatClock): number {
  return thread.unread + thread.messages.filter(message => message.sender === 'contact' &&
    !thread.heldReply?.messageIds.includes(message.id) &&
    !messageShown(message, before) && messageShown(message, clock)).length
}
