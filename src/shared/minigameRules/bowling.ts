/** Bowling's rules: the lane, a throw, which pins it takes, the scoring and how she throws. */

import { listed } from '../minigameKit'

/** Half the lane's width, in inches: everything across the lane is measured from its middle. */
export const LANE_HALF = 20.75

/** How far either side of the middle the ball may be set down at the foul line. */
export const START_REACH = 17

export interface Pin {
  /** 1 to 10, as a bowler numbers them: the head pin is 1, the back row 7 to 10. */
  id: number
  /** Inches right of the lane's middle. */
  x: number
  /** 0 for the head pin's row to 3 for the back row. */
  row: number
}

/** The ten pins in their triangle, a foot between neighbours. */
export const PINS: readonly Pin[] = [0, 1, 2, 3].flatMap((row) =>
  Array.from({ length: row + 1 }, (_, i): Pin => ({ id: 0, x: (i - row / 2) * 12, row }))
).map((pin, i) => ({ ...pin, id: i + 1 }))

/** A full rack. */
export const ALL_PINS: readonly number[] = PINS.map((pin) => pin.id)

/** A throw as it is made: three things, each stopped by hand. */
export interface Throw {
  /** Where the ball is set down along the foul line, -1 (far left) to 1 (far right). */
  position: number
  /** 0 (a dribble) to 1 (everything she has). */
  power: number
  /** The curve put on it, -1 (hard left) to 1 (hard right). */
  hook: number
}

/** Where a throw ends up when it reaches the pins. */
export interface Path {
  /** Inches right of the middle as it reaches the head pin's row. */
  arriveX: number
  /** How hard it is still moving sideways: inches across per row of pins, over {@link DRIFT}. */
  angle: number
  /** It left the lane before the pins. */
  gutter: boolean
}

/** The most a full hook moves a slow ball across the lane, in inches. */
const HOOK_INCHES = 9
/** How far across one row of pins a ball at angle 1 drifts, in inches. */
export const DRIFT = 2.2

/** How much of its hook a ball keeps at this power: a hard ball skids straighter. */
function bite(power: number): number {
  return 1.25 - 0.5 * power
}

/** A throw's line down the lane: `along` is 0 at the foul line and 1 at the head pin. */
export function ballX(thrown: Throw, along: number): number {
  const x =
    thrown.position * START_REACH + thrown.hook * HOOK_INCHES * bite(thrown.power) * along * along
  // Past the edge it is in the gutter, and stays there.
  return Math.abs(x) > LANE_HALF ? Math.sign(x) * (LANE_HALF + 2.6) : x
}

export function pathOf(thrown: Throw): Path {
  const raw = thrown.position * START_REACH + thrown.hook * HOOK_INCHES * bite(thrown.power)
  return { arriveX: raw, angle: thrown.hook * bite(thrown.power), gutter: Math.abs(raw) > LANE_HALF }
}

/** How near a pin's middle the ball's must pass to hit it. */
const REACH = 5.8

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/**
 * Which pins a ball takes. The ball goes through the rack a row at a time, knocking what is in
 * its reach and glancing off it; every pin that falls is thrown the way it was struck and may
 * take the pin behind it on that side, and so on down the rack. A ball into the pocket sends the
 * head pin one way and goes the other itself, which is the whole rack; one dead on the head pin
 * sends it nowhere in particular and leaves the corners; one out at the edge has nothing behind
 * what it hits. A soft ball carries less and is pushed about more.
 */
export function resolvePins(
  arriveX: number,
  angle: number,
  power: number,
  standing: readonly number[],
  rand: () => number = Math.random
): number[] {
  if (Math.abs(arriveX) > LANE_HALF) return []
  const up = new Set(standing)
  const down: number[] = []
  /** Each fallen pin and the way it was sent: -1 hard left to 1 hard right. */
  const sent: { pin: Pin; lean: number }[] = []
  const fell = (pin: Pin, lean: number): void => {
    if (!up.delete(pin.id)) return
    down.push(pin.id)
    sent.push({ pin, lean })
  }
  const carry = 0.5 + 0.47 * Math.min(1, power / 0.8)

  let x = arriveX
  for (let row = 0; row < 4; row++) {
    for (const pin of PINS) {
      if (pin.row !== row || !up.has(pin.id)) continue
      const off = (pin.x - x) / REACH
      if (Math.abs(off) >= 1) continue
      fell(pin, off)
      // A glancing hit turns the ball the other way; a full one does not turn it at all.
      x -= Math.sign(off) * 4 * Math.abs(off) * (1 - Math.abs(off)) * 2 * (1.3 - power)
    }
    x += angle * DRIFT
  }

  for (let i = 0; i < sent.length; i++) {
    const { pin, lean } = sent[i]
    for (const side of [-1, 1]) {
      const behind = PINS.find((p) => p.row === pin.row + 1 && p.x === pin.x + side * 6)
      if (!behind || !up.has(behind.id)) continue
      if (rand() < carry * clamp(0.58 + 1.1 * lean * side, 0.04, 1)) fell(behind, side * 0.55)
    }
    // Now and then a pin goes off across the deck and takes one nobody aimed at.
    if (up.size > 0 && rand() < 0.07 * carry) {
      const left = PINS.filter((p) => up.has(p.id))
      const struck = left[Math.floor(rand() * left.length)]
      fell(struck, rand() < 0.5 ? -0.5 : 0.5)
    }
  }
  return down.sort((a, b) => a - b)
}

