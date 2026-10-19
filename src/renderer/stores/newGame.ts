import { SENIOR_YEAR } from '@shared/classes'
import { FALLBACK_DORM } from '@shared/dorms'
import { appError, toAppError } from '@shared/errors'
import { fallbackHandleOf } from '@shared/feed'
import { heldSecretsOf, secretTiersWanted } from '@shared/secrets'
import { intakeOf, seasonOf, semesterChain } from '@shared/semesters'
import { emptyTallies } from '@shared/tallies'
import {
  charKeyOf,
  type AppError,
  type Character,
  type CharSecret,
  type Enrollment,
  type FeedAssignment,
  type HiddenScheduleAssignment,
  type JobAssignment,
  type Occasion,
  type PlaythroughRecord,
  type Result
} from '@shared/types'
import {
  buildClassPrompt,
  decorateClasses,
  validateClassDraft,
  type ClassGenReply,
  type ContinuedCatalog
} from '../prompts/classPrompt'
import {
  buildContinuedProfilePrompt,
  buildProfilePrompt,
  feedAssignmentsOf,
  hiddenScheduleAssignmentsOf,
  jobAssignmentsOf,
  mergeProfiles,
  springBreakAssignmentsOf,
  validateContinuedProfiles,
  validateProfileDraft,
  type ContinuedProfileDraft,
  type ContinuedProfileInput,
  type ContinuedProfileReply,
  type ProfileGenDraft,
  type ProfileGenReply
} from '../prompts/profilePrompt'
import {
  buildOccasionPrompt,
  normalizeOccasions,
  planOccasionSlots,
  type OccasionGenDraft,
  type OccasionRequest
} from '../prompts/occasionPrompt'
import {
  buildSecretsPrompt,
  validateSecretDraft,
  type SecretsEntry,
  type SecretsReply
} from '../prompts/secretsPrompt'
import { SEED_WORD_BAG, SEED_WORDS } from '../prompts/seedWords'
import { buildSchedules, type ScheduleResult } from './classScheduler'
import { useGameStore } from './gameStore'
import { useGrabBagStore } from './grabBagStore'
import type { SemesterHandoff } from './semesterCarry'
import { retrySilently } from './silentRetry'

/** The cancellation group New Game's four one-shots register under. */
export const NEW_GAME_LLM_GROUP = 'newGame:llm'

/** Everything the four one-shot New Game calls produce, settled together. */
export interface StartResult {
  schedules: ScheduleResult
  /** Who works where, by charId — the slots themselves are picked at Finalize. */
  jobs: Record<string, JobAssignment>
  /** Where each character likes to be, by charId — placed at Finalize too. */
  haunts: Record<string, HiddenScheduleAssignment>
  /** Her handle and what she posted over the break, by charId — dated at Finalize. */
  feeds: Record<string, FeedAssignment>
  /** What each of them does with spring break, by charId. */
  springBreakPlans: Record<string, string>
  occasions: Occasion[]
  /** The secrets each girl starts the semester with, by charId. */
  secrets: Record<string, CharSecret[]>
}

/**
 * How one press of Start Game ended. `failed` names every call that could not be written,
 * in the modal's words.
 */
export type StartOutcome =
  | { status: 'ready'; data: StartResult }
  | { status: 'failed'; error: AppError; missing: string[] }
  | { status: 'cancelled' }

/** One press of Start Game, held across its retries. */
interface StartAttempt {
  roster: readonly Character[]
  classRequest: ReturnType<typeof buildClassPrompt>
  profileRequest: ReturnType<typeof buildProfilePrompt>
  occasionRequests: OccasionRequest[]
  occasionRequest: ReturnType<typeof buildOccasionPrompt>
  secretEntries: SecretsEntry[]
  secretRequest: ReturnType<typeof buildSecretsPrompt>
  classDraft?: ClassGenReply
  profiles?: ProfileGenDraft
  occasions?: Occasion[]
  secrets?: Record<string, CharSecret[]>
}

/** What each call is called on the modal, in the order failures are reported. */
const CALL_LABELS = {
  classes: 'the class catalog',
  profiles: "the students' profiles",
  occasions: 'the semester’s calendar',
  secrets: "the students' secrets"
} as const

let attempt: StartAttempt | null = null

/**
 * The identity of one press of Start Game, minted by {@link startNewGame} and dropped by
 * {@link cancelNewGameStart} — the game loop's `runToken` for this screen.
 */
