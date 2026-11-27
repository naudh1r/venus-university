import { charKeyOf, globalSlotOf, pronounsOf, readerWordsOf, seededRand, type Character, type ReaderPronouns, type TimeSlot } from '@vx/modkit/shared'

import { AFTER_HOURS_MOD } from './afterHoursText'

export { AFTER_HOURS_MOD }

/** A night spent together, kept until the morning it ends on has opened. */
export interface StayOver {
  charId: string
  room: 'herRoom' | 'hisRoom'
  morning: number
}

interface NightSleep {
  date: number
  cast: string[]
  asleep?: string[]
}

/** The reader's phone status and what is kept about the current night. */
export interface AfterHours {
  busy: boolean
  nightDone?: number
  stayOver?: StayOver
  sleep?: NightSleep
}

/** Restores the phone status and valid night data. */
export function normalize(stored: unknown): AfterHours {
  const data = typeof stored === 'object' && stored !== null ? stored as Partial<AfterHours> : {}
  const sleep = data.sleep
  const validSleep = sleep && Number.isInteger(sleep.date) &&
    Array.isArray(sleep.cast) && sleep.cast.every(id => typeof id === 'string')
  const asleep = validSleep && Array.isArray(sleep.asleep) && sleep.asleep.every(id => typeof id === 'string')
    ? sleep.asleep : undefined
  const stay = data.stayOver
  const validStay = stay && typeof stay === 'object' && typeof stay.charId === 'string' && stay.charId.length > 0 &&
    (stay.room === 'herRoom' || stay.room === 'hisRoom') && Number.isInteger(stay.morning)
  return {
    busy: data.busy === true,
    ...(typeof data.nightDone === 'number' && Number.isInteger(data.nightDone) ? { nightDone: data.nightDone } : {}),
    ...(validSleep ? { sleep: { date: sleep.date, cast: sleep.cast, ...(asleep ? { asleep } : {}) } } : {}),
    ...(validStay ? { stayOver: { charId: stay.charId, room: stay.room, morning: stay.morning } } : {})
  }
}

const AWAKE_AFTER_MEETING = 0.8
const AWAKE_WHEN_CLOSE = 0.6
const AWAKE_OTHERWISE = 0.5

/** Decides whether a contact has gone to sleep based on the evening just ended. */
export function asleepTonight(
  charKey: string, date: number, { metThisEvening, close }: { metThisEvening: boolean; close: boolean }
): boolean {
  const awake = metThisEvening ? AWAKE_AFTER_MEETING : close ? AWAKE_WHEN_CLOSE : AWAKE_OTHERWISE
  return seededRand(`${AFTER_HOURS_MOD}:sleep:${date}:${charKey}`)() >= awake
}

/** The character in the cast the ledger says is staying over, in a room they can share. */
export function stayOverOf(ledger: unknown, cast: readonly Character[]): { partner: Character; room: 'herRoom' | 'hisRoom' } | null {
  if (!ledger || typeof ledger !== 'object') return null
  const { stayedOverWith, stayedOverIn } = ledger as { stayedOverWith?: unknown; stayedOverIn?: unknown }
  if (typeof stayedOverWith !== 'string' || stayedOverWith === 'none' ||
    (stayedOverIn !== 'herRoom' && stayedOverIn !== 'hisRoom')) return null
  const partner = cast.find(contact => charKeyOf(contact.firstName, contact.lastName) === stayedOverWith)
  return partner ? { partner, room: stayedOverIn } : null
}

/** A morning after an evening still owes its night until that morning's marker is recorded. */
export function nightOwed(to: { date: number; time: TimeSlot }, data: AfterHours): boolean {
  return to.time === 0 && to.date > 0 && data.nightDone !== globalSlotOf(to.date, to.time)
}

/** Busy keeps a chat the reader opened from becoming a meet-up now. */
export function busyPromptApplies(busy: boolean, startedBy: 'reader' | 'her'): boolean {
  return busy && startedBy === 'reader'
}

/**
 * The first opening line after the staged part of a morning after a night together: the line the
 * reply names as the one where they have parted, else the line after the partner's last words, else the line
 * after waking.
 */
export function stagedUntil(reply: { homeLine?: unknown; lines?: unknown }, key: string): number {
  const lines = Array.isArray(reply.lines) ? reply.lines : []
  let last = -1
  lines.forEach((line, index) => {
    if (line && typeof line === 'object' && (line as { speaker?: unknown }).speaker === key) last = index
  })
  // A named line before the partner's last words would cut the staged dialogue.
  const named = reply.homeLine
  if (typeof named === 'number' && Number.isInteger(named) && named > Math.max(last, 0) && named <= lines.length) return named
  return Math.min(lines.length, last >= 0 ? last + 1 : 1)
}

