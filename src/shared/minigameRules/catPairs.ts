import { listed } from '../minigameKit'

/**
 * Cat Pairs' rules: the cards and who has taken which, what a turn comes to, the café cat's
 * swaps, and how a girl plays from what she remembers. The reader's is seat 0 wherever seats are
 * counted; the girls follow in the order they play.
 */

/** How well a girl plays, from 1 to 5. */
export type Skill = 1 | 2 | 3 | 4 | 5

/** One of the café's cats, as its card draws it. */
export interface CafeCat {
  name: string
  /** What its coat is filled with. */
  coat: 'light' | 'dark' | 'accent' | 'grey'
  /** What is drawn on the coat. */
  marking: 'plain' | 'stripes' | 'spots' | 'patch' | 'blaze' | 'muzzle' | 'split' | 'points' | 'mask'
  eyes: 'open' | 'sleepy' | 'wink'
  /** One more thing that is this cat's alone. */
  extra?: 'bow' | 'folded' | 'tongue' | 'whiskers'
}

/** The cats on the cards. A game uses as many of them as it has pairs. */
export const CAFE_CATS: readonly CafeCat[] = [
  { name: 'Biscuit', coat: 'light', marking: 'stripes', eyes: 'open' },
  { name: 'Mochi', coat: 'light', marking: 'plain', eyes: 'sleepy' },
  { name: 'Sergeant Whiskers', coat: 'dark', marking: 'muzzle', eyes: 'open', extra: 'whiskers' },
  { name: 'Pickle', coat: 'accent', marking: 'spots', eyes: 'open' },
  { name: 'Noodle', coat: 'grey', marking: 'blaze', eyes: 'open' },
  { name: 'Marmalade', coat: 'accent', marking: 'stripes', eyes: 'sleepy' },
  { name: 'Duchess', coat: 'light', marking: 'points', eyes: 'open', extra: 'bow' },
  { name: 'Soot', coat: 'dark', marking: 'plain', eyes: 'open' },
  { name: 'Patch', coat: 'light', marking: 'patch', eyes: 'open' },
  { name: 'Tofu', coat: 'grey', marking: 'plain', eyes: 'sleepy', extra: 'folded' },
  { name: 'Juniper', coat: 'light', marking: 'split', eyes: 'open' },
  { name: 'Waffles', coat: 'accent', marking: 'mask', eyes: 'wink', extra: 'tongue' }
]

/** How many pairs a game is where nothing was settled. */
export const PAIRS = 8

/** A random source that gives the same numbers for the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** One of `count` things, by the random source. */
function oneOf(count: number, rand: () => number): number {
  return Math.min(count - 1, Math.floor(rand() * count))
}

function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = oneOf(i + 1, rand)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * How a turn came out, told apart by what had been shown before it.
 *
 * - `memory`: a pair whose second card had been turned before.
 * - `lucky`: a pair whose second card nobody had seen.
 * - `last`: the last two cards on the table, which cannot miss.
 * - `forgot`: a miss although the first card's partner had been turned before and lay still.
 * - `cat`: the same, but a cat had moved that partner since it was shown.
 * - `miss`: a miss with the partner never yet seen.
 */
export type How = 'memory' | 'lucky' | 'last' | 'forgot' | 'cat' | 'miss'

/** A turn taken: the two cards turned, in order, and what it came to. */
export interface TurnMade {
  kind: 'turn'
  seat: number
  first: number
  second: number
  /** The cat on each card turned. */
  cats: readonly [number, number]
  how: How
  /** How many pairs in a row this made for the player; 0 for a miss. */
  run: number
}

/** A café cat's visit: the two places whose cards it swapped. */
export interface CatMade {
  kind: 'cat'
  a: number
  b: number
  /** The cat on each card moved, `a`'s first. */
  cats: readonly [number, number]
  /** One of the cards had been shown: somebody may have been counting on it. */
  seen: boolean
}

export interface Game {
  /** The cat on the card at each place. */
  cards: readonly number[]
  /** The seat that took the card at each place, or null while it lies there. */
  taken: readonly (number | null)[]
  seats: number
  /** Whose turn it is. */
  turn: number
  /** Turns taken so far, by everyone. */
  turns: number
  /** Pairs the player whose turn it is has made in a row. */
  run: number
  /** The card at each place has been turned up at some time. */
  seen: readonly boolean[]
  /** The card at each place was moved by a cat since it was last shown. */
  moved: readonly boolean[]
  /** The cat's visits still to come: each is due once this many pairs are taken. */
  visits: readonly number[]
  log: readonly (TurnMade | CatMade)[]
}

