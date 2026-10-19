import { appError } from './errors'
import { FINAL_DATE, SENIOR_YEAR, yearLabel } from './classes'
import { replayIdsOf } from './replays'
import type {
  CharInfo,
  CharProfile,
  CharState,
  ClassEntry,
  Occasion,
  PlaythroughRecord,
  Season,
  SemesterLog,
  ShiftSlot
} from './types'
import type { Weather } from './weather'

/**
 * The semesters of a playthrough: which half of the year each is, who graduates at its end,
 * the record read as one semester, and the split between what a semester settles and what a
 * save carries.
 */

/** Which half of the year a semester is: the first is a spring, and they alternate. */
export function seasonOf(index: number): Season {
  return index % 2 === 0 ? 'spring' : 'fall'
}

/** The reader's class year in a semester, two semesters to a year. */
export function readerYearOf(index: number): number {
  return Math.floor(index / 2) + 1
}

/** The last semester: the fall the reader graduates at as a senior. */
export const LAST_SEMESTER = 7

/** Which of the reader's eight a semester is, in words: `"third"`. */
export function semesterOrdinal(index: number): string {
  return ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'][index]
}

/** `"Freshman Spring"` — a semester as the screens name it: the reader's year, then its season. */
export function semesterName(index: number): string {
  const season = seasonOf(index)
  return `${yearLabel(readerYearOf(index))} ${season === 'spring' ? 'Spring' : 'Fall'}`
}

/**
 * The season a character arrived in: her own, or in the first semester a freshman's spring and
 * anybody older's fall.
 */
export function intakeOf(profile: Pick<CharProfile, 'year' | 'intake'>): Season {
  return profile.intake ?? (profile.year <= 1 ? 'spring' : 'fall')
}

/** Whether an intake moves up a year at the end of a `season` semester: the one it did not arrive in. */
export function advancesAfter(intake: Season, season: Season): boolean {
  return intake !== season
}

/**
 * How many days the next semester's day 0 falls after this one's: August 17 is thirty weeks
 * after January 19, and the next January 19 is 155 days after August 17.
 */
export function semesterShiftOf(season: Season): number {
  return season === 'spring' ? 210 : 155
}

/** The days between this semester's last day and the next one's first: the break a memory does not age through. */
export function breakDaysOf(season: Season): number {
  return semesterShiftOf(season) - FINAL_DATE
}

/** One semester's fixed calendar and the occasions it invented — every occasion read takes one. */
export interface SemesterCalendar {
  readonly season: Season
  readonly generated: readonly Occasion[]
}

/** The calendar of a semester whose season and generated occasions are these. */
export function calendarOf(season: Season, generated: readonly Occasion[]): SemesterCalendar {
  return { season, generated }
}

/** One semester of a playthrough, read off its record the same way whichever semester it is. */
export interface SemesterView {
  /** Its key in the record's semesters; undefined for the first. */
  id: string | undefined
  index: number
  season: Season
  chars: string[]
  alumni: string[]
  classes: Record<string, ClassEntry>
  occasions: Occasion[]
  jobClosures: Record<string, ShiftSlot[]>
  weather: Weather[]
  profiles: Record<string, CharProfile>
  fallGraduate: string | undefined
  playerFirstName: string
  playerLastName: string
}

/** Raised when a save names a semester its playthrough's record does not hold. */
export const SEMESTER_NOT_FOUND = {
  code: 'SEMESTER_NOT_FOUND',
  message: "That save's semester is missing from its playthrough."
}

/** Whether the record holds the semester `id` names; the first semester always. */
export function hasSemester(record: PlaythroughRecord, id: string | undefined): boolean {
  return id === undefined || record.semesters?.[id] !== undefined
}

