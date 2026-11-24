/** Skee-Ball's rules: the board, where a roll lands and what it scores, the turns and how she rolls. */

import { listed } from '../minigameKit'

/** The target board, in ball widths or so: across from its middle, and up from the lip of the ramp. */
export const BOARD = { half: 12, depth: 30 } as const

/** A ring a ball can drop into: what it is worth, its middle and its radius. */
export interface Ring {
  value: number
  x: number
  y: number
  r: number
}

/**
 * The rings, up the middle from the big 20 to the small 50, and the two 100 pockets in the top
 * corners with nothing beside them but gutter. Anywhere else on the board rolls down to the 10.
 */
export const RINGS: readonly Ring[] = [
  { value: 20, x: 0, y: 6.3, r: 3.3 },
  { value: 30, x: 0, y: 13.1, r: 2.9 },
  { value: 40, x: 0, y: 19.2, r: 2.5 },
  { value: 50, x: 0, y: 24.5, r: 1.7 },
  { value: 100, x: -9.9, y: 27.2, r: 1.1 },
  { value: 100, x: 9.9, y: 27.2, r: 1.1 }
]

/** What the gutter pays: every ball scores something. */
export const GUTTER = 10

/** Half the width of a rim: a ball landing this near a ring's edge, inside or out, can drop either way. */
export const RIM = 0.3

/** How far either side of the middle the aim marker sweeps, on the board. */
export const AIM_REACH = 11.5
/** Where the softest and the hardest roll come down: short of the lip, and past the back wall. */
export const POWER_FROM = -3
export const POWER_SPAN = 36

/** How long each sweep takes from one end to the other: the aim, then the quicker power. */
export const AIM_SWEEP_MS = 1000
export const POWER_SWEEP_MS = 800

/**
 * How far a ball strays from where the reader's two stops put it, as any hand's does: enough that
 * a small corner pocket is not a sure thing even on two good stops.
 */
export const HAND = 0.7

/** A sweep back and forth between 0 and 1, from the time since it began. */
export function sweepAt(elapsed: number, period: number): number {
  const turn = (((elapsed / period) % 2) + 2) % 2
  return turn <= 1 ? turn : 2 - turn
}

/**
 * Where a sweep begins, as time already run on it: anywhere along it and going either way, so no
 * two balls keep the same beat and each has to be read off the marker, not counted.
 */
export function sweepFrom(period: number, rand: () => number = Math.random): number {
  return rand() * 2 * period
}

/** Where an aim from -1 to 1 puts the ball's line, and how far up a power from 0 to 1 sends it. */
export const aimX = (aim: number): number => aim * AIM_REACH
export const powerY = (power: number): number => POWER_FROM + power * POWER_SPAN

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** The two stops that would put a ball on a spot of the board. */
export function stopsFor(x: number, y: number): { aim: number; power: number } {
  return { aim: clamp(x / AIM_REACH, -1, 1), power: clamp((y - POWER_FROM) / POWER_SPAN, 0, 1) }
}

/**
 * How a ball ended: clean in a ring, off a rim and in, off a rim and out, short of the board,
 * off the back wall, or down on the board between the rings.
 */
export type RollKind = 'in' | 'rim-in' | 'rim-out' | 'short' | 'back' | 'between'

export interface Landing {
  /** Where it came down, kept on the board. */
  x: number
  y: number
  score: number
  kind: RollKind
  /** The ring it dropped into or spilled out of. */
  ring: Ring | null
}

/**
 * What a ball scores for where it comes down. Well inside a ring it drops; across a rim the
 * chance falls evenly from certain to none, and `rand` settles it; anywhere else it is the
 * gutter's. The dice are asked only for a ball on a rim.
 */
