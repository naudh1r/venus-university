import { PRONOUNS, readerWords, type ReaderPronouns } from '@shared/gender'
import { STAT_KEYS, STAT_LABELS, tierName, tierNameOf } from '@shared/playerStats'
import type { Gender } from '@shared/types'
import { objectSchema } from '@vx/modkit/renderer'
import {
  MAX_TIER,
  pointsForTier,
  type CharFlags,
  type PlayerStats,
  type StatTier,
  type StructuredRequest
} from '@vx/modkit/shared'
import {
  ASSISTANT_ACTION_LIMIT,
  ASSISTANT_SUGGESTIONS_MAX,
  type ChoiceCount
} from '../../shared/storyAssistant'
import { headingTag } from './scenePrompt'

/** A character of the scene's cast as the request may name them. */
export interface AssistantName {
  /** Their first name, or null while the reader has not learned it. */
  name: string | null
  /** Their first and last name as the story's own text spells them, for masking an unnamed one. */
  names: readonly string[]
  gender: Gender
}

/** One character in the scene, as much of them as the player has been shown. */
export interface AssistantGirl extends AssistantName {
  /** Their age as the scene's own cast heading gives it; absent where unknown. */
  age?: number
  /** The tag their contact page wears. */
  tag: string
  flags: Pick<
    CharFlags,
    | 'isLover'
    | 'hasKissed'
    | 'hadSex'
    | 'brokenUp'
    | 'harem'
    | 'friendZoned'
    | 'friendZonedBy'
    | 'gaveContactInfo'
    | 'blocked'
  >
  /** Every line her contact page has open — likes, her type, backstory, love life — ready to print. */
  profile: readonly string[]
  /** Her memories, told secrets, the player's notes and the plans ahead, ready to print. */
  record: readonly string[]
}

/** Everything one read of the scene is built from. */
export interface AssistantContext {
  setting: string
  reader: string
  /** The reader's pronouns, for the lines that name the reader beside a character. */
  readerPronouns: ReaderPronouns
  /** The reader's points in each stat. */
  stats: PlayerStats
  /** The date and half of the day the scene is in. */
  when: string
  /** Earlier slots' summaries, dated, oldest first. */
  earlier: readonly string[]
  /** The characters still in the scene. */
  girls: readonly AssistantGirl[]
  /** The characters who have left it, whose lines are still in `lines`. */
  departed: readonly AssistantName[]
  /** The running summary, covering the scene up to where `lines` takes over. */
  summary: string | null
  /** The scene's tail, a line of the transcript to each. */
  lines: readonly string[]
  /** What the player asked; blank for a read of the scene as a whole. */
  question: string
  /** The player's own prompt; blank for the shipped one. */
  prompt: string
  choices: ChoiceCount
  lessNsfwText: boolean
}

/**
 * What the assistant calls each character of the cast whose name the reader has not learned, those
 * still in the scene first: UNNAMED GIRL or UNNAMED GUY, numbered where several share one.
 */
function unnamedLabels(cast: readonly AssistantName[]): Map<AssistantName, string> {
  const labels = new Map<AssistantName, string>()
  for (const gender of ['female', 'male'] as const) {
    const unnamed = cast.filter((person) => person.name === null && person.gender === gender)
    const label = `UNNAMED ${PRONOUNS[gender].noun.toUpperCase()}`
    unnamed.forEach((person, index) => {
      labels.set(person, unnamed.length === 1 ? label : `${label} ${index + 1}`)
    })
  }
  return labels
}