/**
 * Whether what is left standing is a split: the head pin is down and the pins left are in two
 * groups or more with a gap between them.
 */
export function isSplit(standing: readonly number[]): boolean {
  if (standing.length < 2 || standing.includes(1)) return false
  const left = PINS.filter((pin) => standing.includes(pin.id))
  const group = new Set([left[0].id])
  for (let grew = true; grew; ) {
    grew = false
    for (const pin of left) {
      if (group.has(pin.id)) continue
      const near = left.some(
        (other) =>
          group.has(other.id) && Math.hypot(pin.x - other.x, (pin.row - other.row) * 10.4) < 12.5
      )
      if (near) {
        group.add(pin.id)
        grew = true
      }
    }
  }
  return group.size < left.length
}

/** Whether a throw was a good one for the pins it was thrown at, whatever came of it. */
export function wellAimed(thrown: Throw, standing: readonly number[]): boolean {
  const path = pathOf(thrown)
  if (path.gutter || thrown.power < 0.45) return false
  // A full rack: into either pocket, just off the head pin.
  if (standing.length === 10) return Math.abs(path.arriveX) >= 1.5 && Math.abs(path.arriveX) <= 4.8
  // A leave: the ball's line passes close to the middle of a pin that is there.
  return PINS.some(
    (pin) =>
      standing.includes(pin.id) &&
      Math.abs(path.arriveX + path.angle * DRIFT * pin.row - pin.x) < 3.2
  )
}

/** How a girl bowls, from 1 (hopes for the best) to 5 (league night). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** How far her hand strays from what she meant, by skill: along the line, in power, in hook. */
const STRAY: Record<Skill, { position: number; power: number; hook: number }> = {
  1: { position: 0.9, power: 0.22, hook: 0.7 },
  2: { position: 0.55, power: 0.16, hook: 0.38 },
  3: { position: 0.27, power: 0.12, hook: 0.15 },
  4: { position: 0.14, power: 0.08, hook: 0.09 },
  5: { position: 0.08, power: 0.05, hook: 0.05 }
}

/** A draw from a bell curve about zero, from two of the injected random's. */
function bell(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand() * 0.999999)) * Math.cos(2 * Math.PI * rand())
}

/**
 * Her throw at the pins standing. She means the same thing every time: at a full rack the
 * pocket, with a hook once she is good enough to have one, and at a leave the front pin of it,
 * leaning toward the rest. What skill buys is how near her hand comes to what she meant.
 */
export function herThrow(
  standing: readonly number[],
  skill: Skill,
  rand: () => number = Math.random
): Throw {
  const left = PINS.filter((pin) => standing.includes(pin.id))
  const full = left.length === 10 || left.length === 0
  const hook = full && skill >= 3 ? -0.45 : 0
  const power = skill >= 3 ? 0.78 : skill === 2 ? 0.62 : 0.5
  const front = left.filter((pin) => pin.row === Math.min(...left.map((p) => p.row)))
  const mean = (pins: readonly Pin[]): number =>
    pins.reduce((sum, pin) => sum + pin.x, 0) / Math.max(1, pins.length)
  const target = full ? 3 : mean(front) * 0.75 + mean(left) * 0.25
  const meant = (target - hook * HOOK_INCHES * bite(power)) / START_REACH
  const stray = STRAY[skill]
  return {
    position: clamp(meant + bell(rand) * stray.position, -1, 1),
    power: clamp(power + bell(rand) * stray.power, 0.05, 1),
    hook: clamp(hook + bell(rand) * stray.hook, -1, 1)
  }
}

