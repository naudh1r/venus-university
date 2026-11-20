/** The mod's saved identity. */
export const AFTER_HOURS_MOD = 'after-hours'

/** The mod's catalogue copy, status labels and night choices. */
export const afterHoursText = {
  name: 'After Hours',
  blurb: "A Busy status for the phone, texting people while they're busy, and a night after the evening. While you're Busy, a chat you start won't turn into meeting up right now, though they can still ask you out themselves. Text someone during their class or work, and they reply once they're out. After the evening, a night in your room to text before you sleep, or, if you spent it with someone, a short goodbye the next morning.",
  offNote: 'Switching it off keeps your status; people can ask you out again, and the evening goes straight to the morning.',
  option: 'Busy status',
  online: 'Online',
  busy: 'Busy',
  hint: "Busy: no meeting up right now in chats you start.",
  busyTextsOption: "Text people when they're busy",
  busyTextsHint: "Text someone during class or work; they reply when they're out, in the next half of the day.",
  nightOption: 'The night',
  nightHint: 'After the evening, stay up texting before you sleep. An evening in their room or yours can last the night.',
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
