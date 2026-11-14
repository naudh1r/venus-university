import { type StorySnapshot } from '@shared/storyMemory'
import { messageSlotOf } from '@shared/chatVisibility'
import type { BreakthroughState } from '@shared/breakthrough'
import type { CharacterDynamics } from '@shared/characterDynamics'
import { affectionFor, dedupedMemoriesFor, emptyFlags } from '@shared/relationship'
import { ROOM_LOCATION } from '@shared/locations'
import { worstInSlot } from '@shared/colds'
import { globalSlotOf } from '@shared/jobs'
import type { NpcRelationshipMap } from '@shared/npcRelationships'
import type { SemesterCalendar } from '@shared/semesters'
import {
  type Character,
  type CharInfo,
  type ClassEntry,
  type ChatMessage,
  type Conversation,
  type GameHistory,
  type Haunt,
  type JobState,
  type Season,
  type StructuredRequest,
  type TimeSlot
} from '@shared/types'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from '@shared/playerStats'
import type { Weather } from '@shared/weather'
import {
  formatMessageSlot,
  formatDateBanner,
  formatGameDate,
  formatRelativeSlot,
  formatSemesterProgress,
  nextSlot
} from './gameDate'
import {
  ambientLoreCharacters,
  characterLore,
  characterLoreForIds,
  classLore,
  type ClassRoster,
  keyPattern,
  type BookEntry,
  lorebookBlock
} from './lorebook'
import { occasionLoreLines } from './occasions'
import { recapLore } from './recaps'
import { objectSchema } from './schema'
import {
  graduateLines,
  herClassmates,
  memoryLines,
  secretLines,
  notesLines,
  profileLines,
  readerClassmates,
  scheduleLines,
  yearMajorLine
} from './scenePrompt'
import { isAwayForSpringBreak, springBreakLines } from './springBreak'
import {
  bestFriendLines,
  hauntClause,
  whereaboutsLine,
  type NpcCompanions
} from './npcRelationship'
import { modRequest, dmHistoryNotes, promptFields, promptLines, promptRequired } from '../mods/hooks'
import { relationshipLines } from './relationship'
import { herColdLine } from './colds'
import { weatherLines } from './weather'
import type { GlobalTextId, TextEdits } from '@shared/promptText'
import { textingPersonaFor } from './promptBlocks'

/**
 * Builds the Bunnyboard texting request: RITA answering the reader's text as one
 * character, over the campus messaging app.
 */

/** How many recent messages ride in the prompt and in each rolling summary. */
const TEXTING_HISTORY_CAP = 20

/** A replay may need more context when its earlier summary is unavailable. */
const TEXTING_HISTORY_MAX = 160

/** A bad request must never turn slice(-NaN) into the entire saved conversation. */
function historyLimitOf(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return TEXTING_HISTORY_CAP
  return Math.max(TEXTING_HISTORY_CAP, Math.min(TEXTING_HISTORY_MAX, Math.floor(requested)))
}