let run: object | null = null

/** Cancellers for the backoff sleep in flight, so leaving never waits one out. */
let sleepers: (() => void)[] = []

/** A semester on disk with its cast resolved — what the registrar is reopened on. */
export interface StagedEnrollment {
  playthroughId: string
  enrollment: Enrollment
  characters: Character[]
}

let staged: StagedEnrollment | null = null

/** Hands New Game the enrollment the screen it is about to raise stands on. */
export function stageEnrollment(next: StagedEnrollment): void {
  staged = next
}

/** What is staged, left where it is: a `useState` initializer runs twice under StrictMode. */
export function stagedEnrollment(): StagedEnrollment | null {
  return staged
}

/** Drops what was staged, once the screen holding it has mounted. */
export function clearStagedEnrollment(): void {
  staged = null
}

/** Whether the run a continuation started under is still the live one. */
function stale(mine: object): boolean {
  return run !== mine
}

/** Sends one call until it lands, its budget runs out, or the run is left. */
async function sendUntilAnswered<T>(
  call: string,
  mine: object,
  send: () => Promise<Result<T>>
): Promise<Result<T>> {
  let spent = 0
  for (;;) {
    const result = await send()
    if (stale(mine) || result.ok) return result

    console.warn(`[newGame] ${call} failed:`, result.error)
    const retried = await retrySilently(`newGame:${call}`, result.error, spent, {
      onSleep: (cancel) => sleepers.push(cancel)
    })
    if (!retried || stale(mine)) return result
    spent += 1
  }
}

/** Fetches and validates the save's class catalog. */
async function fetchClassDraft(current: StartAttempt): Promise<Result<ClassGenReply>> {
  const generated = await window.api.llm.generateClasses<ClassGenReply>(
    current.classRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }
  try {
    return { ok: true, data: validateClassDraft(generated.data, current.roster) }
  } catch (err) {
    return { ok: false, error: toAppError(err) }
  }
}

/** Fetches and validates the roster's years, course loads and jobs. */
async function fetchProfiles(current: StartAttempt): Promise<Result<ProfileGenDraft>> {
  const generated = await window.api.llm.generateProfiles<ProfileGenReply>(
    current.profileRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }
  try {
    return { ok: true, data: validateProfileDraft(generated.data, current.roster) }
  } catch (err) {
    return { ok: false, error: toAppError(err) }
  }
}

/** Fetches the semester's own calendar occasions. */
async function fetchOccasions(
  current: Pick<StartAttempt, 'occasionRequest' | 'occasionRequests'>
): Promise<Result<Occasion[]>> {
  const generated = await window.api.llm.generateOccasions<OccasionGenDraft>(
    current.occasionRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }

  const occasions = normalizeOccasions(generated.data, current.occasionRequests)
  if (occasions.length === 0) {
    return {
      ok: false,
      error: appError(
        'OCCASION_GEN_INVALID',
        'The semester’s occasions came back empty.',
        `${current.occasionRequests.length} were asked for; none could be written.`
      )
    }
  }
  return { ok: true, data: occasions }
}

/** Fetches and validates the roster's secrets, keyed by charKey. */
async function fetchSecrets(
  current: Pick<StartAttempt, 'secretEntries' | 'secretRequest'>
): Promise<Result<Record<string, CharSecret[]>>> {
  const generated = await window.api.llm.generateSecrets<SecretsReply>(
    current.secretRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }
  try {
    return { ok: true, data: validateSecretDraft(generated.data, current.secretEntries) }
  } catch (err) {
    return { ok: false, error: toAppError(err) }
  }
}

/**
 * Runs whatever the attempt is still missing, then composes the semester out of the four
 * replies.
 */
