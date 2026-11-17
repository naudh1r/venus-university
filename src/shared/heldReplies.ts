import type { Conversation, TimeSlot } from './types'

/** A reply waits through the next class only when she and the reader take that same class. */
export function sharedReplyClass(
  commitment: { kind: 'class'; code: string } | { kind: 'shift' } | null,
  readerClass: string | null
): string | null {
  return commitment?.kind === 'class' && commitment.code === readerClass ? commitment.code : null
}

/** A written or still-pending held reply owns her text at its due landing, including overdue recovery. */
export function heldReplyDueAt(held: Conversation['heldReply'], date: number, time: TimeSlot): boolean {
  return held !== undefined && held.until.date * 2 + held.until.time <= date * 2 + time
}
