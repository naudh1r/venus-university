import { affectionFor, dedupedMemoriesFor, emptyFlags, relationshipTagOf } from '@shared/relationship'
import { readerize } from '@shared/readerVoice'
import { DEFAULT_PLAYER_STATS, type PlayerStats } from '@shared/playerStats'
import {
  fullNameOf,
  type Character,
  type CharInfo,
  type Season,
  type StructuredRequest,
  type TimeSlot
} from '@shared/types'
import { formatShortGameDate } from './gameDate'
import { relationshipLines } from './relationship'
import { objectSchema } from './schema'
import { memoryLines, profileLines, spaced } from './scenePrompt'
import type { PosterStanding, Replier } from '../stores/bunnyfeedsReplies'

/** Bunnyfeeds' prompts: the replies a post arrives with, and the call that answers the reader. */

/** The slot opening's lines about the replies each post arrives with. */
export function slotCommentLines(): string[] {
  return [
    'Each post also carries "comments": what other students replied underneath it, in their own voices: exactly as many of her followers as CROWD says for that post, and the friend REPLIERS names under it on top of those.',
    'A reply is either the friend of hers REPLIERS names under that post, if it names one, or one of her followers. For that friend, "from" is her key exactly as written there, and she types the way she would actually type to a friend — her own words, slang and emoji, not a generic commenter\'s. She replies besides the followers CROWD counts, unless she would leave it.',
    'A follower is one of the four thousand students on campus who follows her account: a fan, a classmate, somebody from her club or her dorm. "from" is an empty string; she is friendly with the poster at most, never close, so no inside jokes and nothing about her private life, and she is not the reader. Followers reply the way a public feed does: mostly friendly, sometimes flirty, sometimes roasting, now and then a hater, never more than one mean reply under a post. No reply is the reader. No handles and no @s in "text" — just what each one said. Each typed it on her phone and has only read the post: nobody hears, sees or laughs out loud at anybody here.',
    'They answer the post they are under. A reply to a picture is a reply to that picture; one under a picture with skin in it reads like a public feed at its least charming, which is strangers being obvious at somebody who did not ask.'
  ]
}

/** The schema of each post's `comments` field: who wrote each reply, and what she said. */
export function slotCommentsField(): Record<string, unknown> {
  return {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      required: ['from', 'text'],
      properties: { from: { type: 'string' }, text: { type: 'string' } }
    }
  }
}

/** How a replier stands with the poster, named, so "her" never reads as the replier herself. */
function standingWords(standing: PosterStanding, poster: string): string {
  if (standing === 'friend') return `${poster}'s friend`
  if (standing === 'enemy') return `${poster}'s enemy: they can't stand each other`
  return `barely knows ${poster}`
}

/**
 * How many of her followers reply under each of the slot's posts, as the game rolled them: one
 * count for a post of words and another for one with a picture, since the picture is only known
 * once written. A friend REPLIERS names replies on top of these.
 */
export function crowdBlock(
  posters: ReadonlyArray<{ name: string; charKey: string; words: number; picture: number }>
): string[] {
  if (posters.length === 0) return []
  const many = (n: number): string =>
    n === 0 ? 'no followers' : n === 1 ? '1 follower' : `${n} followers`
  return [
    'CROWD',
    ...posters.map(({ name, charKey, words, picture }) =>
      words === picture
        ? `- ${name}'s post ("${charKey}"): ${many(words)}.`
        : `- ${name}'s post ("${charKey}"): ${many(words)}, or ${many(picture)} if it carries a picture.`
    )
  ]
}

/** One poster this slot, and the friend of hers, if any, who may reply under her post. */
export interface PosterRepliers {
  character: Character
  charKey: string
  repliers: readonly Replier[]
}

/**
 * The friend of hers who may reply under each post, every one described once in enough of her
 * own voice to write as her. A girl already posting is described with the posters, so only named.
 */