async function runAttempt(current: StartAttempt, mine: object): Promise<StartOutcome> {
  const [classResult, profileResult, occasionResult, secretResult] = await Promise.all([
    current.classDraft
      ? Promise.resolve<Result<ClassGenReply>>({ ok: true, data: current.classDraft })
      : sendUntilAnswered('classes', mine, () => fetchClassDraft(current)),
    current.profiles
      ? Promise.resolve<Result<ProfileGenDraft>>({ ok: true, data: current.profiles })
      : sendUntilAnswered('profiles', mine, () => fetchProfiles(current)),
    current.occasions
      ? Promise.resolve<Result<Occasion[]>>({ ok: true, data: current.occasions })
      : sendUntilAnswered('occasions', mine, () => fetchOccasions(current)),
    current.secrets
      ? Promise.resolve<Result<Record<string, CharSecret[]>>>({ ok: true, data: current.secrets })
      : sendUntilAnswered('secrets', mine, () => fetchSecrets(current))
  ])
  if (stale(mine)) return { status: 'cancelled' }

  // Banked before the verdict below, so a retry re-sends only what is still missing.
  if (classResult.ok) current.classDraft = classResult.data
  if (profileResult.ok) current.profiles = profileResult.data
  if (occasionResult.ok) current.occasions = occasionResult.data
  if (secretResult.ok) current.secrets = secretResult.data

  // The first failure is the one the modal shows; the rest are named beside it.
  if (!classResult.ok || !profileResult.ok || !occasionResult.ok || !secretResult.ok) {
    const failures: { label: string; error: AppError }[] = []
    if (!classResult.ok) failures.push({ label: CALL_LABELS.classes, error: classResult.error })
    if (!profileResult.ok) {
      failures.push({ label: CALL_LABELS.profiles, error: profileResult.error })
    }
    if (!occasionResult.ok) {
      failures.push({ label: CALL_LABELS.occasions, error: occasionResult.error })
    }
    if (!secretResult.ok) {
      failures.push({ label: CALL_LABELS.secrets, error: secretResult.error })
    }
    return {
      status: 'failed',
      error: failures[0].error,
      missing: failures.map((failure) => failure.label)
    }
  }

  const { roster } = current
  const profiles = profileResult.data
  const schedules = buildSchedules(
    decorateClasses(mergeProfiles(classResult.data, profiles)),
    roster
  )
  /** One profile assignment map re-keyed from charKey to charId, absences dropped. */
  const byCharId = <T,>(byKey: Record<string, T>): Record<string, T> =>
    Object.fromEntries(
      roster
        .map((c) => [c.charId, byKey[charKeyOf(c.firstName, c.lastName)]] as const)
        .filter(([, assignment]) => Boolean(assignment))
    ) as Record<string, T>

  attempt = null
  return {
    status: 'ready',
    data: {
      schedules,
      jobs: byCharId(jobAssignmentsOf(profiles)),
      haunts: byCharId(hiddenScheduleAssignmentsOf(profiles)),
      feeds: byCharId(feedAssignmentsOf(profiles)),
      springBreakPlans: byCharId(springBreakAssignmentsOf(profiles)),
      occasions: occasionResult.data,
      secrets: byCharId(secretResult.data)
    }
  }
}

/**
 * Start Game's generation pass: the four one-shots in parallel, then the local passes
 * that turn them into a semester.
 */
export async function startNewGame(roster: readonly Character[]): Promise<StartOutcome> {
  const mine = {}
  run = mine
  sleepers = []
  // Clears the tokens any call since the main menu added, so the enrollment counts only this run's.
  useGameStore.setState({ tallies: emptyTallies() })
  const occasionRequests = planOccasionSlots(
    (count) => useGrabBagStore.getState().drawMany(SEED_WORD_BAG, SEED_WORDS, count),
    'spring'
  )
  // Every girl is new to the playthrough, so each is asked for all three.
  const secretEntries: SecretsEntry[] = roster.map((character) => ({
    character,
    tiers: secretTiersWanted(undefined),
    held: []
  }))
  const current: StartAttempt = {
    roster,
    classRequest: buildClassPrompt(roster),
    profileRequest: buildProfilePrompt(roster),
    occasionRequests,
    occasionRequest: buildOccasionPrompt(occasionRequests, 'spring'),
    secretEntries,
    secretRequest: buildSecretsPrompt(secretEntries)
  }
  attempt = current

  return runAttempt(current, mine)
}

/**
 * The failure modal's Retry — resumes the stored attempt, re-sending only the calls with no
 * reply yet. With nothing held, it starts over.
 */
export async function retryNewGameStart(roster: readonly Character[]): Promise<StartOutcome> {
  const current = attempt
  if (!current) return startNewGame(roster)
  const mine = {}
  run = mine
  sleepers = []
  return runAttempt(current, mine)
}

/**
 * Abandons the start: the player answered the modal with Cancel, or left the screen entirely.
 */
export function cancelNewGameStart(): void {
  run = null
  attempt = null
  nextAttempt = null
  const waking = sleepers
  sleepers = []
  for (const wake of waking) wake()
  void window.api.jobs.cancelGroup(NEW_GAME_LLM_GROUP)
}

