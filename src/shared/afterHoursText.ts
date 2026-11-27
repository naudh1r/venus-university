/** The mod's saved identity. */
export const AFTER_HOURS_MOD = 'after-hours'

/** The mod's catalogue copy, status labels and night choices. */
export const afterHoursText = {
  name: 'After Hours',
  blurb: "A Busy status for the phone, texting people while they're busy, and a night after the evening. While you're Busy, a chat you start won't turn into meeting up right now, though they can still ask you out themselves. Text someone during their class or work, and they reply once they're out. After the evening, a night in your room to text before you sleep, or, if you spent it with someone, a short goodbye the next morning.",
  offNote: 'Switching it off keeps your status. People can ask you out again, and the evening goes straight to the morning.',
  option: 'Busy status',
  online: 'Online',
  busy: 'Busy',
  hint: "Busy: no meeting up right now in chats you start.",
  busyTextsOption: "Text people when they're busy",
  busyTextsHint: "Text someone during class or work. They reply when they're out, in the next half of the day.",
  nightOption: 'The night',
  nightSleepOption: 'Not everyone stays up',
  nightSleepHint: 'At night, some people have gone to sleep. Their light is yellow, and they reply in the morning.',
  nightHint: 'After the evening, stay up texting before you sleep. An evening in their room or yours can last the night.',
  /** One is picked for each night's landing; each leaves the reader awake in their room with their phone. */
  nightLines: [
    "It's late, and you're in your room for the night. The hall outside is quiet now.",
    "It's late. The hall has gone quiet, and the only light left on is your desk lamp.",
    "You're back in your room for the night. Somewhere down the hall, someone still has music on, low.",
    "It's late, and the building has mostly settled down. Your bed's right there, but you're not quite tired yet.",
    "The day's done, and you're in your room for the night. Outside your window, campus is dark and still.",
    "It's late. A door clicks shut somewhere down the hall, and then everything's quiet."
  ],
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
