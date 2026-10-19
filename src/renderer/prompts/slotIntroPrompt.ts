import { modRequest, promptFields, promptLines, promptRequired } from '../mods/hooks'
import type { ExamPeriod } from '@shared/academics'
import { yearLabel } from '@shared/classes'
import { worstInSlot } from '@shared/colds'
import { globalSlotOf } from '@shared/jobs'
import { locationDefOf, locationLabel } from '@shared/locations'
import { affectionFor, dedupedMemoriesFor, emptyFlags } from '@shared/relationship'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from '@shared/playerStats'
import { readerYearOf, seasonOf, semesterOrdinal } from '@shared/semesters'
import {
  fullNameOf,
  type CalendarEvent,
  type Character,
  type CharInfo,
  type EverydayAsk,
  type Haunt,
  type Occasion,
  type Season,
  type StructuredRequest,
  type TimeSlot
} from '@shared/types'
import type { Weather } from '@shared/weather'
import { herColdLine } from './colds'
import { formatRelativeSlot } from './gameDate'
import type { LoreEntry } from './lorebook'
import { examLookaheadLine } from './occasions'
import { whereaboutsLine, type NpcCompanions } from './npcRelationship'
import { relationshipLines } from './relationship'
import { objectSchema } from './schema'
import {
  graduateLines,
  memoryLines,
  secretLines,
  notesLines,
  personaFor,
  profileLines,
  spaced
} from './scenePrompt'
import { springBreakLines } from './springBreak'
import { weatherLines } from './weather'

/** The slot-opening narration prompt. */

/** What a character has to be at in a slot — her class or her shift — named as a prompt says it. */
export type Commitment = { kind: 'class'; name: string } | { kind: 'shift'; employer: string }

/** What a girl asking him out of nowhere asks him to, when the app rolled her anything. */
export type HangoutInvite =
  | { kind: 'herRoom' }
  | { kind: 'hisRoom' }
  /** An exam in a lecture class the two of them take, and the slot it is sat in. */
  | { kind: 'study'; className: string; exam: ExamPeriod; date: number; time: TimeSlot }
  /** A location id off the map. */
  | { kind: 'outing'; location: string }
  | { kind: 'everyday'; ask: EverydayAsk }

/** Each everyday ask as the prompt names it beside her key. */
const EVERYDAY_ASK_PHRASE: Record<EverydayAsk, string> = {
  help: 'asking him to help her with something',
  exercise: 'asking him to work out or exercise with her',
  meal: 'inviting him over for a meal she is cooking herself',
  shopping: 'asking him to help her shop for something'
}

/** What a rolled invitation asks him to, as the line beside her key says it on `date`'s `time`. */
function invitePhrase(invite: HangoutInvite, date: number, time: TimeSlot): string {
  switch (invite.kind) {
    case 'herRoom':
      return 'asking him to come over to her room'
    case 'hisRoom':
      return 'asking him to have her over in his dorm room'
    case 'study':
      return `asking him to study with her for the ${invite.className} ${invite.exam} ${formatRelativeSlot(invite.date, invite.time, date, time)}`
    case 'outing': {
      // The blurb, since nothing else in this prompt says what the place is.
      const blurb = locationDefOf(invite.location)?.blurb
      return `asking him to come to ${locationLabel(invite.location)} with her${blurb ? `: ${blurb}` : ''}`
    }
    case 'everyday':
      return EVERYDAY_ASK_PHRASE[invite.ask]
  }
}

/** A contact this slot rolled in to text the reader an invitation. */
export interface IntroAsker {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
  /**
   * The plan she is texting about, when a plan is why she is texting at all.
   * Absent for a contact the slot's roll picked out of nowhere.
   */
  plan?: CalendarEvent
  /**
   * The class or the shift she has in the slot, beside a {@link plan} she is meeting him before
   * or after. Absent when she is free.
   */
  commitment?: Commitment
  /**
   * The occasion she is asking him to, on a slot one is on and he is free to go. Absent
   * for a girl asking about anything else.
   */
  occasion?: Occasion
  /**
   * What the app rolled her invitation into, for a girl asking about neither a plan nor an
   * occasion. Absent when the roll landed nothing and she asks what she likes.
   */
  invite?: HangoutInvite
  /**
   * Where she is texting from, who is with her, and what she is there for when the place is
   * her own haunt. Absent for a slot nothing places her in, which is most of them.
   */
  whereabouts?: { location: string; companions: NpcCompanions; haunt?: Haunt }
}

