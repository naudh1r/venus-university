import { availableLocationMenu, jobAvailable } from '@shared/cityLife'
import {
  charKeyOf,
  fullNameOf,
  type Character,
  type FeedAssignment,
  type HiddenScheduleAssignment,
  type JobAssignment,
  type Season,
  type StructuredRequest
} from '@shared/types'
import {
  PROFILE_FIELDS,
  profileFieldDecided,
  yearFloorOf,
  type DecidedProfile,
  type ProfileField
} from '@shared/application'
import { DORM_IDS, FALLBACK_DORM, isDorm, type DormId } from '@shared/dorms'
import { availableJobs, jobDefOf } from '@shared/jobs'
import {
  ACTIVITY_LOCATIONS,
  FUN_LOCATIONS,
  MEAL_LOCATIONS,
  STUDY_LOCATIONS,
  locationForKey,
  locationLabel,
  locationMenuLines
} from '@shared/locations'
import { fallbackHandleOf } from '@shared/feed'
import { appError } from '@shared/errors'
import {
  clamp,
  intField,
  rosterCastLines,
  type ClassGenDraft,
  type ClassGenReply
} from './classPrompt'
import { keyPattern, loreEntryById } from './lorebook'
import { newGameText, withAdditions } from './promptBlocks'
import { objectSchema } from './schema'
import type { GlobalTextId, TextEdits } from '@shared/promptText'

/**
 * Builds and validates the one-shot student-profile request; pure, no IO.
 */

/** How many shifts a working character may be given. */
const MAX_NPC_SHIFTS = 2

/** How many evenings a week a character may be asked to stay in. */
const MIN_HOME_SLOTS = 1
const MAX_HOME_SLOTS = 3

/** How many places she may go out to for fun. */
const MAX_FUN_LOCATIONS = 2

/** One character's profile as the model returns it. */
interface CharProfileDraft {
  year: number
  classesTaken: number
  /** Where she lives on campus — a {@link DormId}. */
  dorm: DormId
  /** A `JobDef.id`, or `''` for a character who holds no job. */
  job: string
  /** How many weekly shifts she works; 0 whenever `job` is blank. */
  jobShifts: number
  /** How many slots a week she spends in her own room. */
  homeSlots: number
  /** A `STUDY_LOCATIONS` key, or `''` for a character who studies in her room. */
  study: string
  /** Up to {@link MAX_FUN_LOCATIONS} `FUN_LOCATIONS` keys; empty for a homebody. */
  fun: string[]
  /** The weekly interest in her own words — "sketching at the Whitman Greenhouse" — or `''`. */
  activity: string
  /** The `ACTIVITY_LOCATIONS` key {@link activity} happens at, or `''` when it is blank. */
  activityLocation: string
  /** A `MEAL_LOCATIONS` key, or `''` for a character who eats in. */
  meal: string
  /** Her social handle, repaired to `fallbackHandleOf` when unusable. */
  handle: string
  /** What she posted over the winter break, nought to {@link MAX_WINTER_POSTS}; upperclassmen only. */
  winterPosts: string[]
  /** What she does with spring break, as one short phrase; whether she goes is the save's to settle. */
  springBreakPlans: string
  /** The field she studies. */
  major?: string
  /** How many of her classes are in her major; asked beside {@link major}. */
  majorClassesTaken?: number
}

/** The most winter-break posts one character may arrive with. */
const MAX_WINTER_POSTS = 3

/** The validated shape every consumer reads: profiles keyed by charKey. */
export interface ProfileGenDraft {
  characters: Record<string, CharProfileDraft>
}

/** The whole reply as the model returns it: one record per student, each naming its charKey. */
export interface ProfileGenReply {
  characters: Array<CharProfileDraft & { key: string }>
}

/** A handle as it will be printed, or `''` when nothing is salvageable: strips a leading `@` and anything outside the prompt's character set. */
export function normalizeHandle(raw: string): string {
  const stripped = raw.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._]/g, '')
  return /[a-z]/.test(stripped) ? stripped : ''
}

/**
 * Her activity phrase as it will be printed: no trailing full stop, and opening lowercase unless
 * its first word carries a capital of its own, which makes it a name or an acronym like "DJing".
 */
export function normalizeActivity(raw: unknown): string {
  const text = (typeof raw === 'string' ? raw : '').trim().replace(/\.+$/, '').trim()
  if (text === '') return ''
  const first = text.split(/\s+/)[0]
  return /[A-Z]/.test(first.slice(1)) ? text : text[0].toLowerCase() + text.slice(1)
}

/** Whether a phrase already says where it happens, by the lorebook keys of the place it names. */
function namesLocation(phrase: string, locationId: string): boolean {
  const keys = loreEntryById(locationId)?.keys ?? []
  if (keys.length === 0) return false
  return new RegExp(keys.map((key) => keyPattern(key)).join('|'), 'iu').test(phrase)
}