/** How often a cat visits in a game of `pairs`, and after how many pairs taken each is due. */
export function catVisits(pairs: number, rand: () => number = Math.random): number[] {
  const marks = Array.from({ length: Math.max(1, pairs - 3) }, (_, i) => i + 1)
  return shuffled(marks, rand)
    .slice(0, pairs >= 10 ? 3 : 2)
    .sort((a, b) => a - b)
}

/** A table laid for `seats` players: `pairs` of the café's cats, shuffled face down. */
export function newGame(
  seats: number,
  pairs: number,
  cats: boolean,
  rand: () => number = Math.random
): Game {
  const chosen = shuffled(
    CAFE_CATS.map((_, i) => i),
    rand
  ).slice(0, pairs)
  const cards = shuffled([...chosen, ...chosen], rand)
  return {
    cards,
    taken: cards.map(() => null),
    seats,
    turn: 0,
    turns: 0,
    run: 0,
    seen: cards.map(() => false),
    moved: cards.map(() => false),
    visits: cats ? catVisits(pairs, rand) : [],
    log: []
  }
}

/** The places where a card still lies. */
export function faceDown(game: Game): number[] {
  return game.taken.flatMap((seat, at) => (seat === null ? [at] : []))
}

export function isOver(game: Game): boolean {
  return game.taken.every((seat) => seat !== null)
}

/** Pairs taken by each seat. */
export function pairCounts(game: Game): number[] {
  const counts = Array.from({ length: game.seats }, () => 0)
  for (const seat of game.taken) if (seat !== null) counts[seat] += 0.5
  return counts
}

/** The turns taken, without the cat's visits. */
export function turnsMade(game: Game): TurnMade[] {
  return game.log.filter((made): made is TurnMade => made.kind === 'turn')
}

/** The other card of the cat at `at`, where it still lies. */
function partnerOf(game: Game, at: number): number {
  return game.cards.findIndex(
    (cat, other) => other !== at && cat === game.cards[at] && game.taken[other] === null
  )
}

/** What turning `first` and then `second` comes to, from what had been shown before. */
export function judge(game: Game, first: number, second: number): How {
  if (game.cards[first] === game.cards[second]) {
    if (faceDown(game).length === 2) return 'last'
    return game.seen[second] ? 'memory' : 'lucky'
  }
  const partner = partnerOf(game, first)
  if (!game.seen[partner]) return 'miss'
  return game.moved[partner] ? 'cat' : 'forgot'
}

/**
 * The table after the player whose turn it is turns `first` and then `second`: a pair is his
 * and he goes again; otherwise both lie where they were and the turn passes.
 */
export function playTurn(game: Game, first: number, second: number): Game {
  const how = judge(game, first, second)
  const pair = game.cards[first] === game.cards[second]
  const at = (i: number): boolean => i === first || i === second
  const run = pair ? game.run + 1 : 0
  return {
    ...game,
    taken: pair ? game.taken.map((seat, i) => (at(i) ? game.turn : seat)) : game.taken,
    seen: game.seen.map((was, i) => was || at(i)),
    moved: game.moved.map((was, i) => was && !at(i)),
    turn: pair ? game.turn : (game.turn + 1) % game.seats,
    turns: game.turns + 1,
    run,
    log: [
      ...game.log,
      {
        kind: 'turn',
        seat: game.turn,
        first,
        second,
        cats: [game.cards[first], game.cards[second]],
        how,
        run
      }
    ]
  }
}

/**
 * A cat is due: enough pairs are taken for its next visit, and enough cards still lie there for
 * a swap to mean anything. Asked between turns, when every card is face down.
 */
export function catDue(game: Game): boolean {
  const down = faceDown(game).length
  return (
    game.visits.length > 0 &&
    down >= 4 &&
    (game.cards.length - down) / 2 >= game.visits[0]
  )
}

/**
 * The two places a visiting cat swaps: a card somebody has seen where there is one, and a card
 * of another cat, so that the swap always changes the table.
 */
