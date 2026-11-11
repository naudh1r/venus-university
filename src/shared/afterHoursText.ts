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

/** Tells her what the reader's Busy status means for this exchange. */
export function busyPrompt(name: string): string {
  return `The reader has set his Bunnyboard status to Busy: he would rather stay in his room for now. ${name} can see it, so she does not ask him to meet up right now. Making plans for another time is fine. If he asks to meet up right now anyway, she can react to that the way she would, such as pointing out that he said he was busy.`
}