/** A lover the reader left this slot for somebody else, who is texting him to end it. */
export interface IntroBreakup {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
  /** The first name of the girl he started dating instead. */
  forFirstName: string
}

/** A contact leaving campus for spring break, texting the reader that she is going. */
export interface IntroLeaver {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
}

/** A graduate back in town for Homecoming, texting the reader that she is here. */
export interface IntroVisitor {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
}

/**
 * What a girl reaching out just to talk texts the reader about: the first four rolled by the app,
 * and `sick` for a girl in the worst of a cold, whatever the roll.
 */
export const REACH_OUT_TOPICS = ['wellbeing', 'goodNews', 'badNews', 'question', 'sick'] as const

/** One of {@link REACH_OUT_TOPICS}. */
export type ReachOutTopic = (typeof REACH_OUT_TOPICS)[number]

/** The topics a reach-out is rolled from. */
export const ROLLED_REACH_OUT_TOPICS: readonly ReachOutTopic[] = [
  'wellbeing',
  'goodNews',
  'badNews',
  'question'
]

/** Each reach-out topic as the prompt names it beside her key. */
const REACH_OUT_TOPIC_PHRASE: Record<ReachOutTopic, string> = {
  wellbeing: 'checking in on how he is doing',
  goodNews: 'telling him some good news of hers',
  badNews: 'telling him some bad news of hers',
  question: 'asking him a question',
  sick: 'telling him she is stuck in bed with a cold'
}

/** A contact this slot rolled in to text the reader just to talk, about one rolled topic. */
export interface IntroReachOut {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
  /** What she is texting him about. */
  topic: ReachOutTopic
  /** Her TEXTING HISTORY lines: what the two of them last texted about, and when. */
  thread: readonly string[]
  /** Where she is, who with, and what she is there for, when the slot places her anywhere. */
  whereabouts?: { location: string; companions: NpcCompanions; haunt?: Haunt }
}

/**
 * A character posting a status update this slot. A girl doing both is in this list and
 * the askers'; `LOREBOOK` describes her once.
 */
export interface IntroPoster {
  character: Character
  info: CharInfo
  /** How the reply names her back — resolved through `charKeyToId`. */
  charKey: string
  /** Whether a Bunnyboard thread with her already holds anything (`hasTexted`). */
  texted: boolean
  /** Where she is, who with, and what she is there for, when the slot places her anywhere. */
  whereabouts?: { location: string; companions: NpcCompanions; haunt?: Haunt }
}

