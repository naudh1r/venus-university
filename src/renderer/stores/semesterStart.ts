import { carriedModFields } from '@shared/modCarry'
import { rollPostLikes } from '@shared/feed'
import { placeNpcShifts, rollFreshmanJobStart, rollJobClosures } from '@shared/jobs'
import { npcFriendsOf } from '@shared/npcRelationships'
import { breakDecayedStats, STAT_KEYS, tierOf, type PlayerStats } from '@shared/playerStats'
import {
  affectionFor,
  breakPenaltyAt,
  initialFlags,
  meetsCrushStandards,
  observedUpperHalves
} from '@shared/relationship'
import { SAVE_SCHEMA_VERSION } from '@shared/saveRules'
import { observedSecretTiers } from '@shared/secrets'
import { seasonOf } from '@shared/semesters'
import { shuffle } from '@shared/shuffle'
import {
  type CharJob,
  type Character,
  type CharProfile,
  type CharState,
  type EnrollmentDraft,
  type SaveDraft,
  type Season,
  type SemesterRecord,
  type ShiftSlot,
  type SocialPost,
  type TimeSlot
} from '@shared/types'
import { rollSemesterWeather } from '@shared/weather'
import { MOOD_CYCLE_LENGTH } from '../prompts/moods'
import { fallbackPursuit } from '../prompts/profilePrompt'
import { dryOccasionDates } from '../prompts/weather'
import { buildHiddenSchedules, type HiddenScheduleInput } from './hiddenScheduler'

/**
 * A semester's start, where the registrar's timetable meets what was generated for it: the
 * winter posts New Game dates, and the record and opening save a next semester's Finalize writes.
 */

/** The days a break's posts are dated into, counted back from the semester's day 0. */
export interface PostWindow {
  first: number
  last: number
}

/** December 1 through January 13: the winter break before a playthrough's first spring. */
export const FIRST_WINTER_POSTS: PostWindow = { first: -49, last: -6 }

/**
 * The break before a next semester, after last term's ending posts: the summer before a fall,
 * the winter break before a spring.
 */
export function breakPostWindowOf(season: Season): PostWindow {
  return season === 'fall' ? { first: -79, last: -7 } : { first: -24, last: -6 }
}

/**
 * Files a character's break posts on actual days inside `window`, their likes rolled, or given
 * by `likes` where the caller has another say in them (a mod's, on a new game's winter posts).
 */
export function dealBreakPosts(
  texts: readonly string[],
  friends: number,
  window: PostWindow,
  likes: () => number = () => rollPostLikes(friends)
): SocialPost[] {
  const slots = new Set<number>()
  // Distinct slots by redraw: every window holds dozens and nobody posts more than three times.
  while (slots.size < texts.length) {
    const day = window.first + Math.floor(Math.random() * (window.last - window.first + 1))
    slots.add(day * 2 + Math.floor(Math.random() * 2))
  }

  return [...slots]
    .sort((a, b) => a - b)
    .map((slot, i) => ({
      id: crypto.randomUUID(),
      text: texts[i],
      date: Math.floor(slot / 2),
      // `%` keeps the dividend's sign and every slot is negative, so the remainder is floored into 0/1.
      time: (((slot % 2) + 2) % 2) as TimeSlot,
      likes: likes()
    }))
}

/** What a next semester's Finalize writes: the semester for the record, and its opening save. */
export interface ContinuedStart {
  id: string
  semester: SemesterRecord
  save: SaveDraft
}

/** A feed in posting order. */
function byPostingOrder(feed: readonly SocialPost[]): SocialPost[] {
  return [...feed].sort((a, b) => a.date * 2 + a.time - (b.date * 2 + b.time))
}

/**
 * A returning girl as the break leaves her: a penalty taking her a tier down where she would open
 * friendly or warmer, the half it pushed her out of read as left, every secret whose tier she
 * still stands in reached, and a standard she was told he met forgotten where the decayed stats
 * no longer meet it.
 */
function cooledByBreak(entry: CharState, character: Character, stats: PlayerStats): CharState {
  const cooled: CharState = { ...entry }
  const penalty = breakPenaltyAt(affectionFor(entry, 0, character), entry.breakPenalty)
  if (penalty) {
    cooled.breakPenalty = penalty
    const upperHalves = observedUpperHalves(entry.upperHalves, affectionFor(cooled, 0, character))
    if (upperHalves) cooled.upperHalves = upperHalves
  }
  const secrets = observedSecretTiers(cooled.secrets, affectionFor(cooled, 0, character))
  if (secrets) cooled.secrets = secrets
  if (cooled.crushHint && 'met' in cooled.crushHint && !meetsCrushStandards(character, stats)) {
    delete cooled.crushHint
  }
  return cooled
}

