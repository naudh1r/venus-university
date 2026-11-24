import { freshDeck, type Card, type SkillLevel as Skill, type Suit } from '../minigameKit'
import { listed } from '../minigameKit'

/**
 * Texas hold'em with play chips, for the reader and one to three girls: what a hand is worth,
 * how a hand is bet and its pots shared out, how a girl plays hers, and how a game is told.
 * The reader's is seat 0 wherever seats are counted; the girls follow in the order they sit.
 */

export const SMALL_BLIND = 5
export const BIG_BLIND = 10

/** How many chips everyone starts with, for the `stack` option's value of 1 to 5. */
export function startingStack(option: number): number {
  return option * 10 * BIG_BLIND
}

/* ------------------------------------------------------------------ the worth of a hand */

/** What five to seven cards come to: the best five of them. */
export interface HandValue {
  /** 0 high card, 1 pair, 2 two pair, 3 three of a kind, 4 straight, 5 flush, 6 full house, 7 four of a kind, 8 straight flush. */
  category: number
  /** What breaks a tie inside the category, the most telling first. */
  ranks: number[]
  /** The whole of it as one number: the higher beats the lower, and equal split. */
  score: number
}

function valued(category: number, ranks: number[]): HandValue {
  let score = category
  for (let i = 0; i < 5; i++) score = score * 15 + (ranks[i] ?? 0)
  return { category, ranks, score }
}

/** The top card of the best straight among the ranks `has` holds, the ace playing low too; 0 for none. */
function straightTop(has: (rank: number) => boolean): number {
  for (let top = 14; top >= 5; top--) {
    let run = true
    for (let k = 0; k < 5 && run; k++) run = has(top - k === 1 ? 14 : top - k)
    if (run) return top
  }
  return 0
}

/** The best five-card hand to be had from `cards`, however many there are. */
export function evaluate(cards: readonly Card[]): HandValue {
  const counts = new Array<number>(15).fill(0)
  const suits: Record<Suit, number[]> = { spades: [], hearts: [], diamonds: [], clubs: [] }
  for (const card of cards) {
    counts[card.rank]++
    suits[card.suit].push(card.rank)
  }
  const flush =
    suits.spades.length >= 5
      ? suits.spades
      : suits.hearts.length >= 5
        ? suits.hearts
        : suits.diamonds.length >= 5
          ? suits.diamonds
          : suits.clubs.length >= 5
            ? suits.clubs
            : null
  if (flush) {
    const top = straightTop((rank) => flush.includes(rank))
    if (top) return valued(8, [top])
  }
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const held: number[] = []
  for (let rank = 14; rank >= 2; rank--) {
    if (counts[rank] === 0) continue
    held.push(rank)
    if (counts[rank] === 4) quads.push(rank)
    else if (counts[rank] === 3) trips.push(rank)
    else if (counts[rank] === 2) pairs.push(rank)
  }
  const kickers = (not: readonly number[], n: number): number[] =>
    held.filter((rank) => !not.includes(rank)).slice(0, n)
  if (quads.length) return valued(7, [quads[0], ...kickers([quads[0]], 1)])
  if (trips.length && (trips.length > 1 || pairs.length)) {
    return valued(6, [trips[0], Math.max(trips[1] ?? 0, pairs[0] ?? 0)])
  }
  if (flush) return valued(5, [...flush].sort((a, b) => b - a).slice(0, 5))
  const top = straightTop((rank) => counts[rank] > 0)
  if (top) return valued(4, [top])
  if (trips.length) return valued(3, [trips[0], ...kickers([trips[0]], 2)])
  if (pairs.length >= 2) return valued(2, [pairs[0], pairs[1], ...kickers([pairs[0], pairs[1]], 1)])
  if (pairs.length) return valued(1, [pairs[0], ...kickers([pairs[0]], 3)])
  return valued(0, held.slice(0, 5))
}

/* ------------------------------------------------------------------ chances */

/** A random source that gives the same run for the same seed. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUITS: readonly Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const cardKey = (card: Card): number => card.rank * 4 + SUITS.indexOf(card.suit)

/** The deck less the cards already known. */
function unseen(known: readonly Card[]): Card[] {
  const out = new Set(known.map(cardKey))
  return SUITS.flatMap((suit) =>
    Array.from({ length: 13 }, (_, i): Card => ({ rank: i + 2, suit }))
  ).filter((card) => !out.has(cardKey(card)))
}

/** Puts `count` cards drawn at random at the front of `pool`. */
function drawFront(pool: Card[], count: number, rand: () => number): void {
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(rand() * (pool.length - i))
    const kept = pool[i]
    pool[i] = pool[j]
    pool[j] = kept
  }
}

/**
 * The share of the pot each of several known hands would take on average from `board` on, by
 * dealing out the rest of the board `trials` times.
 */
export function knownEquity(
  holes: readonly (readonly Card[])[],
  board: readonly Card[],
  rand: () => number = Math.random,
  trials = 300
): number[] {
  const pool = unseen([...holes.flat(), ...board])
  const need = 5 - board.length
  const share = holes.map(() => 0)
  const runs = need === 0 ? 1 : trials
  for (let t = 0; t < runs; t++) {
    drawFront(pool, need, rand)
    const full = [...board, ...pool.slice(0, need)]
    const scores = holes.map((hole) => evaluate([...hole, ...full]).score)
    const best = Math.max(...scores)
    const level = scores.filter((score) => score === best).length
    scores.forEach((score, i) => {
      if (score === best) share[i] += 1 / level
    })
  }
  return share.map((won) => won / runs)
}

/**
 * How strong a hand is from where it stands: the chance it beats one hand dealt at random once
 * the board is out, estimated over `trials` deals against `opponents` random hands and brought
 * back to a single opponent so that it reads the same at any table.
 */
export function handStrength(
  hole: readonly Card[],
  board: readonly Card[],
  opponents: number,
  rand: () => number = Math.random,
  trials = 120
): number {
  const rivals = Math.max(1, opponents)
  const pool = unseen([...hole, ...board])
  const need = rivals * 2 + 5 - board.length
  let won = 0
  for (let t = 0; t < trials; t++) {
    drawFront(pool, need, rand)
    const full = [...board, ...pool.slice(rivals * 2, need)]
    const mine = evaluate([...hole, ...full]).score
    let best = 0
    let level = 0
    for (let k = 0; k < rivals; k++) {
      const theirs = evaluate([pool[2 * k], pool[2 * k + 1], ...full]).score
      if (theirs > best) {
        best = theirs
        level = 1
      } else if (theirs === best) level++
    }
    if (mine > best) won += 1
    else if (mine === best) won += 1 / (level + 1)
  }
  return (won / trials) ** (1 / rivals)
}

