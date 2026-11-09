/** Beer Pong's rules: the racks, a throw and where it lands, the turns, how she throws and how a game is told. */

import { listed } from '../minigameKit'

/** Everything is measured in cup widths: a cup is 1 across, and neighbours in a rack touch. */
/** How near a cup's middle a ball must land to drop straight in. */
export const SINK = 0.34
/** How near to catch the rim, which may bounce it in or out. */
export const RIM = 0.6
/** Half the table's width. */
export const HALF_WIDTH = 3.2
/** How far behind the front cup the table ends. */
export const BACK_EDGE = 4.2
/** How far either side of the middle a full aim reaches. */
export const AIM_REACH = 2.4
/** Where the weakest throw lands, in front of the front cup, and how much farther a full one goes. */
export const NEAR = -1.5
export const DEPTH = 6
/** The gap between rows of a rack. */
const ROW = 0.866

/** A cup on the table, in its own rack's frame: x across, y back from the front cup. */
export interface Cup {
  id: number
  x: number
  y: number
}

/** A triangle of 3, 6 or 10 cups, its point toward the thrower. */
export function rackOf(count: number): Cup[] {
  const rows = count >= 10 ? 4 : count >= 6 ? 3 : 2
  const cups: Cup[] = []
  for (let row = 0; row < rows; row++) {
    for (let i = 0; i <= row; i++) cups.push({ id: cups.length + 1, x: i - row / 2, y: row * ROW })
  }
  return cups
}

/** How many cups a side racks, from the option: 1 is six, 2 is ten. */
export function cupsFor(option: number): number {
  return option === 2 ? 10 : 6
}

/** The tight shapes a re-rack makes of 4, 3 or 2 cups. */
const TIGHT: Record<number, readonly [number, number][]> = {
  4: [[0, 0], [-0.5, ROW], [0.5, ROW], [0, 2 * ROW]],
  3: [[0, 0], [-0.5, ROW], [0.5, ROW]],
  2: [[0, 0], [0, 1]]
}

/** The same cups pulled together in the middle of the rack. */
export function tightened(cups: readonly Cup[]): Cup[] {
  const shape = TIGHT[cups.length]
  if (!shape) return [...cups]
  return [...cups].sort((a, b) => a.id - b.id).map((cup, i) => ({ id: cup.id, x: shape[i][0], y: shape[i][1] + 0.4 }))
}

/** How many cups stand with no other touching them. */
export function strays(cups: readonly Cup[]): number {
  return cups.filter((cup) => !cups.some((other) => other !== cup && Math.hypot(other.x - cup.x, other.y - cup.y) < 1.05)).length
}

/** A throw as it is made: two things, each stopped by hand. */
export interface Throw {
  /** Across the cups, -1 (far left) to 1 (far right). */
  aim: number
  /** The arc, 0 (drops short) to 1 (sails long). */
  power: number
}

export interface Point {
  x: number
  y: number
}

/** Where a throw comes down, in the frame of the rack thrown at. */
export function landingOf(thrown: Throw): Point {
  return { x: thrown.aim * AIM_REACH, y: NEAR + thrown.power * DEPTH }
}