/**
 * A Continue on its way to the next semester's roster screen: the playthrough, its record as the
 * ending read it, the semester that just ended, and what that ending handed on.
 */
export interface Continuation {
  playthroughId: string
  record: PlaythroughRecord
  /** The semester that just ended; undefined for the first. */
  from: string | undefined
  handoff: SemesterHandoff
}

let continuation: Continuation | null = null

/** Hands the next semester's roster screen the Continue it is about to be raised for. */
export function stageContinuation(next: Continuation): void {
  continuation = next
}

/** What is staged, left where it is: a `useState` initializer runs twice under StrictMode. */
export function stagedContinuation(): Continuation | null {
  return continuation
}

/** Drops the staged Continue, once the screen holding it has mounted. */
export function clearStagedContinuation(): void {
  continuation = null
}

/** A next semester as its generation settles it: the semester, and what its registration carries beyond it. */
export interface NextSemesterResult extends StartResult {
  /** What each graduate is doing now, by charId. */
  pursuits: Record<string, string>
  /** The senior picked to graduate early at a fall's ceremony. */
  fallGraduate?: string
}

/** How one press of a next semester's Start ended. */
export type NextOutcome =
  | { status: 'ready'; data: NextSemesterResult }
  | { status: 'failed'; error: AppError; missing: string[] }
  | { status: 'cancelled' }

/** One press of a next semester's Start, held across its retries. */
interface NextAttempt {
  roster: readonly Character[]
  characters: Readonly<Record<string, Character>>
  continuation: Continuation
  catalog: ContinuedCatalog
  profileInput: ContinuedProfileInput
  classRequest: ReturnType<typeof buildClassPrompt>
  profileRequest: ReturnType<typeof buildContinuedProfilePrompt>
  occasionRequests: OccasionRequest[]
  occasionRequest: ReturnType<typeof buildOccasionPrompt>
  secretEntries: SecretsEntry[]
  secretRequest: ReturnType<typeof buildSecretsPrompt>
  classDraft?: ClassGenReply
  profiles?: ContinuedProfileDraft
  occasions?: Occasion[]
  secrets?: Record<string, CharSecret[]>
}

let nextAttempt: NextAttempt | null = null

/** Every class this timeline has run, by code, oldest semester first: what the catalog avoids. */
function takenClassesOf(
  record: PlaythroughRecord,
  from: string | undefined
): ContinuedCatalog['taken'] {
  const taken = new Map<string, string>()
  for (const { view } of semesterChain(record, from)) {
    for (const entry of Object.values(view.classes)) {
      if (!taken.has(entry.code)) taken.set(entry.code, entry.name)
    }
  }
  return [...taken].map(([code, name]) => ({ code, name }))
}

/** Fetches and validates a next semester's catalog. */
async function fetchNextClasses(current: NextAttempt): Promise<Result<ClassGenReply>> {
  const generated = await window.api.llm.generateClasses<ClassGenReply>(
    current.classRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }
  try {
    return { ok: true, data: validateClassDraft(generated.data, current.roster, current.catalog) }
  } catch (err) {
    return { ok: false, error: toAppError(err) }
  }
}

/** Fetches and validates a next semester's profiles. */
async function fetchNextProfiles(current: NextAttempt): Promise<Result<ContinuedProfileDraft>> {
  const generated = await window.api.llm.generateProfiles<ContinuedProfileReply>(
    current.profileRequest,
    NEW_GAME_LLM_GROUP
  )
  if (!generated.ok) return { ok: false, error: generated.error }
  try {
    return { ok: true, data: validateContinuedProfiles(generated.data, current.profileInput) }
  } catch (err) {
    return { ok: false, error: toAppError(err) }
  }
}

/**
 * A next semester composed out of its four replies: the returning girls kept on their year,
 * dorm, course load, employer and habits, the first-years as New Game deals them.
 */
