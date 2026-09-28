import type { ChatMessage } from './types'

/**
 * How the reader answered her invitation, as the thread records it under `strictSchema`.
 *
 * Without the switch a Yes writes "Sure" into the thread as though he had typed it, and the
 * summary a scene reads quotes it back as his. With it both answers are `system` lines — the voice
 * a rescheduled plan is already announced in — because the answer is a button he pressed, not
 * something he said: the app owns the fact that he was asked and what he chose, and the words in
 * the thread stay his own. The line is marked with the answer so the summary can report it without
 * reading it off the wording.
 *
 * Declared from here rather than in `types.ts`, so the build's own file carries none of it.
 */
declare module './types' {
  interface ChatMessage {
    /** On the app's line recording his answer to her invitation: which answer it was. */
    answered?: 'yes' | 'no'
  }
}

/** The app's line saying he took her invitation up, or did not. */
export function invitationAnswerText(firstName: string | undefined, yes: boolean): string {
  const whose = firstName ? `${firstName}'s invitation` : 'her invitation'
  return yes ? `You took up ${whose}.` : `You didn't take up ${whose}.`
}

/** The message marked as his answer to her invitation. */
export function asInvitationAnswer(message: ChatMessage, yes: boolean): ChatMessage {
  return { ...message, answered: yes ? 'yes' : 'no' }
}

/** How a line in the thread answered her invitation, or undefined for any other line. */
export function invitationAnswerOf(message: ChatMessage | undefined): 'yes' | 'no' | undefined {
  return message?.answered
}