/** The throw that comes down at a point. */
export function throwAt(point: Point): Throw {
  return { aim: clamp(point.x / AIM_REACH, -1, 1), power: clamp((point.y - NEAR) / DEPTH, 0, 1) }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

/**
 * What became of a ball. `sunk` dropped straight in; `rim-in` and `rim-out` caught a rim and
 * went the one way or the other; `miss` found the table and `off` did not.
 */
export type Landing = 'sunk' | 'rim-in' | 'rim-out' | 'miss' | 'off'

export interface Landed {
  kind: Landing
  /** The cup it went into or off the rim of. */
  cup: Cup | null
  /** How far from the middle of the nearest cup it came down; nothing with no cups. */
  error: number
}

/**
 * Where a ball coming down at `point` ends up among `cups`. Only a rim asks the random source:
 * the nearer the middle it caught, the likelier it drops.
 */
export function resolve(point: Point, cups: readonly Cup[], rand: () => number = Math.random): Landed {
  let cup: Cup | null = null
  let error = Infinity
  for (const each of cups) {
    const far = Math.hypot(each.x - point.x, each.y - point.y)
    if (far < error) {
      error = far
      cup = each
    }
  }
  if (cup && error <= SINK) return { kind: 'sunk', cup, error }
  if (cup && error <= RIM) {
    const chance = 0.1 + (0.55 * (RIM - error)) / (RIM - SINK)
    return { kind: rand() < chance ? 'rim-in' : 'rim-out', cup, error }
  }
  const off = Math.abs(point.x) > HALF_WIDTH || point.y > BACK_EDGE
  return { kind: off ? 'off' : 'miss', cup: null, error }
}

/** Whether a ball ended in a cup. */
export function dropped(kind: Landing): boolean {
  return kind === 'sunk' || kind === 'rim-in'
}

/** How a girl throws, from 1 (hopeless) to 5 (hard to beat). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** How far her ball strays from where she meant it, in cup widths, by skill. */
const SCATTER: Record<Skill, number> = { 1: 1.6, 2: 1.2, 3: 0.9, 4: 0.66, 5: 0.46 }

/** The most the drink does to anyone: the game stays playable. */
export const TIPSY_CAP = 1
/** Cups each, on a side, that bring it to the cap. */
const CUPS_TO_CAP = 6

/** How far gone a side is, 0 to 1, from the cups it has drunk shared among its members. */
export function tipsiness(drunk: number, members: number): number {
  return Math.min(TIPSY_CAP, drunk / Math.max(1, members) / CUPS_TO_CAP)
}

/** How much faster the reader's sweeps run at a tipsiness. */
export function sweepSpeed(tipsy: number): number {
  return 1 + 0.25 * tipsy
}

/** How far the reader's marker wobbles about its sweep, as a share of the sweep. */
export function sweepWobble(tipsy: number): number {
  return 0.03 * tipsy
}

/** How far the reader's ball strays from where his two stops put it, in cup widths, sober. */
export const HAND = 0.6

/** How far the reader's ball strays at a tipsiness: a hand is never quite the eye, and less so with drink. */
export function handScatter(tipsy: number): number {
  return HAND * (1 + 0.3 * tipsy)
}

/** How far her ball strays at a skill and a tipsiness. */
export function scatterOf(skill: Skill, tipsy: number): number {
  return SCATTER[skill] * (1 + 0.45 * tipsy)
}

/** A draw from a bell curve about zero, from two of the injected random's. */
function bell(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand() * 0.999999)) * Math.cos(2 * Math.PI * rand())
}

/** The cup worth throwing at: the one with most cups touching it, so a near miss may still drop; the front-most of those. */
export function bestCup(cups: readonly Cup[]): Cup | null {
  const touching = (cup: Cup): number =>
    cups.filter((other) => other !== cup && Math.hypot(other.x - cup.x, other.y - cup.y) < 1.05).length
  return [...cups].sort((a, b) => touching(b) - touching(a) || a.y - b.y || Math.abs(a.x) - Math.abs(b.x) || a.id - b.id)[0] ?? null
}

/** Where she means her ball to come down. A good player picks a cup; a poor one lobs at the middle of whatever is standing. */
export function herTarget(cups: readonly Cup[], skill: Skill): Point {
  const best = bestCup(cups)
  if (!best) return { x: 0, y: 0 }
  const middle = {
    x: cups.reduce((sum, cup) => sum + cup.x, 0) / cups.length,
    y: cups.reduce((sum, cup) => sum + cup.y, 0) / cups.length
  }
  const vague = skill === 1 ? 1 : skill === 2 ? 0.5 : 0
  return { x: best.x + (middle.x - best.x) * vague, y: best.y + (middle.y - best.y) * vague }
}

/** Her throw at the cups standing, at her skill and her side's tipsiness. */
export function herThrow(cups: readonly Cup[], skill: Skill, tipsy: number, rand: () => number = Math.random): Throw {
  const target = herTarget(cups, skill)
  const stray = scatterOf(skill, tipsy)
  return throwAt({ x: target.x + bell(rand) * stray, y: target.y + bell(rand) * stray })
}