/** Where a bowler stands in her own game, from the pins each of her balls took. */
export interface Rack {
  /** The frame she is on, from 0; the number of frames once she is done. */
  frame: number
  /** Which ball of that frame is next, from 0. */
  ball: number
  /** The next ball is at a full rack. */
  fresh: boolean
  done: boolean
}

/**
 * Where `rolls` leaves a bowler in a game of `frames` frames. Two balls a frame unless the first
 * is a strike; the last frame gives a third for a strike or a spare.
 */
export function rackOf(rolls: readonly number[], frames: number): Rack {
  let i = 0
  for (let frame = 0; frame < frames - 1; frame++) {
    if (i >= rolls.length) return { frame, ball: 0, fresh: true, done: false }
    if (rolls[i] === 10) i += 1
    else if (i + 1 >= rolls.length) return { frame, ball: 1, fresh: false, done: false }
    else i += 2
  }
  const last = rolls.slice(i)
  const frame = frames - 1
  if (last.length === 0) return { frame, ball: 0, fresh: true, done: false }
  if (last.length === 1) return { frame, ball: 1, fresh: last[0] === 10, done: false }
  const earned = last[0] === 10 || last[0] + last[1] === 10
  if (last.length === 2 && earned) {
    return { frame, ball: 2, fresh: last[0] < 10 || last[1] === 10, done: false }
  }
  return { frame: frames, ball: 0, fresh: true, done: true }
}

/** One frame on the scoresheet. */
export interface FrameScore {
  /** Each ball as it is marked: a count, X for a strike, / for a spare, – for nothing. */
  marks: string[]
  /** The running total through this frame, once every ball it counts has been thrown. */
  total: number | null
  /** The same with whatever is still owed counted as nothing: how it stands right now. */
  sofar: number
}

/** A bowler's scoresheet: every frame of the game, the ones not reached yet empty. */
export function sheetOf(rolls: readonly number[], frames: number): FrameScore[] {
  const sheet: FrameScore[] = []
  const at = (i: number): number => rolls[i] ?? 0
  let i = 0
  let running = 0
  let settled = true
  for (let frame = 0; frame < frames; frame++) {
    const lastFrame = frame === frames - 1
    const strike = rolls[i] === 10
    const spare = !strike && i + 1 < rolls.length && at(i) + at(i + 1) === 10
    // The last frame is scored on its own balls; an earlier one borrows from what follows.
    const taken = lastFrame ? (strike || spare ? 3 : 2) : strike ? 1 : 2
    const counted = lastFrame ? taken : strike || spare ? 3 : 2
    const mine = rolls.slice(i, i + taken)

    const marks: string[] = []
    let left = 10
    // A ball at a full rack: all ten of it is a strike, where all of a leave is a spare.
    let fresh = true
    for (const roll of mine) {
      if (roll === left) {
        marks.push(fresh ? 'X' : '/')
        left = 10
        fresh = true
      } else {
        marks.push(roll === 0 ? '–' : String(roll))
        left -= roll
        fresh = false
      }
    }

    for (let k = 0; k < counted; k++) running += at(i + k)
    settled = settled && mine.length > 0 && i + counted <= rolls.length
    sheet.push({ marks, total: settled ? running : null, sofar: running })
    i += taken
  }
  return sheet
}

/** What a bowler has on the sheet right now. */
export function totalOf(rolls: readonly number[], frames: number): number {
  return sheetOf(rolls, frames)[frames - 1].sofar
}

/** One ball of a game: who threw it, how, at what, and what fell. */
export interface Ball {
  /** Who threw it: 0 is the reader, then the girls in the order they bowl, from 1. */
  who: number
  thrown: Throw
  /** The pins standing as it was thrown. */
  before: readonly number[]
  fallen: readonly number[]
}

/** The pins each ball of one bowler's took, in order. */
export function rollsOf(balls: readonly Ball[], who: number): number[] {
  return balls.filter((ball) => ball.who === who).map((ball) => ball.fallen.length)
}

/** What every bowler has on the sheet right now, the reader first. */
export function totalsOf(balls: readonly Ball[], frames: number, girls: number): number[] {
  return Array.from({ length: girls + 1 }, (_, who) => totalOf(rollsOf(balls, who), frames))
}

/** How a game stands between balls. */
export interface Table {
  /** Whose ball is next: 0 is the reader, then the girls from 1. */
  who: number
  /** The pins she or he is throwing at. */
  standing: readonly number[]
  /** The frame that ball belongs to, from 0, and which ball of it. */
  frame: number
  ball: number
  over: boolean
}