/* ------------------------------------------------------------------ a hand being played */

export type Street = 'preflop' | 'flop' | 'turn' | 'river'
const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river']
const SHOWN: Record<Street, number> = { preflop: 0, flop: 3, turn: 4, river: 5 }

export interface PokerSeat {
  stack: number
  hole: Card[]
  /** What this seat has put in on this street. */
  bet: number
  /** What it has put in over the whole hand. */
  total: number
  folded: boolean
  allIn: boolean
  /** It has had its say since the last full raise. */
  acted: boolean
  /** Not dealt in: it had no chips when the hand began. */
  out: boolean
}

export type ActionKind = 'fold' | 'check' | 'call' | 'bet' | 'raise'

/** One thing done at the table, and what the table looked like as it was done. */
export interface ActionMade {
  seat: number
  street: Street
  kind: ActionKind
  /** What the seat has in on this street once it is done. */
  to: number
  /** The chips it took. */
  paid: number
  allIn: boolean
  /** The pot before it, everything bet so far. */
  pot: number
  /** What the seat had to put in to stay. */
  toCall: number
  /** A bet or a raise its maker meant as a bluff, where she said so. */
  bluff?: boolean
}

/** A pot, who could win it, and once the hand is over who did. */
export interface Pot {
  amount: number
  eligible: number[]
  winners: number[]
}

export interface HandState {
  no: number
  button: number
  smallBlind: number
  bigBlind: number
  seats: PokerSeat[]
  deck: Card[]
  board: Card[]
  street: Street
  /** The seat to act, or null: between streets, or the hand over. */
  toAct: number | null
  /** The bet to match on this street. */
  currentBet: number
  /** The least a raise must add. */
  lastRaise: number
  log: ActionMade[]
  /** Everyone's chips before the blinds went in. */
  start: number[]
  over: boolean
  /** It ended with hands turned over, not with everyone folding to one. */
  showdown: boolean
  /** How the chips were shared, once it is over. */
  pots: Pot[]
  /** How many cards were on the board when the last bet that could be made was made; null where betting ran to the river. */
  runoutFrom: number | null
}

const able = (seat: PokerSeat): boolean => !seat.out && !seat.folded && !seat.allIn
const live = (seat: PokerSeat): boolean => !seat.out && !seat.folded

/** Everything bet in the hand so far. */
export function potOf(hand: HandState): number {
  return hand.seats.reduce((sum, seat) => sum + seat.total, 0)
}

/** What a seat must put in to stay: the bet to match, as far as its chips go. */
export function owedBy(hand: HandState, at: number): number {
  const seat = hand.seats[at]
  return Math.max(0, Math.min(hand.currentBet - seat.bet, seat.stack))
}

/** The seat after `from` that is still to act, or null where the betting is closed. */
function nextToAct(hand: HandState, from: number): number | null {
  const count = hand.seats.length
  const ables = hand.seats.flatMap((seat, i) => (able(seat) ? [i] : []))
  if (ables.length === 0) return null
  // One player left with chips who has matched everyone still in: nobody is there to bet against.
  // A big blind posted short leaves a bet to match that nobody made, which is not owed to anyone.
  if (ables.length === 1) {
    const rest = hand.seats.filter((seat, i) => i !== ables[0] && live(seat)).map((seat) => seat.bet)
    if (hand.seats[ables[0]].bet >= Math.max(0, ...rest)) return null
  }
  for (let k = 1; k <= count; k++) {
    const i = (from + k) % count
    if (able(hand.seats[i]) && (owedBy(hand, i) > 0 || !hand.seats[i].acted)) return i
  }
  return null
}

/** Gives back the part of the highest bet that nobody matched. */
function refund(seats: PokerSeat[]): PokerSeat[] {
  const bets = seats.map((seat) => seat.bet)
  const top = Math.max(...bets)
  const at = bets.indexOf(top)
  const second = Math.max(0, ...bets.filter((_, i) => i !== at))
  if (top === second) return seats
  const back = top - second
  return seats.map((seat, i) =>
    i === at
      ? { ...seat, bet: seat.bet - back, total: seat.total - back, stack: seat.stack + back, allIn: false }
      : seat
  )
}

/**
 * The pots a hand's bets make. `totals` is what each seat put in and `dead` the seats that
 * cannot win, folded or not dealt in. A seat all-in for less is in the pots up to what it put
 * in and no further; chips from folded seats stay in the pot they were bet into.
 */
export function sidePots(totals: readonly number[], dead: readonly boolean[]): Omit<Pot, 'winners'>[] {
  const levels = [...new Set(totals.filter((total, i) => !dead[i] && total > 0))].sort((a, b) => a - b)
  const pots: Omit<Pot, 'winners'>[] = []
  let under = 0
  for (const level of levels) {
    const amount = totals.reduce((sum, total) => sum + Math.min(total, level) - Math.min(total, under), 0)
    const eligible = totals.flatMap((total, i) => (!dead[i] && total >= level ? [i] : []))
    // Every level is some live seat's whole stake, so each pot has fewer in it than the one before.
    pots.push({ amount, eligible })
    under = level
  }
  const over = totals.reduce((sum, total) => sum + Math.max(0, total - under), 0)
  if (over > 0 && pots.length) pots[pots.length - 1].amount += over
  return pots
}

/**
 * Who takes each pot: the best hand among those in it, an equal share each where it is level,
 * any odd chips going one each to the winners nearest the left of the button. `scores` is each
 * seat's hand; `gains` comes back as the chips each seat is paid.
 */
export function awardPots(
  pots: readonly Omit<Pot, 'winners'>[],
  scores: readonly number[],
  button: number
): { pots: Pot[]; gains: number[] } {
  const count = scores.length
  const gains = scores.map(() => 0)
  const shared = pots.map((pot) => {
    const best = Math.max(...pot.eligible.map((i) => scores[i]))
    const winners = pot.eligible.filter((i) => scores[i] === best)
    const each = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - each * winners.length
    const fromLeft = [...winners].sort(
      (a, b) => ((a - button - 1 + count) % count) - ((b - button - 1 + count) % count)
    )
    for (const i of fromLeft) {
      gains[i] += each + (odd > 0 ? 1 : 0)
      odd--
    }
    return { ...pot, winners }
  })
  return { pots: shared, gains }
}

