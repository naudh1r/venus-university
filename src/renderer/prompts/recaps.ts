/**
 * The lorebook's dated recaps: a turn that points back at a finished slot — "last night",
 * "yesterday morning", "last Monday" — gets that slot's summary out of the playthrough log.
 */
import { globalSlotOf } from '@shared/jobs'
import type { GameHistory, Season, TimeSlot } from '@shared/types'
import { formatShortGameDate, formatTimeSlot, shiftWeekdayOf, weekdayOf } from './gameDate'

/** One slot of the semester, by day and half. */
interface SlotRef {
  date: number
  time: TimeSlot
}

/** The halves of one day a phrase names. */
type Halves = readonly TimeSlot[]

const DAY: Halves = [0]
const NIGHT: Halves = [1]
const BOTH: Halves = [0, 1]

/** One recall phrase: what it matches, and the slots a match names from the slot being played. */
interface RecallRule {
  pattern: RegExp
  slots: (match: RegExpMatchArray, now: SlotRef) => SlotRef[]
}

/** Weekday names in `weekdayOf` order, 0 = Sunday. */
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/** Counts by word, one to seven; a figure is read as itself and "a" as one. */
const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven']

const WEEKDAY = `(${WEEKDAYS.join('|')})`
const DAY_HALF = '(?:morning|afternoon)'
const NIGHT_HALF = '(?:night|nite|evening)'
const COUNT = `(a|${COUNT_WORDS.join('|')}|[1-7])`
/** "last" or "this past", never straight after "the": "the last night of break" names no slot. */
const LAST = '(?<!\\bthe\\s+)\\b(?:last|this\\s+past)'

/** The weekday a match captured, as `weekdayOf` numbers it. */
function weekdayIn(match: RegExpMatchArray): number {
  return WEEKDAYS.indexOf(match[1].toLowerCase())
}

/** The count a match captured. */
function countIn(match: RegExpMatchArray): number {
  const word = match[1].toLowerCase()
  if (word === 'a') return 1
  const spelled = COUNT_WORDS.indexOf(word)
  return spelled === -1 ? Number(word) : spelled + 1
}

/** The named halves of the day `back` days before the slot being played. */
function daysBack(now: SlotRef, back: number, halves: Halves): SlotRef[] {
  return halves.map((time) => ({ date: now.date - back, time }))
}

/** Days back to the last `weekday` before today: a whole week when today is one. */
function lastWeekdayBack(now: SlotRef, weekday: number): number {
  return (weekdayOf(now.date) - weekday + 7) % 7 || 7
}

/** The latest `weekday` slot in `time`'s half that is already over, today's included. */
function latestWeekdaySlot(now: SlotRef, weekday: number, time: TimeSlot): SlotRef {
  const date = now.date - ((weekdayOf(now.date) - weekday + 7) % 7)
  return globalSlotOf(date, time) < globalSlotOf(now.date, now.time)
    ? { date, time }
    : { date: date - 7, time }
}

/** A rule whose source opens on its own boundary and is closed on a word boundary here. */
function rule(source: string, slots: RecallRule['slots']): RecallRule {
  return { pattern: new RegExp(`${source}\\b`, 'giu'), slots }
}

/**
 * Every recall phrase, longest claim first: a match blanks its words before the next rule
 * reads, so "yesterday morning" is never also "yesterday".
 */