export function replierBlock(posters: readonly PosterRepliers[]): string[] {
  const posting = new Set(posters.map(({ charKey }) => charKey))
  const described = new Set<string>()
  const voices: string[] = []
  const under: string[] = []

  for (const { character, charKey, repliers } of posters) {
    if (repliers.length === 0) continue
    const names = repliers.map(
      ({ character: other, charKey: key, standing }) =>
        `${other.firstName} ("${key}", ${standingWords(standing, character.firstName)})`
    )
    under.push(`- Under ${character.firstName}'s post ("${charKey}"): ${names.join(', ')}`)
    for (const { character: other, charKey: key } of repliers) {
      if (described.has(key)) continue
      described.add(key)
      const { withFriends } = other.behavior
      voices.push(
        posting.has(key)
          ? `${fullNameOf(other)} — "from": "${key}": described under LOREBOOK.`
          : `${fullNameOf(other)} — "from": "${key}": ${other.personality}`,
        ...(withFriends ? [`  With friends: ${withFriends}`] : [])
      )
    }
  }
  if (under.length === 0) return []

  return [
    'REPLIERS',
    'Besides her followers, only the girl named under a post may reply to it, in her own voice, as her friend.',
    ...under,
    '',
    ...voices
  ]
}

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
  /** The ref a new comment on the post itself answers. */
  postRef: string
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
  repliers: readonly Replier[]
  /** Whether one of her followers may chime in this round. */
  follower: boolean
  /** Whoever the reader answered directly and answers him back, with the ref of his comment. */
  answersBack?: readonly { ref: string; who: string }[]
  /** Girls the reader answered directly who stay quiet this round, with the ref of his comment. */
  silent?: readonly { ref: string; replier: Replier }[]
  /** Girls the reader tagged, each with the ref of the comment she answers. */
  tagged?: readonly { ref: string; name: string }[]
  /** The thread has run long and she wraps it up. */
  windingDown?: boolean
}