/** The reader's throw as it leaves his hand: where his two stops put it, less what the hand and the drink take off it. */
export function readerThrow(stopped: Throw, tipsy: number, rand: () => number = Math.random): Throw {
  const meant = landingOf(stopped)
  const stray = handScatter(tipsy)
  return throwAt({ x: meant.x + bell(rand) * stray, y: meant.y + bell(rand) * stray })
}

/** One side of the table. */
export interface Side {
  /** Who is on it: 0 is the reader, then the girls in seat order from 1. */
  members: readonly number[]
  /** Its own cups, which the other side throws at. */
  cups: readonly Cup[]
  /** It has had its one re-rack of the cups it throws at. */
  reracked: boolean
  /** Which of its members throws next. */
  up: number
}

/** One throw of a game. */
export interface Shot {
  who: number
  side: 0 | 1
  /** The turn it was part of, from 1. */
  turn: number
  thrown: Throw
  point: Point
  kind: Landing
  cup: Cup | null
  error: number
  /** Cups the side thrown at had left afterwards. */
  left: number
  /** Who drank the cup, where one went. */
  drinker: number | null
  /** It was thrown in a redemption. */
  redemption: boolean
  /** It was the second of two sunk in a turn, and earned the balls back. */
  ballsBack: boolean
  /** It cleared the other side's cups, which now has its redemption. */
  cleared: boolean
  /** It cleared the rest in a redemption and forced overtime. */
  overtime: boolean
  /** It ended the game. */
  final: boolean
}

export interface Rerack {
  /** The side that asked for it. */
  side: 0 | 1
  /** How many throws had been made. */
  at: number
  cups: number
}

/** A game between throws. */
export interface Game {
  /** How many cups a side started with. */
  racked: number
  sides: readonly [Side, Side]
  /** Cups drunk, by person. */
  drinks: readonly number[]
  /** The side throwing. */
  turn: 0 | 1
  turnNo: number
  /** Throws made and sunk since the turn began or the balls came back. */
  thrown: number
  sunk: number
  /** The balls have come back once this turn already. */
  ballsBack: boolean
  /** The side that cleared the other's cups, while the other has its redemption. */
  leader: 0 | 1 | null
  /** How many overtimes have been forced. */
  overtimes: number
  log: readonly Shot[]
  reracks: readonly Rerack[]
  winner: 0 | 1 | null
}

/**
 * Who is on which side. One girl: the reader against her. Two: the reader against the pair.
 * Three: the reader and the first girl against the other two.
 */
export function teamsOf(girls: number): [number[], number[]] {
  if (girls >= 3) return [[0, 1], [2, 3]]
  if (girls === 2) return [[0], [1, 2]]
  return [[0], [1]]
}

/** A game about to start: full racks, the reader's side to throw. */
export function newGame(girls: number, cups: number): Game {
  const [ours, theirs] = teamsOf(girls)
  const side = (members: number[]): Side => ({ members, cups: rackOf(cups), reracked: false, up: 0 })
  return {
    racked: cups,
    sides: [side(ours), side(theirs)],
    drinks: Array<number>(ours.length + theirs.length).fill(0),
    turn: 0,
    turnNo: 1,
    thrown: 0,
    sunk: 0,
    ballsBack: false,
    leader: null,
    overtimes: 0,
    log: [],
    reracks: [],
    winner: null
  }
}

/** Whose throw is next. */
export function throwerOf(game: Game): number {
  const side = game.sides[game.turn]
  return side.members[side.up % side.members.length]
}

/** How far gone a side is. */
export function tipsyOf(game: Game, side: 0 | 1): number {
  const members = game.sides[side].members
  return tipsiness(members.reduce((sum, who) => sum + game.drinks[who], 0), members.length)
}

/** Whether a side may have the cups it throws at re-racked now: once a game, at 4, 3 or 2 cups, on its own turn. */
export function canRerack(game: Game, side: 0 | 1): boolean {
  const left = game.sides[side === 0 ? 1 : 0].cups.length
  return game.winner === null && game.turn === side && !game.sides[side].reracked && left >= 2 && left <= 4
}

