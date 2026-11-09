/**
 * Pool's rules, with no table drawn in them: the balls and how they roll, strike each other, come
 * off the cushions and drop; what eight-ball makes of a shot; how she chooses and plays one at
 * her skill; and how a match is told afterwards. Lengths are in the table's own units, the playing
 * surface running from (0, 0) to (TABLE_W, TABLE_H); times are in seconds, angles in radians.
 */

import { listed } from '../minigameKit'

export const TABLE_W = 800
export const TABLE_H = 400
export const BALL_R = 11
/** How near a pocket's centre a ball's centre must come to drop, at a corner and at a side. */
export const CORNER_R = 26
export const SIDE_R = 23
/** The physics' own step: the table is always advanced by this much at a time. */
export const STEP = 1 / 240
/** The slowest and the hardest the cue ball can be struck. */
export const MIN_SPEED = 160
export const MAX_SPEED = 1500
/** How much speed a rolling ball loses each second to the cloth. */
const FRICTION = 450
/** How much of its speed a ball keeps off a cushion, and how much two balls keep between them. */
const CUSHION_BOUNCE = 0.74
const BALL_BOUNCE = 0.95
/** The longest a shot is run for: nothing struck at full power rolls longer. */
export const MAX_STEPS = 2400
/** Where the cue ball stands for the break until it is moved, and where the head of the rack stands. */
export const HEAD_SPOT: Point = { x: TABLE_W / 4, y: TABLE_H / 2 }
export const FOOT_SPOT: Point = { x: (TABLE_W * 3) / 4, y: TABLE_H / 2 }
/** How far the cue ball and then the object ball travel in a pot worth calling long. */
const LONG_POT = 520
/** A pot off the cue ball's collision of this number or later, balls and cushions both, was nobody's plan. */
const FLUKE_FROM = 3
/** A run of this many pots in one visit is worth a word. */
export const RUN_WORTH = 3

export type Side = 'reader' | 'her'
export type Group = 'solids' | 'stripes'
export type Skill = 1 | 2 | 3 | 4 | 5

export interface Point {
  x: number
  y: number
}

/** A ball: 0 is the cue ball, 1 to 7 the solids, 8 the eight, 9 to 15 the stripes. */
export interface Ball extends Point {
  id: number
  vx: number
  vy: number
  /** Down a pocket; for the cue ball, also lifted off the table to be placed. */
  potted: boolean
}

export interface Pocket extends Point {
  r: number
}

export const POCKETS: readonly Pocket[] = [
  { x: 0, y: 0, r: CORNER_R },
  { x: TABLE_W / 2, y: 0, r: SIDE_R },
  { x: TABLE_W, y: 0, r: CORNER_R },
  { x: 0, y: TABLE_H, r: CORNER_R },
  { x: TABLE_W / 2, y: TABLE_H, r: SIDE_R },
  { x: TABLE_W, y: TABLE_H, r: CORNER_R }
]

/** Which group a ball belongs to; neither for the cue ball and the eight. */
export function groupOf(id: number): Group | null {
  if (id >= 1 && id <= 7) return 'solids'
  if (id >= 9 && id <= 15) return 'stripes'
  return null
}

const otherGroup = (group: Group): Group => (group === 'solids' ? 'stripes' : 'solids')
export const otherSide = (side: Side): Side => (side === 'reader' ? 'her' : 'reader')

/* ------------------------------------------------------------------------------------------ */
/* The table's physics                                                                          */
/* ------------------------------------------------------------------------------------------ */

/** What happened in a shot, as the table saw it. */
export interface ShotLog {
  /** The first ball the cue ball touched. */
  firstHit: number | null
  /** The balls that dropped, in order, the cue ball included, and the pocket each went into. */
  potted: number[]
  pockets: number[]
  /** How many cushions each ball has come off, by ball id. */
  cushions: number[]
  /** How many times the cue ball has met a ball or come off a cushion. */
  cueHits: number
  /** That count as each ball was first set moving, by ball id; 0 for a ball nothing has touched. */
  moved: number[]
}

export function freshLog(): ShotLog {
  return {
    firstHit: null,
    potted: [],
    pockets: [],
    cushions: new Array<number>(16).fill(0),
    cueHits: 0,
    moved: new Array<number>(16).fill(0)
  }
}

export function cloneBalls(balls: readonly Ball[]): Ball[] {
  return balls.map((ball) => ({ ...ball }))
}

/** The order the fifteen are racked in, row by row from the head: the eight in the middle, a solid and a stripe at the back corners. */
const RACK_ORDER = [1, 9, 2, 10, 8, 3, 4, 11, 5, 12, 13, 6, 14, 7, 15]

/** A full rack at the foot of the table, and the cue ball on the head spot. */
export function rackedBalls(): Ball[] {
  const balls: Ball[] = [{ id: 0, ...HEAD_SPOT, vx: 0, vy: 0, potted: false }]
  // A hair apart, so nothing starts inside anything else.
  const gap = BALL_R * 2 + 0.6
  let next = 0
  for (let row = 0; row < 5; row++) {
    for (let i = 0; i <= row; i++) {
      balls.push({
        id: RACK_ORDER[next++],
        x: FOOT_SPOT.x + row * gap * Math.cos(Math.PI / 6),
        y: FOOT_SPOT.y + (i - row / 2) * gap,
        vx: 0,
        vy: 0,
        potted: false
      })
    }
  }
  return balls.sort((a, b) => a.id - b.id)
}

/** How fast the cue ball leaves the cue at a power from 0 to 1. */
export function speedOf(power: number): number {
  const p = Math.min(1, Math.max(0, power))
  return MIN_SPEED + p * (MAX_SPEED - MIN_SPEED)
}

/** Strikes the cue ball. */
export function strike(balls: Ball[], angle: number, power: number): void {
  const cue = balls[0]
  const speed = speedOf(power)
  cue.vx = Math.cos(angle) * speed
  cue.vy = Math.sin(angle) * speed
}

/** The table's energy, up to the balls' mass: what no step may add to. */
export function energyOf(balls: readonly Ball[]): number {
  let sum = 0
  for (const ball of balls) if (!ball.potted) sum += ball.vx * ball.vx + ball.vy * ball.vy
  return sum
}

/**
 * Advances the table by one step: the cloth slows every ball, balls that meet part with what the
 * other brought, a ball at a pocket drops, and a ball at a cushion comes back off it. Returns
 * whether anything is still moving.
 */
