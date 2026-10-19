import { coursePointsOf, gradedCourses } from '@shared/academics'
import { carryPostFields } from '@shared/modCarry'
import { carriedComments } from '@shared/postComments'
import { overTextDesc } from '@shared/relationship'
import {
  advancesAfter,
  breakDaysOf,
  charProfileOf,
  charStateOf,
  graduatesOf,
  intakeOf,
  semesterShiftOf,
  type SemesterCalendar,
  type SemesterView
} from '@shared/semesters'
import type { NpcFriendship, NpcRelationshipMap } from '@shared/npcRelationships'
import type { GameReplays } from '@shared/replays'
import type { ReaderTallies } from '@shared/tallies'
import type {
  BunnybotHandover,
  BunnyboardState,
  CalendarEvent,
  CharInfo,
  CharMemory,
  CharProfile,
  CharState,
  ClassEntry,
  ClassRecord,
  Conversation,
  FormerJob,
  GameHistory,
  HiddenScheduleAssignment,
  JobAssignment,
  JobState,
  OwnedItem,
  SemesterCarry,
  SocialPost,
  Transcript
} from '@shared/types'
import type { PlayerStats } from '@shared/playerStats'
import { handedBackAcedCount } from '../prompts/classProgress'
import { hauntAssignmentOf } from './hiddenScheduler'

/**
 * What one semester's ending hands the next: who graduates and who stays, every date moved onto
 * the next semester's clock, and the reader's bookkeeping carried across the break. Pure; the
 * caller hands in the ending's state as the store holds it.
 */

/** The finished semester's moving state, as the store holds it when the reader goes home. */
export interface CarryInput {
  date: number
  stats: PlayerStats
  money: number
  bio: string
  tallies: ReaderTallies
  charInfo: Readonly<Record<string, CharInfo>>
  bunnyboard: BunnyboardState
  inventory: readonly OwnedItem[]
  job: JobState | null
  jobsClosed: readonly string[]
  formerJobs: Readonly<Record<string, FormerJob>>
  transcript: Transcript | null
  gradesStanding: 'good' | 'bad' | null
  classRecords: Readonly<Record<string, ClassRecord>>
  classes: Readonly<Record<string, ClassEntry>>
  playerSchedule: Readonly<Record<number, string>>
  calendar: SemesterCalendar
  finalsScoresShown: boolean
  history: GameHistory
  replays: GameReplays
  events: readonly CalendarEvent[]
  bunnymapUnlocked: boolean
  bunnyshopUnlocked: boolean
  venusJobIntroSent: boolean
  bunnybotContactIntroSent: boolean
  bunnybotFirstPostNudgeSent: boolean
  bunnybotTwoTimingTipSent: boolean
  bunnybotSeenTipSent: boolean
  bunnybotDeferred: readonly BunnybotHandover[]
  bunnybotThrough: number
  npcRelationships: NpcRelationshipMap
  npcFriendships: readonly NpcFriendship[]
}

/** The next semester as the ending leaves it, before anybody new is picked. */
export interface SemesterHandoff {
  /** The next semester's index. */
  index: number
  /** Who stays on the roster, in roster order. */
  continuing: string[]
  /** Who graduated at this ending, in roster order. */
  graduated: string[]
  /** Every graduate by the next semester, oldest first. */
  alumni: string[]
  /** The continuing girls' and the graduates' settled halves, each year and intake moved on. */
  priorProfiles: Record<string, CharProfile>
  /** Each continuing girl's employer and how many shifts she works, kept for the next term. */
  jobs: Record<string, JobAssignment>
  /** Each continuing girl's habits, read off her week to be dealt again around her new timetable. */
  haunts: Record<string, HiddenScheduleAssignment>
  carry: SemesterCarry
}

/** A memory moved onto the next semester's clock, its age frozen across the break. */
function carriedMemory(memory: CharMemory, shift: number, breakDays: number): CharMemory {
  return { ...memory, date: memory.date - shift, breakDays: (memory.breakDays ?? 0) + breakDays }
}

/** `memories` with `entry` placed after the last memory not newer than it. */
function withMemoryInOrder(memories: readonly CharMemory[], entry: CharMemory): CharMemory[] {
  let at = memories.length
  while (at > 0 && memories[at - 1].date > entry.date) at--
  return [...memories.slice(0, at), entry, ...memories.slice(at)]
}