type Contact = Pick<Character, 'firstName' | 'gender'>

/** A contact's words in a prompt about the two of them. */
function contactWords(contact: Contact) {
  const p = pronounsOf(contact)
  return { subject: p.they, Subject: p.They, object: p.them, possessive: p.their }
}

/** Keeps the contact from suggesting a meet-up while the reader stays in. */
export function busyPrompt(contact: Contact): string {
  const p = contactWords(contact)
  return `In the background: the reader is staying in for now, so ${contact.firstName} does not suggest meeting up right now. Making plans for another time is fine. It is not something ${p.subject} talks about.`
}

/** Keeps the late-night exchange in their rooms without making the hour a topic. */
export function nightPrompt(contact: Contact): string {
  const p = contactWords(contact)
  return `It is late at night, and students are expected to be in their own dorm rooms by now. ${contact.firstName} and the reader are both in their rooms, and neither is going anywhere tonight, so ${p.subject} does not suggest meeting up now. Making plans for another time is fine. It is just the hour, not something to remark on.`
}

export const stayOverPrompt = "This is the evening. If the scene ends in another character's dorm room or the reader's, and both of them want it, they can spend the night there together. It is only an option, never a goal."

/** Names the stay-over partner and the room using the ledger's saved keys. */
export function stayOverLedgerInstruction(pronouns: ReaderPronouns): string {
  const reader = readerWordsOf(pronouns)
  return `Set stayedOverWith to the key of the character spending tonight with the reader as the scene ends. Set stayedOverIn to "herRoom" for that character's room or "hisRoom" for the reader's room, regardless of pronouns. Set both to "none" if ${reader.he} is spending the night alone.`
}

/** Stages waking together, the contact's own parting lines and the return to the usual morning. */
export function morningReturnPrompt(
  contact: Contact,
  key: string,
  room: 'herRoom' | 'hisRoom',
  pronouns: ReaderPronouns
): string {
  const name = contact.firstName
  const p = contactWords(contact)
  const reader = readerWordsOf(pronouns, contact.gender ?? 'female')
  const speech = `three or four lines of ${name} talking to ${reader.him}, one after another: only ${p.possessive} words, each with "speaker" set to "${key}" and "emotion" to how ${p.subject} looks saying it`
  const atTheirs = room === 'herRoom'
  const place = atTheirs ? `${p.possessive} room` : "the reader's room"
  const beats = atTheirs
    ? `first, one line where ${reader.he} wakes up beside ${p.object}; then, as the reader leaves, ${speech}; then one line where ${reader.he} gets back to ${reader.his} room; then the morning as usual.`
    : `first, one line of them waking up there together; then, as ${name} leaves, ${speech}; then one line of ${name} heading off; then the morning as usual.`
  const example = atTheirs ? 'Pull the door shut on your way out.' : "I'll text you after class."
  const home = atTheirs ? 'the line where the reader gets home' : `the first line after ${name} has gone`
  return `Last night the reader stayed over with ${name} in ${place} (see the latest scene). This morning's opening is the one time dialogue and someone else on screen are allowed. Write it as short lines, one beat each: ${beats} Do not sum up or describe what happened between them last night. Every entry in "lines" has "speaker" and "emotion": "" for both on narration; ${p.possessive} own words are never written into a narration line. For example: {"text": "${example}", "speaker": "${key}", "emotion": "happy"}. Set "homeLine" to the index in "lines" of ${home}.`
}

/** The contact is catching up in the morning after going to sleep. */
export function sleepingTextPrompt(contact: Contact): string {
  const p = pronounsOf(contact)
  return `${contact.firstName} fell asleep before reading the reader's messages. Write the reply ${p.they} sends in the morning after reading them. ${p.They} can mention falling asleep, but there's no need to make a topic of it.`
}

/** The reply catches up after the commitment, without making it a required topic. */
export function busyTextPrompt(
  contact: Contact,
  commitment: { kind: 'class'; name: string } | { kind: 'shift'; employer: string },
  pronouns: ReaderPronouns
): string {
  const p = contactWords(contact)
  const reader = readerWordsOf(pronouns, contact.gender ?? 'female')
  const place = commitment.kind === 'class' ? `in ${commitment.name}` : `at ${p.possessive} shift at ${commitment.employer}`
  const after = commitment.kind === 'class' ? 'class' : 'work'
  return `${contact.firstName} is ${place} right now and cannot text. ${p.Subject} will read the reader's messages once it is over, in the next half of the day, and the reply you write is the one ${p.subject} sends then: as ${p.subject} would after ${after}, catching up on what ${reader.he} said. It is not something ${p.subject} needs to dwell on unless ${p.subject} wants to.`
}