/**
 * Her activity phrase as it is printed at the place it happens, which it stands in for there:
 * normalized, and with the place appended where the phrase never says it.
 */
export function activityPhraseAt(raw: unknown, locationId: string): string {
  const phrase = normalizeActivity(raw)
  if (phrase === '' || namesLocation(phrase, locationId)) return phrase
  return `${phrase} at ${locationLabel(locationId)}`
}

/** Thrown as an `AppError` when the reply cannot be used. */
function invalid(detail: string): never {
  throw appError('PROFILE_GEN_INVALID', 'The generated student profiles were not usable.', detail)
}

/** Who the profile calls are written by, and the world the students live in. */
function profileSystem(setting: string, textEdits?: TextEdits<GlobalTextId>): string {
  return [
    withAdditions(
      newGameText(textEdits, 'newgame.profiles.system'),
      textEdits,
      'newgame.profiles.additions'
    ),
    '',
    'SETTING',
    setting
  ].join('\n')
}

/** Her job, and the employers she may hold one at. */
function workLines(): string[] {
  const employers = availableJobs().map((def) => `${def.id} — ${def.employer}, ${def.title}: ${def.blurb}`)
  return [
    'PART-TIME WORK',
    'If the student works a part-time job, you can describe it as follows:',
    'job: the id of the employer she works for, exactly as written below. Leave empty if she has no job.',
    `jobShifts: how many shifts a week she works, 1 or ${MAX_NPC_SHIFTS} when she has a job, and 0 when she does not.`,
    '',
    'EMPLOYERS',
    ...employers,
    ''
  ]
}

/** Where she habitually goes, and the menus each habit is picked from. */
function hauntLines(textEdits?: TextEdits<GlobalTextId>): string[] {
  return [
    'WHERE SHE SPENDS HER FREE TIME',
    'Decide some places where she goes by habit. Answer with the keys below, exactly as written:',
    `homeSlots: how many times a week she stays in her own room, ${MIN_HOME_SLOTS} to ${MAX_HOME_SLOTS}.`,
    'study: where she goes to study, or an empty string if she studies in her own room.',
    `fun: 0 to ${MAX_FUN_LOCATIONS} places she goes out to enjoy herself. Leave it empty for somebody who does not go out.`,
    newGameText(textEdits, 'newgame.profiles.freeTime'),
    '',
    'STUDY LOCATIONS',
    ...locationMenuLines(availableLocationMenu(STUDY_LOCATIONS)),
    '',
    'FUN LOCATIONS',
    ...locationMenuLines(availableLocationMenu(FUN_LOCATIONS)),
    '',
    'MEAL LOCATIONS',
    ...locationMenuLines(availableLocationMenu(MEAL_LOCATIONS)),
    '',
    'ACTIVITY LOCATIONS',
    ...locationMenuLines(availableLocationMenu(ACTIVITY_LOCATIONS)),
    ''
  ]
}

/** How the posts she made over a break are asked for, `field` being the field that holds them. */
function breakPostsLine(field: string, breakName: string): string {
  return `${field}: nought to ${MAX_WINTER_POSTS} short status updates she posted over the ${breakName}, oldest first. Keep these casual, using lowercase and/or emoji if it suits her. Don't address them to anyone, like other students or the reader.`
}

/** One student the profile call writes for, with whatever of her profile is already decided. */
export interface ProfileStudent {
  character: Character
  /** Her decided fields in the reply's own vocabulary, as {@link decidedProfileOf} gives them. */
  decided: Partial<CharProfileDraft>
}

/** Everything New Game's profile call is built from. */
export interface ProfilePromptInput {
  /** The roster girls with something left to write, in roster order. */
  students: readonly ProfileStudent[]
  /** The majors decided for the girls the call leaves out, which another may share. */
  otherMajors: readonly string[]
  /**
   * A later semester's: its season, the returning girls asked their break, the graduates their
   * lives since.
   */
  next?: NextProfileInput
  setting: string
}

/** Who a later semester's profile call asks beside its new students, and before which season. */
export interface NextProfileInput {
  season: Season
  /** The roster girls coming back, asked only for their break. */
  returning: readonly Character[]
  graduates: readonly GraduateBrief[]
}

/** How a decided value is said to the model: the field and the value, as the reply would hold them. */
function decidedLine(decided: Readonly<Record<string, unknown>>): string | null {
  const fields = Object.entries(decided).filter(([, value]) => value !== undefined)
  if (fields.length === 0) return null
  return `Already decided, to be answered exactly as written: ${fields
    .map(([field, value]) => `${field}: ${JSON.stringify(value)}`)
    .join('; ')}.`
}

/**
 * What each new student is asked, under `heading`: her winter break posts only where `posts`, her
 * spring break plans only where `plans`. A later semester's `next` swaps in its own housing text
 * and adds its new-student line.
 */
