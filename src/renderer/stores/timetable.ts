import { sickInSlot, worstInSlot } from '@shared/colds'
import type { CharInfo, Haunt, ShiftSlot, TimeSlot } from '@shared/types'
import type { NpcGroup } from '@shared/npcRelationships'
import type { DormId } from '@shared/dorms'
import { globalSlotOf, jobDefOf, shiftSlotOf } from '@shared/jobs'
import { ROOM_LOCATION } from '@shared/locations'
import { isRainedOut, weatherAt } from '@shared/weather'
import { classSlotOf, hauntClosedOn, jobClosedOn } from '../prompts/occasions'
import { charJobAt, shiftWeekdayOf } from '../prompts/gameDate'
import { isHomecomingVisit } from '../prompts/homecoming'
import { isMoodHomebound } from '../prompts/moods'
import type { Commitment } from '../prompts/slotIntroPrompt'
import { isAwayForSpringBreak } from '../prompts/springBreak'
import { useGameStore } from './gameStore'

/**
 * The loops' shared timetable lookups: what is meeting right now, and who is sitting in
 * it.
 */

/**
 * The `ClassSlot` for a game slot, or null when nothing meets — the one bridge to the timetable.
 * Defaults to the clock; the scene-ending prefetch passes the *next* slot.
 */
export function currentSlot(date?: number, time?: TimeSlot): number | null {
  const game = useGameStore.getState()
  return classSlotOf(date ?? game.date, time ?? game.time, game.calendar)
}

/** Whether `info` is in the worst of a cold in a slot: in bed, off her class, shift and haunts. */
export function isSickAtHome(
  info: Pick<CharInfo, 'cold'> | undefined,
  date: number,
  time: TimeSlot
): boolean {
  return worstInSlot(info?.cold, globalSlotOf(date, time))
}

/** Whether `info` keeps her in her room all slot: one of her stay-in days, or the worst of a cold. */
export function isHomebound(
  info: Pick<CharInfo, 'moodCycleOffset' | 'cold'> | undefined,
  date: number,
  time: TimeSlot
): boolean {
  return isMoodHomebound(date, info?.moodCycleOffset ?? 0) || isSickAtHome(info, date, time)
}

/** {@link isSickAtHome} for `charId` as the store holds her, defaulting to now. */
export function charSickAtHomeNow(charId: string, date?: number, time?: TimeSlot): boolean {
  const game = useGameStore.getState()
  return isSickAtHome(game.charInfo[charId], date ?? game.date, time ?? game.time)
}

/**
 * The class code `charId` is sitting in for a slot, defaulting to now, or null — the roster's
 * sibling of {@link playerClassNow}. A girl in bed with a cold sits in none.
 */
export function charClassNow(charId: string, date?: number, time?: TimeSlot): string | null {
  const slot = currentSlot(date, time)
  if (slot === null) return null
  if (charSickAtHomeNow(charId, date, time)) return null
  return useGameStore.getState().charInfo[charId]?.schedule?.[slot] ?? null
}

/** The class code the *player* is enrolled in for a slot, defaulting to now. */
export function playerClassNow(date?: number, time?: TimeSlot): string | null {
  const slot = currentSlot(date, time)
  if (slot === null) return null
  return useGameStore.getState().playerSchedule?.[slot] ?? null
}

/** Whether the reader's cold keeps him off work and stats in a slot, defaulting to now. */
export function readerSickNow(date?: number, time?: TimeSlot): boolean {
  const game = useGameStore.getState()
  return sickInSlot(game.readerCold ?? undefined, globalSlotOf(date ?? game.date, time ?? game.time))
}

/** The shift the reader is rostered for in a slot, defaulting to now, or null; none while he is sick. */
export function shiftNow(date?: number, time?: TimeSlot): ShiftSlot | null {
  const game = useGameStore.getState()
  if (!game.job || readerSickNow(date, time)) return null
  const on = date ?? game.date
  if (jobClosedOn(game.job.jobId, on, game.calendar)) return null
  const slot = shiftSlotOf(shiftWeekdayOf(on), time ?? game.time)
  return game.job.shifts.includes(slot) ? slot : null
}

/**
 * The employer `charId` is working for in a slot, defaulting to now, or null — the
 * roster's half of {@link shiftNow} above.
 */
export function charJobNow(charId: string, date?: number, time?: TimeSlot): string | null {
  const game = useGameStore.getState()
  const on = date ?? game.date
  // Nobody works a shift from another country, or from her bed.
  if (charAwayNow(charId, on) || charSickAtHomeNow(charId, on, time)) return null
  const jobId = charJobAt(game.charInfo[charId]?.job, on, time ?? game.time)
  return jobClosedOn(jobId, on, game.calendar) ? null : jobId
}

/** The graduate back in town on `date`, defaulting to today: Homecoming's visitor, or null. */
export function homecomingVisitorNow(date?: number): string | null {
  const game = useGameStore.getState()
  if (!isHomecomingVisit(game.calendar.season, date ?? game.date)) return null
  return game.homecomingVisitor
}

/**
 * Everybody a scene may cast or a classifier may name on `date`, defaulting to today: the
 * roster, and Homecoming's visitor.
 */