export function stepBalls(balls: Ball[], log: ShotLog): boolean {
  const slow = FRICTION * STEP
  for (const ball of balls) {
    if (ball.potted || (ball.vx === 0 && ball.vy === 0)) continue
    const speed = Math.hypot(ball.vx, ball.vy)
    if (speed <= slow) {
      ball.vx = 0
      ball.vy = 0
      continue
    }
    const keep = (speed - slow) / speed
    ball.vx *= keep
    ball.vy *= keep
    ball.x += ball.vx * STEP
    ball.y += ball.vy * STEP
  }

  const touch = BALL_R * 2
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i]
    if (a.potted) continue
    const aStill = a.vx === 0 && a.vy === 0
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j]
      if (b.potted || (aStill && b.vx === 0 && b.vy === 0)) continue
      let nx = b.x - a.x
      let ny = b.y - a.y
      if (Math.abs(nx) >= touch || Math.abs(ny) >= touch) continue
      const far2 = nx * nx + ny * ny
      if (far2 >= touch * touch) continue
      let far = Math.sqrt(far2)
      if (far === 0) {
        nx = 1
        ny = 0
        far = 1
      }
      nx /= far
      ny /= far
      // Put clear of each other, then each takes the other's speed along the line between them.
      const lap = (touch - far) / 2
      a.x -= nx * lap
      a.y -= ny * lap
      b.x += nx * lap
      b.y += ny * lap
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
      if (closing <= 0) continue
      const push = ((1 + BALL_BOUNCE) / 2) * closing
      a.vx -= push * nx
      a.vy -= push * ny
      b.vx += push * nx
      b.vy += push * ny
      if (a.id === 0) {
        log.cueHits++
        if (log.firstHit === null) log.firstHit = b.id
      }
      if (a.id !== 0 && log.moved[a.id] === 0) log.moved[a.id] = Math.max(1, log.cueHits)
      if (log.moved[b.id] === 0) log.moved[b.id] = Math.max(1, log.cueHits)
    }
  }

  let moving = false
  for (const ball of balls) {
    if (ball.potted) continue
    let down = -1
    // Only a ball near an edge can be at a pocket or a cushion.
    const edge =
      ball.x < CORNER_R || ball.x > TABLE_W - CORNER_R || ball.y < CORNER_R || ball.y > TABLE_H - CORNER_R
    if (edge) {
      for (let p = 0; p < POCKETS.length; p++) {
        const pocket = POCKETS[p]
        const dx = ball.x - pocket.x
        const dy = ball.y - pocket.y
        if (dx * dx + dy * dy < pocket.r * pocket.r) {
          down = p
          break
        }
      }
      if (down >= 0) {
        ball.potted = true
        ball.vx = 0
        ball.vy = 0
        log.potted.push(ball.id)
        log.pockets.push(down)
        continue
      }
      let off = false
      if (ball.x < BALL_R) {
        ball.x = BALL_R
        if (ball.vx < 0) {
          ball.vx = -ball.vx * CUSHION_BOUNCE
          off = true
        }
      } else if (ball.x > TABLE_W - BALL_R) {
        ball.x = TABLE_W - BALL_R
        if (ball.vx > 0) {
          ball.vx = -ball.vx * CUSHION_BOUNCE
          off = true
        }
      }
      if (ball.y < BALL_R) {
        ball.y = BALL_R
        if (ball.vy < 0) {
          ball.vy = -ball.vy * CUSHION_BOUNCE
          off = true
        }
      } else if (ball.y > TABLE_H - BALL_R) {
        ball.y = TABLE_H - BALL_R
        if (ball.vy > 0) {
          ball.vy = -ball.vy * CUSHION_BOUNCE
          off = true
        }
      }
      if (off) {
        log.cushions[ball.id]++
        if (ball.id === 0) log.cueHits++
      }
    }
    if (ball.vx !== 0 || ball.vy !== 0) moving = true
  }
  return moving
}

/** Plays a shot through to rest on the balls given, and says what happened. */
export function simulate(balls: Ball[], angle: number, power: number): ShotLog {
  const log = freshLog()
  strike(balls, angle, power)
  for (let i = 0; i < MAX_STEPS; i++) if (!stepBalls(balls, log)) break
  for (const ball of balls) {
    ball.vx = 0
    ball.vy = 0
  }
  return log
}

/** Where a cue ball sent from `from` at `angle` first meets something: a ball, or a cushion. */
export interface AimGuide {
  /** The cue ball's centre at that moment. */
  ghost: Point
  /** The ball it meets, and the way that ball is sent; null at a cushion. */
  hit: number | null
  send: Point | null
}

export function aimGuide(balls: readonly Ball[], from: Point, angle: number): AimGuide {
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  let best = Infinity
  let hit: Ball | null = null
  const touch = BALL_R * 2
  for (const ball of balls) {
    if (ball.potted || ball.id === 0) continue
    const rx = ball.x - from.x
    const ry = ball.y - from.y
    const along = rx * dx + ry * dy
    if (along <= 0) continue
    const off2 = rx * rx + ry * ry - along * along
    if (off2 >= touch * touch) continue
    const at = along - Math.sqrt(touch * touch - off2)
    if (at >= 0 && at < best) {
      best = at
      hit = ball
    }
  }
  if (hit) {
    const ghost = { x: from.x + dx * best, y: from.y + dy * best }
    return {
      ghost,
      hit: hit.id,
      send: { x: (hit.x - ghost.x) / touch, y: (hit.y - ghost.y) / touch }
    }
  }
  // No ball in the way: on to the cushion.
  let reach = Infinity
  if (dx > 0) reach = Math.min(reach, (TABLE_W - BALL_R - from.x) / dx)
  if (dx < 0) reach = Math.min(reach, (BALL_R - from.x) / dx)
  if (dy > 0) reach = Math.min(reach, (TABLE_H - BALL_R - from.y) / dy)
  if (dy < 0) reach = Math.min(reach, (BALL_R - from.y) / dy)
  if (!Number.isFinite(reach) || reach < 0) reach = 0
  return { ghost: { x: from.x + dx * reach, y: from.y + dy * reach }, hit: null, send: null }
}

/** Whether the cue ball may be put down at a point: on the cloth, clear of every ball and pocket. */
export function canPlace(balls: readonly Ball[], at: Point): boolean {
  if (at.x < BALL_R || at.x > TABLE_W - BALL_R || at.y < BALL_R || at.y > TABLE_H - BALL_R) return false
  for (const pocket of POCKETS) {
    if (Math.hypot(at.x - pocket.x, at.y - pocket.y) < pocket.r + 2) return false
  }
  for (const ball of balls) {
    if (ball.potted || ball.id === 0) continue
    if (Math.hypot(at.x - ball.x, at.y - ball.y) < BALL_R * 2 + 1) return false
  }
  return true
}

/** Whether the cue ball may be put down at a point for the break: anywhere it has room on or behind the head string. */
export function canBreakFrom(balls: readonly Ball[], at: Point): boolean {
  return at.x <= HEAD_SPOT.x && canPlace(balls, at)
}