export function catPick(game: Game, rand: () => number = Math.random): [number, number] {
  const down = faceDown(game)
  const known = down.filter((at) => game.seen[at])
  const from = known.length > 0 ? known : down
  const a = from[oneOf(from.length, rand)]
  const others = down.filter((at) => game.cards[at] !== game.cards[a])
  return [a, others[oneOf(others.length, rand)]]
}

/** The table after a cat swaps the cards at `a` and `b`: each takes what was known of it along. */
export function catSwap(game: Game, a: number, b: number): Game {
  const swap = <T>(row: readonly T[]): T[] =>
    row.map((value, i) => (i === a ? row[b] : i === b ? row[a] : value))
  const seen = swap(game.seen)
  return {
    ...game,
    cards: swap(game.cards),
    seen,
    moved: game.moved.map((was, i) => (i === a || i === b ? seen[i] : was)),
    visits: game.visits.slice(1),
    log: [
      ...game.log,
      {
        kind: 'cat',
        a,
        b,
        cats: [game.cards[a], game.cards[b]],
        seen: game.seen[a] || game.seen[b]
      }
    ]
  }
}

/** How a game came out for the reader: his alone, shared at the top, or somebody else's. */
export function gameOutcome(counts: readonly number[]): 'won' | 'lost' | 'draw' {
  const top = Math.max(...counts)
  if (counts[0] < top) return 'lost'
  return counts.filter((count) => count === top).length > 1 ? 'draw' : 'won'
}

/* ---- her play -------------------------------------------------------------- */

/** A card she believes she knows: the cat she thinks lies at a place. */
export interface Held {
  at: number
  cat: number
}

/** What a girl remembers of the table, oldest first. */
export type Memory = readonly Held[]

/** How likely a card shown stays with her, by skill. */
const RETAINS: Record<Skill, number> = { 1: 0.3, 2: 0.5, 3: 0.7, 4: 0.88, 5: 0.98 }

/** How many cards she can keep in her head at once, by skill: the oldest go first. */
const HOLDS: Record<Skill, number> = { 1: 2, 2: 4, 3: 6, 4: 10, 5: 24 }

/** How likely she follows a cat's swap, by skill. Unfollowed, she goes on believing the old places. */
const FOLLOWS: Record<Skill, number> = { 1: 0, 2: 0.15, 3: 0.5, 4: 0.85, 5: 1 }

/** How often a card she holds will not come to her when she needs it, by skill. */
const BLANKS: Record<Skill, number> = { 1: 0.3, 2: 0.2, 3: 0.1, 4: 0.04, 5: 0 }

/** Her memory after the card at `at` is shown to be `cat`: kept or not, and never more than she can hold. */
export function observe(
  memory: Memory,
  at: number,
  cat: number,
  skill: Skill,
  rand: () => number = Math.random
): Memory {
  const rest = memory.filter((held) => held.at !== at)
  if (rand() >= RETAINS[skill]) return rest
  return [...rest, { at, cat }].slice(-HOLDS[skill])
}

/** Her memory once the cards at `places` are taken off the table. */
export function cleared(memory: Memory, places: readonly number[]): Memory {
  return memory.filter((held) => !places.includes(held.at))
}

/** Her memory after a cat swaps `a` and `b`: she follows the cards, or she does not notice. */
export function catMoved(
  memory: Memory,
  a: number,
  b: number,
  skill: Skill,
  rand: () => number = Math.random
): Memory {
  if (FOLLOWS[skill] < 1 && rand() >= FOLLOWS[skill]) return memory
  return memory.map((held) =>
    held.at === a ? { ...held, at: b } : held.at === b ? { ...held, at: a } : held
  )
}

/**
 * The first card she turns: one of a pair she believes she knows, where she holds both; failing
 * that a card she knows nothing of, to learn it.
 */
export function herFirst(game: Game, memory: Memory, rand: () => number = Math.random): number {
  const held = memory.filter((card) => game.taken[card.at] === null)
  const paired = held.find((card) => held.some((other) => other.cat === card.cat && other.at !== card.at))
  if (paired) return paired.at
  const down = faceDown(game)
  const unknown = down.filter((at) => !held.some((card) => card.at === at))
  const from = unknown.length > 0 ? unknown : down
  return from[oneOf(from.length, rand)]
}

/**
 * Her second card, the first lying face up: its partner where she holds it and it comes to her;
 * otherwise a guess, among the cards she knows nothing of where there are any.
 */