function newStudentLines(
  heading: string,
  posts: boolean,
  plans: boolean,
  textEdits?: TextEdits<GlobalTextId>,
  next = false
): string[] {
  const newcomers = newGameText(textEdits, 'newgame.profiles.next.newcomers')
  return [
    heading,
    'year: 1 = Freshman, 2 = Sophomore, 3 = Junior, 4 = Senior.',
    'major: the field she studies. Pick one that fits her personality. Collapse similar majors like Business Studies and Business Science into a single major like Business Administration.',
    newGameText(textEdits, 'newgame.profiles.instructions'),
    ...(next && newcomers.trim() !== '' ? [newcomers] : []),
    'majorClassesTaken: how many of those classes are in her major, from 1 to 3.',
    '',
    ...workLines(),
    'HOUSING',
    newGameText(textEdits, next ? 'newgame.profiles.next.housing' : 'newgame.profiles.housing'),
    '',
    ...hauntLines(textEdits),
    'SOCIAL MEDIA',
    newGameText(textEdits, 'newgame.profiles.handle'),
    ...(posts
      ? [
          breakPostsLine('winterPosts', 'winter break'),
          'First-year students get no posts, leave the array empty. Everyone else gets at least one.'
        ]
      : []),
    '',
    ...(plans ? ['SPRING BREAK', newGameText(textEdits, 'newgame.profiles.springBreak'), ''] : []),
    'DECIDED FIELDS',
    'Some of a student\'s fields may already be decided, written under her name. Answer those exactly as written, and fit the rest of her profile around them.'
  ]
}

/** Each new student's cast line, her decided fields under it, then her personality. */
function newStudentBlock(students: readonly ProfileStudent[], cast: readonly string[]): string[] {
  return students.flatMap((student, index) => {
    const [line, personality] = cast.slice(index * 3, index * 3 + 2)
    const decided = decidedLine(student.decided)
    return [line, ...(decided ? [decided] : []), personality, '']
  })
}

/**
 * The fields a new student's entry holds, in the order she is answered in: her winter break
 * posts only where `posts`, her spring break plans only where `plans`.
 */
function newStudentProperties(posts: boolean, plans: boolean): Record<string, unknown> {
  return {
    year: intField(1, 4),
    major: { type: 'string' },
    classesTaken: intField(3, 6),
    majorClassesTaken: intField(1, 3),
    // Closed like `job`: the dorm list is code, identical in every save.
    dorm: { type: 'string', enum: [...DORM_IDS] },
    job: { type: 'string', enum: ['', ...availableJobs().map((def) => def.id)] },
    jobShifts: intField(0, MAX_NPC_SHIFTS),
    homeSlots: intField(MIN_HOME_SLOTS, MAX_HOME_SLOTS),
    // Closed for `job`'s reason; `''` is legal in the two optional ones and is the ordinary answer.
    study: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(STUDY_LOCATIONS))] },
    fun: {
      type: 'array',
      maxItems: MAX_FUN_LOCATIONS,
      items: { type: 'string', enum: [...Object.keys(availableLocationMenu(FUN_LOCATIONS))] }
    },
    // Her own phrase, unlike the closed menus: the place it happens at rides `activityLocation`.
    activity: { type: 'string' },
    handle: { type: 'string' },
    ...(posts
      ? { winterPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } } }
      : {}),
    ...(plans ? { springBreakPlans: { type: 'string' } } : {}),
    activityLocation: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(ACTIVITY_LOCATIONS))] },
    meal: { type: 'string', enum: ['', ...Object.keys(availableLocationMenu(MEAL_LOCATIONS))] }
  }
}

/** Builds the student-profile request, or null when nobody is left to ask anything. */
export function buildProfilePrompt(
  input: ProfilePromptInput,
  textEdits?: TextEdits<GlobalTextId>
): StructuredRequest | null {
  if (input.next) return buildNextProfilePrompt(input, input.next, textEdits)
  if (input.students.length === 0) return null
  const { keys, cast } = rosterCastLines(input.students.map((student) => student.character))

  const preamble = [...newStudentLines('FOR EACH STUDENT', true, true, textEdits), '---', ''].join('\n')

  // Below the '---' divider: the roster is all that varies, and the console log starts here.
  const rest = [
    'characters holds one entry per student below, its key exactly as written before her name, in the order listed.',
    '',
    ...(input.otherMajors.length > 0
      ? [
          `Other students already major in ${[...input.otherMajors].sort().join(', ')}; a student below may share one of them where it fits her.`,
          ''
        ]
      : []),
    'STUDENTS',
    ...newStudentBlock(input.students, cast)
  ].join('\n')

  // Gemini rejects a schema past a complexity cap with a bare INVALID_ARGUMENT: this record
  // keyed once per roster member passes at ten students and fails at eleven, while one item
  // schema in an array costs the same at any roster size. Left boundless — minItems or
  // maxItems on the array trips the cap again.
  const schema = objectSchema('student_profiles', ['characters'], {
    characters: keyedArray(keys, newStudentProperties(true, true))
  })

  // The roster is in the prompt, so this caches only across retries of the same New Game.
  return {
    system: profileSystem(input.setting, textEdits),
    user: `${preamble}\n${rest}`,
    schema,
    cacheKey: 'venus-university-profile-generation',
    logFrom: preamble.length + 1
  }
}