/**
 * How a game stands after `balls`, with `girls` of them bowling against the reader. Alone the
 * reader bowls every frame; with company everyone bowls each frame in turn, the reader first and
 * then each girl in her order.
 */
export function tableOf(balls: readonly Ball[], frames: number, girls: number): Table {
  const racks = Array.from({ length: girls + 1 }, (_, who) => rackOf(rollsOf(balls, who), frames))
  // Whoever is furthest behind is up, and of those the one who bowls first.
  const reached = racks.map((rack) => (rack.done ? frames : rack.frame))
  const who = reached.indexOf(Math.min(...reached))
  const rack = racks[who]
  const last = [...balls].reverse().find((ball) => ball.who === who)
  const standing =
    rack.fresh || !last ? ALL_PINS : last.before.filter((pin) => !last.fallen.includes(pin))
  return {
    who,
    standing,
    frame: Math.min(rack.frame, frames - 1),
    ball: rack.ball,
    over: racks.every((each) => each.done)
  }
}

/** How a game came out for the reader: `played` is one bowled alone. */
export type Outcome = 'won' | 'lost' | 'draw' | 'played'

/**
 * The reader's result from everyone's totals, his own first: a win only with the top score to
 * himself, a draw where he shares it.
 */
export function outcomeOf(totals: readonly number[]): Outcome {
  if (totals.length < 2) return 'played'
  const [mine, ...theirs] = totals
  const best = Math.max(...theirs)
  return mine > best ? 'won' : mine === best ? 'draw' : 'lost'
}

/** What kind of ball one was, the most telling thing about it first. */
export type BallKind =
  | 'turkey'
  | 'strike'
  | 'split-converted'
  | 'spare'
  | 'gutter'
  | 'split'
  | 'miss'
  | 'count'

/** One ball as it is told. */
export interface BallTold {
  kind: BallKind
  /** The frame it was thrown in, from 0. */
  frame: number
  /** It was the last ball of its frame. */
  closed: boolean
  /** For the scene's dialogue box ("You ..."). */
  narration: string
  /** For a girl, as a plain account of what just happened ("The reader ..."). */
  cue: string
  /** Worth a remark from one of them. */
  notable: boolean
}

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']

/** The pins left, as a bowler names a leave: "the 7-10". */
function leaveName(standing: readonly number[]): string {
  return `the ${[...standing].sort((a, b) => a - b).join('-')}`
}

/**
 * Ball `i` of a game, told: what it was, in the narration's words and in a cue for a girl.
 * `names` is what the reader calls each girl, in the order they bowl; empty in a game played
 * alone. With more than one girl the cue also says whom the ball took its bowler past.
 */