/** Everything the builder reads; assembled by the loop, which owns the store. */
export interface SlotIntroInput {
  /** The cloud-LLM cache key — the playthrough, exactly as the scene calls use it. */
  playthroughId: string
  /** Today, for weighting the askers' memories. */
  date: number
  /** The reader's accumulated stats, used for relationship requirement guidance. */
  stats?: PlayerStats
  /** Which half of the day is opening: a day slot is the one he wakes into. */
  time: TimeSlot
  /** The player's `lessNsfwText` setting; picks which persona heads this call's prefix. */
  lessNsfwText: boolean
  /** How many of her told secrets each girl's entry carries; absent is the default. */
  secretBudget?: number
  /** The app-written first line the narration continues from. */
  opening: string
  /**
   * The last three slots' summaries, newest last, each stamped with the slot it
   * covers. May be empty in a fresh game.
   */
  recent: readonly string[]
  /**
   * Contacts texting an invitation this slot; empty whenever the player is
   * booked — a class or a shift.
   */
  askers: readonly IntroAsker[]
  /** The lovers the finished slot left for somebody else, each ending it over text now. */
  breakups: readonly IntroBreakup[]
  /** The girls the spring break pick just sent away, each texting him she is going. */
  leavers: readonly IntroLeaver[]
  /** The graduate Homecoming morning brings back, texting him she is in town. */
  visitors: readonly IntroVisitor[]
  /** The one contact, if any, texting him just to talk this slot. */
  reachOuts: readonly IntroReachOut[]
  /**
   * Characters posting a status update this slot — the 10% roll's passers, anyone also
   * under {@link askers} included.
   */
  posters: readonly IntroPoster[]
  /**
   * What is going on in the world in **this slot alone**, fixed calendar already merged
   * in by the loop.
   */
  occasions: readonly Occasion[]
  /** The semester's season, which the exam lookahead names its dates by. */
  season: Season
  /**
   * Which semester a later one's first morning opens, for the line saying he is back on campus;
   * absent on every other slot.
   */
  backOnCampus?: number
  /** The lorebook lines for what this slot leads up to, built by the loop beside `occasions`. */
  occasionLeadUps?: readonly string[]
  /**
   * The whole semester's sky, one reading per slot — the `WEATHER` block walks back through it
   * for how long the weather has held. Absent means the block is not written at all.
   */
  weather?: readonly Weather[]
  /**
   * Pre-formatted lorebook paragraphs for girls none of the blocks name — the closest
   * friends `ambientLoreCharacters` picks out.
   */
  backgroundLore?: readonly string[]
  /** Who leaves campus for spring break, or null before the pick has run. */
  springBreakAway?: readonly string[] | null
  /** The graduate back in town for Homecoming, as a charId; absent on every other slot. */
  homecomingVisitor?: string
  /**
   * The place `SOMEWHERE TO GO` invents a rumor about. **Drawn by the loop rather than
   * here**, which is what lets the reply's own sentence about it be banked and carried into the
   * scene the reader spends the slot in; absent means the block is not written at all.
   */
  rumorPlace?: LoreEntry
}

/**
 * The narration-only schema: no speaker, emotion, action or bg to emit. Built per call, since the
 * fields mods add to a post follow which mods are on.
 */
function slotIntroSchema(): ReturnType<typeof objectSchema> {
  return objectSchema('slot_intro', ['lines'], {
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: { text: { type: 'string' } }
      }
    },
    hangouts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'text', 'description'],
        properties: {
          char: { type: 'string' },
          text: { type: 'string' },
          description: { type: 'string' }
        }
      }
    },
    breakups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'texts'],
        properties: {
          char: { type: 'string' },
          texts: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    posts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'text', ...promptRequired('slot-posts')],
        properties: {
          char: { type: 'string' },
          text: { type: 'string' },
          ...promptFields('slot-posts')
        }
      }
    },
    springBreakTexts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'texts'],
        properties: {
          char: { type: 'string' },
          texts: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    reachOuts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'texts', ...promptRequired('slot-reach-outs')],
        properties: {
          char: { type: 'string' },
          texts: { type: 'array', items: { type: 'string' } },
          ...promptFields('slot-reach-outs')
        }
      }
    },
    homecomingTexts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['char', 'texts'],
        properties: {
          char: { type: 'string' },
          texts: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  })
}

/** What the sky is doing as the slot opens, on a slot there is anything to say about. */
function weatherBlock(input: SlotIntroInput): string[] {
  const lines = input.weather ? weatherLines(input.weather, input.date, input.time) : []
  return lines.length > 0 ? ['WEATHER', ...lines] : []
}

/**
 * What the day is, beyond being a date: whatever the campus and the city have going
 * on in this slot.
 */
function campusBlock(input: SlotIntroInput): string[] {
  const leadUps = input.occasionLeadUps ?? []
  const lookahead = examLookaheadLine(input.date, input.season)
  const back = input.backOnCampus !== undefined ? backOnCampusLine(input.backOnCampus) : null
  if (input.occasions.length === 0 && leadUps.length === 0 && !lookahead && !back) return []
  return [
    'WHAT\'S GOING ON',
    ...(back ? [`- ${back}`] : []),
    ...input.occasions.map((occasion) => `- ${occasion.title} — ${occasion.description}`),
    ...leadUps.map((line) => `- ${line}`),
    ...(lookahead ? [`- ${lookahead}`] : [])
  ]
}

