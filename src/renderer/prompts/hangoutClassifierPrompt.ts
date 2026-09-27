import type {
  ChatMessage,
  HangoutClassifierResponse,
  StructuredRequest,
  TimeSlot
} from '@shared/types'
import type { Weather } from '@shared/weather'
import { formatDateBanner, slotHalf } from './gameDate'
import { objectSchema } from './schema'
import { stampedStubs } from './textingPrompt'
import { weatherLines } from './weather'

/**
 * The hangout classifier: a second, cheap call that reads one texting exchange and
 * answers whether anybody just proposed meeting up *right now*.
 */

/** How many messages of thread ride along as background. */
const HANGOUT_CONTEXT_CAP = 6

/** What the classifier decided, once the two flags are collapsed. */
export interface HangoutVerdict {
  /** Who did the proposing — the arm-now path, or the Yes/No path. */
  initiatedBy: 'player' | 'contact'
  /** The plan in one sentence; the scene's opening action. */
  description: string
}

/** The prompt-facing slice of state one classification needs. */
export interface HangoutClassifierState {
  date: number
  time: TimeSlot
  /**
   * Ask the verdict to cite the words it is judging. Absent reads as off, which is the call this
   * build has always sent.
   */
  strictSchema?: boolean
  /**
   * Whether the reader has already turned down an invitation from her that still stands — he was
   * asked, he said no, and she has not been asked to drop it since.
   *
   * Each classification is one exchange: six messages of background, his message, her reply.
   * Nothing in that view says he was asked yesterday and said no, so a standing offer pressed
   * again reads as a fresh proposal, every turn. It is the same distinction the prompt already
   * draws for a plan already made — pressing an offer he has answered is not a new one — given
   * the fact it needed to apply it.
   */
  alreadyDeclined?: boolean
  /**
   * The whole semester's sky, one reading per slot — the NOW line walks back through it for how
   * long the weather has held. Absent means nothing is said about it.
   */
  weather?: readonly Weather[]
}