export function landOn(x: number, y: number, rand: () => number = Math.random): Landing {
  const at = { x: clamp(x, -BOARD.half + 0.5, BOARD.half - 0.5), y: clamp(y, POWER_FROM, BOARD.depth) }
  if (y < 0) return { ...at, score: GUTTER, kind: 'short', ring: null }
  if (y > BOARD.depth) return { ...at, score: GUTTER, kind: 'back', ring: null }
  for (const ring of RINGS) {
    const off = Math.hypot(at.x - ring.x, at.y - ring.y) - ring.r
    if (off <= -RIM) return { ...at, score: ring.value, kind: 'in', ring }
    if (off < RIM) {
      const drops = rand() < (RIM - off) / (2 * RIM)
      return { ...at, score: drops ? ring.value : GUTTER, kind: drops ? 'rim-in' : 'rim-out', ring }
    }
  }
  return { ...at, score: GUTTER, kind: 'between', ring: null }
}

/** One ball rolled: whose, the stops it was made with, where it landed and what it was going for. */
export interface Roll extends Landing {
  who: number
  aim: number
  power: number
  /** The ring the roll was plainly meant for, by its value; null for one meant for nothing. */
  sought: number | null
}

/** A roll before it is anybody's. */
export type Rolled = Omit<Roll, 'who'>

/** How far outside a ring a ball can be put and still have been meant for it. */
const MEANT_WITHIN = 2.4

/** The ring a spot is plainly meant for: the nearest, where it is near enough. */
export function soughtAt(x: number, y: number): number | null {
  const near = RINGS.map((ring) => ({ ring, off: Math.hypot(x - ring.x, y - ring.y) - ring.r })).sort(
    (a, b) => a.off - b.off
  )[0]
  return near.off <= MEANT_WITHIN ? near.ring.value : null
}

/** A draw off the bell curve, from two of the dice. */
function bell(rand: () => number): number {
  const u = Math.max(rand(), 1e-9)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand())
}

/** The reader's roll, from his two stops: the line and the weight, less a little the hand takes off them. */
export function readerRoll(aim: number, power: number, rand: () => number = Math.random): Rolled {
  const x = aimX(aim)
  const y = powerY(power)
  const landing = landOn(x + bell(rand) * HAND, y + bell(rand) * HAND, rand)
  return { ...landing, aim, power, sought: soughtAt(x, y) }
}

export type Skill = 1 | 2 | 3 | 4 | 5

/** How far her ball strays across the lane, by skill; the weight is harder to judge than the line. */
export const SCATTER: Record<Skill, number> = { 1: 2.3, 2: 1.8, 3: 1.15, 4: 0.95, 5: 0.75 }
export const WEIGHT_SCATTER = 1.6
/**
 * The ring she rolls for with nothing to chase, where her hand scores best: the safe 40, and the
 * 50 only for the best, the one girl who can hold it.
 */
const HOME: Record<Skill, number> = { 1: 40, 2: 40, 3: 40, 4: 40, 5: 50 }
/** How often the corners tempt her for no reason at all: a poor player cannot leave them alone. */
const TEMPTED: Record<Skill, number> = { 1: 0.3, 2: 0.18, 3: 0.06, 4: 0, 5: 0 }

/**
 * What she rolls for. `need` is what each ball she has left must average for her to catch
 * whoever is ahead, nothing where she leads. Needing more than the middle rings pay she goes
 * for a corner, and needing more than a 40 for the 50; otherwise it is her usual ring, unless a
 * corner tempts her. The dice are asked only where she can be tempted.
 */
export function herTarget(skill: Skill, need: number, rand: () => number = Math.random): number {
  if (need > 50) return 100
  if (TEMPTED[skill] > 0 && rand() < TEMPTED[skill]) return 100
  if (need > 40) return 50
  return HOME[skill]
}

/** Her roll at a ring: its middle, less what her hand takes off it. A corner is either corner. */
export function herRoll(skill: Skill, need: number, rand: () => number = Math.random): Rolled {
  const value = herTarget(skill, need, rand)
  const rings = RINGS.filter((ring) => ring.value === value)
  const ring = rings.length > 1 ? rings[rand() < 0.5 ? 0 : 1] : rings[0]
  const x = ring.x + bell(rand) * SCATTER[skill]
  const y = ring.y + bell(rand) * SCATTER[skill] * WEIGHT_SCATTER
  return { ...landOn(x, y, rand), ...stopsFor(x, y), sought: value }
}

/** Where the game is: whose ball is next, which of their balls it is, and whether it is over. */
export interface Table {
  /** 0 the reader, then the girls in their order. */
  who: number
  /** Which ball of theirs, from 0. */
  ball: number
  over: boolean
}

