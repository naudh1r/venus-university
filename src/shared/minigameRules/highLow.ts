import { rankWord, shuffle, type Card, type SkillLevel } from '../minigameKit'

/** High-Low's rules: the deck, a call, and whether the next card made it good. */

export type Call = 'higher' | 'lower'

/** How many calls one player makes in a full game. */
export const CALLS_EACH = 5

/** Whether a call came good. A card of the same rank is a miss either way. */
export function callWins(shown: Card, next: Card, call: Call): boolean {
  return call === 'higher' ? next.rank > shown.rank : next.rank < shown.rank
}

/** A call and what it turned, as the scene's narration says it. `who` is "You" or her name. */
export function callLine(who: string, call: Call, shown: Card, next: Card): string {
  const verb = who === 'You' ? 'call' : 'calls'
  const came =
    next.rank === shown.rank
      ? `${rankWord(next.rank)} again: a miss`
      : `${rankWord(next.rank)}: ${callWins(shown, next, call) ? 'right' : 'a miss'}`
  return `${who} ${verb} ${call}. ${came.charAt(0).toUpperCase()}${came.slice(1)}.`
}

/** How many cards a pack turns before it is out: all of a deck but the one left showing. */
const PACK_TURNS = 51

/**
 * The cards as dealt once the deck has run out, which only sudden death can come to: every card
 * turned but the one showing is shuffled into a new pack and dealt on after it.
 */
export function reshuffled(deck: readonly Card[], rand: () => number = Math.random): Card[] {
  return [...deck, ...shuffle(deck.slice(-(PACK_TURNS + 1), -1), rand)]
}

/**
 * The cards out of the pack with card `i` showing, that card among them: every card turned so
 * far, or since the turned cards were last shuffled back in.
 */
export function turnedCards(deck: readonly Card[], i: number): Card[] {
  return deck.slice(Math.floor(i / PACK_TURNS) * PACK_TURNS, i + 1)
}

/** How a girl plays, from 1 (on hunches) to 5 (counts every card). */
export type Skill = SkillLevel

/**
 * The call the cards favour on `shown`, given every card turned so far (`shown` among them), and
 * by how much: the share of the cards still in the deck that separates the two calls.
 */
export function oddsCall(shown: Card, seen: readonly Card[]): { call: Call; edge: number } {
  let higher = 0
  let lower = 0
  for (let rank = 2; rank <= 14; rank++) {
    const left = 4 - seen.filter((card) => card.rank === rank).length
    if (rank > shown.rank) higher += left
    else if (rank < shown.rank) lower += left
  }
  const left = 52 - seen.length
  return {
    call: higher >= lower ? 'higher' : 'lower',
    edge: left > 0 ? Math.abs(higher - lower) / left : 0
  }
}

/** The edge under which she stops reading the cards and goes on a hunch, by skill. */
const HUNCH_UNDER: Record<Skill, number> = { 1: 0.5, 2: 0.35, 3: 0.2, 4: 0.1, 5: 0 }

/**
 * Her call. Everyone calls lower on a king; what skill buys is the close ones: the better she
 * is, the finer an edge she still reads, and under that she is guessing.
 */
export function herCall(
  shown: Card,
  seen: readonly Card[],
  skill: Skill,
  rand: () => number = Math.random
): Call {
  const { call, edge } = oddsCall(shown, seen)
  if (edge > HUNCH_UNDER[skill]) return call
  return rand() < 0.5 ? 'higher' : 'lower'
}

/** What a game played alone comes to, as the scene's narration says it. */
export function soloSummary(right: number, calls = CALLS_EACH): string {
  const said = `${right} of ${calls} calls right`
  if (right === calls) return `You deal yourself a game of High-Low and get all ${said}. A perfect run.`
  if (right === 0) return `You deal yourself a game of High-Low and get ${said}. The deck had it in for you.`
  return `You deal yourself a game of High-Low and get ${said}.`
}

/** What a game against her comes to, as the scene's narration says it. */
export function versusSummary(name: string, mine: number, hers: number): string {
  if (mine > hers) return `You play High-Low with ${name} and win, ${mine} calls to ${hers}.`
  if (mine < hers) return `You play High-Low with ${name} and lose, ${mine} calls to ${hers}.`
  return `You play High-Low with ${name} and it ends level, ${mine} calls each.`
}

/** One call of a finished game, as the account tells it. */
export interface CallMade {
  hers: boolean
  call: Call
  right: boolean
}

/** One call as the account tells it, and what kind of call it was. */
export interface CallTold {
  /** The call in a sentence, with its judgment. */
  line: string
  /** Worth a remark at the table: anything but an ordinary call. */
  notable: boolean
  /** Made against cards that clearly favoured the other call. */
  poor: boolean
}