/** One girl's carried entry: profile fields dropped, dates moved on, the semester's own state reset. */
function carriedState(
  info: CharInfo,
  graduate: boolean,
  shift: number,
  breakDays: number
): CharState {
  const state: CharState = { ...charStateOf(info) }
  const memory = (entry: CharMemory): CharMemory => carriedMemory(entry, shift, breakDays)

  state.memories = state.memories.map(memory)
  if (state.jealousyMemories) state.jealousyMemories = state.jealousyMemories.map(memory)
  if (state.giftMemories) state.giftMemories = state.giftMemories.map(memory)
  if (state.textMemory) {
    const text = memory(state.textMemory)
    // A graduate keeps what texting left her as one of her memories, said as texted.
    if (graduate) {
      state.memories = withMemoryInOrder(state.memories, { ...text, desc: overTextDesc(text.desc) })
      delete state.textMemory
    } else {
      state.textMemory = text
    }
  }
  if (state.feed) state.feed = carriedFeed(state.feed, shift)
  if (state.datingSince !== undefined) state.datingSince -= shift
  if (state.brokeUpOn !== undefined) state.brokeUpOn -= shift

  // The semester's own: re-dealt, re-learned or rolled again in the next one.
  delete state.job
  delete state.metSlots
  delete state.ignoredInvitation
  delete state.suspicions
  // Everybody comes back from the break well, and the next semester's strains are new ones.
  delete state.cold
  delete state.coldsHad
  // A graduate is never cast again, so her romance count and break penalty have nothing left to
  // settle.
  if (graduate) {
    delete state.romanceScenes
    delete state.breakPenalty
  }
  return state
}

/** A feed moved onto the next semester's clock, in posting order. */
function carriedFeed(feed: readonly SocialPost[], shift: number): SocialPost[] {
  return feed
    .map((post) =>
      carryPostFields(
        carriedComments(
          {
            ...post,
            date: post.date - shift,
            ...(post.likedOn !== undefined ? { likedOn: post.likedOn - shift } : {})
          },
          shift
        ),
        shift
      )
    )
    .sort((a, b) => a.date * 2 + a.time - (b.date * 2 + b.time))
}

/** A thread moved onto the next semester's clock, with nothing of this semester still pending. */
function carriedConversation(conversation: Conversation, shift: number): Conversation {
  const { pendingHangout: _pending, declined: _declined, turnedDown: _turnedDown, ...rest } =
    conversation
  return {
    ...rest,
    messages: conversation.messages.map((message) => ({ ...message, date: message.date - shift }))
  }
}

/** The Bunnyboard carried: threads moved on, requests to graduates dropped, suggestions re-drawn. */
function carriedBunnyboard(
  bunnyboard: BunnyboardState,
  graduated: ReadonlySet<string>,
  shift: number
): BunnyboardState {
  const { suggestions: _suggestions, ...rest } = bunnyboard
  return {
    ...rest,
    conversations: Object.fromEntries(
      Object.entries(bunnyboard.conversations).map(([charId, conversation]) => [
        charId,
        carriedConversation(conversation, shift)
      ])
    ),
    requestsSent: bunnyboard.requestsSent.filter((charId) => !graduated.has(charId)),
    requestsReceived: bunnyboard.requestsReceived.filter((charId) => !graduated.has(charId))
  }
}

/** Every pair's standing kept, its last meeting dropped: that meeting belongs to the old clock. */
function carriedRelationships(map: NpcRelationshipMap): NpcRelationshipMap {
  return Object.fromEntries(
    Object.entries(map).map(([key, pair]) => [key, { affinity: pair.affinity }])
  )
}

/**
 * The employers he may go back to: the one he held as the term ended joins those he left, and an
 * employer stays closed only where it fired him — or where no record says how he left it.
 */
function carriedJobs(
  job: JobState | null,
  jobsClosed: readonly string[],
  formerJobs: Readonly<Record<string, FormerJob>>
): { formerJobs: Record<string, FormerJob>; jobsClosed: string[] } {
  const former: Record<string, FormerJob> = { ...formerJobs }
  if (job) former[job.jobId] = { raises: job.raises, left: 'term' }
  return {
    formerJobs: former,
    jobsClosed: jobsClosed.filter((jobId) => (former[jobId]?.left ?? 'fired') === 'fired')
  }
}

/** The reader's record with this semester's courses, aced papers and meetings added on. */
function carriedTranscript(input: CarryInput): Transcript {
  const earlier = input.transcript ?? { gradePoints: [], aced: 0, attended: 0, held: 0 }
  let attended = 0
  let held = 0
  for (const record of Object.values(input.classRecords)) {
    for (const meeting of record.meetings) {
      held += 1
      if (meeting.attended) attended += 1
    }
  }
  return {
    gradePoints: [
      ...earlier.gradePoints,
      ...coursePointsOf(input.classRecords, gradedCourses(input.playerSchedule, input.classes))
    ],
    aced:
      earlier.aced +
      handedBackAcedCount(
        input.classRecords,
        input.classes,
        input.calendar,
        input.date,
        input.finalsScoresShown
      ),
    attended: earlier.attended + attended,
    held: earlier.held + held
  }
}