/** Everyone rolls one ball in turn, the reader first, until each has rolled `balls`. */
export function tableOf(rolls: readonly Roll[], balls: number, girls: number): Table {
  const players = girls + 1
  return {
    who: rolls.length % players,
    ball: Math.floor(rolls.length / players),
    over: rolls.length >= players * balls
  }
}

/** One player's scores, in the order rolled. */
export function scoresOf(rolls: readonly Roll[], who: number): number[] {
  return rolls.filter((roll) => roll.who === who).map((roll) => roll.score)
}

const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0)

/** Everyone's total, the reader's first. */
export function totalsOf(rolls: readonly Roll[], girls: number): number[] {
  return Array.from({ length: girls + 1 }, (_, who) => sum(scoresOf(rolls, who)))
}

/** Who is ahead on their own, or null where the top is shared. */
export function leaderOf(totals: readonly number[]): number | null {
  const best = Math.max(...totals)
  const top = totals.flatMap((total, who) => (total === best ? [who] : []))
  return top.length === 1 ? top[0] : null
}

/**
 * Who led on their own after each full round, everyone having rolled the same number of balls:
 * the only fair moment to ask, since the reader is always a ball ahead inside a round.
 */
export function leadsOf(rolls: readonly Roll[], girls: number): (number | null)[] {
  const players = girls + 1
  const rounds = Math.floor(rolls.length / players)
  return Array.from({ length: rounds }, (_, round) => leaderOf(totalsOf(rolls.slice(0, (round + 1) * players), girls)))
}

/** How many times the lead passed from one player to another, level rounds between not counting. */
export function leadChanges(leads: readonly (number | null)[]): number {
  const held = leads.filter((lead) => lead !== null)
  return held.filter((lead, k) => k > 0 && lead !== held[k - 1]).length
}

/**
 * What each ball a player has left must average to catch the best of the others as it stands;
 * nothing where nobody is ahead of them.
 */
export function needOf(rolls: readonly Roll[], who: number, balls: number, girls: number): number {
  const totals = totalsOf(rolls, girls)
  const left = balls - scoresOf(rolls, who).length
  const behind = Math.max(...totals.filter((_, other) => other !== who), 0) - totals[who]
  return left > 0 && behind > 0 ? behind / left : 0
}

export type Outcome = 'won' | 'lost' | 'draw' | 'played'

/** The reader's result: a win only with the top total to himself; alone there is nobody to beat. */
export function outcomeOf(totals: readonly number[]): Outcome {
  if (totals.length === 1) return 'played'
  const best = Math.max(...totals)
  if (totals[0] < best) return 'lost'
  return totals.filter((total) => total === best).length === 1 ? 'won' : 'draw'
}

/** Whether the last round, one ball each, can still change who is on top: within a corner pocket's reach. */
export function stillOpen(totals: readonly number[]): boolean {
  if (totals.length < 2) return false
  const [first, second] = [...totals].sort((a, b) => b - a)
  return first - second <= 100 - GUTTER
}

/** A moment worth a word from one of the girls. */
export type Moment = 'hundred' | 'gutter' | 'lead' | 'decider'

export interface RollTold {
  /** The roll in a few words, for the dialogue box. */
  narration: string
  /** A plain account of it, for whoever remarks on it. */
  cue: string
  moments: Moment[]
}

const times = (count: number, what: string): string => `${count} ${what}${count === 1 ? '' : 's'}`

/** What a ring is called. */
const ringName = (value: number): string => (value === 100 ? 'a corner pocket' : `the ${value}`)

/** How a ball ended, after "the ball" or a name's roll. */
function endTold(roll: Roll): string {
  const ring = roll.ring ? ringName(roll.ring.value) : ''
  switch (roll.kind) {
    case 'in':
      return roll.score === 100 ? 'drops clean into a corner pocket' : `drops into ${ring}`
    case 'rim-in':
      return `circles the rim of ${ring} and drops in`
    case 'rim-out':
      return `catches the rim of ${ring} and spills out to the gutter`
    case 'short':
      return 'dies short of the board and falls in the gutter'
    case 'back':
      return 'bangs off the back wall and runs down to the gutter'
    default:
      return 'lands between the rings and runs down to the gutter'
  }
}