/** Builds the classification request for one texting turn. */
export function buildHangoutClassifierPrompt(
  firstName: string,
  recent: readonly ChatMessage[],
  playerMessage: ChatMessage,
  replyMessages: readonly ChatMessage[],
  state: HangoutClassifierState
): StructuredRequest {
  const strict = state.strictSchema === true
  const background = stampedStubs(recent.slice(-HANGOUT_CONTEXT_CAP), firstName)

  const user = [
    'You read one exchange from a text thread and report three things about it.',
    '',
    'NOW',
    `It is ${formatDateBanner(state.date, state.time)}`,
    ...(state.weather ? weatherLines(state.weather, state.date, state.time) : []),
    '',
    // The instructions below point at these blocks by name.
    'BACKGROUND — earlier messages in the thread, for context only.',
    'They tell you what "this" or "that plan" refers to.',
    'A proposal made in BACKGROUND is NOT a proposal: never set a flag because of a line in here.',
    "'''",
    ...(background.length > 0 ? background : ['(none)']),
    "'''",
    '',
    'THE MESSAGE — what the reader just sent.',
    "'''",
    ...stampedStubs([playerMessage], firstName),
    "'''",
    '',
    `THE REPLY — what ${firstName} is about to send back.`,
    "'''",
    ...stampedStubs(replyMessages, firstName),
    "'''",
    '',
    ...(strict
      ? [
          'First, set "quote" to the words that do the asking, copied exactly from THE MESSAGE or THE REPLY.',
          'Copy them character for character. Do not tidy them, do not complete them, do not write them in your own words.',
          'If neither one contains words that ask to meet up right now, "quote" is an empty string and both flags below are false.',
          ''
        ]
      : []),
    `Set "playerAsked" to true when THE MESSAGE asks ${firstName} to meet up in person right now — today, this ${slotHalf(state.time)}, immediately — AND THE REPLY does not turn it down.`,
    'It is false when she refuses, deflects, or is unsure in THE REPLY.',
    'It is false for a plan at any other time: "tonight" while it is still day, "tomorrow", "this weekend", "sometime", "we should do this again".',
    '',
    `Set "characterOffered" to true when THE REPLY itself asks the reader to meet up in person right now, today, immediately — ${firstName} doing the proposing.`,
    'A vague maybe, an agreement to something the reader proposed, or a reference to a plan already made is not an offer.',
    '',
    'Look for proposals ONLY in THE MESSAGE and THE REPLY. Nowhere else.',
    ...(strict && state.alreadyDeclined
      ? [
          '',
          `The reader has already turned down an invitation from ${firstName} and has not changed his mind since.`,
          'So "characterOffered" is false here unless THE REPLY proposes something genuinely new — a different thing to do, not the same one pressed again, reworded, or held open.',
          'Keeping an offer standing, repeating it, or telling him where she will be is not a new proposal.'
        ]
      : []),
    '',
    ...(strict
      ? [
          /**
           * The three lines this replaces contradicted each other, and the contradiction cost
           * more thought than the verdict did. "The name of every single person going" and
           * "Nobody present may be left out" sat beside "no 'the reader'" and five examples that
           * name nobody but the girls. A reasoning trace over a single heart emoji settled the
           * verdict in four lines and then spent the great majority of its budget here:
           * *"instruction says every single person going. If we omit, we violate... But examples
           * omitted reader"*, and *"Is Bunnyboard a place? If Bunnyboard is app, wrong. Need
           * decide."*
           *
           * A rule that cannot be satisfied does not produce a worse answer. It produces the
           * same answer far more slowly — and on a reasoning model the bill for that arrives as
           * output tokens.
           */
          'When either flag is true, set "description" to the plan written as a calendar entry: what is happening, where it is happening, and who is going.',
          'Write it as a phrase, not a sentence about anybody: no verb about who does what. "Coffee at the student union with Mina and Mia." — not "The reader gets coffee with Mina."',
          'Never name the reader. He is going by definition, so he is never one of the names: "with Mina and Mia", never "with the reader" and never a name or nickname of his.',
          'Name the other characters going, including anybody either message says is coming along.',
          'Where neither message names a place, leave the place out rather than settling on one.'
        ]
      : [
          'When either flag is true, set "description" to the plan written as a calendar entry: what is happening, where it is happening, and the name of every single person going.',
          'Write it as a phrase, not a sentence about anybody: no "the reader", no "you", no verb about who does what. "Coffee at the student union with Mina and Mia." — not "The reader gets coffee with Mina."',
          'Name everyone who is going, including anybody either message says is coming along. Nobody present may be left out.'
        ]),
    'When both flags are false, "description" is an empty string.',
    '',
    'Examples:',
    '',
    'THE MESSAGE "we should hang out sometime" / THE REPLY "yeah for sure!"',
    strict
      ? '{"quote":"","playerAsked":false,"characterOffered":false,"description":""}'
      : '{"playerAsked":false,"characterOffered":false,"description":""}',
    '',
    'THE MESSAGE "wanna grab coffee at the union right now" / THE REPLY "omg yes im starving, bringing mia too"',
    strict
      ? '{"quote":"wanna grab coffee at the union right now","playerAsked":true,"characterOffered":false,"description":"Coffee at the student union with Mina and Mia."}'
      : '{"playerAsked":true,"characterOffered":false,"description":"Coffee at the student union with Mina and Mia."}',
    '',
    'THE MESSAGE "wanna grab coffee right now" / THE REPLY "cant, im swamped tonight sorry"',
    strict
      ? '{"quote":"","playerAsked":false,"characterOffered":false,"description":""}'
      : '{"playerAsked":false,"characterOffered":false,"description":""}',
    '',
    'THE MESSAGE "how was your day" / THE REPLY "long lol. come walk by the river with me, im heading out now"',
    strict
      ? '{"quote":"come walk by the river with me, im heading out now","playerAsked":false,"characterOffered":true,"description":"A walk along the river with Mina."}'
      : '{"playerAsked":false,"characterOffered":true,"description":"A walk along the river with Mina."}',
    '',
    'THE MESSAGE "what are you up to" / THE REPLY "hazel and colette dragged me to the arcade, come meet us"',
    strict
      ? '{"quote":"hazel and colette dragged me to the arcade, come meet us","playerAsked":false,"characterOffered":true,"description":"BTB Arcade with Mina, Hazel and Colette."}'
      : '{"playerAsked":false,"characterOffered":true,"description":"BTB Arcade with Mina, Hazel and Colette."}',
    '',
    strict
      ? 'Fill in "quote", "playerAsked", "characterOffered", and "description" for the exchange above.'
      : 'Fill in "playerAsked", "characterOffered", and "description" for the exchange above.'
  ].join('\n')

  return {
    system: '',
    user,
    schema: hangoutClassifierSchema(strict),
    cacheKey: 'hangout-classifier',
    // The classifier is judged better at a floor of low.
    minThinking: 'low',
    /**
     * And a ceiling to match, under `strictSchema`. This is one judgement with six worked
     * examples and a sixty-character answer; at the player's `medium` it billed a median 330
     * output tokens — about sixteen of them the visible answer — cost 78% of the reply it
     * followed, and took as long, on every single message.
     *
     * The reasoning was not buying accuracy either: at `medium` this is the same classifier that
     * reported "Meeting at Stalestein with Ines" for a girl called Ingrid, on a goodnight.
     */
    ...(strict ? { maxThinking: 'low' as const } : {})
  }
}

