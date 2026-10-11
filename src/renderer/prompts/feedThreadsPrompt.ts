import { affectionFor, dedupedMemoriesFor, emptyFlags } from '@shared/relationship'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from '@shared/playerStats'
import {
  fullNameOf,
  type Character,
  type CharInfo,
  type StructuredRequest,
  type TimeSlot
} from '@shared/types'
import { formatShortGameDate } from './gameDate'
import { relationshipLines } from './relationship'
import { objectSchema } from './schema'
import { memoryLines, profileLines, spaced } from './scenePrompt'
import type { IntroReplier } from './slotIntroPrompt'

/** The feed's comment threads: the one call per slot that answers what was said under posts. */

/** One comment as the thread shows it, under the short ref the reply names it by. */
export interface ThreadLine {
  ref: string
  /** Who said it, already worded: "the reader", a girl's name and key, or a stranger's handle. */
  who: string
  text: string
  /** The ref of the comment it answers, when it answers one. */
  replyTo?: string
}

/** One post with something to answer, and everything its answers need. */
export interface FeedThread {
  character: Character
  info: CharInfo
  charKey: string
  texted: boolean
  post: { text: string; date: number; time: TimeSlot; picture?: string }
  lines: readonly ThreadLine[]
  /** Refs of the reader's comments, every one of which she answers. */
  mustAnswer: readonly string[]
  /** Refs of other comments she may answer, at most `mayAnswerCount` of them. */
  mayAnswer: readonly string[]
  mayAnswerCount: number
  /** The roster girls who may react under this post besides her. */
  repliers: readonly IntroReplier[]
  /** Girls the reader tagged, each with the ref of the comment she answers. */
  tagged?: readonly { ref: string; name: string }[]
}

/** Everything the builder reads; assembled by the loop, which owns the store. */
export interface FeedThreadsInput {
  playthroughId: string
  stats?: PlayerStats
  lessNsfwText: boolean
  date: number
  threads: readonly FeedThread[]
}

/** Replies, then what each poster made of the reader's comments. */
const SCHEMA = objectSchema('feed_threads', ['replies', 'memories'], {
  replies: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['to', 'from', 'text'],
      properties: {
        to: { type: 'string' },
        from: { type: 'string' },
        text: { type: 'string' }
      }
    }
  },
  memories: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['char', 'type', 'desc'],
      properties: {
        char: { type: 'string' },
        type: { type: 'string', enum: ['loved', 'liked', 'disliked', 'hated'] },
        desc: { type: 'string' }
      }
    }
  }
})

const PERSONA_LINES = [
  'You write the comment sections of a college social feed: what people type under each other\'s posts on their phones.',
  'Every comment is somebody real typing with their thumbs, in their own voice. Short, casual, lowercase if that is how they type, slang, typos and emoji where they fit. One line, two at most.',
  'You know these people well and keep each of them sounding like herself, so a reader could tell who wrote a comment with the name covered.',
  'You hate generic, robotic comments. Nobody writes "Great post!" or explains a joke. People tease, flirt, hype, deflect and get petty, and leave things unsaid.',
  'You never use semicolons or em dashes.',
  'You always return a single, fully-formed JSON object matching the provided schema exactly.'
]

/** The feed's own persona, kept clean on a less-NSFW playthrough. */
function feedPersona(lessNsfwText: boolean): string {
  return [
    ...PERSONA_LINES,
    ...(lessNsfwText ? ['Keep every comment clean: flirting at most, nothing sexual.'] : [])
  ].join('\n')
}

/** Every poster in full and every other girl who may comment, described once each. */
function characterBlock(input: FeedThreadsInput): string[] {
  const entries: string[][] = []
  const named = new Set<string>()

  for (const thread of input.threads) {
    const { character, info, charKey, texted } = thread
    if (named.has(charKey)) continue
    named.add(charKey)
    entries.push([
      `${fullNameOf(character)} — "char": "${charKey}"`,
      ...profileLines(character, info.flags ?? emptyFlags()),
      ...relationshipLines(
        character,
        info.flags ?? emptyFlags(),
        info.nameKnown,
        affectionFor(info, input.date, character),
        input.stats ?? DEFAULT_PLAYER_STATS,
        { texting: true, texted },
        { date: input.date, offset: info.moodCycleOffset ?? 0 }
      ),
      ...memoryLines(character, dedupedMemoriesFor(info).slice(-3), info.textMemory)
    ])
  }

  for (const thread of input.threads) {
    for (const { character, charKey } of thread.repliers) {
      if (named.has(charKey)) continue
      named.add(charKey)
      const { withFriends, withStrangers } = character.behavior
      entries.push([
        `${fullNameOf(character)} — "from": "${charKey}"`,
        character.personality,
        ...(withFriends ? [`With friends: ${withFriends}`] : []),
        ...(withStrangers ? [`With people she barely knows: ${withStrangers}`] : [])
      ])
    }
  }

  if (entries.length === 0) return []
  return [
    'LOREBOOK',
    '',
    ...entries.flatMap((entry, index) => (index === 0 ? entry : ['', ...entry]))
  ]
}