/** The same for the scene's writer, with what was skill and what was luck. */
function playTold(roll: Roll): string {
  const meant = roll.sought === null ? 'at nothing in particular' : `for ${ringName(roll.sought)}`
  switch (roll.kind) {
    case 'in':
      return roll.sought === roll.score
        ? `rolled ${meant} and landed it`
        : `rolled ${meant} and it found ${ringName(roll.score)} instead`
    case 'rim-in':
      return `rolled ${meant}; the ball sat on the rim of ${ringName(roll.score)} and dropped in: a kind bounce`
    case 'rim-out':
      return `rolled ${meant}; the ball sat on the rim of ${ringName(roll.ring?.value ?? 0)} and spilled out to the gutter: an unkind bounce`
    case 'short':
      return `rolled ${meant}, far too soft: short of the board, into the gutter`
    case 'back':
      return `rolled ${meant}, far too hard: off the back wall, into the gutter`
    default:
      return `rolled ${meant} and missed everything: down the board to the gutter`
  }
}

/** The totals as a clause: "the reader 120, Ana 90". */
function standing(who: readonly string[], totals: readonly number[]): string {
  return who.map((name, k) => `${name} ${totals[k]}`).join(', ')
}

/**
 * The last roll, told: a line for the box, a cue for a remark, and what makes it worth one. A
 * 100, a gutter ball, the lead changing hands as a round closes, and the last round coming with
 * the game still open.
 */
export function rollTold(names: readonly string[], rolls: readonly Roll[], balls: number): RollTold {
  const girls = names.length
  const players = girls + 1
  const roll = rolls[rolls.length - 1]
  const totals = totalsOf(rolls, girls)
  const mine = roll.who === 0
  const name = mine ? 'You' : names[roll.who - 1]
  const who = ['the reader', ...names]
  const total = totals[roll.who]
  const first = scoresOf(rolls, roll.who).length === 1

  const narration = `${mine ? 'Your' : `${name}'s`} ball ${endTold(roll)}: ${roll.score}${roll.score === 100 ? '!' : '.'}${first ? '' : ` ${total} so far.`}`

  const moments: Moment[] = []
  if (roll.score === 100) moments.push('hundred')
  if (roll.score === GUTTER) moments.push('gutter')
  const parts = [`${who[roll.who][0].toUpperCase()}${who[roll.who].slice(1)} ${playTold(roll)}, for ${roll.score}.`]

  const roundDone = rolls.length % players === 0
  const round = rolls.length / players
  if (girls > 0 && roundDone) {
    const leads = leadsOf(rolls, girls)
    const now = leads[leads.length - 1]
    const before = leads.slice(0, -1).filter((lead) => lead !== null).pop()
    if (now !== null && before !== undefined && before !== now) {
      moments.push('lead')
      parts.push(`That round took the lead from ${who[before]}: ${who[now]} is in front now.`)
    }
    if (round === balls - 1 && stillOpen(totals)) {
      moments.push('decider')
      parts.push('One ball each is left and it is still anybody\'s: the last ball decides it.')
    }
  }
  if (girls > 0) parts.push(`The totals: ${standing(who, totals)}.`)
  return { narration, cue: parts.join(' '), moments }
}

/**
 * The game so far, for the scene's writer should the reader walk away from it: what is being
 * played, everyone's total and how many balls each has left.
 */
export function progressTold(names: readonly string[], rolls: readonly Roll[], balls: number): string[] {
  const who = ['the reader', ...names]
  const totals = totalsOf(rolls, names.length)
  const each = who.map((name, k) => {
    const rolled = scoresOf(rolls, k).length
    return `${name} ${totals[k]} after ${times(rolled, 'ball')}, ${balls - rolled} left`
  })
  return [
    names.length === 0
      ? `The reader was rolling ${times(balls, 'ball')} of Skee-Ball alone.`
      : `They were rolling ${times(balls, 'ball')} each at Skee-Ball, one ball each in turn, the reader first.`,
    `So far: ${each.join('; ')}.`
  ]
}