/** The first morning of a semester after his first: what he is back from, and as what. */
function backOnCampusLine(semesterIndex: number): string {
  const year = yearLabel(readerYearOf(semesterIndex)).toLowerCase()
  const away = seasonOf(semesterIndex) === 'fall' ? 'summer vacation' : 'winter break'
  return `The reader is back on campus after ${away}, starting his ${semesterOrdinal(semesterIndex)} semester as a ${year}. Classes start tomorrow.`
}

/** A place worth going, for a slot with nothing and nobody in it. */
function rumorBlock(input: SlotIntroInput): string[] {
  if (!input.rumorPlace) return []
  return [
    'SOMEWHERE TO GO',
    input.rumorPlace.text,
    '',
  ]
}

/**
 * Whether anybody asking this slot is asking about something already agreed — the
 * one test the asker block and `YOUR TURN` both make.
 */
function anyPlans(input: SlotIntroInput): boolean {
  return input.askers.some(({ plan }) => plan !== undefined)
}

/** Whether anybody reminding him of a plan has a class or a shift in the slot. */
function anyCommitments(input: SlotIntroInput): boolean {
  return input.askers.some(({ plan, commitment }) => plan !== undefined && commitment !== undefined)
}

/** `text` ending on a full stop, so a sentence can follow it. */
function closedSentence(text: string): string {
  const trimmed = text.trim()
  return /[.!?]["')]?$/.test(trimmed) ? trimmed : `${trimmed}.`
}

/**
 * The sentence beside a plan for a girl with a class or a shift in the slot, leaving the model to
 * pick whether she meets him before it or after.
 */
function commitmentSentence(firstName: string, commitment: Commitment, time: TimeSlot): string {
  const what =
    commitment.kind === 'class'
      ? `her ${commitment.name} class`
      : `a shift at ${commitment.employer}`
  const when = time === 1 ? 'tonight' : 'today'
  return ` ${firstName} has ${what} ${when} but she will meet up with the reader either before or after it. Choose what makes the most sense.`
}

/** The characters texting the reader an invitation this slot. */
function askerBlock(input: SlotIntroInput): string[] {
  if (input.askers.length === 0) return []

  return [
    'ASKING TO HANG OUT',
    'Each of these characters is texting the reader right now to ask him to spend this part of the day with her, doing what is listed beside her where anything is. Write one entry in "hangouts" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...(anyPlans(input)
      ? [
          'Where a plan is listed beside a character, she is not inviting the reader out of nowhere: the two of them agreed to this already, and she is writing about that plan, for everyone going. Her message reads as a reminder or a "still on?", not as a new idea.'
        ]
      : []),
    ...input.askers.map(({ character, charKey, plan, commitment, occasion, invite }) =>
      // The plan, the occasion and the rolled ask ride the key, not the lorebook entry.
      plan
        ? `- ${charKey} — already planned for this part of the day: ` +
          (commitment
            ? closedSentence(plan.description) +
              commitmentSentence(character.firstName, commitment, input.time)
            : plan.description)
        : occasion
          ? `- ${charKey} — asking him to come to ${occasion.title} with her`
          : invite
            ? `- ${charKey} — ${invitePhrase(invite, input.date, input.time)}`
            : `- ${charKey}`
    )
  ]
}

/** The lovers he left, each ending it by text as the slot opens. */
function breakupBlock(input: SlotIntroInput): string[] {
  if (input.breakups.length === 0) return []

  return [
    'BREAKING UP',
    'Each of these characters has just found out the reader started dating somebody else and is ending things with him over text right now. Write one entry in "breakups" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...input.breakups.map(
      ({ charKey, forFirstName }) => `- ${charKey} — he started dating ${forFirstName}`
    )
  ]
}

/** The characters posting a status update this slot. */
function posterBlock(input: SlotIntroInput): string[] {
  if (input.posters.length === 0) return []

  return [
    'STATUS UPDATES',
    'Each of these characters is posting a status update on social media right now. Write one entry in "posts" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...input.posters.map(({ charKey }) => `- ${charKey}`)
  ]
}