/**
 * A later semester's profile request: its new students as New Game asks them but for break posts,
 * the returning girls' break, and every graduate's life since; null when nobody is asked.
 */
function buildNextProfilePrompt(
  input: ProfilePromptInput,
  next: NextProfileInput,
  textEdits?: TextEdits<GlobalTextId>
): StructuredRequest | null {
  const { students } = input
  const { returning, graduates } = next
  if (students.length + returning.length + graduates.length === 0) return null
  const breakName = breakNameOf(next.season)
  const spring = next.season === 'spring'

  const sections: string[][] = []
  /** One group of the reply: its key, the heading its students stand under, and their lines. */
  const groups: { group: string; heading: string; lines: string[]; schema: unknown }[] = []

  if (students.length > 0) {
    sections.push(newStudentLines('FOR EACH NEW STUDENT', false, spring, textEdits, true))
    const { keys, cast } = rosterCastLines(students.map((student) => student.character))
    groups.push({
      group: 'characters',
      heading: 'NEW STUDENTS',
      lines: newStudentBlock(students, cast),
      schema: keyedArray(keys, newStudentProperties(false, spring))
    })
  }

  if (returning.length > 0) {
    sections.push([
      'FOR EACH RETURNING STUDENT',
      breakPostsLine('breakPosts', breakName),
      'Everyone gets at least one.',
      ...(spring ? [newGameText(textEdits, 'newgame.profiles.springBreak')] : [])
    ])
    const { keys, cast } = rosterCastLines(returning)
    groups.push({
      group: 'returning',
      heading: 'RETURNING STUDENTS',
      lines: cast,
      schema: keyedArray(keys, {
        breakPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } },
        ...(spring ? { springBreakPlans: { type: 'string' } } : {})
      })
    })
  }

  if (graduates.length > 0) {
    sections.push([
      'FOR EACH GRADUATE',
      newGameText(textEdits, 'newgame.profiles.next.graduates'),
      breakPostsLine('breakPosts', breakName),
      'Everyone gets at least one.',
      ...(graduates.some((graduate) => graduate.decided)
        ? [
            'A graduate\'s pursuing may already be decided, written under her name. Answer it exactly as written, and fit her posts around it.'
          ]
        : [])
    ])
    const { keys, cast } = rosterCastLines(graduates.map((graduate) => graduate.character))
    groups.push({
      group: 'graduates',
      heading: 'GRADUATES',
      lines: graduates.flatMap((graduate, index) => {
        const [line, personality] = cast.slice(index * 3, index * 3 + 2)
        const decided = graduate.decided ? decidedLine({ pursuing: graduate.decided }) : null
        return [
          line,
          `Majored in ${graduate.major}.`,
          ...(graduate.pursuing ? [`Last semester she was ${graduate.pursuing}.`] : []),
          ...(decided ? [decided] : []),
          personality,
          ''
        ]
      }),
      schema: keyedArray(keys, {
        pursuing: { type: 'string' },
        breakPosts: { type: 'array', maxItems: MAX_WINTER_POSTS, items: { type: 'string' } }
      })
    })
  }

  const preamble = [
    ...sections.flatMap((section, index) => (index === 0 ? section : ['', ...section])),
    '---',
    ''
  ].join('\n')

  // Below the '---' divider: the students are all that varies, and the console log starts here.
  const named = groups.map(({ group, heading }) => `${group} under ${heading}`)
  const rest = [
    groups.length === 1
      ? `${groups[0].group} holds one entry per student under ${groups[0].heading} below, its key exactly as written before her name, in the order listed.`
      : `${groups.map(({ group }) => group).join(', ')} each hold one entry per student under their headings below (${named.join(', ')}), its key exactly as written before her name, in the order listed.`,
    '',
    ...(input.otherMajors.length > 0
      ? [
          `Other students already major in ${[...input.otherMajors].sort().join(', ')}; a student below may share one of them where it fits her.`,
          ''
        ]
      : []),
    ...groups.flatMap(({ heading, lines }) => [heading, ...lines])
  ].join('\n')

  return {
    system: profileSystem(input.setting, textEdits),
    user: `${preamble}\n${rest}`,
    schema: objectSchema(
      'student_profiles',
      groups.map(({ group }) => group),
      Object.fromEntries(groups.map(({ group, schema }) => [group, schema]))
    ),
    cacheKey: `venus-university-profile-continued-${next.season}`,
    logFrom: preamble.length + 1
  }
}