/** How one player's game went, counted. */
export interface Tally {
  scores: number[]
  total: number
  hundreds: number
  gutters: number
  /** Balls rolled for a corner pocket, and what they scored between them. */
  corners: number
  cornerPoints: number
  /** Balls a rim settled: dropped in, and spilled out. */
  kind: number
  unkind: number
}

export function tallyOf(rolls: readonly Roll[], who: number): Tally {
  const own = rolls.filter((roll) => roll.who === who)
  const corners = own.filter((roll) => roll.sought === 100)
  return {
    scores: own.map((roll) => roll.score),
    total: sum(own.map((roll) => roll.score)),
    hundreds: own.filter((roll) => roll.score === 100).length,
    gutters: own.filter((roll) => roll.score === GUTTER).length,
    corners: corners.length,
    cornerPoints: sum(corners.map((roll) => roll.score)),
    kind: own.filter((roll) => roll.kind === 'rim-in').length,
    unkind: own.filter((roll) => roll.kind === 'rim-out').length
  }
}

/** A player's balls in a line, each gutter ball with why. */
function ballsLine(name: string, rolls: readonly Roll[], who: number): string {
  const why: Partial<Record<RollKind, string>> = {
    'rim-in': 'off the rim, lucky',
    'rim-out': 'rimmed out, unlucky',
    short: 'short',
    back: 'too hard',
    between: 'missed'
  }
  const own = rolls.filter((roll) => roll.who === who)
  const each = own.map((roll) => {
    const notes = [roll.sought === 100 && roll.score !== 100 ? 'going for a corner' : '', why[roll.kind] ?? ''].filter(Boolean)
    return `${roll.score}${notes.length ? ` (${notes.join(', ')})` : ''}`
  })
  const tally = tallyOf(rolls, who)
  return `${name}: ${each.join(', ')}. Total ${tally.total}; ${times(tally.hundreds, '100')}, ${times(tally.gutters, 'gutter ball')}.`
}

/** What a safe ball up the middle is worth, to weigh a gamble against. */
const SAFE_BALL = 40

/** Whether a player went for the corners or stayed in the middle, and whether it paid. */
function approachTold(name: string, tally: Tally): string {
  const rolled = tally.scores.length
  if (tally.corners === 0) return `${name} played it safe up the middle and never went for a corner pocket.`
  const made = tally.hundreds
  const each = Math.round(tally.cornerPoints / tally.corners)
  const paid =
    each > SAFE_BALL
      ? `it paid: those balls averaged ${each}, better than a safe 40`
      : each === SAFE_BALL
        ? 'it came out even with playing safe'
        : `it did not pay: those balls averaged ${each}, worse than a safe 40`
  const how = tally.corners * 2 > rolled ? 'went for the corner pockets most of the game' : 'gambled on a corner pocket'
  return `${name} ${how}: ${times(tally.corners, 'ball')} of ${rolled} at the 100s, ${made} made; ${paid}.`
}

/** Where the rims helped and hurt a player; nothing where they did neither. */
function luckTold(name: string, tally: Tally): string[] {
  if (tally.kind === 0 && tally.unkind === 0) return []
  return [`Luck on the rims for ${name}: ${tally.kind} dropped in, ${tally.unkind} spilled out; the rest was the roll itself.`]
}

/** A game alone, as the scene tells it. */
export function soloSummary(rolls: readonly Roll[]): string {
  const tally = tallyOf(rolls, 0)
  const extras = [
    tally.hundreds ? `${times(tally.hundreds, 'ball')} in a corner pocket` : '',
    tally.gutters ? `${times(tally.gutters, 'ball')} in the gutter` : ''
  ].filter(Boolean)
  return `You roll ${times(tally.scores.length, 'ball')} of Skee-Ball and score ${tally.total}${extras.length ? `, with ${extras.join(' and ')}` : ''}.`
}