/** The prompt-facing slice of state a texting turn needs. */
export interface TextingPromptState {
  /** The edits a mod hands the global text blocks; absent when none is supplied. */
  globalTextEdits?: TextEdits<GlobalTextId>
  storyMemory?: StorySnapshot
  /** Supplied only while the standalone Breakthrough mod is enabled. */
  breakthrough?: BreakthroughState
  /** Recent stored messages to include: 20 by default, at most 160; not a token budget. */
  historyLimit?: number
  exCharacterDynamics?: CharacterDynamics
  date: number
  time: TimeSlot
  /** The night the held boundary displays, while texts keep the current slot. */
  lateNight?: { date: number; time: TimeSlot }
  /** The reply is composed now for delivery after this commitment. */
  heldUntil?: { date: number; time: TimeSlot }
  commitment?: import('./slotIntroPrompt').Commitment
  /** Her shared class has ended, with the reader's attendance read from its class record. */
  sharedClass?: { name: string; attended: boolean }
  /** The reader's accumulated stats, used for relationship requirement guidance. */
  stats?: PlayerStats
  /**
   * Every roster character except the one being texted — the lorebook's people,
   * excluded at the source so no entry can restate the `CHARACTER` block.
   */
  roster: readonly Character[]
  /** The playthrough's lorebook: the shipped entries as the player has them, then his own. */
  lorebook: readonly BookEntry[]
  /** Per-character save state, keyed by charId — read for the roster's entries. */
  charInfo: Record<string, CharInfo>
  /**
   * What the roster thinks of each other: read for the friend her `CHARACTER` block
   * names and for the standing every lorebook character entry closes with.
   */
  npcRelationships: NpcRelationshipMap
  /** The save's class roster, keyed by class code — names the schedules. */
  classes: Record<string, ClassEntry>
  /** The reader's own timetable, sparse slot → class code. */
  playerSchedule: Record<number, string>
  /** Who sits in each class of the catalog, by class code. */
  classRosters: Readonly<Record<string, ClassRoster>>
  /** The part-time job the reader holds, or null — the rest of his week. */
  playerJob: JobState | null
  /** The semester's season and the occasions the save invented; the fixed calendar is merged in on read. */
  calendar: SemesterCalendar
  /**
   * The whole semester's sky, one reading per slot — the NOW line walks back through it for how
   * long the weather has held. Absent means nothing is said about it.
   */
  weather?: readonly Weather[]
  /**
   * Where the girl being texted is standing right now: a location id, `'room'`, or null
   * for a slot her hidden schedule says nothing about.
   */
  charLocation?: string | null
  /**
   * Who is with her there — read only where {@link charLocation} is set,
   * and named only where the reader has heard the name.
   */
  charCompanions?: NpcCompanions
  /** Her standing haunt when {@link charLocation} is it — what she is doing there. */
  charHaunt?: Haunt | null
  /**
   * Who leaves campus for spring break, or null before the pick has run. A thread stays
   * open through an absence, so this is what says she is texting from somewhere else.
   */
  springBreakAway?: readonly string[] | null
  /** The graduate back in town for Homecoming, as a charId; absent on every other slot. */
  homecomingVisitor?: string
  /**
   * Each character's plans with the reader from this slot on, one sentence apiece, by charId —
   * hers and the lorebook's people's.
   */
  upcomingPlans?: Record<string, string[]>
  /** How many of her memories the thread carries: the one-character budget, the thread being the two of them. */
  memoryBudget: number
  /** How many of her told secrets the thread carries; absent is the default. */
  secretBudget?: number
  /** The playthrough log, read for the lorebook's dated recaps. */
  history: GameHistory
}

/** A text's line breaks folded to spaces, so a message stays one prompt line. */
function flatText(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ')
}

/** `"YOU: hey"` / `"MINA: hey yourself"` / `"SYSTEM: ..."` — one history stub. */
function messageStub(message: ChatMessage, firstName: string): string {
  if (message.sender === 'player') return `YOU: ${flatText(message.text)}`
  if (message.sender === 'system') return `SYSTEM: ${flatText(message.text)}`
  return `${firstName.toUpperCase()}: ${flatText(message.text)}${flatText(dmHistoryNotes(message))}`
}

/**
 * A window of messages rendered for injection, newest last; system lines ride along as
 * context the character plausibly has.
 */
export function stampedStubs(
  window: readonly ChatMessage[],
  firstName: string,
  season: Season
): string[] {
  const lines: string[] = []
  let stamped: string | null = null
  for (const message of window) {
    const stamp = formatMessageSlot(message, season)
    if (stamp !== stamped) {
      lines.push(`[${stamp}]`)
      stamped = stamp
    }
    lines.push(messageStub(message, firstName))
  }
  return lines
}

/**
 * Whether the reader and she have actually texted — a summary, or a player/contact message.
 * A thread holding only the app's own friend-request/block system lines doesn't count.
 */
export function hasTexted(conversation: Conversation | undefined): boolean {
  if (!conversation) return false
  if (conversation.summary !== null) return true
  return conversation.messages.some(
    (message) => message.sender === 'player' || message.sender === 'contact'
  )
}

