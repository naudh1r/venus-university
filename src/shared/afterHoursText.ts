/** The mod's catalogue copy and status labels. */
export const afterHoursText = {
  name: 'After Hours',
  blurb: "A Busy status for the phone, so girls don't ask you out in chats you start.",
  offNote: 'Switching it off keeps your status; girls can ask you out again.',
  option: 'Busy status',
  online: 'Online',
  busy: 'Busy',
  hint: "Busy: girls won't ask you to meet up in chats you start."
}

/** Keeps her from suggesting a meet-up while the reader is Busy, without making it a topic. */
export function busyPrompt(name: string): string {
  return `In the background: the reader is staying in for now, so ${name} does not suggest meeting up right now. Making plans for another time is fine. It is not something she talks about.`
}