/** One semester of the record, the first where `id` is undefined. */
export function semesterOf(record: PlaythroughRecord, id?: string): SemesterView {
  const names = { playerFirstName: record.playerFirstName, playerLastName: record.playerLastName }
  if (id === undefined) {
    return {
      id: undefined,
      index: 0,
      season: seasonOf(0),
      chars: record.chars,
      alumni: [],
      classes: record.classes,
      occasions: record.occasions,
      jobClosures: record.jobClosures,
      weather: record.weather,
      profiles: record.profiles,
      fallGraduate: undefined,
      ...names
    }
  }
  const semester = record.semesters?.[id]
  if (!semester) throw appError(SEMESTER_NOT_FOUND.code, SEMESTER_NOT_FOUND.message, id)
  return {
    id,
    index: semester.index,
    season: seasonOf(semester.index),
    chars: semester.chars,
    alumni: semester.alumni,
    classes: semester.classes,
    occasions: semester.occasions,
    jobClosures: semester.jobClosures,
    weather: semester.weather,
    profiles: semester.profiles,
    fallGraduate: semester.fallGraduate,
    ...names
  }
}

/** One semester of a chain, with how it ended where a later semester in the chain recorded it. */
export interface ChainedSemester {
  view: SemesterView
  /** Its history, replays, timetable and plans as its ending left them; null for the last. */
  log: SemesterLog | null
}

/** The semesters from the first to the one `id` names, oldest first. */
export function semesterChain(record: PlaythroughRecord, id?: string): ChainedSemester[] {
  const ids: (string | undefined)[] = []
  let at = id
  while (at !== undefined) {
    // A loop is refused by the record check; this only stops a walk from running forever.
    if (ids.includes(at) || ids.length > LAST_SEMESTER) break
    ids.unshift(at)
    at = record.semesters?.[at]?.parent
  }
  ids.unshift(undefined)
  return ids.map((semesterId, i) => {
    const next = ids[i + 1]
    return {
      view: semesterOf(record, semesterId),
      log: next === undefined ? null : (record.semesters?.[next]?.before ?? null)
    }
  })
}

/**
 * Who graduates at the end of this semester, in roster order — the one answer the ceremony,
 * the goodbyes, the last posts, her own lines and the carry all read: the seniors whose intake
 * moves up now, and in a fall the senior picked to go early.
 */
export function graduatesOf(
  view: Pick<SemesterView, 'season' | 'chars' | 'profiles' | 'fallGraduate'>
): string[] {
  return view.chars.filter((charId) => {
    if (charId === view.fallGraduate) return true
    const profile = view.profiles[charId]
    if (!profile) return false
    return profile.year >= SENIOR_YEAR && advancesAfter(intakeOf(profile), view.season)
  })
}

/** Every replay a semester log in the record names — kept for as long as the playthrough is. */
export function recordReplayIds(record: PlaythroughRecord): Set<string> {
  const ids = new Set<string>()
  for (const semester of Object.values(record.semesters ?? {})) {
    for (const replayId of replayIdsOf(semester.before.replays)) ids.add(replayId)
  }
  return ids
}

/**
 * Every key of the settled half. A field added to `CharProfile` is a compile error until it is
 * listed here, which is what keeps it out of the save files.
 */
const PROFILE_KEYS: Record<keyof CharProfile, true> = {
  year: true,
  dorm: true,
  major: true,
  schedule: true,
  hiddenSchedule: true,
  moodCycleOffset: true,
  handle: true,
  springBreakPlans: true,
  intake: true,
  pursuing: true
}

/** The half of one entry a save file carries: everything the record already holds, dropped. */
export function charStateOf(info: CharInfo): CharState {
  const state = { ...info } as Record<string, unknown>
  for (const key of Object.keys(PROFILE_KEYS)) delete state[key]
  return state as unknown as CharState
}

/** The half of one entry the record holds: the settled fields alone, absent ones left absent. */
export function charProfileOf(info: CharInfo): CharProfile {
  const profile: Record<string, unknown> = {}
  for (const key of Object.keys(PROFILE_KEYS)) {
    const value = (info as unknown as Record<string, unknown>)[key]
    if (value !== undefined) profile[key] = value
  }
  return profile as unknown as CharProfile
}