/** The free spot nearest a point, looking outward from it in rings; `clearOfCue` for a ball that is not the cue ball. */
function freeSpotNear(balls: readonly Ball[], want: Point, clearOfCue = false): Point {
  const cue = balls[0]
  const free = (at: Point): boolean =>
    canPlace(balls, at) &&
    !(clearOfCue && cue && !cue.potted && Math.hypot(at.x - cue.x, at.y - cue.y) < BALL_R * 2 + 1)
  if (free(want)) return { ...want }
  for (let ring = 1; ring < 40; ring++) {
    for (let k = 0; k < 12; k++) {
      const turn = (k / 12) * Math.PI * 2
      const at = {
        x: want.x + Math.cos(turn) * ring * BALL_R,
        y: want.y + Math.sin(turn) * ring * BALL_R
      }
      if (free(at)) return at
    }
  }
  return { ...want }
}

/** Puts the cue ball down, at the point wanted or the nearest free one. */
export function placeCue(balls: Ball[], want: Point): void {
  const at = freeSpotNear(balls, want)
  const cue = balls[0]
  cue.x = at.x
  cue.y = at.y
  cue.vx = 0
  cue.vy = 0
  cue.potted = false
}

/* ------------------------------------------------------------------------------------------ */
/* Eight-ball                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** A rack as it stands between shots. */
export interface Rack {
  balls: Ball[]
  /** A table with nobody to beat: no groups, no turns, every ball the reader's to pot. */
  solo: boolean
  turn: Side
  groups: Record<Side, Group | null>
  /** The cue ball is in the hand of whoever's turn it is, to be placed. */
  inHand: boolean
  /** The next shot is the break. */
  breaking: boolean
  /** Pots so far in this visit to the table. */
  run: number
  winner: Side | null
}

export function freshRack(breaker: Side, solo = false): Rack {
  return {
    balls: rackedBalls(),
    solo,
    turn: solo ? 'reader' : breaker,
    groups: { reader: null, her: null },
    inHand: false,
    breaking: true,
    run: 0,
    winner: null
  }
}

/** The balls a side still has to pot before the eight: its group's, and none named while the table is open. Alone, every ball still up. */
export function ballsLeft(rack: Rack, side: Side): number[] {
  const group = rack.groups[side]
  if (!rack.solo && !group) return []
  return rack.balls
    .filter((ball) => !ball.potted && (rack.solo ? ball.id !== 0 : groupOf(ball.id) === group))
    .map((ball) => ball.id)
}

/** Whether a side has only the eight left. */
export function onTheEight(rack: Rack, side: Side): boolean {
  return !rack.solo && rack.groups[side] !== null && ballsLeft(rack, side).length === 0
}

/** The balls whoever is at the table may hit first. */
export function legalTargets(rack: Rack): number[] {
  const up = rack.balls.filter((ball) => !ball.potted && ball.id !== 0).map((ball) => ball.id)
  if (rack.solo) return up
  const group = rack.groups[rack.turn]
  if (!group) {
    const open = up.filter((id) => id !== 8)
    return open.length ? open : up
  }
  const mine = up.filter((id) => groupOf(id) === group)
  return mine.length ? mine : up.filter((id) => id === 8)
}

export type Foul = 'scratch' | 'no-hit' | 'wrong-ball'

/** One shot, as the rules judged it. */
export interface ShotRecord {
  by: Side
  breakShot: boolean
  /** The object balls that dropped and stayed down. */
  potted: number[]
  /** Those of them that were the shooter's to pot, and those that were the other side's. */
  own: number[]
  other: number[]
  foul: Foul | null
  /** The group the shot gave the shooter, where it settled an open table. */
  assigned: Group | null
  /** A pot from a long way off, struck straight at it. */
  long: boolean
  /**
   * A pot that was plainly luck. Hers is one she did not mean, her plan being known. The reader's
   * intent is not, so his is only a ball first set moving at the cue ball's third collision or
   * later: a bank or a combination may well have been meant, and nothing is said of it.
   */
  fluke: boolean
  /** A pot that was the shot played: hers as she meant it, his struck first and straight in. */
  clean: boolean
  /** Pots in this visit, this shot's included. */
  run: number
  /** The shot cleared the shooter's group: the eight is next. */
  onEightNow: boolean
  /** The shooter was already on the eight when it was played. */
  atEight: boolean
  /** How the eight ended the rack: potted in turn, potted early, or lost by a foul on it. */
  eight: 'win' | 'early' | 'foul' | null
  /** The eight dropped on the break and was put back on its spot. */
  eightBack: boolean
  winner: Side | null
  /** Whose shot is next. */
  next: Side
  /** How far off her aim the shot went, where it was hers. */
  aimError: number | null
}

/**
 * What eight-ball makes of a shot. `rack` is the rack with its balls as they came to rest, `pre`
 * the balls as they stood before it, and `expected` the balls she meant to pot where the shot was
 * hers and she had a plan. Returns the rack as it stands for the next shot.
 */