export function ballTold(
  names: readonly string[],
  balls: readonly Ball[],
  i: number,
  frames: number
): BallTold {
  const ball = balls[i]
  const name = names[ball.who - 1] ?? ''
  const side = balls.slice(0, i + 1).filter((other) => other.who === ball.who)
  const rolls = side.map((other) => other.fallen.length)
  const rack = rackOf(rolls.slice(0, -1), frames)
  const after = rackOf(rolls, frames)
  const took = ball.fallen.length
  const left = ball.before.filter((pin) => !ball.fallen.includes(pin))
  const cleared = left.length === 0
  const full = ball.before.length === 10
  let run = 0
  for (let k = side.length - 1; k >= 0 && side[k].before.length === 10 && side[k].fallen.length === 10; k--) run++

  const kind: BallKind =
    full && cleared
      ? run >= 3
        ? 'turkey'
        : 'strike'
      : cleared
        ? isSplit(ball.before)
          ? 'split-converted'
          : 'spare'
        : pathOf(ball.thrown).gutter
          ? 'gutter'
          : full && isSplit(left)
            ? 'split'
            : took === 0
              ? 'miss'
              : 'count'

  const closed = after.done || after.frame > rack.frame
  const frameTook = full ? took : 10 - left.length
  const texts = (who: string, whose: string, s: string): string => {
    switch (kind) {
      case 'turkey':
        return `${who} bowl${s} a third strike running: a turkey!`
      case 'strike':
        return run === 2 ? `${who} bowl${s} another strike: two in a row.` : `${who} bowl${s} a strike!`
      case 'split-converted':
        return `${who} convert${s} ${leaveName(ball.before)} split for a spare!`
      case 'spare':
        return `${who} pick${s} up the spare.`
      case 'gutter':
        return `${whose} ball drops into the gutter.`
      case 'split':
        return `${who} take${s} ${took} and leave${s} ${leaveName(left)} split.`
      case 'miss':
        return full ? `${whose} ball slides past everything.` : `${who} miss${s ? 'es' : ''} what was left.`
      default:
        return full
          ? `${who} knock${s} down ${took}.`
          : `${who} take${s} ${took} more: ${frameTook} for the frame.`
    }
  }
  const total = totalOf(rolls, frames)
  const tally = (who: string, has: string): string =>
    closed ? ` ${who} ${has} ${total} after ${ORDINAL[rack.frame] ? `the ${ORDINAL[rack.frame]} frame` : `frame ${rack.frame + 1}`}.` : ''

  // Among several, whom this ball took its bowler past, and whether that is the lead.
  let passing = ''
  if (names.length > 1) {
    const was = totalOf(rolls.slice(0, -1), frames)
    const others = ['the reader', ...names]
      .map((who, k) => ({ who, k, total: totalOf(rollsOf(balls.slice(0, i + 1), k), frames) }))
      .filter((other) => other.k !== ball.who)
    const passed = others.filter((other) => other.total >= was && other.total < total)
    if (passed.length > 0) {
      const leads = others.every((other) => other.total < total)
      passing = ` That takes ${ball.who ? name : 'the reader'} past ${listed(passed.map((other) => other.who))}${leads ? ' and into the lead' : ''}.`
    }
  }
  return {
    kind,
    frame: rack.frame,
    closed,
    narration: ball.who
      ? texts(name, `${name}'s`, 's') + tally(name, 'has')
      : texts('You', 'Your', '') + tally('You', 'have'),
    cue:
      (ball.who
        ? texts(name, `${name}'s`, 's') + tally(name, 'has')
        : texts('The reader', "The reader's", 's') + tally('The reader', 'has')) + passing,
    notable: ['turkey', 'strike', 'split-converted', 'gutter'].includes(kind)
  }
}

/**
 * What to tell a girl as the last frame begins with the game still open: everyone has every
 * frame but the last on the sheet and the two in front are within a strike or so of each other.
 * Null at any other moment.
 */
export function lastFrameCue(names: readonly string[], balls: readonly Ball[], frames: number): string | null {
  if (frames < 2 || names.length === 0) return null
  const sides = ['the reader', ...names].map((who, k) => ({ who, rolls: rollsOf(balls, k) }))
  if (sides.some(({ rolls }) => {
    const rack = rackOf(rolls, frames)
    return rack.frame !== frames - 1 || rack.ball !== 0
  })) return null
  const totals = sides.map(({ rolls }) => totalOf(rolls, frames))
  const [first, second] = [...totals].sort((a, b) => b - a)
  if (first - second > 20) return null
  return `One frame left and it will decide the game: ${sides.map(({ who }, k) => `${who} has ${totals[k]}`).join(', ')}.`
}

/** A bowler's game in counts. */
export interface Tally {
  total: number
  strikes: number
  spares: number
  gutters: number
  splits: number
  /** Balls thrown, and how many of them were good throws for what stood. */
  balls: number
  aimed: number
  /** Strikes off throws that were not good ones. */
  lucky: number
  /** Good throws at a full rack that left pins standing. */
  robbed: number
}

export function tallyOf(balls: readonly Ball[], who: number, frames: number): Tally {
  const side = balls.filter((ball) => ball.who === who)
  const full = (ball: Ball): boolean => ball.before.length === 10
  const cleared = (ball: Ball): boolean => ball.fallen.length === ball.before.length
  const good = (ball: Ball): boolean => wellAimed(ball.thrown, ball.before)
  const count = (test: (ball: Ball) => boolean): number => side.filter(test).length
  return {
    total: totalOf(side.map((ball) => ball.fallen.length), frames),
    strikes: count((ball) => full(ball) && cleared(ball)),
    spares: count((ball) => !full(ball) && cleared(ball)),
    gutters: count((ball) => pathOf(ball.thrown).gutter),
    splits: count((ball) => full(ball) && isSplit(ball.before.filter((pin) => !ball.fallen.includes(pin)))),
    balls: side.length,
    aimed: count(good),
    lucky: count((ball) => full(ball) && cleared(ball) && !good(ball)),
    robbed: count((ball) => full(ball) && !cleared(ball) && good(ball))
  }
}

const times = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

