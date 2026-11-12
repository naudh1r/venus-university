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
  nightHint: 'After the evening, stay up texting before you sleep. An evening in her room or yours can last the night.',
  nightLine: 'You head back to your room for the night. The hall outside is quiet now.',
  sleep: 'Sleep',
  skipTomorrow: 'Skip to tomorrow',
  relax: 'Relax (Skip to bedtime)'
}

/** Keeps her from suggesting a meet-up while the reader is Busy, without making it a topic. */
export function busyPrompt(name: string): string {
  return `In the background: the reader is staying in for now, so ${name} does not suggest meeting up right now. Making plans for another time is fine. It is not something she talks about.`
}

/** Keeps the late-night exchange in their rooms without making the hour a topic. */
export function nightPrompt(name: string): string {
  return `It is late at night, and students are expected to be in their own dorm rooms by now. ${name} and the reader are both in their rooms, and neither is going anywhere tonight, so she does not suggest meeting up now. Making plans for another time is fine. It is just the hour, not something to remark on.`
}

export const stayOverPrompt = "This is the evening. If the scene ends in her dorm room or the reader's, and both of them want it, they can spend the night there together. It is only an option, never a goal."
export const stayOverLedgerInstruction = 'Set stayedOverWith to the key of the girl the reader is spending tonight with as the scene ends, and stayedOverIn to whose room it is in; set both to none if he is spending the night alone.'
const roomText = (room: 'herRoom' | 'hisRoom'): string => room === 'herRoom' ? 'her room' : 'his room'

/** The morning opening narrates their parting after a night together. */
export function morningReturnPrompt(name: string, room: 'herRoom' | 'hisRoom'): string {
  const departure = room === 'herRoom'
    ? 'the reader leaves her and gets back to his own room and into the morning'
    : 'she leaves his room and the reader gets into the morning'
  return `Last night the reader was with ${name} in ${roomText(room)}, and they woke up there together (see the latest scene). Open by telling, in a line or two, how ${departure}, in whatever way fits what happened between them; then the morning as usual.`
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