/**
 * A settled half carried into the next semester: her intake written down, her year moved on where
 * her intake moves now, and a graduate's week emptied.
 */
function carriedProfile(profile: CharProfile, graduate: boolean, view: SemesterView): CharProfile {
  const intake = intakeOf(profile)
  const { hiddenSchedule: _week, springBreakPlans: _plans, ...rest } = profile
  if (graduate) return { ...rest, intake, schedule: {} }
  return {
    ...rest,
    intake,
    year: advancesAfter(intake, view.season) ? profile.year + 1 : profile.year
  }
}

/** Everything the ending of `view` hands the next semester. */
export function carryOf(input: CarryInput, view: SemesterView): SemesterHandoff {
  const shift = semesterShiftOf(view.season)
  const breakDays = breakDaysOf(view.season)
  const graduated = graduatesOf(view)
  const leaving = new Set(graduated)
  const continuing = view.chars.filter((charId) => !leaving.has(charId))
  const alumni = [...view.alumni, ...graduated]
  const isGraduate = (charId: string): boolean => alumni.includes(charId)

  const charInfo: Record<string, CharState> = {}
  const priorProfiles: Record<string, CharProfile> = {}
  for (const charId of [...continuing, ...alumni]) {
    const info = input.charInfo[charId]
    if (info) charInfo[charId] = carriedState(info, isGraduate(charId), shift, breakDays)
    const profile = view.profiles[charId] ?? (info ? charProfileOf(info) : undefined)
    if (profile) priorProfiles[charId] = carriedProfile(profile, isGraduate(charId), view)
  }

  // Her routine, read before the carry empties it: the same employer and habits, dealt anew.
  const girlsJobs: Record<string, JobAssignment> = {}
  const haunts: Record<string, HiddenScheduleAssignment> = {}
  for (const charId of continuing) {
    const job = input.charInfo[charId]?.job
    if (job && job.shifts.length > 0) girlsJobs[charId] = { jobId: job.jobId, count: job.shifts.length }
    const week = view.profiles[charId]?.hiddenSchedule
    if (week) haunts[charId] = hauntAssignmentOf(week)
  }

  const jobs = carriedJobs(input.job, input.jobsClosed, input.formerJobs)
  const carry: SemesterCarry = {
    stats: input.stats,
    money: input.money,
    ...(input.bio ? { bio: input.bio } : {}),
    tallies: input.tallies,
    // A present keeps the day she gave it, moved onto the next semester's clock.
    inventory: input.inventory.map((entry) =>
      entry.from ? { ...entry, from: { ...entry.from, date: entry.from.date - shift } } : entry
    ),
    jobsClosed: jobs.jobsClosed,
    formerJobs: jobs.formerJobs,
    transcript: carriedTranscript(input),
    gradesStanding: input.gradesStanding,
    bunnyboard: carriedBunnyboard(input.bunnyboard, new Set(alumni), shift),
    bunnymapUnlocked: input.bunnymapUnlocked,
    bunnyshopUnlocked: input.bunnyshopUnlocked,
    venusJobIntroSent: input.venusJobIntroSent,
    bunnybotContactIntroSent: input.bunnybotContactIntroSent,
    bunnybotFirstPostNudgeSent: input.bunnybotFirstPostNudgeSent,
    bunnybotTwoTimingTipSent: input.bunnybotTwoTimingTipSent,
    bunnybotSeenTipSent: input.bunnybotSeenTipSent,
    bunnybotDeferred: [...input.bunnybotDeferred],
    bunnybotThrough: input.bunnybotThrough,
    npcRelationships: carriedRelationships(input.npcRelationships),
    npcFriendships: input.npcFriendships.map((pair) => ({ ...pair, date: pair.date - shift })),
    charInfo,
    before: {
      history: input.history,
      ...(Object.keys(input.replays).length > 0 ? { replays: input.replays } : {}),
      playerSchedule: { ...input.playerSchedule },
      events: [...input.events]
    }
  }

  return {
    index: view.index + 1,
    continuing,
    graduated,
    alumni,
    priorProfiles,
    jobs: girlsJobs,
    haunts,
    carry
  }
}