/** What a game played alone comes to, as the scene's narration says it. */
export function soloSummary(balls: readonly Ball[], frames: number): string {
  const tally = tallyOf(balls, 0, frames)
  const said = `You bowl ${times(frames, 'frame')} on your own and finish on ${tally.total}`
  if (tally.total === frames * 30) return `${said}: nothing but strikes, a perfect game.`
  const marks = [
    ...(tally.strikes ? [times(tally.strikes, 'strike')] : []),
    ...(tally.spares ? [times(tally.spares, 'spare')] : [])
  ]
  if (marks.length > 0) return `${said}, with ${marks.join(' and ')}.`
  return tally.gutters > 1 ? `${said}. The gutters saw a lot of you.` : `${said}.`
}

/**
 * How a game played alone went, for the scene's writer: each frame with what was worth telling
 * in it and the score as it ran, what was thrown in strikes, spares and gutter balls, and how
 * much of it was aim and how much was luck.
 */
export function soloAccount(balls: readonly Ball[], frames: number): string[] {
  const side = balls.filter((ball) => ball.who === 0)
  const rolls = side.map((ball) => ball.fallen.length)
  const sheet = sheetOf(rolls, frames)
  const tally = tallyOf(balls, 0, frames)
  return [
    `The reader bowled ${times(frames, 'frame')} alone, scored as ten-pin is: a strike counts the next two balls as well, a spare the next one.`,
    ...Array.from(
      { length: frames },
      (_, frame) =>
        `Frame ${frame + 1}: ${frameTold(side, rolls, frame, frames)}. Running score ${sheet[frame].sofar}.`
    ),
    `The reader: ${times(tally.strikes, 'strike')}, ${times(tally.spares, 'spare')}, ${times(tally.gutters, 'gutter ball')}${tally.splits ? `, ${times(tally.splits, 'split')} left` : ''}.`,
    aimTold('The reader', tally),
    `Final score: ${tally.total} of a possible ${frames * 30}${tally.total === frames * 30 ? ', a perfect game' : ''}.`
  ]
}

/** Everyone in the order they finished, by where each sits in `totals`: level scores keep their bowling order. */
function standingOrder(totals: readonly number[]): number[] {
  return totals.map((_, who) => who).sort((a, b) => totals[b] - totals[a] || a - b)
}

/**
 * What a game against the girls comes to, as the scene's narration says it. `totals` is
 * everyone's score, the reader's first and then each girl's as `names` has them.
 */
export function versusSummary(names: readonly string[], totals: readonly number[]): string {
  const [mine, ...theirs] = totals
  if (names.length === 1) {
    const [name] = names
    const [hers] = theirs
    if (mine > hers) return `You bowl against ${name} and win, ${mine} to ${hers}.`
    if (mine < hers) return `You bowl against ${name} and lose, ${mine} to ${hers}.`
    return `You bowl against ${name} and it ends level, ${mine} each.`
  }
  const who = ['you', ...names]
  const order = standingOrder(totals)
  const scores = order.map((k) => `${who[k]} ${totals[k]}`).join(', ')
  const said = `You bowl against ${listed(names)}`
  const top = Math.max(...totals)
  const best = order.filter((k) => k > 0 && totals[k] === top).map((k) => who[k])
  if (mine === top && best.length === 0) return `${said} and win: ${scores}.`
  if (mine === top) return `${said} and share the top score with ${listed(best)}: ${scores}.`
  const place = totals.filter((total) => total > mine).length
  return `${said} and finish ${ORDINAL[place]}; ${listed(best)} ${best.length === 1 ? 'wins' : 'share the win'}: ${scores}.`
}

/** One bowler's frame as the account tells it: its marks, and anything about how it was thrown. */
function frameTold(side: readonly Ball[], rolls: readonly number[], frame: number, frames: number): string {
  const marks = sheetOf(rolls, frames)[frame].marks
  const notes: string[] = []
  let at = 0
  side.forEach((ball, k) => {
    if (rackOf(rolls.slice(0, k), frames).frame !== frame) return
    const full = ball.before.length === 10
    const left = ball.before.filter((pin) => !ball.fallen.includes(pin))
    const good = wellAimed(ball.thrown, ball.before)
    if (pathOf(ball.thrown).gutter) notes.push('a gutter ball')
    else if (full && left.length === 0) notes.push(good ? 'a strike off a good ball' : 'a strike off a loose ball: lucky')
    else if (!full && left.length === 0) notes.push(isSplit(ball.before) ? `converted ${leaveName(ball.before)} split` : 'a spare')
    else if (full && isSplit(left)) notes.push(`left ${leaveName(left)} split${good ? ' off a good ball: unlucky' : ''}`)
    else if (full && good) notes.push(`a good ball that left ${times(left.length, 'pin')}: unlucky`)
    else if (full && ball.fallen.length <= 4) notes.push('a sloppy ball')
    at++
  })
  return at === 0 ? 'nothing' : `${marks.join(' ')}${notes.length ? ` (${notes.join(', ')})` : ''}`
}