/** Everything the builder reads; assembled by the loop, which owns the store. */
export interface FeedThreadsInput {
  playthroughId: string
  stats?: PlayerStats
  lessNsfwText: boolean
  date: number
  /** The semester's season, which the posts' dates are read in. */
  season: Season
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
  'Nobody is in the same room: they only read what the others typed. Nobody sees a face or hears a laugh, so nobody mentions giggling, looks or tone of voice; a laugh is typed or an emoji, and a reaction is to the words on the screen.',
  'You know these people well and keep each of them sounding like herself, so a reader could tell who wrote a comment with the name covered.',
  'You hate generic, robotic comments. Nobody writes "Great post!" or explains a joke. People tease, flirt, hype, deflect and get petty, and leave things unsaid.',
  'The reader is the exception: he types however he types, in plain words, short or in broken English. The girls read him for what he means: none of them corrects, mocks or judges his grammar, his spelling or how little he wrote (a one-word comment is a fine comment), and how a girl feels about his comment goes by what he said, never how he said it. A follower may now and then poke fun at a badly mangled comment, the way strangers online do, and that counts as the post\'s one mean comment.',
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
        info,
        input.stats ?? DEFAULT_PLAYER_STATS,
        { texting: true, texted },
        { date: input.date, offset: info.moodCycleOffset ?? 0 }
      ),
      ...memoryLines(
        character,
        dedupedMemoriesFor(info).slice(-3),
        info.textMemory,
        input.season
      )
    ])
  }

  for (const thread of input.threads) {
    const quiet = (thread.silent ?? []).map(({ replier }) => replier)
    for (const { character, charKey, info } of [...thread.repliers, ...quiet]) {
      if (named.has(charKey)) continue
      named.add(charKey)
      const { withFriends, withStrangers } = character.behavior
      entries.push([
        `${fullNameOf(character)} — "from": "${charKey}"`,
        character.personality,
        ...(withFriends ? [`With friends: ${withFriends}`] : []),
        ...(withStrangers ? [`With people she barely knows: ${withStrangers}`] : []),
        ...readerTieLines(character, info, input.date)
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

/**
 * For a girl reacting to the reader, what she knows of him: how she stands with him and the last
 * thing she remembers, or, if they have never shared a scene, only the feed.
 */
function readerTieLines(character: Character, info: CharInfo | undefined, date: number): string[] {
  const flags = info?.flags ?? emptyFlags()
  const memories = info ? dedupedMemoriesFor(info) : []
  const latest = memories[memories.length - 1]
  const remembered = latest
    ? `What she last remembers of him: ${character.firstName} ${latest.type} that ${readerize(latest.desc)}.`
    : null
  if (!info || !flags.hasMet) {
    return remembered
      ? ['She has never met the reader in person and knows him only from the feed.', remembered]
      : ['She has never met the reader: she knows him only as the name on his comment.']
  }
  return [
    `Her and the reader: ${relationshipTagOf(flags, affectionFor(info, date, character))}.`,
    ...(remembered ? [remembered] : [])
  ]
}

/** One post, its thread so far, and what is owed under it. */
function threadLines(thread: FeedThread, season: Season): string[] {
  const { character, charKey, post } = thread
  const name = character.firstName
  const when = `${formatShortGameDate(post.date, season)}, ${post.time === 0 ? 'morning' : 'evening'}`
  const repliers = thread.repliers.map(
    ({ character: other, charKey: key, standing }) =>
      `${other.firstName} ("${key}", ${standingWords(standing, name)})`
  )
  return [
    `POST ${thread.postRef} by ${fullNameOf(character)} ("${charKey}"), ${when}: ${post.text}`,
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
    ...(thread.tagged ?? []).map(({ ref, name: tagged }) => {
      const standing = thread.repliers.find(({ character: girl }) => girl.firstName === tagged)?.standing
      return `The reader tagged ${tagged}${standing ? ` (${standingWords(standing, name)})` : ''} in ${ref}, so she answers it too.`
    }),
    ...(thread.answersBack ?? []).map(
      ({ ref, who }) => `The reader answered ${who} directly in ${ref}, so ${who} answers him back.`
    ),
    ...(thread.silent ?? []).map(
      ({ ref, replier }) =>
        `The reader answered ${replier.character.firstName} ("${replier.charKey}") directly in ${ref}. She sees it but does not answer it, and writes nothing here.`
    ),
    ...(thread.windingDown
      ? [
          `This thread has run long. ${name} keeps her answers short and starts wrapping it up in her own way, the way people drift out of a thread that has gone on too long. Nobody else reacts here besides anyone the reader tagged.`
        ]
      : thread.mustAnswer.length > 0
        ? [joinersLine(repliers, thread.follower, thread.postRef)]
        : [])
  ]
}

/** Who besides the poster may react under a post this round, or that nobody else does. */
function joinersLine(repliers: readonly string[], follower: boolean, postRef: string): string {
  const joining = [...repliers, ...(follower ? ['one of her followers'] : [])]
  const named =
    joining.length > 1
      ? `${joining.slice(0, -1).join(', ')} and ${joining[joining.length - 1]}`
      : joining[0]
  return joining.length > 0
    ? `Besides her, ${named} may react here: to the reader, to each other, to her, or to the post itself as ${postRef}.`
    : 'Nobody else reacts under this post this round besides whoever is named above.'
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
      index === 0
        ? threadLines(thread, input.season)
        : ['', ...threadLines(thread, input.season)]
    ),
    '',
    'YOUR TURN',
    'Fill "replies" with the new comments under these posts. "to" is the ref of the comment it answers, or the post\'s own ref for a new comment on the post, exactly as written. "from" is who writes it: the poster\'s or another girl\'s key exactly as written in LOREBOOK, or an empty string for one of her followers. A follower is one of the four thousand students on campus who follows her account: a fan, a classmate, somebody from her club or her dorm. Followers are friendly with her at most, never close: no inside jokes, nothing about her private life. A follower named above as answering the reader back writes "from" as that handle exactly, @ included.',
    'The poster answers exactly what her post says she answers, as herself: how she talks, how she feels about whoever she is answering, and what she remembers of the reader. A girl answering the reader can flirt back, tease, brush him off or ignore the question, whatever she actually would.',
    'Under each post only who THREADS names there reacts: the poster, the girls it names, and a follower where it says one may. Whoever may react can still leave it; none is fine. They react to the reader\'s comment, to another comment in the thread, or to the post itself. The thread is a conversation, not a line of people answering him: they can talk to each other and to the poster too. Nobody else speaks for the reader, nobody answers herself, and nobody @s anybody or writes a handle in "text".',
    'Everybody replies however they actually would. A girl goes by her personality, how she stands with the poster and what she knows of the reader: she can flirt, tease, hype, roast or brush him off. The poster and a girl who is her enemy are never warm to each other, however sweet either is with everyone else: cool, catty or passive-aggressive, each in her own manner, and never a compliment that is not backhanded. Followers have the whole range a public feed has: mostly friendly, sometimes flirty, sometimes roasting her or the reader, now and then a hater. Never more than one mean comment under a post.',
    'All of this happens in front of the whole campus, and everybody types like it. Nobody settles anything here: no meeting up, no date, no time or place agreed, whoever suggests it. A girl who likes the idea can say so in a way that keeps it open, or tell him to message her; one who does not can laugh it off. Nothing she would only say to him alone goes in a comment: feelings she has not shown in public, what passed between them in private, anything explicit. Followers know nothing about the reader beyond the comment in front of them.',
    'Fill "memories" with one entry per poster the reader commented under, one per other girl who answers him in "replies", and one per girl who sees his answer without answering it, whether or not she has met him, saying what she made of what he said: "char" is her key, "type" how she felt about it, and "desc" what happened, in a few words, starting with "the reader". Say only what he said or did: never the post, whose post it was, or where it happened, since the game adds that.'
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

/**
 * Told to the texting bookkeeping when a girl he texted has his comments under her posts: what
 * was said on the feed is filed by the feed, so texts about it are not taken for the comments.
 */
export const TEXT_LEDGER_FEED_LINES = [
  'THE FEED',
  'The reader also comments under these girls\' feed posts, in public, and those comments are noted elsewhere. A message that brings up one of her posts or a comment on it is texting about the feed: note only what was said in these messages, never the comments themselves, and never call something "over text" that happened on the feed.'
]