/**
 * Call `i` of a game, judged: who called what on which card and what came, and whether it was a
 * call that could not win, a bad one, a long shot that came in, a safe one that failed, or the
 * same rank turning up twice. `deck` is the deck as it was dealt.
 */
export function callTold(
  name: string,
  deck: readonly Card[],
  calls: readonly CallMade[],
  i: number
): CallTold {
  const made = calls[i]
  const shown = deck[i]
  const next = deck[i + 1]
  const { call: favoured, edge } = oddsCall(shown, turnedCards(deck, i))
  const hopeless =
    (made.call === 'lower' && shown.rank === 2) || (made.call === 'higher' && shown.rank === 14)
  const poor = made.call !== favoured && edge >= 0.3
  const note = hopeless
    ? `, a call that could not win: nothing is ${made.call} than ${rankWord(shown.rank)}`
    : next.rank === shown.rank
      ? ', the same rank again'
      : poor && made.right
        ? ', a long shot that came in'
        : poor
          ? `, a bad call: the cards clearly favoured ${favoured}`
          : !made.right && edge >= 0.5
            ? ', a safe call that failed: plain bad luck'
            : ''
  const who = made.hers ? name : 'The reader'
  return {
    line: `${who} called ${made.call} on ${rankWord(shown.rank)} and ${rankWord(next.rank)} came: ${made.right ? 'right' : 'a miss'}${note}.`,
    notable: note !== '',
    poor
  }
}

/**
 * How a game against her went, call by call, for the scene's writer: who called what on which
 * card and what came, with the calls worth a remark marked and bad play told apart from bad
 * luck: a long shot that landed, a safe call that failed, a call against the cards, one that
 * could not win. `deck` is the deck as it was dealt.
 */
export function versusAccount(
  name: string,
  deck: readonly Card[],
  calls: readonly CallMade[],
  sudden = false
): string[] {
  const each = calls.filter((made) => !made.hers).length
  const told = calls.map((_, i) => callTold(name, deck, calls, i))
  const against = {
    reader: told.filter((call, i) => call.poor && !calls[i].hers).length,
    her: told.filter((call, i) => call.poor && calls[i].hers).length
  }
  const lines = told.map((call) => call.line)
  const played = (who: string, times: number): string =>
    times === 0
      ? `${who} played the odds every time.`
      : `${who} called against the odds ${times} time${times === 1 ? '' : 's'}: poor play, not bad luck.`
  const count = (side: boolean): number =>
    calls.filter((made) => made.hers === side && made.right).length
  return [
    ...(sudden
      ? [
          'It was sudden death: a call each at a time until one of them was ahead after equal turns.'
        ]
      : []),
    `Each called ${each === 1 ? 'once' : `${each} times`}, in turn, on whether the next card would be higher or lower. Twos are low and aces high; the same rank again is a miss.`,
    ...(calls.length > PACK_TURNS
      ? ['The deck ran out along the way: the turned cards were shuffled into a new one.']
      : []),
    ...lines,
    played('The reader', against.reader),
    played(name, against.her),
    `Final count: the reader ${count(false)}, ${name} ${count(true)}.`
  ]
}

/**
 * How a game stands part-way, for the scene's writer should the reader walk away from it: the
 * calls made so far, each judged as the account judges them, and the count. `her` is her name,
 * or null for a game played alone.
 */
export function progressAccount(
  her: string | null,
  deck: readonly Card[],
  calls: readonly CallMade[]
): string[] {
  const count = (side: boolean): number =>
    calls.filter((made) => made.hers === side && made.right).length
  if (her === null) {
    return [
      `The reader had made ${calls.length} call${calls.length === 1 ? '' : 's'} and got ${count(false)} right.`
    ]
  }
  return [
    ...calls.map((_, i) => callTold(her, deck, calls, i).line),
    `Count so far: the reader ${count(false)}, ${her} ${count(true)}.`
  ]
}

/**
 * Whether a game against her is over after `made` calls. A normal game ends when both have made
 * `each` calls. Sudden death ends the first time the counts differ with both having called the
 * same number of times, and not before: a deck that runs out is {@link reshuffled}.
 */
export function versusOver(made: readonly CallMade[], each: number, sudden: boolean): boolean {
  if (!sudden) return made.length >= each * 2
  if (made.length === 0 || made.length % 2 === 1) return false
  const count = (side: boolean): number =>
    made.filter((call) => call.hers === side && call.right).length
  return count(false) !== count(true)
}