/** How a bowler's throws were, apart from what they scored: the aim, and what was luck. */
function aimTold(who: string, tally: Tally): string {
  const share = tally.balls ? tally.aimed / tally.balls : 0
  const how = share >= 0.65 ? 'threw well all game' : share >= 0.35 ? 'was hit and miss with the aim' : 'threw sloppily'
  const luck = [
    ...(tally.lucky ? [`${times(tally.lucky, 'strike')} came off loose balls, which was luck`] : []),
    ...(tally.robbed ? [`${times(tally.robbed, 'good ball')} left pins standing, which was bad luck`] : [])
  ]
  return `${who} ${how}: ${tally.aimed} of ${times(tally.balls, 'ball')} well aimed${luck.length ? `; ${luck.join('; ')}` : ''}.`
}

/** How far apart the two in front finished, in a phrase. */
function closeness(gap: number): string {
  return gap === 0 ? 'dead level' : gap <= 5 ? 'as close as it gets' : gap <= 15 ? 'a close game' : gap <= 40 ? 'a clear win' : 'not close at all'
}

/** Frames by number, as a sentence has them: "frame 2", "frames 1, 4 and 5". */
function framesListed(at: readonly number[]): string {
  const once = [...new Set(at)].map((frame) => String(frame + 1))
  return `${once.length === 1 ? 'frame' : 'frames'} ${listed(once)}`
}

/**
 * How a game against the girls went, for the scene's writer. Against one: each frame for each of
 * them with what was worth telling in it, how the score ran and who led, what each threw in
 * strikes, spares and gutter balls, and how much of it was aim and how much was luck. Against
 * more it is kept to what stood out: the totals frame by frame on one line, who led and when
 * that changed, each bowler's marks and the frames they came in, how the reader's own throws
 * were, and the final standings.
 */