export function herSecond(
  game: Game,
  memory: Memory,
  first: number,
  skill: Skill,
  rand: () => number = Math.random
): number {
  const held = memory.filter((card) => game.taken[card.at] === null && card.at !== first)
  const partner = held.find((card) => card.cat === game.cards[first])
  if (partner && (BLANKS[skill] === 0 || rand() >= BLANKS[skill])) return partner.at
  const down = faceDown(game).filter((at) => at !== first)
  // A card she holds as another cat is no guess at all, unless her mind has gone blank.
  const unknown = down.filter((at) => !held.some((card) => card.at === at))
  const from = unknown.length > 0 && !partner ? unknown : down
  return from[oneOf(from.length, rand)]
}

/* ---- what is said ---------------------------------------------------------- */

export function catName(cat: number): string {
  return CAFE_CATS[cat].name
}

/** A count of pairs: "1 pair", "3 pairs". */
function pairsWord(count: number): string {
  return `${count} pair${count === 1 ? '' : 's'}`
}

/** A count of times: "once", "twice", "3 times". */
function timesWord(count: number): string {
  return count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`
}

/** A turn as the scene's narration says it; `who` is "You" or her name. */
export function turnLine(who: string, made: TurnMade): string {
  const [a, b] = made.cats.map(catName)
  const turns = who === 'You' ? 'turn' : 'turns'
  if (made.run === 0) {
    return `${who} ${turns} ${a} and ${b}: no match.${made.how === 'cat' ? ` The other ${a} is not where it was.` : ''}`
  }
  const note =
    made.how === 'lucky' ? ', on a blind guess' : made.how === 'last' ? ', the last on the table' : ''
  const run = made.run >= 2 ? ` That is ${made.run} in a row.` : ''
  return `${who} ${turns} ${a}, then the other ${a}: a pair${note}.${run}`
}

/** A cat's visit as the scene's narration says it. */
export const CAT_LINE =
  'One of the café cats pads across the table, and two face-down cards slide into each other\'s places.'

/** The count as it is said: "You 2, Ana 1, Bea 0". */
export function countLine(me: string, names: readonly string[], counts: readonly number[]): string {
  return [me, ...names].map((name, seat) => `${name} ${counts[seat]}`).join(', ')
}

/** A turn for whoever speaks about it, and whether it is worth a remark. */
export function turnTold(
  names: readonly string[],
  made: TurnMade
): { line: string; notable: boolean } {
  const who = made.seat === 0 ? 'The reader' : names[made.seat - 1]
  const [a, b] = made.cats.map(catName)
  if (made.run === 0) {
    const why =
      made.how === 'forgot'
        ? `, although the other ${a} had been turned up earlier and lay where it was: forgotten`
        : made.how === 'cat'
          ? `: the other ${a} had been seen, but a café cat moved it since, and the plan was ruined`
          : ', a fair try: the other one had not been seen yet'
    return {
      line: `${who} turned ${a} and ${b}, no match${why}.`,
      notable: made.how !== 'miss'
    }
  }
  const how =
    made.how === 'lucky'
      ? 'on a blind guess at a card nobody had seen: pure luck'
      : made.how === 'last'
        ? 'the last two cards on the table'
        : 'from memory'
  const run = made.run >= 2 ? `, ${made.run} pairs in a row in one turn` : ''
  return {
    line: `${who} matched the two ${a} cards, ${how}${run}.`,
    notable: made.how === 'lucky' || made.run === 3
  }
}

/** What a game comes to, as the scene's narration says it. `counts` is each seat's pairs. */
export function gameSummary(
  names: readonly string[],
  counts: readonly number[],
  turns: number
): string {
  if (names.length === 0) {
    return `You play Cat Pairs alone and clear all ${pairsWord(counts[0])} in ${turns} turn${turns === 1 ? '' : 's'}.`
  }
  const top = Math.max(...counts)
  const open = `You play Cat Pairs with ${listed(names)}`
  const girls = names.map((name, i) => ({ name, count: counts[i + 1] }))
  const leaders = girls.filter((girl) => girl.count === top)
  const rest = girls.filter((girl) => girl.count < top).map((girl) => `${girl.name}'s ${girl.count}`)
  if (counts[0] < top) {
    const took =
      leaders.length === 1
        ? `${leaders[0].name} takes it with ${pairsWord(top)}`
        : `${listed(leaders.map((girl) => girl.name))} share it on ${pairsWord(top)} each`
    return `${open} and lose: ${took}, to ${listed([`your ${counts[0]}`, ...rest])}.`
  }
  if (leaders.length === 0) return `${open} and win, ${pairsWord(top)} to ${listed(rest)}.`
  return `${open} and finish level with ${listed(leaders.map((girl) => girl.name))} on ${pairsWord(top)} each${rest.length ? `, ahead of ${listed(rest)}` : ''}.`
}