/** The menu key a location id is offered under, or null where the menu does not offer it. */
function menuKeyOf(menu: Readonly<Record<string, string>>, id: string): string | null {
  return Object.entries(menu).find(([, offered]) => offered === id)?.[0] ?? null
}

/**
 * A decided profile in the reply's own vocabulary — menu keys, the job's id and shift count —
 * holding only the fields among `fields` it decides. A place a menu no longer offers is left
 * undecided.
 */
export function decidedProfileOf(
  profile: DecidedProfile,
  fields: readonly ProfileField[] = PROFILE_FIELDS
): Partial<CharProfileDraft> {
  const decided = (field: ProfileField): boolean =>
    fields.includes(field) && profileFieldDecided(profile, field)
  const place = (menu: Readonly<Record<string, string>>, id: string | null | undefined) =>
    id === null ? '' : id === undefined ? null : menuKeyOf(menu, id)
  const out: Partial<CharProfileDraft> = {}

  if (decided('year')) out.year = profile.year
  if (decided('major')) out.major = profile.major?.trim()
  if (decided('classesTaken')) out.classesTaken = profile.classesTaken
  if (decided('majorClassesTaken')) out.majorClassesTaken = profile.majorClassesTaken
  if (decided('dorm')) out.dorm = profile.dorm
  if (decided('homeSlots')) out.homeSlots = profile.homeSlots
  if (decided('handle')) out.handle = profile.handle?.trim()
  if (decided('springBreakPlans')) out.springBreakPlans = profile.springBreakPlans?.trim()
  if (decided('job')) {
    out.job = profile.job?.jobId ?? ''
    out.jobShifts = profile.job?.count ?? 0
  }
  if (decided('study')) {
    const key = place(STUDY_LOCATIONS, profile.study)
    if (key !== null) out.study = key
  }
  if (decided('meal')) {
    const key = place(MEAL_LOCATIONS, profile.meal)
    if (key !== null) out.meal = key
  }
  if (decided('fun')) {
    out.fun = (profile.fun ?? []).flatMap((id) => {
      const key = menuKeyOf(FUN_LOCATIONS, id)
      return key ? [key] : []
    })
  }
  if (decided('activity')) {
    const key = profile.activity ? menuKeyOf(ACTIVITY_LOCATIONS, profile.activity.location ?? '') : ''
    if (key !== null) {
      out.activity = profile.activity?.doing?.trim() ?? ''
      out.activityLocation = key
    }
  }
  if (decided('breakPosts')) out.winterPosts = profile.breakPosts ?? []
  return out
}

/**
 * Folds the reply's array of records into one keyed by charKey: an entry that is not an
 * object, or whose key names nobody on the roster, is dropped; the first entry for a key
 * wins over any later duplicate.
 */
function foldByKey(
  reply: ProfileGenReply,
  keys: ReadonlySet<string>
): Record<string, CharProfileDraft> {
  const list: unknown = reply?.characters
  const folded: Record<string, CharProfileDraft> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) {
      console.warn('[profiles] a characters entry was not an object; skipping it.')
      continue
    }
    const entry = raw as Record<string, unknown>
    const key = typeof entry.key === 'string' ? entry.key.trim() : ''
    if (!keys.has(key)) {
      console.warn(`[profiles] a characters entry named the unknown key "${key}"; skipping it.`)
      continue
    }
    if (folded[key]) {
      console.warn(`[profiles] ${key} was profiled twice; keeping the first.`)
      continue
    }
    folded[key] = entry as unknown as CharProfileDraft
  }
  return folded
}

/**
 * Reads majors as they are kept: trimmed, spaces collapsed, and spelt as the first one it read
 * that differs only in case. Blank reads as `''`.
 */
export function majorSpeller(): (raw: unknown) => string {
  const spellings = new Map<string, string>()
  return (raw) => {
    const major = (typeof raw === 'string' ? raw : '').trim().replace(/\s+/g, ' ')
    if (major === '') return ''
    const known = spellings.get(major.toLowerCase())
    if (known !== undefined) return known
    spellings.set(major.toLowerCase(), major)
    return major
  }
}

/** What a profile validation keeps beyond the profile itself. */
export interface ProfileValidation {
  /** Majors already spelt, which one differing only in case or spacing is spelt as, first first. */
  knownMajors?: readonly string[]
  /** Whether she keeps any winter posts; she does by default. */
  posts?: boolean
  /** Whether she keeps any spring break plans; she does by default. */
  plans?: boolean
}

/**
 * Validates New Game's reply with each girl's decided fields laid over hers, so the player's
 * values win and pass the same repairs. `asked` names the girls the call wrote for, every one by
 * default; a girl it did not is profiled from her decided fields alone. A major is required, and
 * two that differ only in case or spacing are one, spelt as a known one is, else as a decided one.
 */