export function castableIds(date?: number): string[] {
  const game = useGameStore.getState()
  const visitor = homecomingVisitorNow(date)
  return visitor && !game.chars.includes(visitor) ? [...game.chars, visitor] : game.chars
}

/**
 * True while `charId` is off campus: away for spring break, or graduated and gone from Veridan
 * on any day but the Homecoming she is back for.
 */
export function charAwayNow(charId: string, date?: number): boolean {
  const game = useGameStore.getState()
  if (game.alumni.includes(charId)) return homecomingVisitorNow(date) !== charId
  return isAwayForSpringBreak(game.springBreakAway, charId, date ?? game.date)
}

/** True when `charId` is somewhere she has to be — a class or a shift. */
export function charBusyNow(charId: string, date?: number, time?: TimeSlot): boolean {
  return charClassNow(charId, date, time) !== null || charJobNow(charId, date, time) !== null
}

/**
 * The class or the shift `charId` has to be at in a slot, defaulting to now, the class ahead of
 * the shift, or null when she is free.
 */
export function charCommitmentAt(
  charId: string,
  date?: number,
  time?: TimeSlot
): Commitment | null {
  const game = useGameStore.getState()
  const classCode = charClassNow(charId, date, time)
  if (classCode) return { kind: 'class', name: game.classes[classCode]?.name ?? classCode }
  const jobId = charJobNow(charId, date, time)
  if (jobId) return { kind: 'shift', employer: jobDefOf(jobId)?.employer ?? 'work' }
  return null
}

/** True when `charId` cannot be in a scene at all — busy above, or off campus. */
export function charUnavailableNow(charId: string, date?: number, time?: TimeSlot): boolean {
  return charBusyNow(charId, date, time) || charAwayNow(charId, date)
}

/**
 * Her **standing** haunt this slot, before anything the slot itself did to it, or null for a
 * slot her week says nothing about.
 */
export function charStandingHauntAt(charId: string, date: number, time: TimeSlot): Haunt | null {
  const game = useGameStore.getState()
  const haunt = game.charInfo[charId]?.hiddenSchedule?.[shiftSlotOf(shiftWeekdayOf(date), time)]
  if (!haunt) return null
  // A class or a shift outranks a haunt: a save whose timetable moved under it (add/drop).
  if (charBusyNow(charId, date, time)) return null
  if (hauntClosedOn(haunt.location, haunt.kind, date, game.calendar)) return null
  // Nobody keeps an open-air haunt under rain: she is free that slot instead.
  if (isRainedOut(haunt.location, weatherAt(game.weather, date, time))) return null
  return haunt
}

/**
 * The group `charId` is spending a slot in, or null. An overlay stamped for a different
 * slot answers nothing.
 */
export function charOverlayGroupNow(
  charId: string,
  date?: number,
  time?: TimeSlot
): NpcGroup | null {
  const game = useGameStore.getState()
  const overlay = game.npcOverlay
  if (!overlay) return null
  if (overlay.date !== (date ?? game.date) || overlay.time !== (time ?? game.time)) return null
  return overlay.groups.find((group) => group.members.includes(charId)) ?? null
}

/**
 * The dorm of the room `charId` is spending this slot in: the host's, when an overlay group
 * pulled her into somebody else's room, otherwise her own. Only meaningful on a slot whose
 * hidden location is `'room'`.
 */
export function charRoomDormNow(
  charId: string,
  date?: number,
  time?: TimeSlot
): DormId | undefined {
  const group = charOverlayGroupNow(charId, date, time)
  const host = group?.location === ROOM_LOCATION && group.host ? group.host : charId
  return useGameStore.getState().charInfo[host]?.dorm
}

/**
 * Where `charId` actually is this slot — a location id, `'room'`, or null for a slot nothing
 * places her in.
 */
export function charHiddenLocationNow(
  charId: string,
  date?: number,
  time?: TimeSlot
): string | null {
  const game = useGameStore.getState()
  const on = date ?? game.date
  const half = time ?? game.time
  if (charBusyNow(charId, on, half)) return null
  // Before the homebound branch, load-bearing: a girl abroad is not in her dorm room.
  if (charAwayNow(charId, on)) return null
  // A graduate back for the day keeps no room or haunt in Veridan.
  if (game.alumni.includes(charId)) return null
  if (isHomebound(game.charInfo[charId], on, half)) return ROOM_LOCATION
  return (
    charOverlayGroupNow(charId, on, half)?.location ??
    charStandingHauntAt(charId, on, half)?.location ??
    null
  )
}

/**
 * Her standing haunt only while she is actually at it — a host still studying where she pulled
 * her friends, never a homebound girl or one pulled somewhere else — or null.
 */
export function charStandingHauntNow(charId: string, date?: number, time?: TimeSlot): Haunt | null {
  const game = useGameStore.getState()
  const on = date ?? game.date
  const half = time ?? game.time
  const haunt = charStandingHauntAt(charId, on, half)
  const location = charHiddenLocationNow(charId, on, half)
  return haunt && location === haunt.location ? haunt : null
}