/** The cups a side throws at pulled together, and its re-rack spent. */
export function rerack(game: Game, side: 0 | 1): Game {
  if (!canRerack(game, side)) return game
  const other = side === 0 ? 1 : 0
  const sides = game.sides.map((each, i) =>
    i === side ? { ...each, reracked: true } : i === other ? { ...each, cups: tightened(each.cups) } : each
  ) as unknown as [Side, Side]
  return { ...game, sides, reracks: [...game.reracks, { side, at: game.log.length, cups: game.sides[other].cups.length }] }
}

/**
 * Whether she asks for her re-rack now: the cups are scattered, so pulling them together is
 * worth it. At four she waits unless two stand alone; at three or two, any stray is enough.
 */
export function herRerack(game: Game, side: 0 | 1): boolean {
  if (!canRerack(game, side)) return false
  const cups = game.sides[side === 0 ? 1 : 0].cups
  return strays(cups) >= (cups.length === 4 ? 2 : 1)
}

/**
 * The game after the next throw, which is the last of its `log`. A turn is two throws; both
 * sunk brings the balls back, once. Clearing the other side's cups gives it a redemption: it
 * throws until it misses, and clearing the rest forces a three-cup overtime.
 */
export function throwBall(game: Game, thrown: Throw, rand: () => number = Math.random): Game {
  if (game.winner !== null) return game
  const side = game.turn
  const other: 0 | 1 = side === 0 ? 1 : 0
  const who = throwerOf(game)
  const point = landingOf(thrown)
  const landed = resolve(point, game.sides[other].cups, rand)
  const hit = dropped(landed.kind)

  let cups = game.sides[other].cups
  const drinks = [...game.drinks]
  let drinker: number | null = null
  if (hit && landed.cup) {
    cups = cups.filter((cup) => cup.id !== landed.cup?.id)
    // The cup goes to whoever on that side has drunk least, the first of them.
    drinker = [...game.sides[other].members].sort((a, b) => drinks[a] - drinks[b])[0]
    drinks[drinker]++
  }

  const shot: Shot = {
    who,
    side,
    turn: game.turnNo,
    thrown,
    point,
    kind: landed.kind,
    cup: landed.cup,
    error: landed.error,
    left: cups.length,
    drinker,
    redemption: game.leader !== null,
    ballsBack: false,
    cleared: false,
    overtime: false,
    final: false
  }
  let sides = game.sides.map((each, i) =>
    i === side ? { ...each, up: (each.up + 1) % each.members.length } : { ...each, cups }
  ) as unknown as [Side, Side]
  const next: Game = { ...game, sides, drinks, thrown: game.thrown + 1, sunk: game.sunk + (hit ? 1 : 0) }
  const pass = (to: 0 | 1): Partial<Game> => ({ turn: to, turnNo: game.turnNo + 1, thrown: 0, sunk: 0, ballsBack: false })

  let change: Partial<Game>
  if (game.leader !== null) {
    if (!hit) {
      shot.final = true
      change = { winner: game.leader }
    } else if (cups.length === 0) {
      // Redemption made: three cups each, and the side that cleared first throws.
      shot.overtime = true
      sides = sides.map((each) => ({ ...each, cups: rackOf(3) })) as unknown as [Side, Side]
      change = { ...pass(game.leader), sides, leader: null, overtimes: game.overtimes + 1 }
    } else change = {}
  } else if (cups.length === 0) {
    shot.cleared = true
    change = { ...pass(other), leader: side }
  } else if (next.thrown >= 2) {
    if (next.sunk >= 2 && !game.ballsBack) {
      shot.ballsBack = true
      change = { thrown: 0, sunk: 0, ballsBack: true }
    } else change = pass(other)
  } else change = {}

  return { ...next, ...change, log: [...game.log, shot] }
}

/** How someone is to be played after the cups they drank. */
export function drinkState(cups: number): 'sober' | 'buzzed' | 'tipsy' {
  return cups >= 4 ? 'tipsy' : cups >= 2 ? 'buzzed' : 'sober'
}

/** The reader's result: his side's. There is always a winner. */
export function outcomeOf(game: Game): 'won' | 'lost' {
  return game.winner === 0 ? 'won' : 'lost'
}

type Voice = 'you' | 'reader'

