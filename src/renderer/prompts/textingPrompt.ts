import { affectionFor, dedupedMemoriesFor, emptyFlags } from '@shared/relationship'
import { invitationAnswerOf } from '@shared/invitationAnswer'
import { strictTextingPersona } from './strictSceneBrief'
import { ROOM_LOCATION } from '@shared/locations'
import type { NpcRelationshipMap } from '@shared/npcRelationships'
import {
  type Character,
  type CharInfo,
  type ClassEntry,
  type ChatMessage,
  type Conversation,
  type Haunt,
  type JobState,
  type Occasion,
  type StructuredRequest,
  type TimeSlot
} from '@shared/types'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from '@shared/playerStats'
import type { Weather } from '@shared/weather'
import {
  formatChatDivider,
  formatDateBanner,
  formatRelativeSlot,
  formatSemesterProgress
} from './gameDate'
import {
  ambientLoreCharacters,
  characterLore,
  characterLoreForIds,
  keyPattern,
  lorebookBlock
} from './lorebook'
import { occasionLoreLines } from './occasions'
import { objectSchema } from './schema'
import { memoryLines, profileLines, scheduleLines, yearMajorLine } from './scenePrompt'
import { springBreakLines } from './springBreak'
import {
  bestFriendLines,
  hauntClause,
  whereaboutsLine,
  type NpcCompanions
} from './npcRelationship'
import { relationshipLines } from './relationship'
import { weatherLines } from './weather'

/**
 * Builds the Bunnyboard texting request: RITA answering the reader's text as one
 * character, over the campus messaging app.
 */

/** How many recent messages ride in the prompt and in each rolling summary. */
const TEXTING_HISTORY_CAP = 20

/** RITA writing one side of a text thread. */
const TEXTING_PERSONA = [
  'You are RITA, author of steamy reader-POV romance fiction set at fictional universities.',
  'You\'ve got sexy nerd energy and have been on a hundred dates, and you use that experience to make your writing shockingly realistic.',
  'Right now you are writing one side of a text conversation on Bunnyboard, the campus messaging app: you answer AS the character, in her own texting voice.',
  'Some people send one long message, some fire off several short ones — match how SHE would text, keeping her personality and memories in mind.',
  'Texts are casual: typos, slang, emoji and lowercase are all fair game if they fit her. No narration, no stage directions, just what she types.',
  'You make the women play hard to get; everything is a slow burn.',
  'Oh, by the way: you really, really HATE repetitive, robotic slop-writing.',
  'You NEVER use semicolons or emdashes or other dumb AI writing habits.',
  'And finally, you\'re totally anal retentive: You always return a single, fully-formed JSON object matching the provided schema exactly.'
].join('\n')

/** The prompt-facing slice of state a texting turn needs. */
export interface TextingPromptState {
  /**
   * Ask for every field, and give her only what she could know. Absent reads as off, which is
   * the call this build has always sent.
   */
  strictSchema?: boolean
  date: number
  time: TimeSlot
  /** The reader's accumulated stats, used for relationship requirement guidance. */
  stats?: PlayerStats
  /**
   * Every roster character except the one being texted — the lorebook's people,
   * excluded at the source so no entry can restate the `CHARACTER` block.
   */
  roster: readonly Character[]
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
  /** The part-time job the reader holds, or null — the rest of his week. */
  playerJob: JobState | null
  /** The save's generated occasions; the fixed calendar is merged in on read. */
  occasions: readonly Occasion[]
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
}

/** A text's line breaks folded to spaces, so a message stays one prompt line. */
function flatText(text: string): string {
  return text.replace(/\s*\n+\s*/g, ' ')
}

/** `"YOU: hey"` / `"MINA: hey yourself"` / `"SYSTEM: ..."` — one history stub. */
function messageStub(message: ChatMessage, firstName: string): string {
  if (message.sender === 'player') return `YOU: ${flatText(message.text)}`
  if (message.sender === 'system') return `SYSTEM: ${flatText(message.text)}`
  return `${firstName.toUpperCase()}: ${flatText(message.text)}`
}

/**
 * A window of messages rendered for injection, newest last; system lines ride along as
 * context the character plausibly has.
 */