export function validateProfileDraft(
  reply: ProfileGenReply | undefined,
  roster: readonly Character[],
  decided: Readonly<Record<string, Partial<CharProfileDraft>>> = {},
  asked: ReadonlySet<string> = new Set(roster.map((c) => charKeyOf(c.firstName, c.lastName))),
  opts: ProfileValidation = {}
): ProfileGenDraft {
  const folded = reply ? foldByKey(reply, asked) : {}
  const characters: Record<string, CharProfileDraft> = {}

  const spell = majorSpeller()
  for (const major of opts.knownMajors ?? []) spell(major)
  for (const character of roster) spell(decided[charKeyOf(character.firstName, character.lastName)]?.major)

  for (const character of roster) {
    const key = charKeyOf(character.firstName, character.lastName)
    const written = folded[key]
    if (asked.has(key) && !written) invalid(`${fullNameOf(character)} was left unprofiled.`)
    const own = decided[key] ?? {}
    const profile = { ...written, ...own } as CharProfileDraft
    // A year left to generate is never below what her decided dorm allows.
    if (own.year === undefined && typeof profile.year === 'number') {
      const floor = yearFloorOf({ dorm: own.dorm })
      profile.year = Math.max(profile.year, floor)
    }
    const major = spell(profile.major)
    if (major === '') invalid(`${fullNameOf(character)} was given no major.`)
    characters[key] = {
      ...validatedProfile(character, key, profile, opts),
      major,
      majorClassesTaken: clamp(profile.majorClassesTaken as number, 1, 3, `${key} majorClassesTaken`)
    }
  }

  return { characters }
}

/**
 * One student's profile as the model wrote it, every field repaired or clamped into range, her
 * posts and plans emptied where `opts` keeps none.
 */
function validatedProfile(
  character: Character,
  key: string,
  profile: CharProfileDraft,
  opts: Pick<ProfileValidation, 'posts' | 'plans'> = {}
): CharProfileDraft {
  const { posts = true, plans = true } = opts
  const job = (profile.job ?? '').trim()
  const known = job !== '' && Boolean(jobDefOf(job)) && jobAvailable(job)
  if (job !== '' && !known) {
    console.warn(`[profiles] ${key} was given the unknown employer "${job}"; leaving her jobless.`)
  }
  const jobShifts = known ? clamp(profile.jobShifts, 0, MAX_NPC_SHIFTS, `${key} jobShifts`) : 0

  // An unknown dorm is repaired to the fallback, like the job, not fatal.
  const dorm = (profile.dorm ?? '').trim()
  if (!isDorm(dorm)) {
    console.warn(`[profiles] ${key} was housed in the unknown dorm "${dorm}"; using ${FALLBACK_DORM}.`)
  }

  // An unknown haunt is dropped, like the job, not fatal.
  const menuKey = (menu: Record<string, string>, value: unknown, field: string): string => {
    const raw = typeof value === 'string' ? value.trim() : ''
    if (raw === '') return ''
    if (locationForKey(availableLocationMenu(menu), raw) === null) {
      console.warn(`[profiles] ${key} ${field} was the unknown location "${raw}"; dropping it.`)
      return ''
    }
    return raw.toLowerCase()
  }

  const fun: string[] = []
  for (const entry of Array.isArray(profile.fun) ? profile.fun : []) {
    const resolved = menuKey(FUN_LOCATIONS, entry, 'fun')
    if (resolved !== '' && !fun.includes(resolved) && fun.length < MAX_FUN_LOCATIONS) {
      fun.push(resolved)
    }
  }

  // The phrase and the place it happens at stand or fall together: either alone says nothing.
  let activity = normalizeActivity(profile.activity)
  let activityLocation = menuKey(ACTIVITY_LOCATIONS, profile.activityLocation, 'activityLocation')
  if ((activity === '') !== (activityLocation === '')) {
    console.warn(
      `[profiles] ${key} gave the activity "${activity}" at "${activityLocation}"; dropping both.`
    )
    activity = ''
    activityLocation = ''
  }
  const activityId = activityLocation ? locationForKey(ACTIVITY_LOCATIONS, activityLocation) : null
  if (activityId) activity = activityPhraseAt(activity, activityId)

  // The handle and her winter posts are repaired, like the job, not fatal.
  const year = clamp(profile.year, 1, 4, `${key} year`)
  const rawHandle = typeof profile.handle === 'string' ? profile.handle.trim() : ''
  const handle = normalizeHandle(rawHandle)
  if (handle === '') {
    console.warn(`[profiles] ${key} was given the unusable handle "${rawHandle}"; deriving one.`)
  }

  const winterPosts: string[] = []
  // A freshman gets no posts, whatever the model wrote.
  if (posts && year > 1) {
    for (const entry of Array.isArray(profile.winterPosts) ? profile.winterPosts : []) {
      const text = typeof entry === 'string' ? entry.trim() : ''
      if (text !== '' && winterPosts.length < MAX_WINTER_POSTS) winterPosts.push(text)
    }
  }

  // Repaired to blank, not fatal.
  const springBreakPlans =
    plans && typeof profile.springBreakPlans === 'string' ? profile.springBreakPlans.trim() : ''
  if (plans && springBreakPlans === '') {
    console.warn(`[profiles] ${key} was given no spring break plans.`)
  }

  return {
    year,
    handle: handle === '' ? fallbackHandleOf(character.firstName, character.lastName) : handle,
    winterPosts,
    springBreakPlans,
    dorm: isDorm(dorm) ? dorm : FALLBACK_DORM,
    classesTaken: clamp(profile.classesTaken, 3, 6, `${key} classesTaken`),
    // A job with no shifts is no job: the two fields are stored agreeing.
    job: known && jobShifts > 0 ? job : '',
    jobShifts: known ? jobShifts : 0,
    homeSlots: clamp(profile.homeSlots, MIN_HOME_SLOTS, MAX_HOME_SLOTS, `${key} homeSlots`),
    study: menuKey(STUDY_LOCATIONS, profile.study, 'study'),
    fun,
    activity,
    activityLocation,
    meal: menuKey(MEAL_LOCATIONS, profile.meal, 'meal')
  }
}