/** What someone is called: the reader as the narration or the account has him, a girl by her name. */
function called(names: readonly string[], who: number, voice: Voice): string {
  return who === 0 ? (voice === 'you' ? 'you' : 'the reader') : (names[who - 1] ?? 'her')
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** A side by its members' names: "you and Ana", "Bea and Cy". */
export function teamName(names: readonly string[], members: readonly number[], voice: Voice = 'you'): string {
  return listed(members.map((who) => called(names, who, voice)))
}

const cupsWord = (count: number): string => `${count === 0 ? 'no' : count} cup${count === 1 ? '' : 's'}`

/** How the sides are made, in a clause. */
export function sidesTold(names: readonly string[], game: Game, voice: Voice = 'you'): string {
  return `${teamName(names, game.sides[0].members, voice)} against ${teamName(names, game.sides[1].members, voice)}`
}

const HOW: Record<Landing, string> = {
  sunk: 'straight in the cup',
  'rim-in': 'off the rim and in',
  'rim-out': 'off the rim and out',
  miss: 'onto the table, no cup',
  off: 'off the table'
}

/** Where a clean miss went, from the nearest cup. */
function missTold(shot: Shot): string {
  if (shot.point.y < -RIM) return 'short, onto the table'
  if (Math.abs(shot.point.x) > 1.5 + RIM) return 'wide, onto the table'
  return 'between the cups, onto the table'
}

/** A throw as it is told: the line of narration, the cue for a remark, and what makes it a moment. */
export interface ShotTold {
  narration: string
  cue: string
  /** What is notable about it, if anything. */
  moments: readonly ('rim-in' | 'balls-back' | 'last-cup' | 'redemption' | 'overtime' | 'tipsy')[]
  /** A cup went. */
  hit: boolean
}

/** The last throw of a game, told. `names` are the girls', in seat order. */
export function shotTold(names: readonly string[], game: Game): ShotTold {
  const shot = game.log[game.log.length - 1]
  const other: 0 | 1 = shot.side === 0 ? 1 : 0
  const hit = dropped(shot.kind)
  const moments: ShotTold['moments'][number][] = []
  const told = (voice: Voice): string => {
    const thrower = called(names, shot.who, voice)
    const them = teamName(names, game.sides[other].members, voice)
    const us = teamName(names, game.sides[shot.side].members, voice)
    const verb = (name: string, one: string, many: string): string =>
      name === 'you' || name.includes(' and ') ? many : one
    const parts = [`${capital(thrower)} ${verb(thrower, 'throws', 'throw')}: ${shot.kind === 'miss' ? missTold(shot) : HOW[shot.kind]}.`]
    if (hit) {
      const drinker = called(names, shot.drinker ?? 0, voice)
      parts.push(`${capital(drinker)} ${verb(drinker, 'drinks', 'drink')}.`)
    }
    if (shot.overtime) parts.push(`That clears the table: redemption made, and it goes to overtime, three cups a side, ${them} to throw.`)
    else if (shot.final) parts.push(shot.redemption ? `The redemption is over: ${them} ${verb(them, 'wins', 'win')}.` : `${capital(us)} ${verb(us, 'wins', 'win')}.`)
    else if (shot.cleared) parts.push(`That is the last of the cups. ${capital(them)} ${verb(them, 'gets', 'get')} a redemption: every throw has to drop.`)
    else {
      parts.push(`${capital(them)} ${verb(them, 'has', 'have')} ${cupsWord(shot.left)} left.`)
      if (shot.ballsBack) parts.push(`Two in a turn: balls back, and ${us} ${verb(us, 'throws', 'throw')} again.`)
    }
    return parts.join(' ')
  }
  if (shot.kind === 'rim-in') moments.push('rim-in')
  if (shot.ballsBack) moments.push('balls-back')
  if (hit && shot.left === 1 && !shot.redemption) moments.push('last-cup')
  if (shot.cleared) moments.push('redemption')
  if (shot.overtime) moments.push('overtime')
  let cue = told('reader')
  if (shot.kind === 'rim-in') cue += ' The rim was kind: luck more than aim.'
  if (shot.kind === 'rim-out') cue += ' Close, and unlucky off the rim.'
  if (hit && shot.left === 1 && !shot.redemption) cue += ' One cup left to win.'
  if (shot.drinker !== null && game.drinks[shot.drinker] === 4) {
    moments.push('tipsy')
    cue += ` ${capital(called(names, shot.drinker, 'reader'))} has drunk four cups now and is plainly getting tipsy.`
  }
  return { narration: told('you'), cue, moments, hit }
}

/** How a game stands, for anything said at the table. */
export function standingTold(names: readonly string[], game: Game): string {
  const [ours, theirs] = game.sides
  const parts = [
    `The game is beer pong, ${game.racked} cups a side, ${sidesTold(names, game, 'reader')}.`,
    `${capital(teamName(names, ours.members, 'reader'))} ${ours.members.length > 1 ? 'have' : 'has'} ${cupsWord(ours.cups.length)} standing, ${teamName(names, theirs.members, 'reader')} ${cupsWord(theirs.cups.length)}.`,
    `Drunk so far: ${drinksTold(names, game, 'reader')}.`
  ]
  if (game.winner !== null) parts.push('The last ball has just been thrown.')
  else if (game.leader !== null) parts.push(`${capital(teamName(names, game.sides[game.turn].members, 'reader'))} ${game.sides[game.turn].members.length > 1 ? 'are' : 'is'} on a redemption: one miss and it is lost.`)
  else parts.push(`It is ${called(names, throwerOf(game), 'reader')} to throw${game.overtimes ? ', in overtime' : ''}.`)
  return parts.join(' ')
}

/** Everyone and the cups they drank. */
export function drinksTold(names: readonly string[], game: Game, voice: Voice, states = false): string {
  return listed(
    game.drinks.map((cups, who) => `${called(names, who, voice)} ${cupsWord(cups)}${states ? ` (${drinkState(cups)})` : ''}`)
  )
}

/** The result as the scene narrates it. */
export function summaryOf(names: readonly string[], game: Game): string {
  const won = game.winner === 0
  const winners = game.sides[game.winner ?? 0]
  const partner = game.sides[0].members.length > 1
  const who = partner ? `${capital(teamName(names, game.sides[0].members))} play` : 'You play'
  const extra = game.overtimes ? ` after ${game.overtimes > 1 ? `${game.overtimes} overtimes` : 'overtime'}` : ''
  const margin = `with ${cupsWord(winners.cups.length)} of ${won ? 'yours' : 'theirs'} still standing`
  return `${who} beer pong against ${teamName(names, game.sides[1].members)} and ${won ? 'win' : 'lose'}${extra}, ${margin}. Drunk along the way: ${drinksTold(names, game, 'you')}.`
}

/** One thrower's game in numbers. */
export interface Tally {
  throws: number
  clean: number
  rimIn: number
  rimOut: number
  /** Longest run of throws that dropped, and of throws that did not. */
  hot: number
  cold: number
}

export function tallyOf(game: Game, who: number): Tally {
  const tally: Tally = { throws: 0, clean: 0, rimIn: 0, rimOut: 0, hot: 0, cold: 0 }
  let hot = 0
  let cold = 0
  for (const shot of game.log) {
    if (shot.who !== who) continue
    tally.throws++
    if (shot.kind === 'sunk') tally.clean++
    if (shot.kind === 'rim-in') tally.rimIn++
    if (shot.kind === 'rim-out') tally.rimOut++
    if (dropped(shot.kind)) {
      hot++
      cold = 0
    } else {
      cold++
      hot = 0
    }
    tally.hot = Math.max(tally.hot, hot)
    tally.cold = Math.max(tally.cold, cold)
  }
  return tally
}

const SHORT: Record<Landing, string> = { sunk: 'in', 'rim-in': 'rim and in', 'rim-out': 'rim and out', miss: 'miss', off: 'off the table' }

/** What the scene's writer is told: the terms, the turns in brief, each thrower's play and luck, the drama, the cups and the drinks. */
export function accountOf(names: readonly string[], game: Game): string[] {
  const name = (who: number): string => called(names, who, 'reader')
  const team = (side: 0 | 1): string => teamName(names, game.sides[side].members, 'reader')
  const lines = [`Beer pong, ${game.racked} cups a side: ${sidesTold(names, game, 'reader')}. Two throws a turn, the reader's side first.`]

  // Turn by turn, with runs of turns where nothing dropped told as one.
  const turns: Shot[][] = []
  for (const shot of game.log) {
    if (turns.length && turns[turns.length - 1][0].turn === shot.turn) turns[turns.length - 1].push(shot)
    else turns.push([shot])
  }
  const brief: string[] = []
  let dryFrom = 0
  const flush = (upTo: number): void => {
    if (!dryFrom) return
    brief.push(dryFrom === upTo ? `Turn ${upTo}: nothing dropped.` : `Turns ${dryFrom} to ${upTo}: nothing dropped for anyone.`)
    dryFrom = 0
  }
  for (const turn of turns) {
    const no = turn[0].turn
    const special = turn.some((shot) => shot.redemption || shot.cleared)
    if (!special && !turn.some((shot) => dropped(shot.kind))) {
      if (!dryFrom) dryFrom = no
      continue
    }
    flush(no - 1)
    const label = turn[0].redemption ? `Turn ${no}, ${team(turn[0].side)}'s redemption` : `Turn ${no}, ${team(turn[0].side)}`
    const tags = [
      ...(turn.some((shot) => shot.ballsBack) ? ['balls back'] : []),
      ...(turn.some((shot) => shot.cleared) ? ['cleared the cups'] : []),
      ...(turn.some((shot) => shot.overtime) ? ['forced overtime'] : []),
      ...(turn.some((shot) => shot.final && shot.redemption) ? ['missed, and it was over'] : [])
    ]
    brief.push(`${label}: ${turn.map((shot) => `${name(shot.who)} ${SHORT[shot.kind]}`).join(', ')}${tags.length ? ` (${tags.join('; ')})` : ''}.`)
  }
  flush(turns.length ? turns[turns.length - 1][0].turn : 0)
  // A long game is summed up: its opening, and how it ended.
  lines.push(...(brief.length > 14 ? [...brief.slice(0, 5), 'The middle of the game went back and forth.', ...brief.slice(-7)] : brief))

  for (const rack of game.reracks) lines.push(`${capital(team(rack.side))} used the re-rack with ${cupsWord(rack.cups)} to throw at.`)

  game.drinks.forEach((_, who) => {
    const tally = tallyOf(game, who)
    if (!tally.throws) return
    const made = tally.clean + tally.rimIn
    const notes = [
      `${capital(name(who))} sank ${made} of ${tally.throws}`,
      ...(made ? [`${tally.clean} clean and ${tally.rimIn} off the rim`] : []),
      ...(tally.rimOut ? [`${tally.rimOut} rimmed out`] : []),
      ...(tally.hot >= 3 ? [`a hot streak of ${tally.hot} in a row`] : []),
      ...(tally.cold >= 5 ? [`a cold spell of ${tally.cold} without a cup`] : [])
    ]
    let verdict = ''
    if (made >= 2 && tally.rimIn * 2 >= made) verdict = ' The rim did much of the work: luck more than aim.'
    else if (tally.rimOut >= 2 && tally.rimOut > tally.rimIn) verdict = ' The aim was better than the count: the rim kept spitting them out.'
    else if (tally.throws >= 4 && made * 2 >= tally.throws) verdict = ' Sharp throwing.'
    else if (tally.throws >= 5 && made === 0) verdict = ' Could not find a cup all game.'
    lines.push(`${notes.join(', ')}.${verdict}`)
  })

  if (game.overtimes) lines.push(`A made redemption forced overtime${game.overtimes > 1 ? ` ${game.overtimes} times` : ''}: three cups a side.`)
  if (game.winner !== null) {
    const loser: 0 | 1 = game.winner === 0 ? 1 : 0
    const last = game.log[game.log.length - 1]
    lines.push(
      `Final: ${team(game.winner)} won with ${cupsWord(game.sides[game.winner].cups.length)} still standing; ${team(loser)}'s redemption ended ${last && dropped(last.kind) ? 'there' : `on a miss by ${name(last.who)}`}.`
    )
  }
  lines.push(`Drinks, a cup each time the other side sank one: ${drinksTold(names, game, 'reader', true)}. Play each of them as that far gone.`)
  return lines
}