export function stampedStubs(window: readonly ChatMessage[], firstName: string): string[] {
  const lines: string[] = []
  let stamped: string | null = null
  for (const message of window) {
    const stamp = formatChatDivider(message.date, message.time)
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
 * Her hangout ask when it ends the thread, with his answer when one closed it — his "Sure", or
 * the app's line recording what he chose. A reminder about a plan already made is not flagged as
 * an invite but stands behind `pendingHangout` just the same.
 */
function hangoutTail(
  conversation: Conversation
): { ask: ChatMessage; answer?: ChatMessage } | null {
  const { messages } = conversation
  const last = messages[messages.length - 1]
  if (!last) return null
  if (last.sender === 'contact') {
    return last.invite || conversation.pendingHangout ? { ask: last } : null
  }
  const before = messages[messages.length - 2]
  const answered =
    (last.sender === 'player' && last.text === 'Sure') || invitationAnswerOf(last) !== undefined
  if (answered && before?.sender === 'contact') {
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
    const first = conversation.messages[0]
    lines.push(
      `The reader and ${firstName} added each other on Bunnyboard ${formatRelativeSlot(first.date, first.time, now.date, now.time)}, but haven't texted yet.`
    )
  } else if (last) {
    const when = formatRelativeSlot(last.date, last.time, now.date, now.time)
    const tail = hangoutTail(conversation)
    // Her ask and his Sure never pass through a texting call, so no summary holds them:
    // the scene is shown the texts themselves.
    const answer = invitationAnswerOf(tail?.answer)
    if (tail && answer) {
      // Reported rather than quoted: the answer is a button he pressed, not something he said.
      lines.push(
        `The last text in the thread was sent ${when}. ${firstName}: "${flatText(tail.ask.text)}" The reader ${
          answer === 'yes' ? 'took her up on it' : 'did not take it up'
        }.`
      )
    } else if (tail?.answer) {
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
  away: boolean,
  strict: boolean
): string[] {
  // Dropped while she is off campus: the line claims she can meet, and her block says she can't.
  if (away) return []

  if (!strict) {
    if (!location || location === ROOM_LOCATION) {
      return [
        `${name}'s schedule is clear, so if the reader asks to meet up right now assume ${name} is free to... though not necessarily willing.`
      ]
    }
    return [
      `${name}'s schedule is clear, so if the reader asks to meet up right now assume ${name} is free to — she is already ${hauntClause(location, haunt, time)} and would sooner have him come to her than go somewhere else — though not necessarily willing.`
    ]
  }

  /**
   * Worth counting what a character is actually told she may do, in the block she writes her
   * reply under. Four lines say write it in her voice and keep it text-length. Thirteen are about
   * sending a picture. Three are about blocking him for good. And one is this.
   *
   * That is the whole menu: three affordances, every one an engine feature, and nothing at all
   * about having a conversation — no topics, no interests, nothing about her day. So when the
   * model asks what it may *do* in a reply, the answer is: offer to meet, send a nude, or block
   * him. Photos are rationed ("Most replies are just words") and blocking is terminal, which
   * leaves meeting the only move always available, for every character, every turn, whatever the
   * conversation was about.
   *
   * And "would sooner have him come to her" is not availability. It is a stated want, sitting one
   * line under "write her reply" — a model reading that is being told she would *like* him to come
   * over, not merely that she could.
   */
  const where =
    !location || location === ROOM_LOCATION
      ? ''
      : ` She is already ${hauntClause(location, haunt, time)}, so her own spot is the easy answer if she says yes.`
  return [
    `If the reader asks to meet up right now, ${name}'s schedule is clear enough that she could — though not necessarily willing.${where}`,
    // The brake the photo rules have and this never did.
    `This answers him if he asks. It is not a reason for ${name} to bring it up: she has her own day and is not looking for company, and most replies are not invitations.`
  ]
}

/** Builds the texting turn request. `newMessage` is the reader's fresh text. */
export function buildTextingPrompt(
  character: Character,
  info: CharInfo | undefined,
  conversation: Conversation | undefined,
  newMessage: string,
  state: TextingPromptState,
  reader: string
): StructuredRequest {
  const name = character.firstName
  // The hours she is enrolled in with him: the same class code in the same slot on both
  // timetables. Her own schedule is already in her block above.
  const sharedClasses = Object.fromEntries(
    Object.entries(state.playerSchedule).filter(
      ([slot, code]) => info?.schedule?.[Number(slot)] === code
    )
  )
  const away = state.springBreakAway?.includes(character.charId) ?? false
  // The new text is the last line of the log, so it gets its own stamp when it lands in a new slot.
  const history = stampedStubs(
    [
      ...(conversation?.messages ?? []).slice(-TEXTING_HISTORY_CAP),
      {
        id: 'pending',
        sender: 'player',
        text: newMessage,
        date: state.date,
        time: state.time
      }
    ],
    name
  )
  const summary = conversation?.summary ?? null

  // The scan covers the whole thread the model reads, not just the new message.
  const scan = [summary ?? '', ...history].join('\n')
  // Today's occasions are always-on.
  const today = occasionLoreLines(state.date, state.time, state.occasions)

  // An entry's standings are measured against the one girl on the thread.
  const relations = { relationships: state.npcRelationships, present: [character] }
  // The ambient entries nothing in the thread named, minus any the scan already fires.
  const ambient = ambientLoreCharacters(state.roster, [character], state.npcRelationships).filter(
    (other) => !new RegExp(keyPattern(other.firstName, false), 'iu').test(scan)
  )
  const lore = lorebookBlock(scan, today, [
    ...characterLore(scan, state.roster, state.charInfo, state.date, relations),
    ...characterLoreForIds(ambient, state.charInfo, state.date, relations)
  ])

  const characterBlock = [
    'CHARACTER',
    `${name} ${character.lastName}.`,
    ...(info?.major ? [yearMajorLine(info)] : []),
    // The phone takes the one-character budget.
    ...profileLines(character, info?.flags ?? emptyFlags()),
    ...relationshipLines(
      character,
      info?.flags ?? emptyFlags(),
      // Texting requires a completed contact, so her name is known by then.
      info?.nameKnown ?? true,
      affectionFor(info, state.date, character),
      state.stats ?? DEFAULT_PLAYER_STATS,
      // The stored thread only: the pending text is not yet something they have said.
      { texting: true, texted: hasTexted(conversation) },
      // Where she is in her cycle, for a Promiscuous girl's DTF days.
      { date: state.date, offset: info?.moodCycleOffset ?? 0 }
    ),
    // Her closest friend; the roster handed in is everybody but her.
    ...bestFriendLines(character, state.roster, state.npcRelationships),
    ...scheduleLines(`${name}'s Schedule:`, info?.schedule ?? {}, state.classes, info?.job, state.date),
    // Where she is spending the break: on a thread, the only thing saying she has left campus.
    ...springBreakLines(
      name,
      info?.springBreakPlans,
      state.springBreakAway,
      character.charId,
      state.date
    ),
    ...memoryLines(character, dedupedMemoriesFor(info), info?.textMemory),
  ]

  const user = [
    'READER',
    reader,
    /**
     * Under `strictSchema` she gets only the hours she is enrolled in with him, and no job at
     * all. His whole week — classes and shifts, ungated by how well she knows him — is defensible
     * on a model that merely respects a fact, and on a cheap one it is a fact to be *used*: the
     * player told her he had a shift and was answered "I know about the shift, nick. badminton
     * class is tonight, and you're behind the bar after it." She was not being consistent with
     * his week, she was arguing with him out of it.
     *
     * Sharing a class is something she would know from sitting in it, and survives as good
     * writing. His other lectures and his roster are things she could only know if he said so —
     * and if he said so, the thread already carries it. The job is not filtered but gone: a shift
     * is never shared, so there is nothing for the two timetables to have in common.
     */
    ...(state.strictSchema === true
      ? scheduleLines(`Classes ${name} is in with the reader:`, sharedClasses, state.classes)
      : scheduleLines(
          "The reader's Schedule:",
          state.playerSchedule,
          state.classes,
          state.playerJob,
          state.date
        )),
    '',
    ...characterBlock,
    '',
    'NOW',
    `It is ${formatDateBanner(state.date, state.time)}`,
    formatSemesterProgress(state.date),
    // Texting happens before the slot's scene; without this she treats the day as over.
    state.time === 0 ? 'Morning classes are starting soon.' : 'Night classes are starting soon.',
    ...(state.weather ? weatherLines(state.weather, state.date, state.time) : []),
    ...whereSheIs(name, state.charLocation, state.charCompanions, state.charHaunt, state.time),
    '',
    ...lore,
    ...(summary ? ['TEXTING SO FAR', '"' + summary + '"', ''] : []),
    'RECENT MESSAGES',
    "'''",
    ...history,
    "'''",
    '',
    'YOUR TURN',
    `${name} is texting the reader back in a private DM.`,
    `Write ${name}'s reply to the reader's newest message, the last line of RECENT MESSAGES, as the "messages" array: each entry is one text bubble she sends.`,
    'Stay in her voice and keep it text-length: this is a phone thread, not prose.',
    ...meetUpLines(
      name,
      state.charLocation,
      state.charHaunt,
      state.time,
      away,
      state.strictSchema === true
    ),
    '',
    'BLOCKING',
    `Set "blocked" to true only if these texts have pushed ${name} to cut the reader off completely. She is done, and blocks him on Bunnyboard as her last text lands.`,
    'Her final messages should read like somebody who is about to do that.',
    'Being annoyed, hurt, bored or angry is not enough on its own: people stay in threads they are angry in. Reserve it for wanting him gone.',
    'Otherwise set it to false.',
    '',
    'SUMMARY',
    summary
      ? 'Then, for the "summary" field, fold the TEXTING SO FAR and the RECENT MESSAGES (plus your reply) into one merged recap.'
      : 'Then, for the "summary" field, condense the RECENT MESSAGES (plus your reply) into a single recap.',
    `Write it in third person, refer to the MC as "the reader", and keep anything ${name} should still remember later. Don't include concrete dates, and leave out old or unimportant information.`
  ].join('\n')

  return {
    system: state.strictSchema === true ? strictTextingPersona(TEXTING_PERSONA) : TEXTING_PERSONA,
    user,
    schema: textingSchema(),
    // Constant, like the ledger's: nothing above the seam varies by save.
    cacheKey: 'texting',
    kind: 'texting'
  }
}

/**
 * The `TextingResponse` schema: `messages` first so they stream ahead; the preview
 * reader stops at that array's `]`.
 */
function textingSchema(): {
  name: string
  schema: Record<string, unknown>
} {
  return objectSchema('texting', ['messages', 'summary', 'blocked'], {
    messages: { type: 'array', items: { type: 'string' } },
    summary: { type: 'string' },
    // Required: an optional boolean drifts into never being considered.
    blocked: { type: 'boolean' }
  })
}
