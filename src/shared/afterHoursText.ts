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
  busyTextsOption: "Text her when she's busy",
  busyTextsHint: "Text her during class or work; she replies when she's out, in the next half of the day.",
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

/** The choices after waking together and the scenes' opening actions. */
export const morningText = {
  stay: (name: string) => `Stay with ${name}`,
  headBack: 'Head back to your room',
  action: (name: string) => `You stay with ${name} in her room.`,
  wakeAction: (name: string) => `You wake up next to ${name}.`
}

export const visitFieldInstruction = "Set nightVisit to herRoom or hisRoom only for the room they agreed to meet in this exchange; set it to none if they agreed on no visit."
export const visitLedgerInstruction = 'Set stayedOver to whether they spent the night together in that room.'
export const roomText = (room: 'herRoom' | 'hisRoom'): string => room === 'herRoom' ? 'her room' : 'his room'
export const visitScenePrompt = (room: 'herRoom' | 'hisRoom'): string => `It is late at night and this visit is in ${roomText(room)}. The scene ends when they fall asleep for the night, or sooner if it goes badly.`
export const visitMorningPrompt = (name: string, room: 'herRoom' | 'hisRoom'): string => `Last night the reader was with ${name} in ${roomText(room)} (see the latest scene). Open on him in his own room this morning; whatever happened last night is behind him.`

/** Her morning commitments shape how waking together ends. */
export function morningScenePrompt(
  name: string,
  room: 'herRoom' | 'hisRoom',
  commitment: { kind: 'class'; name: string } | { kind: 'shift'; employer: string } | null
): string {
  const opening = `It is early morning after the night ${name} and the reader spent together in ${roomText(room)}.`
  const plans = commitment
    ? `${name} has ${commitment.kind === 'class' ? commitment.name : `her shift at ${commitment.employer}`} this morning and will need to leave for it soon. The scene ends when one of them has to go.`
    : `${name} has nothing she has to be at this morning. The scene ends when one of them has to go, or once they settle into the morning together.`
  return `${opening} ${plans}${room === 'hisRoom' ? ` ${name} will head off to start her day.` : ''}`
}

/** The ordinary opening narrates their parting after the scenes together. */
export function morningReturnPrompt(name: string, room: 'herRoom' | 'hisRoom'): string {
  const departure = room === 'herRoom'
    ? 'the reader leaves her and gets back to his own room and into the morning'
    : 'she leaves his room and the reader gets into the morning'
  return `Last night the reader was with ${name} in ${roomText(room)}, and they woke up there together (see the latest scenes). Open by telling, in a line or two, how ${departure}, in whatever way fits what happened between them; then the morning as usual.`
}

/** Her reply catches up after the commitment, without making it a required topic. */
export function busyTextPrompt(
  name: string,
  commitment: { kind: 'class'; name: string } | { kind: 'shift'; employer: string }
): string {
  const place = commitment.kind === 'class' ? `in ${commitment.name}` : `at her shift at ${commitment.employer}`
  const after = commitment.kind === 'class' ? 'class' : 'work'
  return `${name} is ${place} right now and cannot text. She will read the reader's messages once it is over, in the next half of the day, and the reply you write is the one she sends then: as she would after ${after}, catching up on what he said. It is not something she needs to dwell on unless she wants to.`
}