/**
 * A next semester as Finalize writes it, off its registration and the reader's timetable: the
 * roster's shifts and weeks dealt around the new catalog, the break's posts dated, the profiles
 * of the roster and the graduates, and the save it opens on, carrying what the last ending left
 * less what the break cost.
 */
export function continuedStartOf(
  enrollment: EnrollmentDraft,
  playerSchedule: Record<number, string>,
  roster: readonly Character[]
): ContinuedStart {
  const continued = enrollment.continued
  if (!continued) throw new Error('a first semester has no continuation')
  const season = seasonOf(continued.index)
  const { carry, priorProfiles, alumni } = continued
  const returning = new Set(roster.map((c) => c.charId).filter((charId) => priorProfiles[charId]))

  // Rolled once and read twice: by the record and by the roster's shift placement.
  const jobClosures = rollJobClosures(playerSchedule)
  const weather = rollSemesterWeather(dryOccasionDates(season), season)

  // Shifts: a returning girl keeps her employer and her count, re-placed around her new
  // timetable; a newcomer starts hers some weeks in, as a first semester's freshmen do.
  const charJobs: Record<string, CharJob> = {}
  const takenShifts: Record<string, ShiftSlot[]> = {}
  for (const character of shuffle(roster)) {
    const assignment = enrollment.jobs[character.charId]
    if (!assignment) continue
    const shifts = placeNpcShifts(
      assignment.jobId,
      assignment.count,
      enrollment.perChar[character.charId]?.schedule ?? {},
      jobClosures,
      takenShifts[assignment.jobId] ?? []
    )
    if (shifts.length === 0) continue
    takenShifts[assignment.jobId] = [...(takenShifts[assignment.jobId] ?? []), ...shifts]
    charJobs[character.charId] = {
      jobId: assignment.jobId,
      shifts,
      ...(returning.has(character.charId)
        ? {}
        : { startsOn: rollFreshmanJobStart(), newJobNotice: true })
    }
  }

  const hiddenSchedules = buildHiddenSchedules(
    Object.fromEntries(
      roster.flatMap((c) => {
        const assignment = enrollment.haunts[c.charId]
        if (!assignment) return []
        const input: HiddenScheduleInput = {
          ...assignment,
          schedule: enrollment.perChar[c.charId]?.schedule ?? {},
          ...(charJobs[c.charId] ? { job: charJobs[c.charId] } : {})
        }
        return [[c.charId, input] as const]
      })
    )
  )

  // Newcomers take the mood offsets nobody holds yet, so no two start in phase where it can help.
  const held = new Set(
    Object.values(priorProfiles)
      .map((profile) => profile.moodCycleOffset)
      .filter((offset): offset is number => offset !== undefined)
  )
  const freeOffsets = shuffle([...Array(MOOD_CYCLE_LENGTH).keys()].filter((o) => !held.has(o)))
  let nextOffset = 0
  const offsetFor = (): number =>
    freeOffsets.length > 0
      ? freeOffsets[nextOffset++ % freeOffsets.length]
      : Math.floor(Math.random() * MOOD_CYCLE_LENGTH)

  const rosterIds = roster.map((c) => c.charId)
  const window = breakPostWindowOf(season)
  const breakPostsOf = (charId: string): SocialPost[] =>
    dealBreakPosts(
      enrollment.feeds[charId]?.winterPosts ?? [],
      npcFriendsOf(carry.npcRelationships, charId, [...rosterIds, ...alumni]).length,
      window
    )

  // The break's cost: every stat a tier down, and the girls it cooled, kept for the first morning.
  const stats = breakDecayedStats(carry.stats)
  const decayed = STAT_KEYS.filter((key) => tierOf(stats[key]) < tierOf(carry.stats[key]))
  const penalized: string[] = []

  const profiles: Record<string, CharProfile> = {}
  const charInfo: Record<string, CharState> = {}
  for (const character of roster) {
    const charId = character.charId
    const hiddenSchedule = hiddenSchedules[charId]
    const prior = priorProfiles[charId]
    profiles[charId] = {
      ...(prior ?? { moodCycleOffset: offsetFor(), intake: season }),
      ...enrollment.perChar[charId],
      // Omitted when the deal found nowhere to put her.
      ...(hiddenSchedule && Object.keys(hiddenSchedule).length > 0 ? { hiddenSchedule } : {}),
      ...(enrollment.feeds[charId] ? { handle: enrollment.feeds[charId].handle } : {}),
      ...(enrollment.springBreakPlans[charId]
        ? { springBreakPlans: enrollment.springBreakPlans[charId] }
        : {})
    }

    const job = charJobs[charId]
    const carried = carry.charInfo[charId]
    // This semester's secrets, after whatever she still has untold.
    const written = enrollment.secrets?.[charId] ?? []
    if (carried) {
      const posted = breakPostsOf(charId)
      const entry = cooledByBreak(
        {
          ...carried,
          ...(job ? { job } : {}),
          ...(posted.length > 0
            ? { feed: byPostingOrder([...(carried.feed ?? []), ...posted]) }
            : {}),
          ...(written.length > 0 ? { secrets: [...(carried.secrets ?? []), ...written] } : {})
        },
        character,
        stats
      )
      if (entry.breakPenalty && entry.breakPenalty !== carried.breakPenalty) penalized.push(charId)
      charInfo[charId] = entry
    } else {
      // A first-year: a stranger to everybody, posting nothing from before she arrived.
      charInfo[charId] = {
        memories: [],
        flags: initialFlags(character),
        nameKnown: false,
        ...(job ? { job } : {}),
        ...(written.length > 0 ? { secrets: written } : {})
      }
    }
  }

  // Graduates keep their settled half, emptied of a week, with what they are doing now: one the
  // profile call did not see, her character gone, keeps last semester's or the placeholder, as
  // `pursuing` is what makes her a graduate.
  for (const charId of alumni) {
    const prior = priorProfiles[charId]
    if (prior) {
      profiles[charId] = {
        ...prior,
        schedule: {},
        pursuing: continued.pursuits[charId] ?? fallbackPursuit(prior.pursuing)
      }
    }
    const carried = carry.charInfo[charId]
    if (carried) {
      const posted = breakPostsOf(charId)
      charInfo[charId] =
        posted.length > 0
          ? { ...carried, feed: byPostingOrder([...(carried.feed ?? []), ...posted]) }
          : carried
    }
  }

  const semester: SemesterRecord = {
    index: continued.index,
    ...(continued.parent !== undefined ? { parent: continued.parent } : {}),
    chars: rosterIds,
    alumni,
    classes: enrollment.classes,
    occasions: enrollment.occasions,
    jobClosures,
    weather,
    profiles,
    ...(continued.fallGraduate !== undefined ? { fallGraduate: continued.fallGraduate } : {}),
    ...(decayed.length > 0 || penalized.length > 0
      ? { breakDecay: { stats: decayed, girls: penalized } }
      : {}),
    before: carry.before
  }

  const save: SaveDraft = {
    // The mods' own fields first, each as its mod carried it, so none can stand in for the game's.
    ...carriedModFields(carry.mods ?? {}),
    schemaVersion: SAVE_SCHEMA_VERSION,
    semester: continued.id,
    stats,
    money: carry.money,
    ...(carry.bio ? { bio: carry.bio } : {}),
    tallies: {
      ...carry.tallies,
      tokensGenerated: carry.tallies.tokensGenerated + (enrollment.tokensGenerated ?? 0)
    },
    date: 0,
    time: 0,
    charInfo,
    playerSchedule,
    history: {},
    bunnyboard: carry.bunnyboard,
    events: [],
    job: null,
    jobsClosed: carry.jobsClosed,
    ...(carry.formerJobs && Object.keys(carry.formerJobs).length > 0
      ? { formerJobs: carry.formerJobs }
      : {}),
    ...(carry.transcript ? { transcript: carry.transcript } : {}),
    inventory: carry.inventory,
    classRecords: {},
    gradesStanding: carry.gradesStanding,
    expelled: false,
    midtermStandingDone: false,
    finalsScoresShown: false,
    // VenusBot's semester is owed again from its welcome back.
    venusThrough: -1,
    // BunnyBot is long past its tutorials, and its watermark says so.
    bunnybotThrough: carry.bunnybotThrough,
    bunnymapUnlocked: carry.bunnymapUnlocked,
    bunnyshopUnlocked: carry.bunnyshopUnlocked,
    venusJobIntroSent: carry.venusJobIntroSent,
    bunnybotContactIntroSent: carry.bunnybotContactIntroSent,
    bunnybotFirstPostNudgeSent: carry.bunnybotFirstPostNudgeSent,
    bunnybotTwoTimingTipSent: carry.bunnybotTwoTimingTipSent,
    ...(carry.bunnybotSeenTipSent !== undefined
      ? { bunnybotSeenTipSent: carry.bunnybotSeenTipSent }
      : {}),
    bunnybotDeferred: carry.bunnybotDeferred,
    droppedClasses: {},
    addedClasses: {},
    npcRelationships: carry.npcRelationships,
    npcFriendships: carry.npcFriendships ?? [],
    // Generated occasion ids repeat from semester to semester, so nothing turned down carries.
    occasionsDeclined: [],
    npcOverlay: null,
    slotRumor: null,
    lastSlotCast: null,
    weekendOutings: {},
    outingSlots: {},
    springBreakAway: null,
    feedExtras: null,
    graduationSeen: false,
    farewellsDone: [],
    endingArtWanted: false,
    scene: null
  }

  return { id: continued.id, semester, save }
}