/** Ends the hand: the pots are made and paid. */
function settle(hand: HandState): HandState {
  const seats = refund(hand.seats)
  const alive = seats.flatMap((seat, i) => (live(seat) ? [i] : []))
  const scores = seats.map((seat) =>
    live(seat) ? (alive.length > 1 ? evaluate([...seat.hole, ...hand.board]).score : 1) : -1
  )
  const { pots, gains } = awardPots(
    sidePots(
      seats.map((seat) => seat.total),
      seats.map((seat) => !live(seat))
    ),
    scores,
    hand.button
  )
  return {
    ...hand,
    seats: seats.map((seat, i) => ({ ...seat, stack: seat.stack + gains[i], bet: 0 })),
    toAct: null,
    over: true,
    showdown: alive.length > 1,
    pots
  }
}

/** After a move, or a street dealt: whose turn it is, or the betting closed, or the hand won. */
function moveOn(hand: HandState, from: number): HandState {
  if (hand.seats.filter(live).length === 1) return settle(hand)
  const next = nextToAct(hand, from)
  if (next !== null) return { ...hand, toAct: next }
  const seats = refund(hand.seats)
  const noMore = seats.filter(able).length <= 1 && hand.board.length < 5
  return {
    ...hand,
    seats,
    toAct: null,
    runoutFrom: hand.runoutFrom ?? (noMore ? hand.board.length : null)
  }
}

/** The seat after `from` that is dealt in. */
function nextIn(seats: readonly PokerSeat[], from: number): number {
  for (let k = 1; k <= seats.length; k++) {
    const i = (from + k) % seats.length
    if (!seats[i].out) return i
  }
  return from
}

/**
 * A new hand: two cards each off `deck` in seat order, the blinds posted. Heads-up the button
 * posts the small blind and acts first before the flop; otherwise the blinds are the two seats
 * to its left. A blind short of chips is all-in for what it has, and the big blind is still the
 * bet to match. A seat with no chips is not dealt in. `button` must be a seat with chips.
 */
export function dealHand(stacks: readonly number[], button: number, no: number, deck: readonly Card[]): HandState {
  let dealt = 0
  let seats: PokerSeat[] = stacks.map((stack) => {
    const out = stack <= 0
    const hole = out ? [] : [deck[dealt], deck[dealt + 1]]
    if (!out) dealt += 2
    return { stack: Math.max(0, stack), hole, bet: 0, total: 0, folded: false, allIn: false, acted: false, out }
  })
  const playing = seats.filter((seat) => !seat.out).length
  const smallBlind = playing === 2 ? button : nextIn(seats, button)
  const bigBlind = nextIn(seats, smallBlind)
  const post = (at: number, blind: number): void => {
    const paid = Math.min(blind, seats[at].stack)
    seats = seats.map((seat, i) =>
      i === at
        ? { ...seat, stack: seat.stack - paid, bet: paid, total: paid, allIn: seat.stack === paid }
        : seat
    )
  }
  post(smallBlind, SMALL_BLIND)
  post(bigBlind, BIG_BLIND)
  const hand: HandState = {
    no,
    button,
    smallBlind,
    bigBlind,
    seats,
    deck: deck.slice(dealt),
    board: [],
    street: 'preflop',
    toAct: null,
    // The big blind is the bet to match even where the seat posting it was short of it.
    currentBet: BIG_BLIND,
    lastRaise: BIG_BLIND,
    log: [],
    start: stacks.map((stack) => Math.max(0, stack)),
    over: false,
    showdown: false,
    pots: [],
    runoutFrom: null
  }
  return moveOn(hand, bigBlind)
}

/** What the seat to act may do, and what its three sizes of bet come to. */
export interface Legal {
  owed: number
  canCheck: boolean
  canRaise: boolean
  /** The least it may make its bet on this street by raising. */
  minTo: number
  /** Everything it has: all-in. */
  maxTo: number
  /** A bet of half the pot, or a raise of half the pot once it has called. */
  halfTo: number
  /** The same for the whole pot. */
  potTo: number
}

const roundTo5 = (chips: number): number => Math.round(chips / 5) * 5

export function legal(hand: HandState, at: number): Legal {
  const seat = hand.seats[at]
  const owed = owedBy(hand, at)
  const maxTo = seat.bet + seat.stack
  // A raise needs chips beyond the call, someone left who can answer it, and the betting open.
  const canRaise =
    seat.stack > owed && !seat.acted && hand.seats.some((other, i) => i !== at && able(other))
  const minTo = Math.min(maxTo, hand.currentBet + hand.lastRaise)
  const after = potOf(hand) + owed
  const sized = (add: number): number => Math.min(maxTo, Math.max(minTo, hand.currentBet + roundTo5(add)))
  return { owed, canCheck: owed === 0, canRaise, minTo, maxTo, halfTo: sized(after / 2), potTo: sized(after) }
}

/** A move asked for. `to` is what a raise makes the seat's bet on this street. */
export interface Move {
  kind: 'fold' | 'check' | 'call' | 'raise'
  to?: number
  /** A raise meant as a bluff: it is kept with the move in the hand's log. */
  bluff?: boolean
}

/**
 * The seat to act makes its move. A move that cannot be made is the nearest one that can: a
 * fold with nothing to call is a check, a check with a bet to match is a call, a raise that is
 * not open is a call, and a raise's size is brought inside what is allowed.
 */
export function act(hand: HandState, move: Move): HandState {
  const at = hand.toAct
  if (at === null || hand.over) return hand
  const seat = hand.seats[at]
  const can = legal(hand, at)
  const base = { seat: at, street: hand.street, pot: potOf(hand), toCall: can.owed }
  const put = (next: PokerSeat, others?: (seat: PokerSeat) => PokerSeat): PokerSeat[] =>
    hand.seats.map((other, i) => (i === at ? next : others ? others(other) : other))
  if (move.kind === 'fold' && can.owed > 0) {
    return moveOn(
      {
        ...hand,
        seats: put({ ...seat, folded: true, acted: true }),
        log: [...hand.log, { ...base, kind: 'fold', to: seat.bet, paid: 0, allIn: false }]
      },
      at
    )
  }
  if (move.kind !== 'raise' || !can.canRaise) {
    const paid = can.owed
    const allIn = paid > 0 && paid === seat.stack
    return moveOn(
      {
        ...hand,
        seats: put({ ...seat, stack: seat.stack - paid, bet: seat.bet + paid, total: seat.total + paid, acted: true, allIn }),
        log: [...hand.log, { ...base, kind: paid > 0 ? 'call' : 'check', to: seat.bet + paid, paid, allIn }]
      },
      at
    )
  }
  const to = Math.min(can.maxTo, Math.max(can.minTo, Math.round(move.to ?? can.minTo)))
  const paid = to - seat.bet
  const full = to - hand.currentBet >= hand.lastRaise
  const raised: PokerSeat = {
    ...seat,
    stack: seat.stack - paid,
    bet: to,
    total: seat.total + paid,
    acted: true,
    allIn: paid === seat.stack
  }
  return moveOn(
    {
      ...hand,
      // A full raise reopens the betting to everyone; an all-in short of one only has to be matched.
      seats: put(raised, (other) => (full ? { ...other, acted: false } : other)),
      currentBet: to,
      lastRaise: full ? to - hand.currentBet : hand.lastRaise,
      log: [
        ...hand.log,
        {
          ...base,
          kind: hand.currentBet === 0 ? 'bet' : 'raise',
          to,
          paid,
          allIn: raised.allIn,
          ...(move.bluff ? { bluff: true } : {})
        }
      ]
    },
    at
  )
}