/** `word` wherever no letter, number or underscore of any script touches either end of it. */
export function wholeWord(word: string, flags = 'u'): RegExp {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![\\p{L}\\p{N}_])${escaped}(?![\\p{L}\\p{N}_])`, flags)
}

/** `text` with each of `name`'s whole-word appearances, as written or in capitals, swapped for `label`. */
function maskName(text: string, name: string, label: string): string {
  const trimmed = name.trim()
  if (!trimmed) return text
  let out = text
  for (const spelling of new Set([trimmed, trimmed.toUpperCase()])) {
    out = out.replace(wholeWord(spelling, 'gu'), label)
  }
  return out
}

/**
 * `text` with every unnamed girl's names swapped for her label, sparing any name a named girl of
 * the cast also answers to.
 */
function maskedText(
  text: string,
  cast: readonly AssistantName[],
  labels: ReadonlyMap<AssistantName, string>
): string {
  const spared = new Set(cast.flatMap((girl) => (girl.name === null ? [] : girl.names)))
  let out = text
  for (const [girl, label] of labels) {
    // Her whole name first, so "First Last" becomes one label rather than two.
    out = maskName(out, girl.names.join(' '), label)
    for (const name of girl.names) if (!spared.has(name)) out = maskName(out, name, label)
  }
  return out
}

/** The milestones between one character and the reader that the player has watched happen. */
function milestoneSentences(
  who: string,
  gender: Gender,
  flags: AssistantGirl['flags'],
  reader: ReaderPronouns
): string[] {
  const { they, their } = PRONOUNS[gender]
  const shared = flags.harem ? `, and ${they} has agreed to share ${readerWords(reader, gender).him}` : ''
  const lines: string[] = []
  if (flags.isLover) lines.push(`${who} and the reader are dating${shared}.`)
  if (flags.hadSex) lines.push(`${who} and the reader have slept together.`)
  else if (flags.hasKissed) lines.push(`${who} and the reader have kissed.`)
  if (flags.brokenUp > 0) {
    lines.push(`${who} and the reader have broken up ${flags.brokenUp === 1 ? 'once' : `${flags.brokenUp} times`}.`)
  }
  if (flags.friendZoned) lines.push(`The reader has friendzoned ${who}.`)
  if (flags.friendZonedBy) lines.push(`${who} has friendzoned the reader.`)
  if (flags.blocked) lines.push(`${who} has blocked the reader on Bunnyboard.`)
  else if (flags.gaveContactInfo) lines.push(`${who} has given the reader ${their} number.`)
  return lines
}

/** The `STATS` block: each stat's points and rank, then how the scale reads. */
function statLines(stats: PlayerStats): string[] {
  const ceiling = pointsForTier(MAX_TIER)
  const ranks = Array.from({ length: MAX_TIER + 1 }, (_, tier) => tierNameOf(tier as StatTier))
  return [
    ...STAT_KEYS.map((key) => `${STAT_LABELS[key]}: ${Math.floor(stats[key])} (${tierName(stats[key])})`),
    `Ranks, lowest to highest: ${ranks.join(', ')}. The scale has a soft limit of ${ceiling}: a stat can climb past ${ceiling}, but from ${ceiling} on its rank and its wording under READER stay at ${tierNameOf(MAX_TIER)}.`
  ]
}

/**
 * One character's entry under CAST, headed with their age and pronouns as the scene's own cast is;
 * `label` stands in for their name while the reader has not learned it.
 */
function girlLines(girl: AssistantGirl, label: string | undefined, reader: ReaderPronouns): string[] {
  const tag = headingTag(girl.gender, girl.age)
  if (girl.name === null) {
    const { noun, their } = PRONOUNS[girl.gender]
    return [`${label} (${tag}): a ${noun} in the scene who has not told the reader ${their} name.`, '']
  }
  return [
    `${girl.name.toUpperCase()} (${tag}) — ${girl.tag}`,
    ...milestoneSentences(girl.name, girl.gender, girl.flags, reader),
    ...girl.profile,
    ...girl.record,
    ''
  ]
}

/**
 * The shipped prompt: who the assistant is and what its two fields hold. The player may replace
 * it whole; how many ways forward to offer and the content line are the app's, added after it.
 */
export const DEFAULT_ASSISTANT_PROMPT = [
  'You are the Story Assistant: a sharp, warm friend reading the story as it unfolds.',
  'The player plays the reader, the story\'s protagonist. Talk to the player as "you", and call the reader "you" too: what the reader did, the player did.',
  '',
  'WHAT YOU KNOW',
  'You know only what is written in the message, which is what the player has seen. You also know who the reader is, from READER and STATS. Never invent events, history or facts about the characters.',
  "Nobody's private thoughts are given to you. Read each character from what they have said and done, and say how sure you are where it matters.",
  'Someone written as UNNAMED GIRL or UNNAMED GUY has not told the reader their name. Never guess one or give them one, and never write the label itself: call them "she" or "he", or by how they come across.',
  '',
  'COMMENTARY',
  'In "commentary", say what you make of the scene in a phrase or two, maximum 2 sentences: how it is going, how each of them seems to be taking you, what is building or at stake.',
  'Be candid and specific to this scene. No lists, no headings, and no retelling of what the player has just read.',
  'Where a QUESTION is given, "commentary" answers it instead, honestly and from what you know.',
  'The commentary is where you can be more direct to the player, so you can use very casual language, as if you are talking to a friend',
  '',
  'WAYS FORWARD',
  'In "suggestions", offer things the reader could do next, from the scene as it stands, each genuinely different from the others: a bold one, a careful one, one that takes the scene somewhere else entirely.',
  '"label" is two to five words naming it.',
  `"action" is the turn as the player would type it: first person, the reader's words in quotes and what the reader does, one or two sentences and under ${ASSISTANT_ACTION_LIMIT} characters, like: "Wait, you actually play?" I lean in, grinning.`,
  'An action is the reader trying something, never how it turns out: how anyone answers is the story\'s to tell.',
  'An action never names someone written as UNNAMED GIRL or UNNAMED GUY; it calls them "her" or "him".',
  '',
  'WAYS FORWARD GUIDELINES',
  'Tailor them to who the reader is, from READER and STATS, and to what the reader has done so far. Brain is the reader\'s smarts, Body their fitness, Heart their charm: never offer a way forward that leans on a stat the reader is weak in, such as a feat of strength from a reader with a low Body.',
  'You may also offer one that shakes the scene up, or that could push someone away, where it fits who the reader is and the story so far.'
].join('\n')