export function versusAccount(names: readonly string[], balls: readonly Ball[], frames: number): string[] {
  const who = ['the reader', ...names]
  const sides = who.map((_, k) => {
    const side = balls.filter((ball) => ball.who === k)
    const rolls = side.map((ball) => ball.fallen.length)
    return { side, rolls, sheet: sheetOf(rolls, frames), tally: tallyOf(balls, k, frames) }
  })
  const totals = sides.map((side) => side.tally.total)

  if (names.length === 1) {
    const [name] = names
    const [mine, other] = sides
    const lines = Array.from(
      { length: frames },
      (_, frame) =>
        `Frame ${frame + 1}: the reader ${frameTold(mine.side, mine.rolls, frame, frames)}; ${name} ${frameTold(other.side, other.rolls, frame, frames)}. Running score ${mine.sheet[frame].sofar} to ${other.sheet[frame].sofar}.`
    )

    const leads = Array.from({ length: frames }, (_, frame) =>
      Math.sign(mine.sheet[frame].sofar - other.sheet[frame].sofar)
    )
    const held = leads.filter((lead) => lead !== 0)
    const changes = held.filter((lead, k) => k > 0 && lead !== held[k - 1]).length
    const led =
      held.length === 0
        ? 'They were level after every frame.'
        : changes === 0
          ? `${held[0] > 0 ? 'The reader' : name} led from the first frame that separated them to the end.`
          : `The lead changed hands ${times(changes, 'time')}; ${held[held.length - 1] > 0 ? 'the reader' : name} had it last.`

    const counts = (bowler: string, tally: Tally): string =>
      `${bowler}: ${times(tally.strikes, 'strike')}, ${times(tally.spares, 'spare')}, ${times(tally.gutters, 'gutter ball')}${tally.splits ? `, ${times(tally.splits, 'split')} left` : ''}.`

    const [a, b] = totals
    const gap = Math.abs(a - b)
    return [
      `They bowled ${times(frames, 'frame')} each, taking alternate frames, the reader first, scored as ten-pin is: a strike counts the next two balls as well, a spare the next one.`,
      ...lines,
      led,
      counts('The reader', mine.tally),
      counts(name, other.tally),
      aimTold('The reader', mine.tally),
      aimTold(name, other.tally),
      `Final score: the reader ${a}, ${name} ${b}: ${a === b ? 'a draw' : `${a > b ? 'the reader' : name} won by ${gap}`}, ${closeness(gap)}.`
    ]
  }

  const running = Array.from({ length: frames }, (_, frame) =>
    sides.map((side) => side.sheet[frame].sofar)
  )

  // Who was alone in front after each frame, -1 where the top score was shared, in runs of frames.
  const leaders = running.map((scores) => {
    const top = Math.max(...scores)
    return scores.filter((score) => score === top).length === 1 ? scores.indexOf(top) : -1
  })
  const runs: { leader: number; from: number; to: number }[] = []
  leaders.forEach((leader, frame) => {
    const last = runs[runs.length - 1]
    if (last && last.leader === leader) last.to = frame
    else runs.push({ leader, from: frame, to: frame })
  })
  const held = leaders.filter((leader) => leader >= 0)
  const changes = held.filter((leader, k) => k > 0 && leader !== held[k - 1]).length
  const span = (from: number, to: number): string =>
    from === to ? `frame ${from + 1}` : `frames ${from + 1} to ${to + 1}`
  const led =
    held.length === 0
      ? 'Nobody was alone in front after any frame.'
      : `Who led: ${runs.map((run) => `${run.leader < 0 ? 'level at the top' : who[run.leader]} after ${span(run.from, run.to)}`).join('; ')}. ${changes === 0 ? `${capital(who[held[0]])} was the only one to lead.` : `The lead changed hands ${times(changes, 'time')}.`}`

  // Each bowler's marks with the frames they came in, and her best run of strikes if it was three.
  const counts = (k: number): string => {
    const { side, rolls, tally } = sides[k]
    const full = (ball: Ball): boolean => ball.before.length === 10
    const cleared = (ball: Ball): boolean => ball.fallen.length === ball.before.length
    const where = (test: (ball: Ball) => boolean): string => {
      const at = side.flatMap((ball, n) => (test(ball) ? [rackOf(rolls.slice(0, n), frames).frame] : []))
      return at.length ? ` (${framesListed(at)})` : ''
    }
    let best = 0
    let run = 0
    for (const ball of side) {
      if (!full(ball)) continue
      run = cleared(ball) ? run + 1 : 0
      best = Math.max(best, run)
    }
    return [
      `${capital(who[k])}: ${times(tally.strikes, 'strike')}${where((ball) => full(ball) && cleared(ball))}`,
      `${times(tally.spares, 'spare')}${where((ball) => !full(ball) && cleared(ball))}`,
      `${times(tally.gutters, 'gutter ball')}${where((ball) => pathOf(ball.thrown).gutter)}`,
      ...(tally.splits ? [`${times(tally.splits, 'split')} left`] : []),
      ...(best >= 3 ? [`${best} strikes in a row`] : [])
    ].join(', ') + '.'
  }

  const order = standingOrder(totals)
  const top = totals[order[0]]
  const first = order.filter((k) => totals[k] === top)
  const rest = order.filter((k) => totals[k] < top)
  const gap = rest.length ? top - totals[rest[0]] : 0
  const next = rest.filter((k) => totals[k] === totals[rest[0]])
  const place = (k: number): number => totals.filter((total) => total > totals[k]).length
  const verdict =
    first.length > 1
      ? `${capital(listed(first.map((k) => who[k])))} shared the top score${rest.length ? `, ${gap} clear of ${listed(next.map((k) => who[k]))}` : ''}${first.includes(0) ? ': a draw for the reader' : ''}.`
      : `${capital(who[first[0]])} won by ${gap} over ${listed(next.map((k) => who[k]))}, ${closeness(gap)}.`
  const mine = first.includes(0) ? '' : ` The reader finished ${ORDINAL[place(0)]} of ${who.length}, ${top - totals[0]} behind.`

  return [
    `They bowled ${times(frames, 'frame')} each, everyone bowling each frame in turn, the reader first and then ${listed(names)}, scored as ten-pin is: a strike counts the next two balls as well, a spare the next one.`,
    `Totals after each frame (${who.join(' / ')}): ${running.map((scores) => scores.join('/')).join(', ')}.`,
    led,
    ...who.map((_, k) => counts(k)),
    aimTold('The reader', sides[0].tally),
    `Final standings: ${order.map((k) => `${place(k) + 1}. ${who[k]} ${totals[k]}`).join('; ')}. ${verdict}${mine}`
  ]
}
