import type { ChatMessage, TimeSlot } from './types'

export type ChatClock = { date: number; time: TimeSlot }

/** A future-stamped message becomes visible when the opened clock reaches its slot. */
export function messageShown(message: Pick<ChatMessage, 'date' | 'time' | 'late'>, clock: ChatClock): boolean {
  return message.date * 2 + message.time - (message.late ? 1 : 0) <= clock.date * 2 + clock.time
}

/** The last landing opened to texts, rather than a clock advanced under the curtain. */
export function chatClockOf(game: ChatClock & { chatShownThrough?: ChatClock | null }): ChatClock {
  return game.chatShownThrough ?? game
}
