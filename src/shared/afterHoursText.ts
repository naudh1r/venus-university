/** The mod's saved identity. */
export const AFTER_HOURS_MOD = 'after-hours'

/** The mod's catalogue copy, status labels and night choices. */
export const afterHoursText = {
  name: 'After Hours',
  blurb: 'A Busy status for the phone, and a night in your room after the evening to text before you sleep.',
  offNote: 'Switching it off keeps your status; girls can ask you out again.',
  option: 'Busy status',
  online: 'Online',
  busy: 'Busy',
  hint: "Busy: girls won't ask you to meet up in chats you start.",
  nightOption: 'The night',
  nightHint: 'After the evening, stay up in your room texting until you end the day.',
  nightLine: 'You head back to your room for the night. The hall outside is quiet now.',
  endTheDay: 'End the day (Skip to tomorrow)',
  endTheDayConfirm: {
    title: 'End the day?',
    message: "You'll go to sleep and wake up tomorrow morning.",
    confirmText: 'Sleep',
    cancelText: 'Never mind'
  },
  relax: 'Relax (Skip to bedtime)'
}

/** Keeps her from suggesting a meet-up while the reader is Busy, without making it a topic. */
export function busyPrompt(name: string): string {
  return `In the background: the reader is staying in for now, so ${name} does not suggest meeting up right now. Making plans for another time is fine. It is not something she talks about.`
}

/** Keeps the late-night exchange in their rooms without making the hour a topic. */
export function nightPrompt(name: string): string {
  return `It is late at night, and students are expected to be in their own dorm rooms by now. ${name} and the reader are both in their rooms, and neither of them is going anywhere tonight, so she does not suggest meeting up. It is just the hour, not something to remark on.`
}