/** One post, its thread so far, and what is owed under it. */
function threadLines(thread: FeedThread): string[] {
  const { character, charKey, post } = thread
  const name = character.firstName
  const when = `${formatShortGameDate(post.date)}, ${post.time === 0 ? 'morning' : 'evening'}`
  const repliers = thread.repliers.map(
    ({ character: other, charKey: key, friend }) =>
      `${other.firstName} ("${key}", ${friend ? 'her friend' : 'barely knows her'})`
  )
  return [
    `POST by ${fullNameOf(character)} ("${charKey}"), ${when}: ${post.text}`,
    ...(post.picture ? [`Her picture: ${post.picture}`] : []),
    ...thread.lines.map(
      (line) =>
        `- ${line.ref}${line.replyTo ? ` (answering ${line.replyTo})` : ''} — ${line.who}: ${line.text}`
    ),
    ...(thread.mustAnswer.length > 0
      ? [`${name} answers every one of: ${thread.mustAnswer.join(', ')}.`]
      : []),
    ...(thread.mayAnswer.length > 0 && thread.mayAnswerCount > 0
      ? [
          `${name} may answer up to ${thread.mayAnswerCount} of: ${thread.mayAnswer.join(', ')}. Answering none is fine.`
        ]
      : []),
    ...(thread.tagged ?? []).map(
      ({ ref, name: tagged }) => `The reader tagged ${tagged} in ${ref}, so she answers it too.`
    ),
    ...(thread.mustAnswer.length > 0
      ? [
          repliers.length > 0
            ? `Besides her, ${repliers.join(', ')} and strangers may react to the reader's comments here.`
            : 'Besides her, strangers may react to the reader\'s comments here.'
        ]
      : [])
  ]
}

/** Builds the feed-thread request. */
export function buildFeedThreadsPrompt(
  input: FeedThreadsInput,
  setting: string,
  reader: string
): StructuredRequest {
  const user = [
    ...spaced(characterBlock(input)),
    'THREADS',
    '',
    ...input.threads.flatMap((thread, index) =>
      index === 0 ? threadLines(thread) : ['', ...threadLines(thread)]
    ),
    '',
    'YOUR TURN',
    'Fill "replies" with the new comments under these posts. "to" is the ref of the comment it answers, exactly as written. "from" is who writes it: the poster\'s or another girl\'s key exactly as written in LOREBOOK, or an empty string for a stranger, one of the four thousand students on campus who does not know the poster.',
    'The poster answers exactly what her post says she answers, as herself: how she talks, how she feels about whoever she is answering, and what she remembers of the reader. A girl answering the reader can flirt back, tease, brush him off or ignore the question, whatever she actually would.',
    'Other girls and strangers only react to the reader\'s comments, one or two at most per post, and only where it is natural. Nobody else speaks for the reader, and nobody @s anybody or writes a handle in "text".',
    'All of this happens in front of the whole campus, and everybody types like it. Nobody settles anything here: no meeting up, no date, no time or place agreed, whoever suggests it. A girl who likes the idea can say so in a way that keeps it open, or tell him to message her; one who does not can laugh it off. Nothing she would only say to him alone goes in a comment: feelings she has not shown in public, what passed between them in private, anything explicit. Strangers know nothing about the reader beyond the comment in front of them.',
    'Fill "memories" with one entry per poster the reader commented under, saying what she made of what he said: "char" is her key, "type" how she felt about it, and "desc" what happened, in a few words, starting with "the reader".'
  ].join('\n')

  return {
    system: [feedPersona(input.lessNsfwText), '', 'SETTING', setting, '', 'READER', reader].join(
      '\n'
    ),
    user,
    schema: SCHEMA,
    cacheKey: input.playthroughId,
    kind: 'texting'
  }
}