/**
 * The {@link HangoutClassifierResponse} schema. The two flags come before the description so
 * each is decided before anything is written about the plan.
 */
function hangoutClassifierSchema(strict: boolean): {
  name: string
  schema: Record<string, unknown>
} {
  // `quote` comes first so the words that do the asking have to be found before either flag is
  // raised, and the flags come before the description so each is decided before anything is
  // written about the plan.
  if (strict) {
    return objectSchema(
      'hangoutClassifier',
      ['quote', 'playerAsked', 'characterOffered', 'description'],
      {
        quote: { type: 'string' },
        playerAsked: { type: 'boolean' },
        characterOffered: { type: 'boolean' },
        description: { type: 'string' }
      }
    )
  }
  return objectSchema('hangoutClassifier', ['playerAsked', 'characterOffered', 'description'], {
    playerAsked: { type: 'boolean' },
    characterOffered: { type: 'boolean' },
    description: { type: 'string' }
  })
}

/**
 * Collapses a parsed reply into the verdict the texting loop consumes, or null when nobody
 * proposed anything.
 */
/** The fewest words a quote may be. "right now" is in half of all texts and proves nothing. */
const QUOTE_MIN_WORDS = 3

/**
 * Flattens text to what a quote has to survive being copied: case, punctuation and runs of space
 * all go, because a model that quotes correctly still re-punctuates. What is left is the words in
 * order, which is the part it cannot invent and still match.
 */
function flatten(text: string): string {
  return (
    text
      .toLowerCase()
      // Apostrophes are dropped rather than spaced: a model quoting "im" back as "I'm" is quoting
      // correctly, and splitting it into two words would fail a quote that stands up.
      .replace(/['’ʼ]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  )
}

/** Whether the quoted words are really in the side they are attributed to. */
function quoteStandsUp(quote: string, source: string): boolean {
  const needle = flatten(quote)
  if (needle.split(' ').filter(Boolean).length < QUOTE_MIN_WORDS) return false
  return flatten(source).includes(needle)
}

/**
 * The verdict, with the claim checked where `sources` is given.
 *
 * Without it the reply is taken at its word, which is how this build has always read it. With it,
 * a verdict that cannot cite the words it is judging is dropped: the model stays free to be wrong
 * about what the words *mean*, and is no longer free to be wrong about whether they were written.
 */
export function normalizeHangout(
  parsed: unknown,
  sources?: { message: string; reply: string }
): HangoutVerdict | null {
  const reply = (parsed ?? {}) as Partial<HangoutClassifierResponse>
  const description = typeof reply.description === 'string' ? reply.description.trim() : ''
  // A plan with no description is nothing the scene loop can cast from.
  if (!description) return null
  if (!sources) {
    if (reply.playerAsked === true) return { initiatedBy: 'player', description }
    if (reply.characterOffered === true) return { initiatedBy: 'contact', description }
    return null
  }

  const quote = typeof reply.quote === 'string' ? reply.quote : ''
  const grounded = (side: string, who: 'player' | 'contact'): boolean => {
    if (quoteStandsUp(quote, side)) return true
    console.warn(
      `[hangout] dropped a ${who} invitation: the quoted words are not in ${
        who === 'player' ? 'the message' : 'the reply'
      } — ${JSON.stringify(quote)}`
    )
    return false
  }

  if (reply.playerAsked === true) {
    return grounded(sources.message, 'player') ? { initiatedBy: 'player', description } : null
  }
  if (reply.characterOffered === true) {
    return grounded(sources.reply, 'contact') ? { initiatedBy: 'contact', description } : null
  }
  return null
}
