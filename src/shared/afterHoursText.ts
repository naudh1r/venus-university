/** The mod's saved identity. */
export const AFTER_HOURS_MOD = 'after-hours'

/** The mod's catalogue copy, status labels and night choices. */
export const afterHoursText = {
  name: 'After Hours',
  blurb: 'A Busy status for the phone, and a night in your room after the evening to text before you sleep.',
  offNote: 'Switching it off keeps your status; girls can ask you out again, and the evening goes straight to the morning.',
  option: 'Busy status',
  online: 'Online',
  busy: 'Busy',
  hint: "Busy: girls won't ask you to meet up in chats you start.",
  nightOption: 'The night',
  nightHint: "After the evening, stay up texting, visit each other's rooms, or end the day.",
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
  return `It is late at night, and students are expected to be in their own dorm rooms by now. ${name} and the reader are both in their rooms. Tonight the only place either could go is the other's room, and only if both want that. It is just the hour, not something to remark on.`
}

/** The rows and transitions after waking together. */
export const morningText = {
  stay: (name: string) => `Stay with ${name}`,
  headBack: 'Head back to your room',
  startDay: 'Start the day',
  chose: (name: string) => [
    `You say goodbye to ${name} and head back to your room to shower and change.`,
    `You slip out of ${name}'s room and go back to your own to get cleaned up before the day starts.`
  ],
  class: (name: string) => `${name} has to get to class, so you head back to your room to shower and change.`,
  shift: (name: string) => `${name} has to get to work, so you head back to your room to shower and change.`,
  leaves: (name: string) => `${name} heads off to start her day.`,
  action: (name: string) => `You stay with ${name} in her room.`
}

export const visitFieldInstruction = "Set nightVisit to herRoom or hisRoom only for the room they agreed to meet in this exchange; set it to none if they agreed on no visit."
export const visitLedgerInstruction = 'Set stayedOver to whether they spent the night together in that room. Write wake as three or four short second-person narration lines that open the next morning: first one or two saying how last night ended between them, then them waking up there. Narration only, no dialogue. Use an empty array when stayedOver is false.'
export const roomText = (room: 'herRoom' | 'hisRoom'): string => room === 'herRoom' ? 'her room' : 'his room'
export const visitScenePrompt = (room: 'herRoom' | 'hisRoom'): string => `It is late at night and this visit is in ${roomText(room)}. The scene ends when they fall asleep for the night, or sooner if it goes badly.`
export const visitMorningPrompt = (name: string, room: 'herRoom' | 'hisRoom'): string => `Last night the reader was with ${name} in ${roomText(room)} (see the latest scene). Open on him in his own room this morning; whatever happened last night is behind him.`