/**
 * Her reach-outs the reader has sent nothing since, oldest first, each as its first text. A
 * system line is no answer.
 */
export function unansweredReachOuts(messages: readonly ChatMessage[]): ChatMessage[] {
  const unanswered: ChatMessage[] = []
  for (const message of messages) {
    if (message.sender === 'player') unanswered.length = 0
    else if (message.sender === 'contact' && message.reachOut) unanswered.push(message)
  }
  return unanswered
}

/**
 * Her hangout ask when it ends the thread, with his "Sure" when that answered it, or her
 * unanswered reach-out, every text of it from the first. A reminder about a plan already made
 * is not flagged as an invite but stands behind `pendingHangout` just the same.
 */
function hangoutTail(
  conversation: Conversation
): { ask: ChatMessage; answer?: ChatMessage } | null {
  const { messages } = conversation
  const last = messages[messages.length - 1]
  if (!last) return null
  if (last.sender === 'contact') {
    if (last.invite || conversation.pendingHangout) return { ask: last }
    const reachOut = unansweredReachOuts(messages).at(-1)
    if (!reachOut) return null
    const fromSlot = messageSlotOf(reachOut)
    const lastSlot = messageSlotOf(last)
    if (fromSlot.date !== lastSlot.date || fromSlot.time !== lastSlot.time) return null
    // Her texts from the reach-out's first to the end of its slot, nothing of his among them.
    const from = messages.indexOf(reachOut)
    const text = messages
      .slice(from)
      .filter((message) => message.sender === 'contact')
      .map((message) => flatText(message.text))
      .join(' ')
    return { ask: { ...last, text } }
  }
  const before = messages[messages.length - 2]
  if (last.sender === 'player' && last.text === 'Sure' && before?.sender === 'contact') {
    return { ask: before, answer: last }
  }
  return null
}

/** The scene prompts' TEXTING HISTORY lines for one character, or none at all. */
export function composeTextingSummary(
  conversation: Conversation | undefined,
  ignoredInvitation: boolean,
  firstName: string,
  now: Pick<TextingPromptState, 'date' | 'time'>,
  blocked = false
): string[] {
  // Being blocked outlives the thread, so it is stated even with nothing else to say.
  const blockedLines = blocked
    ? [`${firstName} has the reader blocked on Bunnyboard, so he cannot text her.`]
    : []
  if (!conversation) {
    return blockedLines.length > 0
      ? [`${firstName}'s TEXTING HISTORY with the reader:`, ...blockedLines]
      : []
  }
  const lines: string[] = []
  if (conversation.summary) lines.push(conversation.summary)

  const last = conversation.messages[conversation.messages.length - 1]
  // An untexted thread holds only the friend-request system line; say when that add happened.
  if (!hasTexted(conversation) && conversation.messages.length > 0) {
    const first = messageSlotOf(conversation.messages[0])
    lines.push(
      `The reader and ${firstName} added each other on Bunnyboard ${formatRelativeSlot(first.date, first.time, now.date, now.time)}, but haven't texted yet.`
    )
  } else if (last) {
    const at = messageSlotOf(last)
    const when = formatRelativeSlot(at.date, at.time, now.date, now.time)
    const tail = hangoutTail(conversation)
    // Her ask and his Sure never pass through a texting call, so no summary holds them:
    // the scene is shown the texts themselves.
    if (tail?.answer) {
      lines.push(
        `The last texts in the thread were sent ${when}. ${firstName}: "${flatText(tail.ask.text)}" The reader: "${flatText(tail.answer.text)}"`
      )
    } else if (tail) {
      lines.push(`The last text in the thread was sent ${when}: "${flatText(tail.ask.text)}"`)
    } else {
      // Without this the scene reads every thread as if it had just been sent.
      lines.push(`The last text in the thread was sent ${when}.`)
    }
  }
  if (last?.error) lines.push(`${firstName}'s last message failed to send to the player.`)
  // "Ignored", never "left on read": the app only knows he spent the slot elsewhere.
  if (ignoredInvitation) lines.push(`The reader ignored ${firstName}'s invitation.`)
  lines.push(...blockedLines)

  if (lines.length === 0) return []
  return [`${firstName}'s TEXTING HISTORY with the reader:`, ...lines]
}