const RULES: readonly RecallRule[] = [
  rule('\\bthe\\s+day\\s+before\\s+yesterday', (_, now) => daysBack(now, 2, BOTH)),
  rule('\\bthe\\s+night\\s+before\\s+last', (_, now) => daysBack(now, 2, NIGHT)),
  rule(`${LAST}\\s+${WEEKDAY}\\s+${DAY_HALF}`, (match, now) =>
    daysBack(now, lastWeekdayBack(now, weekdayIn(match)), DAY)
  ),
  rule(`${LAST}\\s+${WEEKDAY}\\s+${NIGHT_HALF}`, (match, now) =>
    daysBack(now, lastWeekdayBack(now, weekdayIn(match)), NIGHT)
  ),
  rule(`${LAST}\\s+${WEEKDAY}`, (match, now) =>
    daysBack(now, lastWeekdayBack(now, weekdayIn(match)), BOTH)
  ),
  rule(`\\b${WEEKDAY}\\s+${DAY_HALF}`, (match, now) => [
    latestWeekdaySlot(now, weekdayIn(match), 0)
  ]),
  rule(`\\b${WEEKDAY}\\s+${NIGHT_HALF}`, (match, now) => [
    latestWeekdaySlot(now, weekdayIn(match), 1)
  ]),
  // The weekend before this week's: on a Saturday or a Sunday, the one before that.
  rule(`${LAST}\\s+weekend`, (_, now) => {
    const saturday = shiftWeekdayOf(now.date) + 2
    return [...daysBack(now, saturday, BOTH), ...daysBack(now, saturday - 1, BOTH)]
  }),
  rule(`\\byesterday\\s+${DAY_HALF}`, (_, now) => daysBack(now, 1, DAY)),
  rule(`(?:\\byesterday\\s+${NIGHT_HALF}|${LAST}\\s+${NIGHT_HALF})`, (_, now) =>
    daysBack(now, 1, NIGHT)
  ),
  rule('\\b(?:yesterday|yday)', (_, now) => daysBack(now, 1, BOTH)),
  rule(`\\b${COUNT}\\s+nights?\\s+ago`, (match, now) => daysBack(now, countIn(match), NIGHT)),
  rule(`\\b(?:${COUNT}|a\\s+couple(?:\\s+of)?)\\s+days?\\s+ago`, (match, now) =>
    daysBack(now, match[1] ? countIn(match) : 2, BOTH)
  ),
  // Today's day: over only once the night has begun, which the filter below decides.
  rule(
    '\\b(?:(?:earlier\\s+)?this\\s+(?:morning|afternoon)|earlier\\s+today|in\\s+the\\s+afternoon)',
    (_, now) => daysBack(now, 0, DAY)
  ),
  rule('\\btoday', (_, now) => daysBack(now, 0, DAY))
]

/**
 * The finished slots `text` points back at from the slot being played, oldest first and each
 * once; a phrase naming this slot or a later one names nothing.
 */
function recalledSlots(text: string, date: number, time: TimeSlot): SlotRef[] {
  const now = { date, time }
  const found: SlotRef[] = []
  let rest = text
  for (const { pattern, slots } of RULES) {
    for (const match of rest.matchAll(pattern)) found.push(...slots(match, now))
    rest = rest.replace(pattern, (whole) => ' '.repeat(whole.length))
  }

  const nowSlot = globalSlotOf(date, time)
  const bySlot = new Map<number, SlotRef>()
  for (const slot of found) {
    if (slot.date < 0) continue
    const at = globalSlotOf(slot.date, slot.time)
    if (at < nowSlot) bySlot.set(at, slot)
  }
  return [...bySlot.entries()].sort(([a], [b]) => a - b).map(([, slot]) => slot)
}

/** The sentence closing every recap, so a girl who was not there is not written as knowing it. */
const RECAP_GUARD = 'Only those who were there know what happened.'

/** One dated line per slot `text` points back at that left a summary, oldest first. */
export function recapLore(
  text: string,
  date: number,
  time: TimeSlot,
  history: GameHistory,
  season: Season
): string[] {
  return recalledSlots(text, date, time).flatMap((slot) => {
    const summary = history[slot.date]?.[slot.time]?.replace(/\s*\n+\s*/g, ' ').trim()
    return summary
      ? [`${formatShortGameDate(slot.date, season)}, ${formatTimeSlot(slot.time)} summary: ${summary} ${RECAP_GUARD}`]
      : []
  })
}