export function resolveShot(
  rack: Rack,
  pre: readonly Ball[],
  log: ShotLog,
  expected?: readonly number[],
  aimError: number | null = null
): { rack: Rack; record: ShotRecord } {
  const by = rack.turn
  const against = otherSide(by)
  const balls = cloneBalls(rack.balls)
  const groups = { ...rack.groups }
  const groupBefore = groups[by]
  const atEight =
    !rack.solo &&
    groupBefore !== null &&
    !pre.some((ball) => !ball.potted && groupOf(ball.id) === groupBefore)

  const scratch = log.potted.includes(0)
  let potted = log.potted.filter((id) => id !== 0)
  const first = log.firstHit
  let foul: Foul | null = null
  if (scratch) foul = 'scratch'
  else if (first === null) foul = 'no-hit'
  else if (!rack.solo) {
    const legal = atEight ? first === 8 : groupBefore ? groupOf(first) === groupBefore : first !== 8
    if (!legal) foul = 'wrong-ball'
  }

  let eight: ShotRecord['eight'] = null
  let winner: Side | null = null
  let eightBack = false
  if (!rack.solo) {
    if (potted.includes(8)) {
      if (rack.breaking) {
        // Off the break it is put back on its spot and the rack goes on.
        eightBack = true
        potted = potted.filter((id) => id !== 8)
        const black = balls[8]
        black.potted = false
        const at = freeSpotNear(balls, FOOT_SPOT, true)
        black.x = at.x
        black.y = at.y
      } else if (atEight && !foul) {
        eight = 'win'
        winner = by
      } else {
        eight = atEight ? 'foul' : 'early'
        winner = against
      }
    } else if (atEight && scratch) {
      eight = 'foul'
      winner = against
    }
  }

  let assigned: Group | null = null
  if (!rack.solo && !groupBefore && !foul && !winner) {
    const decider = potted.find((id) => groupOf(id) !== null)
    if (decider !== undefined) {
      assigned = groupOf(decider) as Group
      groups[by] = assigned
      groups[against] = otherGroup(assigned)
    }
  }

  const mine = groups[by]
  const own = rack.solo
    ? potted
    : mine
      ? potted.filter((id) => groupOf(id) === mine)
      : potted.filter((id) => id !== 8)
  const other = rack.solo || !mine ? [] : potted.filter((id) => groupOf(id) === otherGroup(mine))

  if (rack.solo && !balls.some((ball) => !ball.potted && ball.id !== 0)) winner = 'reader'

  const goesOn = !foul && !winner && own.length > 0
  const run = foul ? 0 : rack.run + own.length
  const leftNow = mine ? balls.filter((ball) => !ball.potted && groupOf(ball.id) === mine).length : -1
  const onEightNow = !rack.solo && !winner && leftNow === 0 && !atEight

  // A pot is the shot played where the ball struck first went straight in.
  const direct = (id: number): boolean => id === first && log.cushions[id] === 0
  const scored = !rack.breaking && !foul && own.length > 0
  const fluke =
    scored &&
    (expected
      ? own.some((id) => !expected.includes(id))
      : own.every((id) => log.moved[id] >= FLUKE_FROM))
  const clean = scored && (expected ? !fluke : own.some(direct))
  const cueBefore = pre[0]
  const long =
    clean &&
    own.some((id) => {
      if (!direct(id)) return false
      const ball = pre[id]
      const pocket = POCKETS[log.pockets[log.potted.indexOf(id)]]
      return (
        Math.hypot(ball.x - cueBefore.x, ball.y - cueBefore.y) +
          Math.hypot(pocket.x - ball.x, pocket.y - ball.y) >
        LONG_POT
      )
    })

  const inHand = foul !== null && !winner
  const cue = balls[0]
  // Lifted off the table, wherever it stopped, for whoever is next to put down.
  if (inHand) cue.potted = true
  cue.vx = 0
  cue.vy = 0

  const next = rack.solo ? 'reader' : goesOn ? by : against
  return {
    rack: {
      balls,
      solo: rack.solo,
      turn: winner ? by : next,
      groups,
      inHand,
      breaking: false,
      run: goesOn ? run : 0,
      winner
    },
    record: {
      by,
      breakShot: rack.breaking,
      potted,
      own,
      other,
      foul,
      assigned,
      long,
      fluke,
      clean,
      run,
      onEightNow,
      atEight,
      eight,
      eightBack,
      winner,
      next,
      aimError
    }
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Her play                                                                                     */
/* ------------------------------------------------------------------------------------------ */

/** How many shots she plays through in her head before choosing, by skill. */
export const CONSIDERED: Record<Skill, number> = { 1: 3, 2: 6, 3: 12, 4: 20, 5: 30 }
/** How far her cue strays from the line she chose, by skill: one standard deviation, in radians. */
export const AIM_ERROR: Record<Skill, number> = {
  1: 0.03,
  2: 0.017,
  3: 0.009,
  4: 0.005,
  5: 0.0025
}
/** How far her weight strays from what she meant, by skill, as a part of the power. */
const POWER_ERROR: Record<Skill, number> = { 1: 0.3, 2: 0.2, 3: 0.12, 4: 0.07, 5: 0.04 }

/** The shot she plays. */
export interface HerShot {
  /** Where she puts the cue ball down, where it was in her hand or the break is hers. */
  place: Point | null
  /** The shot as struck, her error in it. */
  angle: number
  power: number
  /** How far the angle is from the one she chose. */
  aimError: number
  /** The balls she meant to pot; empty where she was only trying to hit something. */
  expected: number[]
}

/** A pot that is on: a ball, the pocket it goes to, and the line to send it there. */
interface Candidate {
  target: number
  angle: number
  power: number
  /** How easy it looks: a full hit from close by is 1. */
  ease: number
}

/** Whether anything but the two named stands on the path from one point to another. */
function pathBlocked(balls: readonly Ball[], from: Point, to: Point, a: number, b: number): boolean {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return false
  for (const ball of balls) {
    if (ball.potted || ball.id === a || ball.id === b) continue
    const t = Math.min(1, Math.max(0, ((ball.x - from.x) * dx + (ball.y - from.y) * dy) / len2))
    const px = from.x + dx * t - ball.x
    const py = from.y + dy * t - ball.y
    if (px * px + py * py < BALL_R * 2 * (BALL_R * 2)) return true
  }
  return false
}

/** The weight a pot wants: enough for the cue ball to get there and the object ball to reach the pocket, and some over. */
function powerFor(distance: number, fullness: number): number {
  const speed = (Math.sqrt(2 * FRICTION * distance) * 1.25) / Math.max(0.35, fullness) + 120
  return Math.min(1, Math.max(0.12, (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED)))
}

/** Every pot that is on from where the cue ball lies: each legal ball to each pocket it can be cut into. */
function potsOn(balls: readonly Ball[], cue: Point, targets: readonly number[]): Candidate[] {
  const found: Candidate[] = []
  for (const id of targets) {
    const ball = balls[id]
    for (const pocket of POCKETS) {
      // Aim a little inside the pocket's mouth, where a ball actually drops.
      const mouth = {
        x: pocket.x + Math.sign(TABLE_W / 2 - pocket.x) * BALL_R * 0.9,
        y: pocket.y + Math.sign(TABLE_H / 2 - pocket.y) * BALL_R * 0.9
      }
      const toPocket = Math.hypot(mouth.x - ball.x, mouth.y - ball.y)
      if (toPocket === 0) continue
      const ux = (mouth.x - ball.x) / toPocket
      const uy = (mouth.y - ball.y) / toPocket
      const ghost = { x: ball.x - ux * BALL_R * 2, y: ball.y - uy * BALL_R * 2 }
      const toGhost = Math.hypot(ghost.x - cue.x, ghost.y - cue.y)
      if (toGhost === 0) continue
      const fullness = ((ghost.x - cue.x) * ux + (ghost.y - cue.y) * uy) / toGhost
      // Thinner than this is not a shot anyone plays.
      if (fullness < 0.25) continue
      if (pathBlocked(balls, cue, ghost, 0, id)) continue
      if (pathBlocked(balls, ball, mouth, 0, id)) continue
      found.push({
        target: id,
        angle: Math.atan2(ghost.y - cue.y, ghost.x - cue.x),
        power: powerFor(toGhost + toPocket, fullness),
        ease: (fullness * fullness) / (1 + (toGhost + toPocket) / 600)
      })
    }
  }
  return found
}

/** A number from the bell curve, from two of the uniform ones. */
function bell(rand: () => number): number {
  const a = Math.max(1e-9, 1 - rand())
  return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * rand())
}

/** What a shot she is weighing would come to, played exactly as meant. */
function worth(rack: Rack, angle: number, power: number): { score: number; pots: number[] } {
  const balls = cloneBalls(rack.balls)
  const log = simulate(balls, angle, power)
  const { record } = resolveShot({ ...rack, balls }, rack.balls, log)
  let score = 0
  if (record.winner === rack.turn) score = 1000
  else if (record.winner) score = -1000
  else if (record.foul) score = -250
  else score = record.own.length * 100 - record.other.length * 40
  return { score, pots: record.foul ? [] : record.own.concat(record.eight === 'win' ? [8] : []) }
}

/** How many lines round the cue ball she looks along for a safety, and how many of them she plays through, by skill. */
export const SCANNED: Record<Skill, number> = { 1: 8, 2: 16, 3: 32, 4: 64, 5: 96 }
const SAFETIES: Record<Skill, number> = { 1: 2, 2: 3, 3: 4, 4: 6, 5: 8 }

/** The first ball a cue ball sent along a line would meet, off as many as three cushions, and how far it rolls to it. */
function firstMet(
  balls: readonly Ball[],
  from: Point,
  angle: number
): { hit: number | null; far: number; cushions: number } {
  let at: Point = from
  let dx = Math.cos(angle)
  let dy = Math.sin(angle)
  let far = 0
  for (let cushions = 0; cushions <= 3; cushions++) {
    const guide = aimGuide(balls, at, Math.atan2(dy, dx))
    far += Math.hypot(guide.ghost.x - at.x, guide.ghost.y - at.y)
    if (guide.hit !== null) return { hit: guide.hit, far, cushions }
    at = guide.ghost
    // Off the cushion as the table has it: what went into it comes back the weaker.
    if (at.x <= BALL_R + 0.01 || at.x >= TABLE_W - BALL_R - 0.01) dx = -dx * CUSHION_BOUNCE
    if (at.y <= BALL_R + 0.01 || at.y >= TABLE_H - BALL_R - 0.01) dy = -dy * CUSHION_BOUNCE
  }
  return { hit: null, far, cushions: 3 }
}

/**
 * The safety she plays with no pot on: she looks along a spread of lines, more of them the better
 * she is, keeps those that reach one of her balls first, straight or off a cushion, plays some of
 * them through in her head at two weights, and takes one that is no foul and leaves the other
 * player the hardest pot. Where no line is legal she takes what costs her least. Null on a table
 * with nothing to hit.
 */
function safetyOn(
  table: Rack,
  skill: Skill,
  rand: () => number
): { score: number; angle: number; power: number; pots: number[] } | null {
  const balls = table.balls
  const cue = balls[0]
  const targets = legalTargets(table)
  if (targets.length === 0) return null
  const lines: { angle: number; far: number; rank: number }[] = []
  // Full at each of her balls she can see: the line her hands can least spoil.
  for (const id of targets) {
    const angle = Math.atan2(balls[id].y - cue.y, balls[id].x - cue.x)
    const met = firstMet(balls, cue, angle)
    if (met.hit === id && met.cushions === 0) lines.push({ angle, far: met.far, rank: 0 })
  }
  // Then round the table: a line counts for more where a little either side of it is legal too.
  const wobble = AIM_ERROR[skill] * 2
  const turn = rand() * Math.PI * 2
  const round: { angle: number; far: number; rank: number }[] = []
  for (let k = 0; k < SCANNED[skill]; k++) {
    const angle = turn + (k / SCANNED[skill]) * Math.PI * 2
    const met = firstMet(balls, cue, angle)
    const far = met.far * (1 + met.cushions * 0.6)
    if (met.hit === null || !targets.includes(met.hit)) {
      round.push({ angle, far, rank: 9 })
      continue
    }
    const sure = [angle - wobble, angle + wobble].every((near) => {
      const hit = firstMet(balls, cue, near).hit
      return hit !== null && targets.includes(hit)
    })
    round.push({ angle, far, rank: (sure ? 1 : 3) + (met.cushions > 0 ? 1 : 0) })
  }
  // The surest first, and among lines as sure as each other a spread, so that what they leave differs.
  const spread = <T>(list: readonly T[]): T[] => list.map((_, k) => list[(k * 7919) % list.length])
  const queue: { angle: number; far: number; rank: number }[] = []
  for (const rank of [0, 1, 2, 3, 4, 9]) {
    queue.push(...spread((rank === 0 ? lines : round).filter((line) => line.rank === rank)))
  }

  type Played = { score: number; angle: number; power: number; pots: number[] }
  /** What a line at a weight comes to, played exactly so. */
  const play = (angle: number, power: number): Played => {
    const after = cloneBalls(balls)
    const log = simulate(after, angle, power)
    const got = resolveShot({ ...table, balls: after }, balls, log)
    const record = got.record
    let score: number
    if (record.winner === table.turn) score = 1000
    else if (record.winner) score = -1000
    else if (record.foul) score = record.foul === 'scratch' ? -260 : -250
    else {
      score = record.own.length * 100 - record.other.length * 40
      if (record.next !== table.turn) {
        // What it leaves: the less the other player has on from where the cue ball stops, the better.
        const left = potsOn(got.rack.balls, got.rack.balls[0], legalTargets(got.rack))
        score += 50 * (1 - Math.min(1, left.reduce((most, pot) => Math.max(most, pot.ease), 0)))
      }
    }
    return { score, angle, power, pots: record.foul || record.winner ? [] : record.own }
  }

  // A good player goes on looking where the first lines came to nothing, and trusts no line her
  // own hands could turn into a foul.
  const many = SAFETIES[skill]
  const rounds = skill >= 4 ? 4 : skill === 3 ? 2 : 1
  const checked = skill >= 3 ? 3 : 1
  const slip = AIM_ERROR[skill] * 1.5
  let best: Played | null = null
  let least: Played | null = null
  for (let n = 0; n < rounds && n * many < queue.length; n++) {
    const found: Played[] = []
    for (const line of queue.slice(n * many, (n + 1) * many)) {
      // Lines she could not see to be legal are played firmer, to reach something.
      for (const weight of line.rank === 9 ? [1.3, 2.2] : [0.85, 1.25]) {
        found.push(play(line.angle, Math.min(1, powerFor(line.far, 1) * weight)))
      }
    }
    found.sort((a, b) => b.score - a.score)
    for (const one of found) if (!least || one.score > least.score) least = one
    for (const one of found.slice(0, checked)) {
      if (one.score < 0) break
      const off =
        Math.min(0, play(one.angle + slip, Math.min(1, one.power * (1 - POWER_ERROR[skill]))).score) +
        Math.min(0, play(one.angle - slip, Math.min(1, one.power * (1 + POWER_ERROR[skill]))).score)
      if (off === 0) return one
      // Legal as meant but easily spoiled: kept in case nothing better turns up.
      if (!best || one.score + off > best.score) best = { ...one, score: one.score + off }
    }
  }
  if (best && least && least.score > best.score) return least
  return best ?? least
}

/**
 * Where she puts the cue ball with it in her hand: behind one of her balls, in line with a
 * pocket, a comfortable distance back. A good player takes the easiest of them, a poor one any.
 */
export function herPlacement(rack: Rack, skill: Skill, rand: () => number = Math.random): Point {
  const balls = rack.balls
  const spots: { at: Point; far: number }[] = []
  for (const id of legalTargets(rack)) {
    const ball = balls[id]
    for (const pocket of POCKETS) {
      const far = Math.hypot(pocket.x - ball.x, pocket.y - ball.y)
      const ux = (pocket.x - ball.x) / far
      const uy = (pocket.y - ball.y) / far
      for (const back of [150, 90]) {
        const at = { x: ball.x - ux * back, y: ball.y - uy * back }
        if (!canPlace(balls, at)) continue
        if (pathBlocked(balls, at, ball, 0, id) || pathBlocked(balls, ball, pocket, 0, id)) continue
        spots.push({ at, far })
        break
      }
    }
  }
  if (spots.length === 0) return freeSpotNear(balls, HEAD_SPOT)
  spots.sort((a, b) => a.far - b.far)
  const among = skill >= 4 ? 1 : skill === 3 ? Math.min(3, spots.length) : spots.length
  return spots[Math.min(spots.length - 1, Math.floor(rand() * among))].at
}

/**
 * The shot she plays from a rack on which it is her turn. She lists the pots that are on, plays
 * as many through in her head as her skill allows, the likeliest first where she can judge that,
 * and takes the best; with nothing on she plays a safety: one of her balls struck first, the cue
 * ball left where the other player has least. On the break she puts the cue ball down behind the
 * head string. Then her hands
 * add their error to the line and the weight. The rack is not changed.
 */
export function herShot(rack: Rack, skill: Skill, rand: () => number = Math.random): HerShot {
  let place: Point | null = null
  let table = rack
  if (rack.inHand || rack.balls[0].potted) {
    place = herPlacement(rack, skill, rand)
    const balls = cloneBalls(rack.balls)
    placeCue(balls, place)
    place = { x: balls[0].x, y: balls[0].y }
    table = { ...rack, balls, inHand: false }
  }
  let cue = table.balls[0]

  let angle: number
  let power: number
  let expected: number[] = []
  if (rack.breaking) {
    // The break: from a little to one side behind the head string, at the head ball, as hard as she can.
    const want = {
      x: HEAD_SPOT.x - BALL_R,
      y: HEAD_SPOT.y + (rand() < 0.5 ? -1 : 1) * (30 + rand() * 40)
    }
    const balls = cloneBalls(table.balls)
    placeCue(balls, canBreakFrom(balls, want) ? want : HEAD_SPOT)
    place = { x: balls[0].x, y: balls[0].y }
    table = { ...table, balls, inHand: false }
    cue = table.balls[0]
    const head = table.balls.reduce((a, b) => (b.id !== 0 && !b.potted && b.x < a.x ? b : a), table.balls[1])
    angle = Math.atan2(head.y - cue.y, head.x - cue.x)
    power = 1
  } else {
    const targets = legalTargets(table)
    const on = potsOn(table.balls, cue, targets)
    if (skill >= 3) on.sort((a, b) => b.ease - a.ease)
    else {
      // A poor player does not see which of them is the easy one.
      for (let i = on.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[on[i], on[j]] = [on[j], on[i]]
      }
    }
    let best: { score: number; angle: number; power: number; pots: number[] } | null = null
    for (const shot of on.slice(0, CONSIDERED[skill])) {
      const got = worth(table, shot.angle, shot.power)
      // What looks easier breaks a tie, so her error costs her less.
      const score = got.score + shot.ease
      if (!best || score > best.score) best = { score, angle: shot.angle, power: shot.power, pots: got.pots }
    }
    if (!best || best.score < 0) {
      // Nothing to pot: a safety, where there is one, and otherwise whatever costs her least.
      const safe = safetyOn(table, skill, rand)
      if (safe && (!best || safe.score > best.score)) best = safe
    }
    angle = best ? best.angle : 0
    power = best ? best.power : 0.4
    expected = best ? best.pots : []
  }

  const aimError = bell(rand) * AIM_ERROR[skill]
  const weight = 1 + (rand() * 2 - 1) * POWER_ERROR[skill]
  return {
    place,
    angle: angle + aimError,
    power: Math.min(1, Math.max(0.08, power * weight)),
    aimError,
    expected
  }
}

/* ------------------------------------------------------------------------------------------ */
/* Telling it                                                                                   */
/* ------------------------------------------------------------------------------------------ */

/** A rack that has been played, for the telling. */
export interface RackRecord {
  breaker: Side
  shots: ShotRecord[]
  winner: Side | null
  /** How many of their own balls each side still had up at the end. */
  left: Record<Side, number>
}

/** Balls by number, as a sentence has them: "the 3", "the 3 and the 11". */
export function ballsWord(ids: readonly number[]): string {
  return listed(ids.map((id) => (id === 8 ? 'the eight' : `the ${id}`)))
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)

const FOUL_WORD: Record<Foul, string> = {
  scratch: 'the cue ball goes in off',
  'no-hit': 'the cue ball touches nothing',
  'wrong-ball': 'the wrong ball is struck first'
}

/** A shot as the dialogue box says it. `name` is hers; alone it is not used. */
export function shotLine(name: string, shot: ShotRecord, solo = false): string {
  const you = shot.by === 'reader'
  const who = you ? 'You' : name
  const verb = (mine: string, hers: string): string => (you ? mine : hers)
  const them = you ? name : 'you'
  const parts: string[] = []

  if (shot.eight === 'win') {
    return `${who} ${verb('sink', 'sinks')} the eight${shot.potted.length > 1 ? ` with ${ballsWord(shot.potted.filter((id) => id !== 8))}` : ''}: the rack is ${verb('yours', 'hers')}.`
  }
  if (shot.eight === 'early') {
    return `${who} ${verb('pot', 'pots')} the eight too early: the rack goes to ${them}.`
  }
  if (shot.eight === 'foul') {
    return `${who} ${verb('foul', 'fouls')} on the eight, ${FOUL_WORD[shot.foul ?? 'scratch']}: the rack goes to ${them}.`
  }

  if (shot.breakShot) parts.push(`${who} ${verb('break', 'breaks')}.`)
  if (shot.potted.length > 0) {
    const lead = shot.breakShot ? capital(ballsWord(shot.potted)) : `${who} ${verb('pot', 'pots')} ${ballsWord(shot.potted)}`
    parts.push(shot.breakShot ? `${lead} ${shot.potted.length > 1 ? 'drop' : 'drops'}.` : `${lead}.`)
  } else if (!shot.foul && !shot.breakShot) {
    parts.push(`${who} ${verb('miss', 'misses')}.`)
  } else if (!shot.foul && !shot.eightBack) {
    parts.push('Nothing drops.')
  }
  if (shot.eightBack) parts.push('The eight drops on the break and is put back on its spot.')
  if (shot.foul) {
    // Said of whoever played it where nothing before it in the line has named them.
    const lead = parts.length > 0 ? 'A foul' : `${who} ${verb('foul', 'fouls')}`
    parts.push(
      solo
        ? `${lead}, ${FOUL_WORD[shot.foul]}: you put the cue ball back down.`
        : `${lead}, ${FOUL_WORD[shot.foul]}: ${you ? `${name} has` : 'you have'} the cue ball in hand.`
    )
  }
  if (shot.assigned) parts.push(`${who} ${verb('are', 'is')} ${shot.assigned}.`)
  if (shot.onEightNow) parts.push(`${who} ${verb('are', 'is')} on the eight.`)
  if (solo && shot.winner) parts.push('The table is clear.')
  return parts.join(' ')
}

/**
 * What a shot gives her to say something about, as a plain account for the model: `notable` for
 * the moments worth a word however little she talks. Null where there is nothing in it.
 */
export function shotCue(name: string, shot: ShotRecord): { cue: string; notable: boolean } | null {
  const who = shot.by === 'reader' ? 'the reader' : name
  const them = shot.by === 'reader' ? name : 'the reader'
  if (shot.winner) {
    return {
      cue:
        shot.eight === 'win'
          ? `${who} potted the eight and won the rack; another rack follows.`
          : `${who} lost the rack by ${shot.eight === 'early' ? 'potting the eight too early' : 'fouling on the eight'}; it goes to ${them}, and another rack follows.`,
      notable: true
    }
  }
  if (shot.foul === 'scratch') {
    return {
      cue: `${who} potted the cue ball${shot.potted.length ? ` along with ${ballsWord(shot.potted)}` : ''}: a foul, and ${them} gets to place it anywhere.`,
      notable: true
    }
  }
  if (shot.onEightNow) {
    return { cue: `${who} potted the last of ${shot.by === 'reader' ? 'his' : 'her'} group and is on the eight.`, notable: true }
  }
  if (shot.fluke) {
    return {
      cue:
        shot.by === 'reader'
          ? `${who} potted ${ballsWord(shot.own)} by a plain fluke: the cue ball had bounced around the table before anything sent it in.`
          : `${who} potted ${ballsWord(shot.own)} by a fluke: it was not the ball she was playing for.`,
      notable: true
    }
  }
  if (shot.long) {
    return { cue: `${who} potted ${ballsWord(shot.own)} from most of the table's length away: a fine long pot.`, notable: true }
  }
  if (shot.run >= RUN_WORTH && shot.own.length > 0 && shot.run - shot.own.length < RUN_WORTH) {
    return { cue: `${who} has now potted ${shot.run} balls in a row without missing.`, notable: true }
  }
  if (shot.foul) {
    return {
      cue: `${who} fouled, ${FOUL_WORD[shot.foul]}; ${them} gets to place the cue ball anywhere.`,
      notable: false
    }
  }
  if (shot.assigned) {
    return { cue: `${who} potted ${ballsWord(shot.potted)} and so plays ${shot.assigned} for this rack.`, notable: false }
  }
  if (shot.own.length > 0) return { cue: `${who} potted ${ballsWord(shot.own)} and shoots again.`, notable: false }
  if (shot.other.length > 0 && !shot.breakShot) {
    return {
      cue: `${who} potted ${ballsWord(shot.other)}, which ${shot.other.length > 1 ? 'are' : 'is'} ${them}'s, not ${shot.by === 'reader' ? 'his' : 'her'} own: a mistake that helps ${them}, and the turn passes.`,
      notable: false
    }
  }
  if (!shot.breakShot) return { cue: `${who} missed and the turn passes to ${them}.`, notable: false }
  return null
}

/** How the match stands, for anything said at the table. */
export function matchSituation(
  name: string,
  rack: Rack,
  won: Record<Side, number>,
  race: number,
  stake: string
): string {
  const side = (who: Side): string => {
    const label = who === 'reader' ? 'the reader' : name
    const group = rack.groups[who]
    if (!group) return `${label} has no group yet`
    const left = ballsLeft(rack, who).length
    return `${label} is ${group} with ${left === 0 ? 'only the eight left' : `${left} left`}`
  }
  const terms =
    race > 1
      ? `Eight-ball pool, best of ${race * 2 - 1} racks, the reader ${won.reader} and ${name} ${won.her}.`
      : 'Eight-ball pool, a single rack.'
  const turn = rack.winner
    ? `The rack has just gone to ${rack.winner === 'reader' ? 'the reader' : name}.`
    : `It is ${rack.turn === 'reader' ? "the reader's" : `${name}'s`} shot${rack.inHand ? ', with the cue ball in hand after a foul' : rack.breaking ? ', the break' : ''}.`
  return `${terms} In this rack ${side('reader')}; ${side('her')}. ${turn}${stake ? ` Riding on it: ${stake}` : ''}`
}

/**
 * The match so far for the scene's writer, should it be walked away from: the racks won, who is on
 * which group and what each has left, and whose shot it was.
 */
export function matchProgress(
  name: string,
  rack: Rack,
  won: Record<Side, number>,
  race: number
): string[] {
  const called = (side: Side): string => (side === 'reader' ? 'the reader' : name)
  const lines = [
    `It was eight-ball pool, ${race > 1 ? 'best of three racks' : 'a single rack'}, and it was not played to the end.`
  ]
  if (race > 1) {
    lines.push(`Racks won so far: the reader ${won.reader}, ${name} ${won.her}.`)
  }
  if (rack.winner) {
    lines.push(`The last rack had just gone to ${called(rack.winner)}; the next was not begun.`)
    return lines
  }
  if (rack.breaking) {
    lines.push(`The balls were racked and ${called(rack.turn)} was about to break.`)
    return lines
  }
  const side = (who: Side): string => {
    const group = rack.groups[who]
    const left = ballsLeft(rack, who).length
    return `${called(who)} was ${group} with ${left === 0 ? 'only the eight left' : `${left} of 7 still to pot`}`
  }
  lines.push(
    rack.groups.reader
      ? `In the rack on the table ${side('reader')}; ${side('her')}.`
      : 'In the rack on the table nobody had potted a ball yet: no groups were settled.'
  )
  lines.push(
    `It was ${rack.turn === 'reader' ? "the reader's" : `${name}'s`} shot${rack.inHand ? ', with the cue ball in hand after a foul' : ''}.`
  )
  return lines
}

/** A table being cleared alone so far, the same way. */
export function soloProgress(rack: Rack, shots: readonly ShotRecord[]): string[] {
  const left = ballsLeft(rack, 'reader').length
  const fouls = shots.filter((shot) => shot.foul).length
  return [
    `The reader was clearing a pool table alone and stopped before it was clear: ${15 - left} of 15 balls potted in ${shots.length} ${shots.length === 1 ? 'shot' : 'shots'}, ${fouls} ${fouls === 1 ? 'foul' : 'fouls'}, ${left} still on the table.`
  ]
}

/** What a side did over a rack. */
export interface Tally {
  /** Shots played, the break included. */
  shots: number
  /** Balls of their own potted on a shot that was no foul. */
  pots: number
  fouls: number
  flukes: number
  clean: number
  long: number
  bestRun: number
}

export function tallyOf(shots: readonly ShotRecord[], side: Side): Tally {
  const tally: Tally = { shots: 0, pots: 0, fouls: 0, flukes: 0, clean: 0, long: 0, bestRun: 0 }
  for (const shot of shots) {
    if (shot.by !== side) continue
    tally.shots++
    if (!shot.foul) tally.pots += shot.own.length
    if (shot.foul) tally.fouls++
    if (shot.fluke) tally.flukes++
    if (shot.clean) tally.clean++
    if (shot.long) tally.long++
    tally.bestRun = Math.max(tally.bestRun, shot.run)
  }
  return tally
}

/** The racks each side has won. */
export function racksWon(racks: readonly RackRecord[]): Record<Side, number> {
  return {
    reader: racks.filter((rack) => rack.winner === 'reader').length,
    her: racks.filter((rack) => rack.winner === 'her').length
  }
}

/** The match in the scene's own narration. */
export function matchSummary(name: string, racks: readonly RackRecord[]): string {
  const won = racksWon(racks)
  const mine = won.reader > won.her
  const last = racks[racks.length - 1]
  const final = last?.shots[last.shots.length - 1]
  const how =
    final?.eight === 'win'
      ? mine
        ? 'sinking the eight'
        : 'when she sinks the eight'
      : final?.eight === 'early'
        ? mine
          ? 'when she pots the eight too early'
          : 'by potting the eight too early'
        : mine
          ? 'when she fouls on the eight'
          : 'by fouling on the eight'
  if (racks.length === 1) {
    return `You play a rack of eight-ball with ${name} and ${mine ? 'win' : 'lose'}, ${how}.`
  }
  return `You play eight-ball with ${name}, best of three, and ${mine ? 'win' : 'lose'} ${Math.max(won.reader, won.her)} racks to ${Math.min(won.reader, won.her)}, ${how} in the last.`
}

/** The match for the scene's writer: what was played, how each rack went, and play told from luck. */
export function matchAccount(name: string, racks: readonly RackRecord[], race: number): string[] {
  const called = (side: Side): string => (side === 'reader' ? 'the reader' : name)
  const lines = [
    `It was eight-ball pool, ${race > 1 ? 'best of three racks' : 'a single rack'}: played standing round the table, taking turns, unhurried, a few minutes a rack.`
  ]
  racks.forEach((rack, i) => {
    if (!rack.winner) return
    const loser = otherSide(rack.winner)
    const final = rack.shots[rack.shots.length - 1]
    const ending =
      final?.eight === 'win'
        ? `${called(rack.winner)} potted the eight to win it`
        : final?.eight === 'early'
          ? `${called(loser)} threw it away by potting the eight too early`
          : `${called(loser)} lost it by fouling on the eight`
    const left = rack.left[loser]
    const close =
      final?.eight !== 'win'
        ? `${called(rack.winner)} still had ${rack.left[rack.winner]} of their own balls up, so it was handed over rather than won`
        : left === 0
          ? `${called(loser)} was on the eight too: it could not have been closer`
          : left <= 2
            ? `${called(loser)} had only ${left} left: close`
            : `${called(loser)} still had ${left} balls on the table: not close`
    // An eight down off the break is no win and no loss, and is said so nobody takes it for either.
    const back = rack.shots[0]?.eightBack ? ' and the eight dropped on the break and was put back on its spot' : ''
    lines.push(
      `${racks.length > 1 ? `Rack ${i + 1}` : 'The rack'}: ${called(rack.breaker)} broke${back}, ${ending}; ${close}.`
    )
  })

  const all = racks.flatMap((rack) => rack.shots)
  for (const side of ['reader', 'her'] as const) {
    const t = tallyOf(all, side)
    const bits = [`${t.pots} ${t.pots === 1 ? 'ball' : 'balls'} potted in ${t.shots} ${t.shots === 1 ? 'shot' : 'shots'}`]
    if (t.bestRun >= RUN_WORTH) bits.push(`a best run of ${t.bestRun} in a row`)
    if (t.long) bits.push(`${t.long} long ${t.long === 1 ? 'pot' : 'pots'}`)
    if (t.flukes) bits.push(`${t.flukes} of the pots ${t.flukes === 1 ? 'was a fluke' : 'were flukes'}, luck not aim`)
    bits.push(
      t.fouls === 0 ? 'no fouls' : `${t.fouls} ${t.fouls === 1 ? 'foul' : 'fouls'} that gave the cue ball away`
    )
    lines.push(`${capital(called(side))}: ${bits.join(', ')}.`)
  }

  // Her cueing is known exactly: whether her misses were near things or well off the line.
  const hers = all.filter((shot) => shot.by === 'her' && !shot.breakShot && shot.aimError !== null)
  if (hers.length >= 3) {
    const off = hers.reduce((sum, shot) => sum + Math.abs(shot.aimError ?? 0), 0) / hers.length
    lines.push(
      off < 0.004
        ? `${name} cued very straight all game: her pots were earned.`
        : off < 0.012
          ? `${name} cued decently, a little off line now and then.`
          : `${name} was often well off the line she was aiming for: her misses were her own doing, not bad luck.`
    )
  }
  const won = racksWon(racks)
  lines.push(
    racks.length > 1
      ? `Final: the reader ${won.reader} ${won.reader === 1 ? 'rack' : 'racks'}, ${name} ${won.her}; ${won.reader > won.her ? 'the reader' : name} won the match.`
      : `${won.reader > won.her ? 'The reader' : name} won.`
  )
  return lines
}

/** A table cleared alone, in the scene's narration. */
export function soloSummary(shots: readonly ShotRecord[]): string {
  const fouls = shots.filter((shot) => shot.foul).length
  return `You rack up and clear the pool table alone in ${shots.length} shots${fouls ? `, ${fouls === 1 ? 'one foul' : `${fouls} fouls`} along the way` : ', without a foul'}.`
}

/** The same for the scene's writer, for whoever was there to have watched. */
export function soloAccount(shots: readonly ShotRecord[]): string[] {
  const t = tallyOf(shots, 'reader')
  const lines = [
    `The reader played pool alone, clearing all fifteen balls: ${shots.length} shots, ${t.fouls} ${t.fouls === 1 ? 'foul' : 'fouls'}, a best run of ${t.bestRun} in a row.`
  ]
  lines.push(
    shots.length <= 22
      ? 'That is sharp shooting: hardly a miss.'
      : shots.length <= 40
        ? 'A decent, unhurried clearance.'
        : 'It took him a good while: plenty of misses.'
  )
  if (t.flukes) lines.push(`${t.flukes} of his pots went in by luck rather than aim.`)
  return lines
}