/**
 * The `NOW` line saying where she is texting from, or nothing on a slot her hidden
 * schedule is silent about.
 */
function whereSheIs(
  name: string,
  location: string | null | undefined,
  companions?: NpcCompanions,
  haunt?: Haunt | null,
  time: TimeSlot = 0
): string[] {
  if (!location) return []
  return [
    whereaboutsLine(name, location, companions ?? { knownNames: [], unknown: 0 }, haunt, time)
  ]
}

/** What her calendar says about meeting up this instant. */
function meetUpLines(
  name: string,
  location: string | null | undefined,
  haunt: Haunt | null | undefined,
  time: TimeSlot,
  away: boolean
): string[] {
  // Dropped while she is off campus: the line claims she can meet, and her block says she can't.
  if (away) return []
  if (!location || location === ROOM_LOCATION) {
    return [
      `${name}'s schedule is clear, so if the reader asks to meet up right now assume ${name} is free to... though not necessarily willing.`
    ]
  }
  return [
    `${name}'s schedule is clear, so if the reader asks to meet up right now assume ${name} is free to — she is already ${hauntClause(location, haunt, time)} and would sooner have him come to her than go somewhere else — though not necessarily willing.`
  ]
}

/** Builds the texting turn request. `newMessage` is the reader's fresh text. */
export function buildTextingPrompt(
  character: Character,
  info: CharInfo | undefined,
  conversation: Conversation | undefined,
  newMessage: string,
  state: TextingPromptState,
  reader: string,
  incomingDirection?: string
): StructuredRequest {
  const name = character.firstName
  const firstHeld = conversation?.heldReply?.firstPlayerId
  const heldIndex = firstHeld ? conversation!.messages.findIndex(message => message.id === firstHeld) : -1
  const historyLimit = state.heldUntil && heldIndex >= 0
    ? Math.max(historyLimitOf(state.historyLimit), conversation!.messages.length - heldIndex)
    : historyLimitOf(state.historyLimit)
  // Off campus: away for the break, or graduated and gone from Veridan but for Homecoming.
  const visiting = state.homecomingVisitor === character.charId
  const away =
    (info?.pursuing !== undefined && !visiting) ||
    isAwayForSpringBreak(state.springBreakAway, character.charId, state.date)
  const pending: ChatMessage = {
    id: 'pending',
    sender: 'player',
    text: newMessage,
    ...(state.lateNight ? nextSlot(state.lateNight.date, state.lateNight.time)
      : { date: state.date, time: state.time }),
    ...(state.lateNight ? { late: true as const } : {})
  }
  const thread = [...(conversation?.messages ?? []).slice(-historyLimit), pending]
  // The new text is the last line of the log, so it gets its own stamp when it lands in a new slot.
  const history = stampedStubs(
    [
      ...(conversation?.messages ?? []).slice(-historyLimit),
      ...(incomingDirection === undefined ? [pending] : [])
    ],
    name,
    state.calendar.season
  )
  const summary = conversation?.summary ?? null

  // The scan covers the whole thread the model reads, not just the new message.
  const scan = [summary ?? '', ...history].join('\n')
  // Today's occasions are always-on.
  const today = occasionLoreLines(state.date, state.time, state.calendar)

  // An entry's standings are measured against the one girl on the thread.
  const relations = { relationships: state.npcRelationships, present: [character] }
  // The ambient entries nothing in the thread named, minus any the scan already fires.
  const ambient = ambientLoreCharacters(state.roster, [character], state.npcRelationships).filter(
    (other) => !new RegExp(keyPattern(other.firstName, false), 'iu').test(scan)
  )
  // A thread sets no background, so no entry points at one.
  const paragraphs = [
    ...classLore(scan, {
      classes: state.classes,
      rosters: state.classRosters,
      playerSchedule: state.playerSchedule,
      skip: []
    }),
    ...characterLore(
      scan,
      state.roster,
      state.charInfo,
      state.date,
      relations,
      state.upcomingPlans,
      state.homecomingVisitor
    ),
    ...characterLoreForIds(
      ambient,
      state.charInfo,
      state.date,
      relations,
      state.upcomingPlans,
      state.homecomingVisitor
    ),
    // Only this slot's texts: an older one's "last night" was a different night.
    ...recapLore(
      thread
        .filter((message) => {
          const at = messageSlotOf(message)
          return at.date === state.date && at.time === state.time
        })
        .map((message) => message.text)
        .join('\n'),
      state.date,
      state.time,
      state.history,
      state.calendar.season
    )
  ]
  const lore = lorebookBlock(scan, { book: state.lorebook, always: today, paragraphs })

  // How her cold stands this slot, where she has one that shows.
  const slot = globalSlotOf(state.date, state.time)
  const coldLine = herColdLine(name, info?.cold, slot, true)

  const characterBlock = [
    'CHARACTER',
    `${name} ${character.lastName}.`,
    ...(info?.major ? [yearMajorLine(info)] : []),
    ...graduateLines(name, info, visiting),
    // The phone takes the one-character budget.
    ...profileLines(character, info?.flags ?? emptyFlags()),
    ...(coldLine ? [coldLine] : []),
    ...relationshipLines(
      character,
      info?.flags ?? emptyFlags(),
      // Texting requires a completed contact, so her name is known by then.
      info?.nameKnown ?? true,
      affectionFor(info, state.date, character),
      info,
      state.stats ?? DEFAULT_PLAYER_STATS,
      // The stored thread only: the pending text is not yet something they have said.
      { texting: true, texted: hasTexted(conversation) },
      // Where she is in her cycle, for a Promiscuous girl's DTF days, which a cold calls off.
      { date: state.date, offset: info?.moodCycleOffset ?? 0, sick: worstInSlot(info?.cold, slot) }
    ),
    // Her closest friend; the roster handed in is everybody but her.
    ...bestFriendLines(character, state.roster, state.npcRelationships),
    ...scheduleLines(
      `${name}'s Schedule:`,
      info?.schedule ?? {},
      state.classes,
      info?.job,
      state.date,
      herClassmates(character.charId, state.classRosters, state.playerSchedule)
    ),
    // What she and the reader have planned, this slot's included.
    ...(state.upcomingPlans?.[character.charId] ?? []),
    // Where she is spending the break: on a thread, the only thing saying she has left campus.
    ...springBreakLines(
      name,
      info?.springBreakPlans,
      state.springBreakAway,
      character.charId,
      state.date
    ),
    ...memoryLines(
      character,
      dedupedMemoriesFor(info).slice(-state.memoryBudget),
      info?.textMemory,
      state.calendar.season
    ),
    ...secretLines(info?.toldSecrets, state.secretBudget),
    ...notesLines(name, info?.notes)
  ]

  const user = [
    'READER',
    reader,
    ...scheduleLines(
      "The reader's Schedule:",
      state.playerSchedule,
      state.classes,
      state.playerJob,
      state.date,
      readerClassmates(state.classRosters)
    ),
    '',
    ...characterBlock,
    '',
    'NOW',
    state.lateNight ? `It is late on ${formatGameDate(state.lateNight.date, state.calendar.season)} night`
      : `It is ${formatDateBanner(state.date, state.time, state.calendar.season)}`,
    formatSemesterProgress(state.date),
    // Texting happens before the slot's scene; without this she treats the day as over.
    ...(state.lateNight || state.heldUntil ? [] : [state.time === 0 ? 'Morning classes are starting soon.' : 'Night classes are starting soon.']),
    ...(state.weather ? weatherLines(state.weather, state.lateNight?.date ?? state.date, state.lateNight?.time ?? state.time) : []),
    ...(state.heldUntil ? [] : state.lateNight ? [`${name} is ${info?.pursuing !== undefined ? 'at home' : 'in her dorm room'} for the night.`]
      : whereSheIs(name, state.charLocation, state.charCompanions, state.charHaunt, state.time)),
    '',
    ...(state.heldUntil && !state.sharedClass ? [`The reader is texting ${name} while she is ${state.commitment?.kind === 'class' ? `in ${state.commitment.name}` : `working at ${state.commitment?.kind === 'shift' ? state.commitment.employer : 'her job'}`}. Write the reply she will send once she is out; she is not answering during her commitment.`] : []),
    ...(state.sharedClass ? [
      `${name} has just finished ${state.sharedClass.name}. The reader ${state.sharedClass.attended ? 'attended that class' : 'did not attend that class'}. Her reply can follow up on that and all the messages he sent while she was busy.`
    ] : []),
    ...lore,
    ...(summary ? ['TEXTING SO FAR', '"' + summary + '"', ''] : []),
    'RECENT MESSAGES',
    "'''",
    ...history,
    "'''",
    '',
    'YOUR TURN',
    ...(incomingDirection === undefined ? [
      `${name} is texting the reader back in a private DM.`,
      `Write ${name}'s reply to the reader's newest message, the last line of RECENT MESSAGES, as the "messages" array: each entry is one text bubble she sends.`
    ] : [
      `${name} initiates a private DM to the reader. The reader has not sent a new message.`,
      'The following writing direction comes from the player outside the story. It is not dialogue, a message she received, or something the reader said or did.',
      'WRITING DIRECTION',
      incomingDirection,
      'END WRITING DIRECTION',
      `Write the texts ${name} sends as the "messages" array. Do not quote or acknowledge the writing direction. Keep her personality and the established situation.`,
      'Earlier messages are background, not a new message to answer.'
    ]),
    'Stay in her voice and keep it text-length: this is a phone thread, not prose.',
    ...(state.lateNight ? [] : meetUpLines(name, state.charLocation, state.charHaunt, state.time, away)),
    '',
    ...promptLines('dm', { character, info, state }),
    'BLOCKING',
    `Set "blocked" to true only if these texts have pushed ${name} to cut the reader off completely. She is done, and blocks him on Bunnyboard as her last text lands.`,
    'Her final messages should read like somebody who is about to do that.',
    'Being annoyed, hurt, bored or angry is not enough on its own: people stay in threads they are angry in. Reserve it for wanting him gone.',
    'Otherwise set it to false.',
    '',
    'SUMMARY',
    ...(incomingDirection === undefined ? [] : [
      'Include only actual conversation and the texts you generate. Do not record the writing direction as something the reader said or did.'
    ]),
    summary
      ? 'Then, for the "summary" field, fold the TEXTING SO FAR and the RECENT MESSAGES (plus your reply) into one merged recap.'
      : 'Then, for the "summary" field, condense the RECENT MESSAGES (plus your reply) into a single recap.',
    `Write it in third person, refer to the MC as "the reader", and keep anything ${name} should still remember later. Don't include concrete dates, and leave out old or unimportant information.`
  ].join('\n')

  return modRequest('dm', { character, info, state, newMessage }, {
    system: textingPersonaFor(state.globalTextEdits),
    user,
    schema: textingSchema(),
    // Constant, like the ledger's: nothing above the seam varies by save.
    cacheKey: 'texting',
    kind: 'texting'
  })
}

/**
 * Lead mod fields precede the native reply; trailing additions keep their usual place.
 */
function textingSchema(): {
  name: string
  schema: Record<string, unknown>
} {
  const leadFields = promptFields('dm', 'lead')
  const trailingFields = promptFields('dm', 'trailing')
  const leadRequired = promptRequired('dm', 'lead')
  const trailingRequired = promptRequired('dm', 'trailing')
  return objectSchema('texting', [...new Set([
    ...leadRequired, 'messages', 'summary', 'blocked', ...trailingRequired
  ])], {
    ...leadFields,
    messages: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    // Required: an optional boolean drifts into never being considered.
    blocked: { type: 'boolean' },
    ...trailingFields
  })
}