/** One player's game in a line: what was matched and how, what was forgotten, the best run. */
function seatTold(who: string, turns: readonly TurnMade[]): string {
  const pairs = turns.filter((made) => made.run > 0)
  const count = (how: How): number => turns.filter((made) => made.how === how).length
  const best = Math.max(0, ...turns.map((made) => made.run))
  const hows = [
    count('memory') ? `${count('memory')} from memory` : '',
    count('lucky') ? `${count('lucky')} on a lucky blind guess` : '',
    count('last') ? 'the last one left' : ''
  ].filter(Boolean)
  const took =
    pairs.length === 0
      ? 'took no pair'
      : `took ${pairsWord(pairs.length)} (${listed(pairs.map((made) => catName(made.cats[0])))}): ${hows.join(', ')}`
  const notes = [
    best >= 2 ? `best run ${best} in a row` : '',
    count('forgot')
      ? `forgot a card already shown ${timesWord(count('forgot'))} (${listed(
          turns.filter((made) => made.how === 'forgot').map((made) => catName(made.cats[0]))
        )}): poor memory, not bad luck`
      : pairs.length > 0 || turns.length > 0
        ? 'never forgot a card that had been shown'
        : ''
  ].filter(Boolean)
  return `${who} ${took}${notes.length ? `; ${notes.join('; ')}` : ''}.`
}

/**
 * How a game went, for the scene's writer: the terms, each player's pairs with memory told
 * apart from luck, the cat's visits and whom they cost, and the final standings.
 */
export function gameAccount(names: readonly string[], game: Game, cats: boolean): string[] {
  const players = ['the reader', ...names]
  const turns = turnsMade(game)
  const pairs = game.cards.length / 2
  const visits = game.log.filter((made): made is CatMade => made.kind === 'cat')
  const cost = turns.filter((made) => made.how === 'cat')
  const catLine = !cats
    ? []
    : visits.length === 0
      ? ['No café cat came near the table this time.']
      : [
          `A café cat walked across the table ${timesWord(visits.length)} and swapped two face-down cards each time (${visits
            .map((visit) => `${catName(visit.cats[0])} with ${catName(visit.cats[1])}`)
            .join('; ')}). ${
            cost.length === 0
              ? 'It cost nobody a pair: everyone kept track or was not relying on those cards.'
              : `It ruined a turn for ${listed(
                  cost.map((made) => `${players[made.seat]} (going for ${catName(made.cats[0])})`)
                )}: the card had been seen but was no longer where it had been.`
          }`
        ]
  const counts = pairCounts(game)
  if (names.length === 0) {
    return [
      `It was Cat Pairs played alone: ${pairs} pairs of café cats face down${cats ? ', with a café cat free to wander over the table' : ''}.`,
      seatTold('The reader', turns),
      ...catLine,
      `The table was cleared in ${game.turns} turns; ${pairs} is the fewest possible.`
    ]
  }
  const top = Math.max(...counts)
  const leaders = players.filter((_, seat) => counts[seat] === top)
  return [
    `It was Cat Pairs between the reader${names.length === 1 ? ` and ${names[0]}` : `, ${listed(names)}`}: ${pairs} pairs of café cats face down, two cards a turn, a pair kept and another go for a match, most pairs wins${cats ? ', with a café cat free to wander over the table' : ''}.`,
    ...players.map((who, seat) =>
      seatTold(
        seat === 0 ? 'The reader' : who,
        turns.filter((made) => made.seat === seat)
      )
    ),
    ...catLine,
    `Final count of pairs: ${countLine('the reader', names, counts)}: ${
      leaders.length === 1 ? `${leaders[0]} won` : `${listed(leaders)} shared first place, a draw at the top`
    }.`
  ]
}