/** With the betting closed: the next street is dealt, or after the river the hands are shown. */
export function proceed(hand: HandState): HandState {
  if (hand.over || hand.toAct !== null) return hand
  if (hand.board.length === 5) return settle(hand)
  const take = hand.board.length === 0 ? 3 : 1
  const board = [...hand.board, ...hand.deck.slice(0, take)]
  return moveOn(
    {
      ...hand,
      deck: hand.deck.slice(take),
      board,
      street: STREETS[board.length - 2],
      seats: hand.seats.map((seat) => ({ ...seat, bet: 0, acted: false })),
      currentBet: 0,
      lastRaise: BIG_BLIND
    },
    hand.button
  )
}

/* ------------------------------------------------------------------ the game around the hands */

/** The button for the next hand: the next seat round that still has chips. */
export function nextButton(stacks: readonly number[], button: number): number {
  for (let k = 1; k <= stacks.length; k++) {
    const i = (button + k) % stacks.length
    if (stacks[i] > 0) return i
  }
  return button
}

/** The game is over: every hand played, the reader out of chips, or one player holding them all. */
export function gameOver(stacks: readonly number[], played: number, hands: number): boolean {
  return played >= hands || stacks[0] <= 0 || stacks.filter((stack) => stack > 0).length <= 1
}

/** How a game came out for the reader: most chips alone, shared at the top, or somebody else's. */
export function gameOutcome(stacks: readonly number[]): 'won' | 'lost' | 'draw' {
  const top = Math.max(...stacks)
  if (stacks[0] < top) return 'lost'
  return stacks.filter((stack) => stack === top).length > 1 ? 'draw' : 'won'
}

/* ------------------------------------------------------------------ how she plays */

/** How her style leans, each from -1 to 1: towards betting, towards calling, towards bluffing. */
export interface Traits {
  bold: number
  loose: number
  sly: number
}