/** One graduate as a next semester's profile call reads her: her major and what she was doing. */
export interface GraduateBrief {
  character: Character
  major: string
  /** What she was doing last semester; absent for a girl who has only just graduated. */
  pursuing?: string
  /** The pursuit the player wrote for her. */
  decided?: string
}

/** What a later semester's reply says beyond its new students, as the model returns it. */
export interface ContinuedProfileReply {
  returning?: Array<{ key: string; breakPosts?: unknown; springBreakPlans?: unknown }>
  graduates?: Array<{ key: string; pursuing?: unknown; breakPosts?: unknown }>
}

/** What the break before a `season` semester is called. */
function breakNameOf(season: Season): string {
  return season === 'fall' ? 'summer vacation' : 'winter break'
}

/** What a graduate is doing when the model gave nothing usable: last semester's, or a placeholder. */
export function fallbackPursuit(previous: string | undefined): string {
  return previous && previous.trim() !== '' ? previous.trim() : 'settling into life after college'
}

/**
 * One array of records keyed by charKey: the shape a record per student has to take, since a
 * record keyed once per student trips Gemini's schema-complexity cap past ten of them.
 */
export function keyedArray(keys: readonly string[], properties: Record<string, unknown>): unknown {
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['key', ...Object.keys(properties)],
      properties: { key: { type: 'string', enum: [...keys] }, ...properties }
    }
  }
}

/** The records of one group keyed by charKey, an unknown or repeated key dropped. */
function foldGroup<T extends { key: string }>(
  list: unknown,
  keys: ReadonlySet<string>,
  group: string
): Record<string, T> {
  const folded: Record<string, T> = {}
  for (const raw of Array.isArray(list) ? list : []) {
    if (typeof raw !== 'object' || raw === null) continue
    const key = typeof (raw as { key?: unknown }).key === 'string' ? (raw as T).key.trim() : ''
    if (!keys.has(key) || folded[key]) {
      console.warn(`[profiles] a ${group} entry named "${key}", unknown or repeated; skipping it.`)
      continue
    }
    folded[key] = raw as T
  }
  return folded
}

/** Up to the cap of non-blank posts out of whatever the model sent. */
function postsOf(raw: unknown): string[] {
  const posts: string[] = []
  for (const entry of Array.isArray(raw) ? raw : []) {
    const text = typeof entry === 'string' ? entry.trim() : ''
    if (text !== '' && posts.length < MAX_WINTER_POSTS) posts.push(text)
  }
  return posts
}

/** What a later semester's reply says beyond its new students, by charKey. */
export interface NextProfiles {
  /** What each returning girl and each graduate posted over the break. */
  breakPosts: Record<string, string[]>
  /** Each returning girl's spring break plans; empty before a fall. */
  springBreakPlans: Record<string, string>
  /** What each graduate is doing now. */
  pursuits: Record<string, string>
}

/**
 * Validates the returning girls' and the graduates' half of a later semester's reply, never
 * refusing it: a girl left out costs only her posts, and a graduate's life is the one the player
 * decided, else the reply's, else last semester's.
 */