function composeNext(
  current: NextAttempt,
  classDraft: ClassGenReply,
  profiles: ContinuedProfileDraft,
  occasions: Occasion[],
  secrets: Record<string, CharSecret[]>
): NextSemesterResult {
  const { roster, characters } = current
  const { handoff } = current.continuation
  const keyOf = (character: Character): string => charKeyOf(character.firstName, character.lastName)

  const merged = Object.fromEntries(
    roster.map((character) => {
      const key = keyOf(character)
      const entry = classDraft.characters[key]
      const prior = handoff.priorProfiles[character.charId]
      const newcomer = profiles.newcomers.characters[key]
      // A returning girl takes as many classes as she did, inside the bounds a first-year is held to.
      const load = prior ? Object.keys(prior.schedule).length : (newcomer?.classesTaken ?? 4)
      const classesTaken = Math.min(6, Math.max(3, load || 4))
      return [
        key,
        {
          ...entry,
          year: prior?.year ?? 1,
          dorm: prior?.dorm ?? newcomer?.dorm ?? FALLBACK_DORM,
          classesTaken,
          majorClassesTaken: Math.min(entry.majorClassesTaken, classesTaken)
        }
      ]
    })
  )
  const schedules = buildSchedules(decorateClasses({ ...classDraft, characters: merged }), roster)

  /** One assignment map re-keyed from charKey to charId, absences dropped. */
  const byCharId = <T,>(byKey: Record<string, T>, among: readonly Character[]): Record<string, T> =>
    Object.fromEntries(
      among
        .map((c) => [c.charId, byKey[keyOf(c)]] as const)
        .filter(([, assignment]) => assignment !== undefined)
    ) as Record<string, T>

  const onRoster = (charId: string): boolean => roster.some((c) => c.charId === charId)
  const returningJobs = Object.fromEntries(
    Object.entries(handoff.jobs).filter(([charId]) => onRoster(charId))
  )
  const returningHaunts = Object.fromEntries(
    Object.entries(handoff.haunts).filter(([charId]) => onRoster(charId))
  )

  // Handles stay as they were; the posts are the break's, a first-year having none.
  const graduates = handoff.alumni.flatMap((charId) =>
    characters[charId] ? [characters[charId]] : []
  )
  const feeds: Record<string, FeedAssignment> = {
    ...byCharId(feedAssignmentsOf(profiles.newcomers), roster)
  }
  for (const character of [...roster, ...graduates]) {
    const prior = handoff.priorProfiles[character.charId]
    if (!prior) continue
    feeds[character.charId] = {
      handle: prior.handle ?? fallbackHandleOf(character.firstName, character.lastName),
      winterPosts: profiles.breakPosts[keyOf(character)] ?? []
    }
  }

  const season = seasonOf(handoff.index)
  // A fall's early graduate: one of its seniors from the August intake, picked as it starts.
  const seniors = roster.filter((character) => {
    const prior = handoff.priorProfiles[character.charId]
    return prior !== undefined && prior.year >= SENIOR_YEAR && intakeOf(prior) === 'fall'
  })
  const fallGraduate =
    season === 'fall' && seniors.length > 0
      ? seniors[Math.floor(Math.random() * seniors.length)].charId
      : undefined

  return {
    schedules,
    jobs: { ...byCharId(jobAssignmentsOf(profiles.newcomers), roster), ...returningJobs },
    haunts: {
      ...byCharId(hiddenScheduleAssignmentsOf(profiles.newcomers), roster),
      ...returningHaunts
    },
    feeds,
    springBreakPlans: byCharId(profiles.springBreakPlans, roster),
    occasions,
    secrets: byCharId(secrets, roster),
    pursuits: byCharId(profiles.pursuits, graduates),
    ...(fallGraduate ? { fallGraduate } : {})
  }
}

