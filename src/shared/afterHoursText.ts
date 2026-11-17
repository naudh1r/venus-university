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
  hint: "Busy: no meeting up right now in chats you start.",
  busyTextsOption: "Text her when she's busy",
  busyTextsHint: "Text her during class or work; she replies when she's out, in the next half of the day.",
  nightOption: 'The night',
  nightHint: 'After the evening, stay up texting before you sleep. An evening in her room or yours can last the night.',
  nightLine: "It's late, and you're in your room for the night. The hall outside is quiet now.",
  /** One is picked for each night; each ends at falling asleep, leaving the morning to the curtain. */
  sleepLines: [
    "You put your phone away and turn off the light. Before you know it, you're asleep.",
    "You plug in your phone and pull the covers up. Before you know it, you've drifted off.",
    "You set your alarm and roll over. The hall goes quiet, and so do you.",
    'You turn off the light and lie there a while, thinking about nothing much. Sleep comes easy.',
    "You put your phone face down on the nightstand and close your eyes. It doesn't take long.",
    "You turn in for the night. Somewhere down the hall a door clicks shut, and then you're out."
  ],
  relaxLine: "You stay in and take it easy, doing nothing in particular. Before you know it, the evening's gone.",
  goToSleep: 'Go to sleep',
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

/** The morning after a night together, staged: waking there, her own parting lines, then home. */
export function morningReturnPrompt(name: string, key: string, room: 'herRoom' | 'hisRoom'): string {
  const speech = `three or four lines of her talking to him, one after another: only her words, each with "speaker" set to "${key}" and "emotion" to how she looks saying it`
  return room === 'herRoom'
    ? `Last night the reader stayed over with ${name} in her room (see the latest scene). This morning's opening is the one time dialogue and someone else on screen are allowed. Write it as short lines, one beat each: first, one line of him waking up there beside her; then, as he leaves, ${speech}; then one line of him getting back to his own room; then the morning as usual. Do not sum up or describe what happened between them last night. Every entry in "lines" has "speaker" and "emotion": "" for both on narration; her own words are never written into a narration line. For example: {"text": "Pull the door shut on your way out.", "speaker": "${key}", "emotion": "happy"}. Set "homeLine" to the index in "lines" of the line where he is back in his own room.`
    : `Last night ${name} stayed over in the reader's room (see the latest scene). This morning's opening is the one time dialogue and someone else on screen are allowed. Write it as short lines, one beat each: first, one line of them waking up there together; then, as she leaves, ${speech}; then one line of her heading off; then the morning as usual. Do not sum up or describe what happened between them last night. Every entry in "lines" has "speaker" and "emotion": "" for both on narration; her own words are never written into a narration line. For example: {"text": "I'll text you after class.", "speaker": "${key}", "emotion": "happy"}. Set "homeLine" to the index in "lines" of the first line after she has gone.`
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