/** A game alone, for the scene's writer. */
export function soloAccount(rolls: readonly Roll[]): string[] {
  const tally = tallyOf(rolls, 0)
  const best = tally.scores.length * 50
  return [
    `The reader rolled ${times(tally.scores.length, 'ball')} of Skee-Ball alone: rings from 20 to 50 up the middle, two small 100 pockets in the top corners, 10 for the gutter.`,
    ballsLine('The reader', rolls, 0),
    approachTold('The reader', tally),
    ...luckTold('the reader', tally),
    `Final score ${tally.total}: ${tally.total >= best * 0.8 ? 'a very good card' : tally.total >= best * 0.6 ? 'a decent card' : tally.total >= best * 0.4 ? 'a middling card' : 'a poor card'}, where steady 40s would have made ${tally.scores.length * SAFE_BALL}.`
  ]
}

const ORDINAL = ['first', 'second', 'third', 'fourth'] as const

/** A game with company, as the scene tells it: who won, and everyone's total. */
export function versusSummary(names: readonly string[], totals: readonly number[]): string {
  const against = `You play Skee-Ball against ${listed(names)}`
  if (names.length === 1) {
    const [mine, hers] = totals
    if (mine === hers) return `${against} and it ends level, ${mine} each.`
    return `${against} and ${mine > hers ? 'win' : 'lose'}, ${mine} to ${hers}.`
  }
  const who = ['you', ...names]
  const order = who.map((_, k) => k).sort((a, b) => totals[b] - totals[a] || a - b)
  const board = order.map((k) => `${who[k]} ${totals[k]}`).join(', ')
  const best = totals[order[0]]
  const top = order.filter((k) => totals[k] === best)
  if (top.includes(0)) {
    if (top.length === 1) return `${against} and win: ${board}.`
    return `${against} and share the top score with ${listed(top.filter((k) => k !== 0).map((k) => who[k]))}: ${board}.`
  }
  const place = totals.filter((total) => total > totals[0]).length
  const winners = listed(top.map((k) => who[k]))
  return `${against} and finish ${ORDINAL[place]}; ${winners} ${top.length === 1 ? 'wins' : 'share the win'}: ${board}.`
}

/** A game with company, for the scene's writer: everyone's balls, who led, the gambles and the luck. */
export function versusAccount(names: readonly string[], rolls: readonly Roll[], balls: number): string[] {
  const girls = names.length
  const who = ['the reader', ...names]
  const totals = totalsOf(rolls, girls)
  const leads = leadsOf(rolls, girls)
  const held = leads.filter((lead) => lead !== null)
  const changes = leadChanges(leads)
  const led =
    held.length === 0
      ? 'Nobody led alone after any round.'
      : changes === 0
        ? `${who[held[0]][0].toUpperCase()}${who[held[0]].slice(1)} led after every round that had a leader.`
        : `The lead changed hands ${times(changes, 'time')}; ${who[held[held.length - 1]]} had it last.`

  const best = Math.max(...totals)
  const top = who.filter((_, k) => totals[k] === best)
  const [first, second] = [...totals].sort((a, b) => b - a)
  const gap = first - second
  const ending =
    top.length > 1
      ? `${listed(top)} shared the top score, a draw between them`
      : `${top[0]} won by ${gap}, ${gap <= 20 ? 'as close as it gets' : gap <= 60 ? 'a close game' : 'comfortably'}`
  // The last ball settled it where the winner was not already out of reach going into the last round.
  const before = totalsOf(rolls.slice(0, (balls - 1) * (girls + 1)), girls)
  const late = balls > 1 && stillOpen(before) ? ' It was still open going into the last ball each.' : ''

  return [
    `They rolled ${times(balls, 'ball')} each at Skee-Ball, one ball each in turn, the reader first: rings from 20 to 50 up the middle, two small 100 pockets in the top corners, 10 for the gutter.`,
    ...who.map((name, k) => ballsLine(`${name[0].toUpperCase()}${name.slice(1)}`, rolls, k)),
    led,
    approachTold('The reader', tallyOf(rolls, 0)),
    ...names.flatMap((name, k) => (tallyOf(rolls, k + 1).corners > 0 ? [approachTold(name, tallyOf(rolls, k + 1))] : [])),
    ...who.flatMap((name, k) => luckTold(name, tallyOf(rolls, k))),
    `Final score: ${standing(who, totals)}: ${ending}.${late}`
  ]
}