/** The girls leaving campus for spring break, each telling him so by text as the slot opens. */
function leaverBlock(input: SlotIntroInput): string[] {
  if (input.leavers.length === 0) return []

  return [
    'LEAVING FOR SPRING BREAK',
    'Each of these characters is texting the reader right now to let him know she is leaving campus on Saturday for spring break and will be gone for the week. Write one entry in "springBreakTexts" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...input.leavers.map(({ charKey }) => `- ${charKey}`)
  ]
}

/** The graduate back in town for Homecoming, telling him so by text as the slot opens. */
function visitorBlock(input: SlotIntroInput): string[] {
  if (input.visitors.length === 0) return []

  return [
    'BACK FOR HOMECOMING',
    'Each of these characters graduated and moved away from Veridan, and is texting the reader right now to let him know she is back in town for the Homecoming game today and leaves again tomorrow morning. Write one entry in "homecomingTexts" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...input.visitors.map(({ charKey }) => `- ${charKey}`)
  ]
}

/** The contact texting the reader just to talk this slot, beside what she is texting about. */
function reachOutBlock(input: SlotIntroInput): string[] {
  if (input.reachOuts.length === 0) return []

  return [
    'REACHING OUT',
    'Each of these characters is texting the reader right now just to talk, about what is listed beside her. Write one entry in "reachOuts" for each, and nothing for anyone else. They are described under LOREBOOK.',
    ...input.reachOuts.flatMap(({ character, info, charKey, topic }) => [
      `- ${charKey} — ${REACH_OUT_TOPIC_PHRASE[topic]}`,
      ...promptLines('slot-reach-outs', { character, info, date: input.date })
    ])
  ]
}

/** Everybody the six blocks above name, described once each. */
function characterBlock(input: SlotIntroInput): string[] {
  const entries: string[][] = []
  const named = new Set<string>()

  // A girl reaching out comes ahead of the posters, so her entry is the one carrying her thread.
  const listed: ReadonlyArray<
    IntroAsker | IntroBreakup | IntroLeaver | IntroVisitor | IntroReachOut | IntroPoster
  > = [
    ...input.askers,
    ...input.breakups,
    ...input.leavers,
    ...input.visitors,
    ...input.reachOuts,
    ...input.posters
  ]
  for (const entry of listed) {
    const { charKey, character, info, texted } = entry
    // A girl the slot placed somewhere; the girl ending it is texting from nowhere in particular.
    const whereabouts = 'whereabouts' in entry ? entry.whereabouts : undefined
    if (named.has(charKey)) continue
    named.add(charKey)
    // How her cold stands in the slot opening, where she has one that shows.
    const slot = globalSlotOf(input.date, input.time)
    const coldLine = herColdLine(character.firstName, info.cold, slot, true)
    entries.push([
      `${fullNameOf(character)} — "char": "${charKey}"`,
      ...profileLines(character, info.flags ?? emptyFlags()),
      ...(coldLine ? [coldLine] : []),
      // A graduate posting or ending it from out of town, or back for Homecoming.
      ...graduateLines(
        character.firstName,
        info,
        input.homecomingVisitor === character.charId
      ),
      ...(whereabouts
        ? [
            whereaboutsLine(
              character.firstName,
              whereabouts.location,
              whereabouts.companions,
              whereabouts.haunt,
              input.time
            )
          ]
        : []),
      // What she is doing with the break: a girl off campus has no location to report.
      ...springBreakLines(
        character.firstName,
        info.springBreakPlans,
        input.springBreakAway,
        character.charId,
        input.date
      ),
      ...relationshipLines(
        character,
        info.flags ?? emptyFlags(),
        info.nameKnown,
        affectionFor(info, input.date, character),
        info,
        input.stats ?? DEFAULT_PLAYER_STATS,
        // Everybody here reaches the reader by phone: a first contact is a conversation, not a meeting.
        { texting: true, texted },
        // Where she is in her cycle, for a Promiscuous girl's DTF days, which a cold calls off.
        { date: input.date, offset: info.moodCycleOffset ?? 0, sick: worstInSlot(info.cold, slot) }
      ),
      ...memoryLines(character, dedupedMemoriesFor(info).slice(-2), info.textMemory, input.season),
      ...secretLines(info.toldSecrets, input.secretBudget),
      // What she and the reader last texted about, for the girl starting a conversation.
      ...('thread' in entry ? entry.thread : []),
      ...notesLines(character.firstName, info.notes)
    ])
  }

  // The background girls close the block as keyless paragraphs, and can raise it alone.
  for (const paragraph of input.backgroundLore ?? []) {
    entries.push([paragraph])
  }

  if (entries.length === 0) return []
  // Blank lines between entries only; `spaced()` closes the block.
  return [
    'LOREBOOK',
    '',
    ...entries.flatMap((entry, index) => (index === 0 ? entry : ['', ...entry]))
  ]
}