/** Runs whatever a next semester's attempt is still missing, then composes it. */
async function runNextAttempt(current: NextAttempt, mine: object): Promise<NextOutcome> {
  const [classResult, profileResult, occasionResult, secretResult] = await Promise.all([
    current.classDraft
      ? Promise.resolve<Result<ClassGenReply>>({ ok: true, data: current.classDraft })
      : sendUntilAnswered('classes', mine, () => fetchNextClasses(current)),
    current.profiles
      ? Promise.resolve<Result<ContinuedProfileDraft>>({ ok: true, data: current.profiles })
      : sendUntilAnswered('profiles', mine, () => fetchNextProfiles(current)),
    current.occasions
      ? Promise.resolve<Result<Occasion[]>>({ ok: true, data: current.occasions })
      : sendUntilAnswered('occasions', mine, () => fetchOccasions(current)),
    current.secrets
      ? Promise.resolve<Result<Record<string, CharSecret[]>>>({ ok: true, data: current.secrets })
      : sendUntilAnswered('secrets', mine, () => fetchSecrets(current))
  ])
  if (stale(mine)) return { status: 'cancelled' }

  // Banked before the verdict below, so a retry re-sends only what is still missing.
  if (classResult.ok) current.classDraft = classResult.data
  if (profileResult.ok) current.profiles = profileResult.data
  if (occasionResult.ok) current.occasions = occasionResult.data
  if (secretResult.ok) current.secrets = secretResult.data

  if (!classResult.ok || !profileResult.ok || !occasionResult.ok || !secretResult.ok) {
    const failures: { label: string; error: AppError }[] = []
    if (!classResult.ok) failures.push({ label: CALL_LABELS.classes, error: classResult.error })
    if (!profileResult.ok) {
      failures.push({ label: CALL_LABELS.profiles, error: profileResult.error })
    }
    if (!occasionResult.ok) {
      failures.push({ label: CALL_LABELS.occasions, error: occasionResult.error })
    }
    if (!secretResult.ok) {
      failures.push({ label: CALL_LABELS.secrets, error: secretResult.error })
    }
    return {
      status: 'failed',
      error: failures[0].error,
      missing: failures.map((failure) => failure.label)
    }
  }

  nextAttempt = null
  return {
    status: 'ready',
    data: composeNext(
      current,
      classResult.data,
      profileResult.data,
      occasionResult.data,
      secretResult.data
    )
  }
}

/**
 * A next semester's Start: the four one-shots in parallel — a catalog around the returning
 * majors and away from every class already run, the first-years' profiles beside the returning
 * girls' break and the graduates' lives, the season's occasions and the roster's new secrets —
 * then the local passes.
 */
export async function startNextSemester(
  next: Continuation,
  roster: readonly Character[],
  characters: Readonly<Record<string, Character>>
): Promise<NextOutcome> {
  const mine = {}
  run = mine
  sleepers = []
  // Clears the tokens any call since the ending added, so the registration counts only this run's.
  useGameStore.setState({ tallies: emptyTallies() })

  const { handoff } = next
  const season = seasonOf(handoff.index)
  const keyOf = (character: Character): string => charKeyOf(character.firstName, character.lastName)
  const returning = roster.filter((character) => handoff.priorProfiles[character.charId])
  const catalog: ContinuedCatalog = {
    majors: Object.fromEntries(
      returning.map((character) => [
        keyOf(character),
        handoff.priorProfiles[character.charId].major
      ])
    ),
    taken: takenClassesOf(next.record, next.from)
  }
  const profileInput: ContinuedProfileInput = {
    season,
    newcomers: roster.filter((character) => !handoff.priorProfiles[character.charId]),
    returning,
    graduates: handoff.alumni.flatMap((charId) => {
      const character = characters[charId]
      const prior = handoff.priorProfiles[charId]
      if (!character || !prior) return []
      return [
        { character, major: prior.major, ...(prior.pursuing ? { pursuing: prior.pursuing } : {}) }
      ]
    })
  }
  const occasionRequests = planOccasionSlots(
    (count) => useGrabBagStore.getState().drawMany(SEED_WORD_BAG, SEED_WORDS, count),
    season
  )
  // A returning girl is asked for one more beside what she holds, or for three if she holds none.
  const secretEntries: SecretsEntry[] = roster.map((character) => {
    const carried = handoff.carry.charInfo[character.charId]
    return {
      character,
      tiers: secretTiersWanted(carried),
      held: heldSecretsOf(carried),
      ...(carried?.flags?.hadSex ? { hadSex: true } : {})
    }
  })
  const current: NextAttempt = {
    roster,
    characters,
    continuation: next,
    catalog,
    profileInput,
    classRequest: buildClassPrompt(roster, catalog),
    profileRequest: buildContinuedProfilePrompt(profileInput),
    occasionRequests,
    occasionRequest: buildOccasionPrompt(occasionRequests, season),
    secretEntries,
    secretRequest: buildSecretsPrompt(secretEntries)
  }
  nextAttempt = current
  return runNextAttempt(current, mine)
}

/** A next semester's Retry: re-sends only the calls with no reply yet. */
export async function retryNextSemester(
  next: Continuation,
  roster: readonly Character[],
  characters: Readonly<Record<string, Character>>
): Promise<NextOutcome> {
  const current = nextAttempt
  if (!current) return startNextSemester(next, roster, characters)
  const mine = {}
  run = mine
  sleepers = []
  return runNextAttempt(current, mine)
}