const LEAN: readonly [keyof Traits, number, RegExp][] = [
  ['bold', 1, /aggress|bold|reckless|fearless|daring|wild|gambl|attack|ruthless|impuls|risk[- ]?tak|all[- ]in|confident/],
  ['bold', -1, /cautious|careful|tight|timid|nervous|conservative|shy|patient|safe|hesitant|passive|risk[- ]?averse|anxious/],
  ['loose', 1, /stubborn|curious|loose|optimis|hopeful|chas|calls? (too|every|any)|can(no|')t fold|trusting|naive/],
  ['loose', -1, /disciplin|tight|folds? (a lot|often|early|quick)|suspicious/],
  ['sly', 1, /bluff|sly|cunning|decepti|trick|poker[- ]face|unreadable|mischie|teas|sneak|devious|actress|theatric/],
  ['sly', -1, /honest|open book|transparent|easy to read|can(no|')t (bluff|lie)|bad liar|never bluff|straightforward/]
]

/** What her style's words say about how she bets; all level where they say nothing. */
export function styleTraits(style: string): Traits {
  const words = style.toLowerCase()
  const traits: Traits = { bold: 0, loose: 0, sly: 0 }
  for (const [trait, way, pattern] of LEAN) if (pattern.test(words)) traits[trait] += way
  return traits
}

/** How much of a bet's meaning she takes in: a bet says its maker likely holds something. */
const READ: Record<Skill, number> = { 1: 0, 2: 0.3, 3: 0.6, 4: 0.85, 5: 1 }
/** How far short of the price she will still call, out of hope. */
const LOOSE: Record<Skill, number> = { 1: 0.25, 2: 0.13, 3: 0.05, 4: 0, 5: 0 }
/** How often a big bet frightens her off a hand that was good enough to call with. */
const SCARE: Record<Skill, number> = { 1: 0.3, 2: 0.2, 3: 0.1, 4: 0.04, 5: 0 }
/** How often she bets with nothing where she sees a chance to. */
const BLUFF: Record<Skill, number> = { 1: 0.2, 2: 0.16, 3: 0.12, 4: 0.1, 5: 0.1 }
/** How often she raises a bet with nothing: a bluff into strength, which a good player does not make. */
const WILD: Record<Skill, number> = { 1: 0.15, 2: 0.09, 3: 0.03, 4: 0, 5: 0 }
/** How good a hand she bets for what it is worth: a good player bets a thinner one. */
const VALUE: Record<Skill, number> = { 1: 0.72, 2: 0.7, 3: 0.68, 4: 0.64, 5: 0.6 }
/** How good a hand she raises a bet with. */
const RERAISE: Record<Skill, number> = { 1: 0.93, 2: 0.93, 3: 0.92, 4: 0.89, 5: 0.86 }
/** How good a hand she opens with before the flop. */
const OPEN: Record<Skill, number> = { 1: 0.66, 2: 0.65, 3: 0.64, 4: 0.6, 5: 0.57 }
/** How often she only checks or calls a hand that was worth a bet or a raise. */
const MEEK: Record<Skill, number> = { 1: 0.4, 2: 0.25, 3: 0.1, 4: 0, 5: 0 }
/** How far out she can be in judging a hand that could go either way. */
const MISREAD: Record<Skill, number> = { 1: 0.6, 2: 0.38, 3: 0.18, 4: 0.07, 5: 0 }

/**
 * Her hand's strength as she judges it. A poor player misjudges a hand that could go either
 * way, thinking a middling one good or bad; nobody mistakes a sure thing or a hopeless one.
 */
export function judged(strength: number, skill: Skill, rand: () => number = Math.random): number {
  const off = MISREAD[skill]
  if (off === 0) return strength
  const doubt = 4 * strength * (1 - strength)
  return Math.min(1, Math.max(0, strength + (rand() + rand() - 1) * off * doubt))
}

/** Where she stands when it is her move. */
export interface Spot extends Legal {
  /** Everything in the pot, the bet she faces included. */
  pot: number
  stack: number
  /** The others still in the hand. */
  opponents: number
  street: Street
}

/** What she does, and whether she meant it as a bluff. */
export interface Choice extends Move {
  bluff?: boolean
}

/**
 * A girl's move from `strength`, her hand's chance against one random hand as she judges it,
 * and the spot.
 *
 * Nobody folds for free, and a hand that is nearly sure is never folded. The best player bets
 * a good hand for what it is worth, a thinner one than the others would and bigger the better
 * it is, counts the players still in, raises a very strong one, calls when her chance beats the
 * price of the call with room for what a bet says about the bettor, and bluffs now and then
 * only where it can work: after the flop, against one player, with a hand that cannot win by
 * checking. Weaker players make a person's mistakes: they only check or call a hand that was
 * worth a bet, take a bet at face value and call on hope, are sometimes frightened off a good
 * hand by a big bet, and bluff into several players, before the flop or straight into a bet.
 * Her style shifts the same lines a little.
 */
export function girlChoice(
  strength: number,
  spot: Spot,
  skill: Skill,
  style = '',
  rand: () => number = Math.random
): Choice {
  const lean = styleTraits(style)
  const rivals = Math.max(1, spot.opponents)
  // Leaving a crumb behind is never worth it: a raise of most of her chips is all of them.
  const raise = (to: number): Choice => ({ kind: 'raise', to: to >= spot.maxTo * 0.7 ? spot.maxTo : to })
  const preflop = spot.street === 'preflop'
  // A hand good against one player is less so against several, which a poor player does not count.
  const worth = skill >= 3 ? strength ** Math.sqrt(rivals) : strength
  const meekly = MEEK[skill] * (1 - 0.5 * lean.bold)
  const meek = (): boolean => meekly > 0 && rand() < meekly

  if (spot.owed === 0) {
    if (!spot.canRaise) return { kind: 'check' }
    const value = VALUE[skill] - 0.06 * lean.bold
    if (worth >= value) return meek() ? { kind: 'check' } : raise(worth >= value + (skill >= 4 ? 0.14 : 0.18) ? spot.potTo : spot.halfTo)
    const where =
      skill >= 4
        ? rivals === 1 && !preflop && strength < 0.45
        : skill === 3
          ? rivals <= 2 && !preflop && strength < 0.5
          : strength < 0.55
    const rate = BLUFF[skill] * (1 + 0.6 * lean.sly) * (1 + 0.4 * lean.bold)
    if (where && rate > 0 && rand() < rate) {
      return { ...raise(skill <= 2 && rand() < 0.35 ? spot.potTo : spot.halfTo), bluff: true }
    }
    return { kind: 'check' }
  }

  if (spot.canRaise) {
    const top = RERAISE[skill] - 0.04 * lean.bold
    const open = preflop && spot.owed <= BIG_BLIND && strength >= OPEN[skill] - 0.05 * lean.bold
    // Nobody has raised yet before the flop: a good hand opens.
    if ((worth >= top - 0.05 || open) && !meek()) {
      if (worth >= top || open) return raise(spot.potTo)
      if (spot.owed * 4 <= spot.stack) return raise(spot.halfTo)
    }
  }
  if (strength >= 0.92) return { kind: 'call' }
  const wild = WILD[skill] * (1 + 0.6 * lean.sly) * (1 + 0.4 * lean.bold)
  if (wild > 0 && spot.canRaise && !preflop && strength < 0.6 && rand() < wild) {
    return { ...raise(spot.potTo), bluff: true }
  }
  const price = spot.owed / (spot.pot + spot.owed)
  // How big the bet is: against twenty big blinds before the flop, against the pot after it.
  const size = Math.min(1, preflop ? spot.owed / (20 * BIG_BLIND) : spot.owed / Math.max(1, spot.pot - spot.owed))
  const respect = (preflop ? 0.03 : 0.06) + 0.12 * size
  const need = price + respect * READ[skill] - LOOSE[skill] - 0.05 * lean.loose
  if (strength ** rivals >= need) {
    const scare = SCARE[skill] * (1 - 0.5 * lean.bold)
    if (scare > 0 && size >= 0.5 && strength < 0.88 && rand() < scare) return { kind: 'fold' }
    return { kind: 'call' }
  }
  return { kind: 'fold' }
}

/** A girl's move in the hand as it stands: her hand's strength estimated, then {@link girlChoice}. */
export function girlAction(
  hand: HandState,
  at: number,
  skill: Skill,
  style = '',
  rand: () => number = Math.random,
  trials = 120
): Choice {
  const opponents = hand.seats.filter((seat, i) => i !== at && live(seat)).length
  const strength = judged(handStrength(hand.seats[at].hole, hand.board, opponents, rand, trials), skill, rand)
  const spot: Spot = {
    ...legal(hand, at),
    pot: potOf(hand),
    stack: hand.seats[at].stack,
    opponents,
    street: hand.street
  }
  return girlChoice(strength, spot, skill, style, rand)
}

/* ------------------------------------------------------------------ words */

const RANKS = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'jack', 'queen', 'king', 'ace']
const rankName = (rank: number): string => RANKS[rank] ?? String(rank)
const rankNames = (rank: number): string => (rank === 6 ? 'sixes' : `${rankName(rank)}s`)
const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** A card said aloud: "the king of hearts". */
export function cardWord(card: Card): string {
  return `the ${rankName(card.rank)} of ${card.suit}`
}

/** A hand's name: "a pair of nines", "a flush, ace high". */
export function handName(value: HandValue): string {
  const [a, b] = value.ranks
  switch (value.category) {
    case 8:
      return a === 14 ? 'a royal flush' : `a straight flush to the ${rankName(a)}`
    case 7:
      return `four ${rankNames(a)}`
    case 6:
      return `a full house, ${rankNames(a)} over ${rankNames(b)}`
    case 5:
      return `a flush, ${rankName(a)} high`
    case 4:
      return `a straight to the ${rankName(a)}`
    case 3:
      return `three ${rankNames(a)}`
    case 2:
      return `two pair, ${rankNames(a)} and ${rankNames(b)}`
    case 1:
      return `a pair of ${rankNames(a)}`
    default:
      return `${rankName(a)} high`
  }
}

/** Two hole cards in a word or two: "a pair of aces", "king-seven suited". */
export function holeWord(hole: readonly Card[]): string {
  const [high, low] = [...hole].sort((a, b) => b.rank - a.rank)
  if (high.rank === low.rank) return `a pair of ${rankNames(high.rank)}`
  return `${rankName(high.rank)}-${rankName(low.rank)}${high.suit === low.suit ? ' suited' : ''}`
}

const ON: Record<Street, string> = {
  preflop: 'before the flop',
  flop: 'on the flop',
  turn: 'on the turn',
  river: 'on the river'
}

/** Who sits where, as the narration says it to the reader, or as the account says it of him. */
function namer(names: readonly string[], reader: string): (seat: number) => string {
  return (seat) => (seat === 0 ? reader : names[seat - 1])
}

/** The deal of a hand, as the scene's narration says it. */
export function dealLine(names: readonly string[], hand: HandState): string {
  const who = namer(names, 'you')
  const s = (seat: number, verb: string): string => (seat === 0 ? verb : verb === 'have' ? 'has' : `${verb}s`)
  const { button, smallBlind, bigBlind, seats } = hand
  const blinds =
    button === smallBlind
      ? `${cap(who(button))} ${s(button, 'have')} the button and ${s(button, 'post')} the small blind of ${seats[smallBlind].total}; ${who(bigBlind)} ${s(bigBlind, 'post')} the big blind of ${seats[bigBlind].total}.`
      : `${cap(who(button))} ${s(button, 'have')} the button; ${who(smallBlind)} ${s(smallBlind, 'post')} the small blind of ${seats[smallBlind].total}, ${who(bigBlind)} the big blind of ${seats[bigBlind].total}.`
  return `Hand ${hand.no}. ${blinds} You are dealt ${cardWord(seats[0].hole[0])} and ${cardWord(seats[0].hole[1])}.`
}

/**
 * Moves made one after another, as the scene's narration says them in one line: those in a row
 * who did the same are named together. "Ana folds; you and Bea call 10."
 */
export function actionsLine(names: readonly string[], made: readonly ActionMade[]): string {
  const who = namer(names, 'you')
  const runs: { first: ActionMade; seats: number[] }[] = []
  for (const each of made) {
    const last = runs[runs.length - 1]
    const plain = each.kind === 'fold' || each.kind === 'check' || each.kind === 'call'
    const same =
      last !== undefined &&
      plain &&
      last.first.kind === each.kind &&
      !each.allIn &&
      !last.first.allIn &&
      (each.kind !== 'call' || last.first.paid === each.paid)
    if (same) last.seats.push(each.seat)
    else runs.push({ first: each, seats: [each.seat] })
  }
  const said = runs.map(({ first, seats }) => {
    const many = seats.length > 1 || seats[0] === 0
    const verb = (word: string): string => (many ? word : word === 'check' ? 'checks' : `${word}s`)
    const allIn = first.allIn ? ', all-in' : ''
    const does =
      first.kind === 'fold' || first.kind === 'check'
        ? verb(first.kind)
        : first.kind === 'call'
          ? `${verb('call')} ${first.paid}${allIn}`
          : first.kind === 'bet'
            ? `${verb('bet')} ${first.to}${allIn}`
            : `${verb('raise')} to ${first.to}${allIn}`
    return `${listed(seats.map(who))} ${does}`
  })
  return `${cap(said.join('; '))}.`
}

/** A move, as the scene's narration says it. */
export function actionLine(names: readonly string[], made: ActionMade): string {
  return actionsLine(names, [made])
}

/** The street just dealt, as the scene's narration says it. */
export function streetLine(hand: HandState): string {
  const { board } = hand
  const cards =
    board.length === 3
      ? `The flop: ${listed(board.map(cardWord))}.`
      : `The ${board.length === 4 ? 'turn' : 'river'}: ${cardWord(board[board.length - 1])}.`
  return `${cards} The pot is ${potOf(hand)}.`
}

/** Who took which pot, in a sentence. */
function potsWord(hand: HandState, who: (seat: number) => string, past: boolean): string {
  // Pots that went to the same players are said as one.
  const taken: Pot[] = []
  for (const pot of hand.pots) {
    if (pot.amount <= 0) continue
    const last = taken[taken.length - 1]
    if (last && last.winners.join() === pot.winners.join()) last.amount += pot.amount
    else taken.push({ ...pot })
  }
  const said = taken
    .map((pot, i, all) => {
      const verb = pot.winners.length > 1 ? 'split' : past ? 'took' : pot.winners[0] === 0 && who(0) === 'you' ? 'take' : 'takes'
      const which = all.length === 1 ? 'the pot' : i === 0 ? 'the main pot' : all.length === 2 ? 'the side pot' : 'a side pot'
      return `${listed(pot.winners.map(who))} ${verb} ${which} of ${pot.amount}`
    })
  return said.join('; ')
}

/** The seats that had chips when the hand began and have none now. */
export function bustedIn(hand: HandState): number[] {
  return hand.seats.flatMap((seat, i) => (hand.start[i] > 0 && seat.stack === 0 ? [i] : []))
}

/** How a finished hand came out, as the scene's narration says it: a line or three. */
export function resultLines(names: readonly string[], hand: HandState): string[] {
  const who = namer(names, 'you')
  const lines: string[] = []
  if (hand.showdown) {
    const shown = hand.seats.flatMap((seat, i) =>
      live(seat)
        ? [`${who(i)} ${i === 0 ? 'have' : 'has'} ${handName(evaluate([...seat.hole, ...hand.board]))}`]
        : []
    )
    lines.push(`Showdown: ${shown.join('; ')}.`)
    lines.push(`${cap(potsWord(hand, who, false))}.`)
  } else {
    lines.push(`${cap(potsWord(hand, who, false))} without a showdown.`)
  }
  const gone = bustedIn(hand)
  if (gone.length) lines.push(`${cap(listed(gone.map(who)))} ${gone.length > 1 || gone[0] === 0 ? 'are' : 'is'} out of chips.`)
  return lines
}

/** Everyone's chips in a row: "the reader 340, Ana 0, Bea 260". */
export function chipsLine(names: readonly string[], stacks: readonly number[], reader: string): string {
  return [reader, ...names].map((name, seat) => `${name} ${stacks[seat]}`).join(', ')
}

/* ------------------------------------------------------------------ how a hand is told */

/** A finished hand as the account tells it. */
export interface HandTold {
  /** The hand in a line, with everything known: the cards that were never shown included. */
  line: string
  /** The same as the table saw it: nothing of a hand that was folded or never turned over. */
  seen: string
  /** Worth a remark and a place in the account. */
  notable: boolean
  /** The seat that won it on a bluff nobody saw, or null. */
  bluffer: number | null
  /** The whole of what was won. */
  pot: number
}

/** A seat's hand strength on a street of a finished hand, the same every time it is asked. */
function strengthAt(hand: HandState, seat: number, street: Street): number {
  const hole = hand.seats[seat].hole
  const seed = hand.no * 7919 + seat * 131 + SHOWN[street] * 17 + cardKey(hole[0]) * 53 + cardKey(hole[1])
  return handStrength(hole, hand.board.slice(0, SHOWN[street]), 1, seeded(seed), 200)
}

/** What a seat held on a street, in words. */
function holding(hand: HandState, seat: number, street: Street): string {
  const hole = hand.seats[seat].hole
  return street === 'preflop'
    ? holeWord(hole)
    : handName(evaluate([...hole, ...hand.board.slice(0, SHOWN[street])]))
}

const percent = (share: number): string => `${Math.round(share * 100)}%`

/**
 * A finished hand for the scene's writer, who is told the cards nobody showed: whether a bet
 * that took the pot was a bluff and who folded the better hand to it, and at a showdown whether
 * the loser was unlucky (ahead when the chips went in), called badly, or was caught bluffing.
 * A seat the blinds put all-in is judged for none of it.
 * `stack` is what everyone started the game with, the measure of a big pot.
 */
export function handTold(names: readonly string[], hand: HandState, stack: number): HandTold {
  const who = namer(names, 'the reader')
  const pot = hand.pots.reduce((sum, each) => sum + each.amount, 0)
  const big = pot >= stack * 0.4
  const head = `Hand ${hand.no}:`

  if (!hand.showdown) {
    const winner = hand.pots[0].winners[0]
    let at = -1
    hand.log.forEach((made, i) => {
      if (made.seat === winner && (made.kind === 'bet' || made.kind === 'raise')) at = i
    })
    if (at < 0 || pot <= 4 * BIG_BLIND) {
      const line = `${head} ${who(winner)} took a small pot of ${pot} without a showdown.`
      return { line, seen: line, notable: false, bluffer: null, pot }
    }
    const made = hand.log[at]
    const street = made.street
    const folders = hand.log.slice(at + 1).flatMap((later) => (later.kind === 'fold' ? [later.seat] : []))
    const worth = (seat: number): number =>
      street === 'preflop'
        ? strengthAt(hand, seat, street) - (seat === winner ? 0 : 0.08)
        : evaluate([...hand.seats[seat].hole, ...hand.board.slice(0, SHOWN[street])]).score
    const better = folders.filter((seat) => worth(seat) > worth(winner))
    // A girl's bluff is the one she meant as one. The reader's is read from the cards: a bet or a
    // raise once the flop was out, with a hand behind every hand still in. Taking the blinds
    // with a raise before the flop is not one.
    const bluff =
      winner === 0
        ? street !== 'preflop' && folders.length > 0 && better.length === folders.length
        : made.bluff === true
    const gave = listed(folders.map(who))
    const seen = `${head} ${who(winner)} ${made.kind === 'bet' ? 'bet' : 'raised to'} ${made.to}${made.allIn ? ', all-in,' : ''} ${ON[street]} and ${gave} folded; ${who(winner)} took the pot of ${pot} without showing.`
    const lost = better.length
      ? `${listed(better.map(who))} folded the better hand (${holding(hand, better[0], street)})`
      : ''
    const line = bluff
      ? `${head} ${who(winner)} bluffed ${gave} off a pot of ${pot} ${ON[street]} with ${holding(hand, winner, street)}${lost ? `; ${lost}` : ''}.`
      : `${head} ${who(winner)} bet ${holding(hand, winner, street)} ${ON[street]} and ${gave} folded${lost ? `: ${lost}, a fold too many` : ''}; pot ${pot}.`
    return { line, seen, notable: bluff || better.length > 0 || big || made.allIn, bluffer: bluff ? winner : null, pot }
  }

  const alive = hand.seats.flatMap((seat, i) => (live(seat) ? [i] : []))
  const shown = alive.map((seat) => `${who(seat)} with ${holding(hand, seat, 'river')}`).join(', ')
  const top = hand.pots.reduce((most, each) => (each.amount > most.amount ? each : most))
  const winners = new Set(hand.pots.flatMap((each) => each.winners))
  const losers = alive.filter((seat) => !winners.has(seat))
  const lastBy = (seat: number): ActionMade | undefined => [...hand.log].reverse().find((made) => made.seat === seat)
  const notes: string[] = []
  // A seat the blinds put all-in chose nothing: it made no move at all, or it sat in a blind
  // with no more than the big blind and could only complete it.
  const forced = (seat: number): boolean =>
    hand.seats[seat].total === hand.start[seat] &&
    (!lastBy(seat) || ((seat === hand.smallBlind || seat === hand.bigBlind) && hand.start[seat] <= BIG_BLIND))
  const put = alive.filter(forced)
  if (put.length) notes.push(`the blinds put ${listed(put.map(who))} all-in, with no choice in it`)
  if (hand.runoutFrom !== null && hand.runoutFrom < 5) {
    const when = ON[STREETS[Math.max(0, hand.runoutFrom - 2)]]
    const share = knownEquity(
      alive.map((seat) => hand.seats[seat].hole),
      hand.board.slice(0, hand.runoutFrom),
      seeded(hand.no * 104729 + hand.runoutFrom),
      400
    )
    const ahead = share.indexOf(Math.max(...share))
    // No bad beat where a forced seat is on either side of it: nobody chose to be in that spot.
    const chosen = !forced(alive[ahead]) && !top.winners.every(forced)
    if (!top.winners.includes(alive[ahead]) && share[ahead] >= 0.7) {
      if (chosen) {
        notes.push(`a bad beat for ${who(alive[ahead])}, who was ${percent(share[ahead])} to win when the chips went in ${when}`)
      }
    } else {
      for (const seat of losers) {
        const chance = share[alive.indexOf(seat)]
        if (chance >= 0.3 || forced(seat)) continue
        notes.push(
          lastBy(seat)?.kind === 'call'
            ? `a bad call by ${who(seat)}, only ${percent(chance)} to win when the chips went in ${when}`
            : `${who(seat)} pushed ${when} with the worst of it, ${percent(chance)} to win`
        )
      }
    }
  } else {
    for (const seat of losers) {
      const last = lastBy(seat)
      if (!last || last.street === 'preflop') continue
      const weak = strengthAt(hand, seat, last.street) < 0.45
      if (weak && (last.kind === 'bet' || last.kind === 'raise')) {
        notes.push(`${who(seat)}'s bluff ${ON[last.street]} with ${holding(hand, seat, last.street)} was called`)
      } else if (weak && last.kind === 'call' && last.toCall >= last.pot * 0.4) {
        notes.push(`a loose call by ${who(seat)} ${ON[last.street]} with only ${holding(hand, seat, last.street)}`)
      }
    }
  }
  const gone = bustedIn(hand)
  const out = gone.length ? ` ${cap(listed(gone.map(who)))} ${gone.length > 1 ? 'were' : 'was'} out of chips.` : ''
  const line = `${head} showdown for ${pot}: ${shown}. ${cap(potsWord(hand, who, true))}.${notes.length ? ` ${cap(notes.join('; '))}.` : ''}${out}`
  const allIn = alive.some((seat) => hand.seats[seat].allIn)
  return { line, seen: line, notable: notes.length > 0 || gone.length > 0 || allIn || big, bluffer: null, pot }
}

/**
 * The girl to say something about a finished hand, by her place among the girls: one who has
 * just lost her last chip; failing that one who took a pot, one who showed her hand down, or
 * anyone who was dealt in. Among equals it is whoever has spoken least, `spoken` being how
 * often each has.
 */
export function remarkBy(hand: HandState, spoken: readonly number[]): number {
  const girls = hand.seats.map((_, i) => i).slice(1)
  const winners = new Set(hand.pots.flatMap((each) => each.winners))
  const gone = bustedIn(hand)
  const groups = [
    girls.filter((seat) => gone.includes(seat)),
    girls.filter((seat) => winners.has(seat)),
    girls.filter((seat) => hand.showdown && live(hand.seats[seat])),
    girls.filter((seat) => !hand.seats[seat].out),
    girls
  ]
  const group = groups.find((seats) => seats.length > 0) ?? girls
  return group.reduce((least, seat) => ((spoken[seat - 1] ?? 0) < (spoken[least - 1] ?? 0) ? seat : least)) - 1
}

/* ------------------------------------------------------------------ how a game is told */

/** What a game comes to, as the scene's narration says it. `stacks` is everyone's chips, the reader's first. */
export function pokerSummary(names: readonly string[], stacks: readonly number[], played: number): string {
  const open = `You play poker with ${listed(names)}`
  const mine = stacks[0]
  const top = Math.max(...stacks)
  const girls = names.map((name, i) => ({ name, chips: stacks[i + 1] }))
  const leaders = girls.filter((girl) => girl.chips === top)
  const rest = girls.filter((girl) => girl.chips < top).map((girl) => `${girl.name}'s ${girl.chips}`)
  if (mine < top) {
    const took =
      leaders.length === 1
        ? `${leaders[0].name} finishes on top with ${top} chips`
        : `${listed(leaders.map((girl) => girl.name))} finish level on top with ${top} chips each`
    const how = mine === 0 ? `and lose, out of chips after ${played} hand${played === 1 ? '' : 's'}` : 'and lose'
    return `${open} ${how}: ${took}, to ${listed([`your ${mine}`, ...rest])}.`
  }
  if (leaders.length === 0) return `${open} and win, finishing on ${mine} chips to ${listed(rest)}.`
  return `${open} and finish level with ${listed(leaders.map((girl) => girl.name))} on ${top} chips each${rest.length ? `, ahead of ${listed(rest)}` : ''}.`
}

/** The most hands the account tells one by one. */
const TOLD_AT_MOST = 6

/**
 * A game still being played, for the scene should the reader walk away from it: the terms, how
 * many hands are done and everyone's chips. Nobody's cards are in it.
 */
export function pokerProgress(
  names: readonly string[],
  stacks: readonly number[],
  played: number,
  stack: number,
  agreed: number
): string[] {
  const top = Math.max(...stacks)
  const leaders = ['the reader', ...names].filter((_, seat) => stacks[seat] === top)
  const lead = leaders.length === 1 ? `${leaders[0]} was ahead` : `${listed(leaders)} were level on top`
  return [
    `It was Texas hold'em between the reader and ${listed(names)} for play chips that are only counters: ${stack} each to start, blinds ${SMALL_BLIND} and ${BIG_BLIND}, ${agreed} hand${agreed === 1 ? '' : 's'} at most, most chips at the end wins.`,
    `${played} of the ${agreed} hand${agreed === 1 ? '' : 's'} had been played and the game was not finished.`,
    `Chips after hand ${played}: ${chipsLine(names, stacks, 'the reader')}: ${lead}.`
  ]
}

/**
 * How a game went, for the scene's writer: the terms, the hands that mattered with what nobody
 * at the table saw, and where everyone's chips ended up.
 */
export function pokerAccount(
  names: readonly string[],
  hands: readonly HandState[],
  stack: number,
  agreed: number
): string[] {
  const told = hands.map((hand) => handTold(names, hand, stack))
  const notable = told.filter((each) => each.notable)
  const floor = [...notable].sort((a, b) => b.pot - a.pot)[TOLD_AT_MOST - 1]?.pot ?? 0
  const kept = notable.length > TOLD_AT_MOST ? notable.filter((each) => each.pot >= floor).slice(0, TOLD_AT_MOST) : notable
  const others = hands.length - kept.length
  const stacks = hands.length ? hands[hands.length - 1].seats.map((seat) => seat.stack) : [stack, ...names.map(() => stack)]
  const top = Math.max(...stacks)
  const leaders = ['the reader', ...names].filter((_, seat) => stacks[seat] === top)
  const took = leaders.length === 1 ? `${leaders[0]} won the game` : `${listed(leaders)} finished level on top`
  const early =
    hands.length < agreed
      ? [
          stacks[0] === 0
            ? `It ended after hand ${hands.length}: the reader was out of chips.`
            : `It ended after hand ${hands.length}: only ${leaders[0]} had chips left.`
        ]
      : []
  return [
    `It was Texas hold'em between the reader and ${listed(names)} for play chips that are only counters: ${stack} each to start, blinds ${SMALL_BLIND} and ${BIG_BLIND}, ${agreed} hand${agreed === 1 ? '' : 's'} at most, most chips at the end wins. Nobody saw a hand that was folded; what is said of those below is for you alone.`,
    ...kept.map((each) => each.line),
    ...(others > 0 && hands.length > 0
      ? [`The other ${others === 1 ? 'hand was a small pot' : `${others} hands were small pots`} with nothing remarkable.`]
      : []),
    ...early,
    `Final chips: ${chipsLine(names, stacks, 'the reader')}: ${took}.`
  ]
}

export { freshDeck }