/** How many ways forward one read is asked for, as a line. */
function countLine(choices: ChoiceCount): string {
  return choices === 'four'
    ? `Offer exactly ${ASSISTANT_SUGGESTIONS_MAX} ways forward in "suggestions".`
    : `Offer as many ways forward in "suggestions" as the scene really has room for: at least one, and no more than ${ASSISTANT_SUGGESTIONS_MAX}.`
}

/** The rules every read is given: the player's prompt or the shipped one, then the app's own lines. */
function systemText(prompt: string, choices: ChoiceCount, lessNsfwText: boolean): string {
  return [
    prompt.trim() || DEFAULT_ASSISTANT_PROMPT,
    '',
    countLine(choices),
    ...(lessNsfwText ? ['Keep the commentary and every suggestion short of explicit sex.'] : [])
  ].join('\n')
}

/** The reply's shape: the commentary first, then the ways forward, as many as asked for. */
function assistantSchema(choices: ChoiceCount): StructuredRequest['schema'] {
  return objectSchema('story_assistant', ['commentary', 'suggestions'], {
    commentary: { type: 'string' },
    suggestions: {
      type: 'array',
      minItems: choices === 'four' ? ASSISTANT_SUGGESTIONS_MAX : 1,
      maxItems: ASSISTANT_SUGGESTIONS_MAX,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['label', 'action'],
        properties: { label: { type: 'string' }, action: { type: 'string' } }
      }
    }
  })
}

/**
 * One read of the scene: the rules in `system`; then the world, the reader, his stats, the slot, the days
 * before, the cast, the story so far and the scene's tail, with the player's question last.
 */
export function buildStoryAssistantPrompt(context: AssistantContext): StructuredRequest {
  const cast = [...context.girls, ...context.departed]
  const labels = unnamedLabels(cast)
  const user = [
    'SETTING',
    context.setting.trim(),
    '',
    'READER',
    context.reader.trim(),
    '',
    'STATS',
    ...statLines(context.stats),
    '',
    'NOW',
    context.when,
    '',
    ...(context.earlier.length > 0 ? ['EARLIER', ...context.earlier.map((line) => `- ${line}`), ''] : []),
    'CAST',
    ...context.girls.flatMap((girl) => girlLines(girl, labels.get(girl), context.readerPronouns)),
    ...(context.summary ? ['STORY SO FAR', context.summary, ''] : []),
    'SCENE SO FAR',
    ...context.lines,
    ...(context.question.trim() ? ['', 'QUESTION', context.question.trim()] : [])
  ].join('\n')
  return {
    system: systemText(context.prompt, context.choices, context.lessNsfwText),
    user: maskedText(user, cast, labels),
    schema: assistantSchema(context.choices),
    cacheKey: 'story-assistant'
  }
}