export function validateNextProfiles(
  reply: Pick<ContinuedProfileReply, 'returning' | 'graduates'> | undefined,
  next: NextProfileInput
): NextProfiles {
  const keyOf = (character: Character): string => charKeyOf(character.firstName, character.lastName)

  const breakPosts: Record<string, string[]> = {}
  const springBreakPlans: Record<string, string> = {}
  const returning = foldGroup<{ key: string; breakPosts?: unknown; springBreakPlans?: unknown }>(
    reply?.returning,
    new Set(next.returning.map(keyOf)),
    'returning'
  )
  for (const character of next.returning) {
    const key = keyOf(character)
    breakPosts[key] = postsOf(returning[key]?.breakPosts)
    const plans = returning[key]?.springBreakPlans
    if (next.season === 'spring' && typeof plans === 'string' && plans.trim() !== '') {
      springBreakPlans[key] = plans.trim()
    }
  }

  const pursuits: Record<string, string> = {}
  const graduates = foldGroup<{ key: string; pursuing?: unknown; breakPosts?: unknown }>(
    reply?.graduates,
    new Set(next.graduates.map((graduate) => keyOf(graduate.character))),
    'graduates'
  )
  for (const graduate of next.graduates) {
    const key = keyOf(graduate.character)
    const pursuing = graduates[key]?.pursuing
    const phrase =
      normalizeActivity(graduate.decided) ||
      (typeof pursuing === 'string' ? normalizeActivity(pursuing) : '')
    if (phrase === '') console.warn(`[profiles] ${key} was given no pursuit; keeping her last one.`)
    pursuits[key] = phrase === '' ? fallbackPursuit(graduate.pursuing) : phrase
    breakPosts[key] = postsOf(graduates[key]?.breakPosts)
  }

  return { breakPosts, springBreakPlans, pursuits }
}


/** The academic half of one profile: all the scheduler reads of it. */
export type ProfileAcademics = Pick<
  CharProfileDraft,
  'year' | 'dorm' | 'major' | 'classesTaken' | 'majorClassesTaken'
>

/**
 * Joins the two New Game replies into the draft the scheduler consumes, her major and how many
 * of her classes are in it taken from her profile.
 */
export function mergeProfiles(
  classDraft: ClassGenReply,
  profiles: { characters: Readonly<Record<string, ProfileAcademics>> }
): ClassGenDraft {
  const characters = Object.fromEntries(
    Object.entries(classDraft.characters).map(([key, entry]) => {
      const profile = profiles.characters[key]
      const classesTaken = profile?.classesTaken ?? 4
      const wanted = profile?.majorClassesTaken ?? 1
      const majorClassesTaken = Math.min(wanted, classesTaken)
      if (majorClassesTaken !== wanted) {
        console.warn(
          `[profiles] ${key} majorClassesTaken was ${wanted} of ${classesTaken};` +
            ` clamped to ${majorClassesTaken}.`
        )
      }
      return [
        key,
        {
          ...entry,
          major: profile?.major ?? entry.major,
          year: profile?.year ?? 1,
          dorm: profile?.dorm ?? FALLBACK_DORM,
          classesTaken,
          majorClassesTaken
        }
      ]
    })
  )

  return { ...classDraft, characters }
}

/** The job half of the reply, keyed by charKey; kept out of the scheduler. */
export function jobAssignmentsOf(profiles: ProfileGenDraft): Record<string, JobAssignment> {
  const assignments: Record<string, JobAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    if (profile.job && profile.jobShifts > 0) {
      assignments[key] = { jobId: profile.job, count: profile.jobShifts }
    }
  }
  return assignments
}

/** The social half of the reply, keyed by charKey; kept out of the scheduler like the job. */
export function feedAssignmentsOf(profiles: ProfileGenDraft): Record<string, FeedAssignment> {
  const assignments: Record<string, FeedAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    assignments[key] = { handle: profile.handle, winterPosts: profile.winterPosts }
  }
  return assignments
}

/** What each of them does with spring break, keyed by charKey; blanks are omitted. */
export function springBreakAssignmentsOf(profiles: ProfileGenDraft): Record<string, string> {
  const assignments: Record<string, string> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    if (profile.springBreakPlans !== '') assignments[key] = profile.springBreakPlans
  }
  return assignments
}

/** The haunts half of the reply, keyed by charKey and resolved to location ids. */
export function hiddenScheduleAssignmentsOf(
  profiles: ProfileGenDraft
): Record<string, HiddenScheduleAssignment> {
  const assignments: Record<string, HiddenScheduleAssignment> = {}
  for (const [key, profile] of Object.entries(profiles.characters)) {
    const activityId = profile.activityLocation
      ? locationForKey(ACTIVITY_LOCATIONS, profile.activityLocation)
      : null
    assignments[key] = {
      homeSlots: profile.homeSlots,
      study: profile.study ? locationForKey(STUDY_LOCATIONS, profile.study) : null,
      fun: profile.fun.flatMap((entry) => {
        const id = locationForKey(FUN_LOCATIONS, entry)
        return id ? [id] : []
      }),
      activity: activityId ? { location: activityId, doing: profile.activity } : null,
      meal: profile.meal ? locationForKey(MEAL_LOCATIONS, profile.meal) : null
    }
  }
  return assignments
}