/** Builds the slot-opening narration request. */
export function buildSlotIntroPrompt(
  input: SlotIntroInput,
  setting: string,
  reader: string
): StructuredRequest {
  const waking = input.time === 0
  const rumor = rumorBlock(input)
  const planned = anyPlans(input)
  const committed = anyCommitments(input)

  const user = [
    'OPENING LINE',
    input.opening,
    '',
    ...spaced(input.recent.length > 0 ? ['RECENTLY', ...input.recent] : []),
    ...spaced(weatherBlock(input)),
    ...spaced(campusBlock(input)),
    ...spaced(characterBlock(input)),
    ...spaced(askerBlock(input)),
    ...spaced(breakupBlock(input)),
    ...spaced(posterBlock(input)),
    ...spaced(leaverBlock(input)),
    ...spaced(visitorBlock(input)),
    ...spaced(reachOutBlock(input)),
    ...spaced(rumor),
    'YOUR TURN',
    'Hey RITA, a new part of the reader\'s day is starting. Set the mood for them before they decide what to do with it.',
    'Continue where the OPENING LINE left off with three to five short lines of narration. Don\'t include the OPENING LINE in your response. Each line is one entry in "lines".',
    // The three beats, named: without them the call writes a to-do list.
    waking
      ? 'Open on the reader waking up in his Lowrise dorm room, describing how he feels and the sounds and sights around him.'
      : 'Open on the day winding down around the reader in his Lowrise dorm room, describing how he feels and the sounds and sights around him.',
    "Then say how campus feels right now. Take into account how far we are in the semester and what's going on in the city and on campus.",
    input.recent.length > 0
      ? 'Also keep in mind what happened recently and how it is making the reader feel right now.'
      : '',
    ...(rumor.length > 0
      ? ['End by inventing something spicy about SOMEWHERE TO GO. A rumor, a limited-time thing, etc that encourages the reader to go there.']
      : []),
    'Second person, present tense, no dialogue and nobody else on screen. Do NOT restate the date or prompt the player with "What would you like to do?" as something else does that already.',
    ...(input.askers.length > 0
      ? [
          '',
          'Then fill "hangouts", one entry per character under ASKING TO HANG OUT. "char" is her key exactly as written there. "text" is the message she sends, in her own texting voice — lowercase, slang, typos and emoji are all fine if that is how she types — and it is ONLY about meeting up: what she wants to do and where, asked as a question' +
            (planned
              ? ' — or, where she has a plan listed, that plan, asked as a "we\'re still on, right?"'
              : '') +
            (committed
              ? ', and where she has class or work, she says whether she will meet him before or after it'
              : '') +
            '. No narration, no stage directions, no other conversation. "description" is the plan in a few plain words, like "Getting dinner with Sarah at the Mockingbird" or "Studying with Chloe in the library".' +
            (planned
              ? ' If she has a hangout scheduled with the reader listed under her name, use that one.'
              : ''),
          'The narration in "lines" must not mention these messages or these characters at all — the reader has not opened his phone yet.'
        ]
      : [
          // An optional property with no instruction against it is an invitation to invent one.
          '',
          'Return nothing at all for "hangouts".'
        ]),
    ...(input.breakups.length > 0
      ? [
          '',
          'Then fill "breakups", one entry per character under BREAKING UP. "char" is her key exactly as written there. "texts" is two to four short messages she sends one after another, in her own texting voice — lowercase, slang, typos and emoji are all fine if that is how she types — breaking up with the reader because he started dating the girl named beside her: how she found out, how she feels about it, and that it is over. No narration, no stage directions, no reply from the reader.',
          'The narration in "lines" must not mention these messages or these characters at all — the reader has not opened his phone yet.'
        ]
      : [
          // Refused out loud for "hangouts"'s reason.
          '',
          'Return nothing at all for "breakups".'
        ]),
    ...(input.posters.length > 0
      ? [
          '',
          'Then fill "posts", one entry per character under STATUS UPDATES. "char" is her key exactly as written there. "text" is the post itself: one or two short lines in her own voice, the way she would actually type it — lowercase, slang and emoji are fine if that is how she writes. It is a post to nobody in particular, about her hour: what she is doing, where she is, what kind of mood she is in, something small she noticed. She is NOT writing to the reader and must not address him, mention him, or refer to meeting anyone. No narration and no stage directions.',
          'The narration in "lines" must not mention these posts — the reader has not opened his phone yet.',
          ...promptLines('slot-posts', {})
        ]
      : [
          // Refused out loud for "hangouts"'s reason.
          '',
          'Return nothing at all for "posts".'
        ]),
    ...(input.leavers.length > 0
      ? [
          '',
          'Then fill "springBreakTexts", one entry per character under LEAVING FOR SPRING BREAK. "char" is her key exactly as written there. "texts" is one to three short messages she sends one after another, in her own texting voice — lowercase, slang, typos and emoji are all fine if that is how she types — letting the reader know she is leaving campus on Saturday and will be gone for spring break: what she is doing over the break, and how she feels about being away from him, in keeping with where the two of them stand. She is not inviting him along. No narration, no stage directions, no reply from the reader.',
          'The narration in "lines" must not mention these messages or these characters at all — the reader has not opened his phone yet.'
        ]
      : [
          // Refused out loud for "hangouts"'s reason.
          '',
          'Return nothing at all for "springBreakTexts".'
        ]),
    ...(input.visitors.length > 0
      ? [
          '',
          'Then fill "homecomingTexts", one entry per character under BACK FOR HOMECOMING. "char" is her key exactly as written there. "texts" is one to three short messages she sends one after another, in her own texting voice — lowercase, slang, typos and emoji are all fine if that is how she types — letting the reader know she is back in town for the Homecoming game today and leaves again tomorrow morning: what she has been up to since she left, and whether she would like to see him while she is here, in keeping with where the two of them stand. No narration, no stage directions, no reply from the reader.',
          'The narration in "lines" must not mention these messages or these characters at all — the reader has not opened his phone yet.'
        ]
      : [
          // Refused out loud for "hangouts"'s reason.
          '',
          'Return nothing at all for "homecomingTexts".'
        ]),
    ...(input.reachOuts.length > 0
      ? [
          '',
          'Then fill "reachOuts", one entry per character under REACHING OUT. "char" is her key exactly as written there. "texts" is one or two short messages she sends one after another, in her own texting voice — lowercase, slang, typos and emoji are all fine if that is how she types — starting a conversation with the reader about what is listed beside her name. Good or bad news is something that just happened in her own life, in keeping with how LOREBOOK describes her and where she is. A question is something she actually wants to know from him. She can pick up on time they recently spent together or on what they last texted about, and she ends on something he can answer. She is not asking to meet up or making plans. No narration, no stage directions, no reply from the reader.',
          'The narration in "lines" must not mention these messages or these characters at all — the reader has not opened his phone yet.'
        ]
      : [
          // Refused out loud for "hangouts"'s reason.
          '',
          'Return nothing at all for "reachOuts".'
        ])
  ].join('\n')

  return modRequest('slot-intro', { input }, {
    system: [
      personaFor(input.lessNsfwText),
      '',
      'SETTING',
      setting,
      '',
      'READER',
      reader
    ].join('\n'),
    user,
    schema: slotIntroSchema(),
    cacheKey: input.playthroughId,
    kind: 'slotIntro'
  })
}
