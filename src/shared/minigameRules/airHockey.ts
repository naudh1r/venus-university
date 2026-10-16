/**
 * Air hockey's rules, with no table in them: the puck and the two mallets, the walls and the goal
 * mouths, how she plays at her skill, and how a match is told afterwards. The reader has the
 * bottom half of the table and she the top; a goal is the puck going through the mouth in the
 * other side's wall, or coming to rest in it. Lengths are in the table's own units, times in
 * seconds.
 */

/** The table: its width and its length, the reader's end at the bottom. */
export const TABLE_W = 300
export const TABLE_H = 400
export const PUCK_R = 11
export const MALLET_R = 20
/** How wide each goal mouth is, centred in its end wall. */
export const GOAL_W = 112
/** The fastest the puck goes, however hard it is hit. */
export const MAX_SPEED = 900
/** The physics' own step: the table is always advanced by this much at a time. */
export const STEP = 1 / 120
/** How much of its speed the puck loses each second to the table. */
const DRAG = 0.32
/** How much of its speed the puck keeps off a wall, and off a mallet. */
const WALL_BOUNCE = 0.9
const MALLET_BOUNCE = 0.85
/** The fastest the reader's mallet follows his hand: quick, and never through the puck. */
export const READER_SPEED = 2600
/** How far up from its end wall a served puck is put, and where a mallet waits. */
const SERVE_FROM = 110
const HOME_FROM = 50
/** How long a puck may lie where it is before it is served again, and how far counts as moving. */
export const STALL_S = 5
const STALL_REACH = 12
/** First to this many, where nothing else was agreed. */
export const GOALS_TO_WIN = 5

export type Side = 'reader' | 'her'

export interface Point {
  x: number
  y: number
}

/** Something on the table that moves: where it is, and how fast. */
export interface Body extends Point {
  vx: number
  vy: number
}

export interface Table {
  puck: Body
  reader: Body
  her: Body
}

/** Where a side's mallet waits: in front of its own goal. */
export function homeOf(side: Side): Point {
  return { x: TABLE_W / 2, y: side === 'her' ? HOME_FROM : TABLE_H - HOME_FROM }
}

/** The puck at rest in a side's half, for that side to hit first. */
export function servedPuck(to: Side): Body {
  return {
    x: TABLE_W / 2,
    y: to === 'her' ? SERVE_FROM : TABLE_H - SERVE_FROM,
    vx: 0,
    vy: 0
  }
}

/** A table set for a serve: both mallets at home and the puck with `to`. */
export function freshTable(to: Side): Table {
  return {
    puck: servedPuck(to),
    reader: { ...homeOf('reader'), vx: 0, vy: 0 },
    her: { ...homeOf('her'), vx: 0, vy: 0 }
  }
}

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

/** A point held inside a side's own half, a mallet's width from every edge of it. */
export function inHalf(side: Side, point: Point): Point {
  return {
    x: clamp(point.x, MALLET_R, TABLE_W - MALLET_R),
    y:
      side === 'her'
        ? clamp(point.y, MALLET_R, TABLE_H / 2 - MALLET_R)
        : clamp(point.y, TABLE_H / 2 + MALLET_R, TABLE_H - MALLET_R)
  }
}

/** Whether a puck at `x` is in line with a goal mouth rather than the wall beside it. */
export function inMouth(x: number): boolean {
  return Math.abs(x - TABLE_W / 2) <= GOAL_W / 2 - PUCK_R
}

/** Moves a mallet toward where it is wanted, no faster than it can go, and notes its speed. */
function moveMallet(mallet: Body, side: Side, toward: Point, speed: number, dt: number): void {
  const goal = inHalf(side, toward)
  const dx = goal.x - mallet.x
  const dy = goal.y - mallet.y
  const far = Math.hypot(dx, dy)
  const reach = speed * dt
  const part = far > reach ? reach / far : 1
  mallet.vx = (dx * part) / dt
  mallet.vy = (dy * part) / dt
  mallet.x += dx * part
  mallet.y += dy * part
}

/** A mallet meeting the puck: the puck is put clear of it and takes the mallet's speed with it. */
function strike(puck: Body, mallet: Body): void {
  let nx = puck.x - mallet.x
  let ny = puck.y - mallet.y
  let apart = Math.hypot(nx, ny)
  const touch = PUCK_R + MALLET_R
  if (apart >= touch) return
  if (apart === 0) {
    // Dead centre: off toward the far end, there being no better way to call it.
    nx = 0
    ny = mallet.y > TABLE_H / 2 ? -1 : 1
    apart = 1
  }
  nx /= apart
  ny /= apart
  puck.x = mallet.x + nx * touch
  puck.y = mallet.y + ny * touch
  // The mallet is the heavy one: only the puck's speed changes, by how fast the two close.
  const closing = (puck.vx - mallet.vx) * nx + (puck.vy - mallet.vy) * ny
  if (closing >= 0) return
  puck.vx -= (1 + MALLET_BOUNCE) * closing * nx
  puck.vy -= (1 + MALLET_BOUNCE) * closing * ny
}

function capSpeed(puck: Body): void {
  const speed = Math.hypot(puck.vx, puck.vy)
  if (speed <= MAX_SPEED) return
  puck.vx *= MAX_SPEED / speed
  puck.vy *= MAX_SPEED / speed
}

/** The side walls, and the end walls either side of each mouth. */
function bounceOffWalls(puck: Body): void {
  if (puck.x < PUCK_R) {
    puck.x = PUCK_R
    puck.vx = Math.abs(puck.vx) * WALL_BOUNCE
  } else if (puck.x > TABLE_W - PUCK_R) {
    puck.x = TABLE_W - PUCK_R
    puck.vx = -Math.abs(puck.vx) * WALL_BOUNCE
  }
  const past = puck.y < PUCK_R || puck.y > TABLE_H - PUCK_R
  if (!past) return
  if (inMouth(puck.x)) return
  // Already into a mouth, it is between the posts and stays there.
  if (puck.y < 0 || puck.y > TABLE_H) {
    const edge = GOAL_W / 2 - PUCK_R
    puck.x = clamp(puck.x, TABLE_W / 2 - edge, TABLE_W / 2 + edge)
    puck.vx = -puck.vx * WALL_BOUNCE
    return
  }
  if (puck.y < PUCK_R) {
    puck.y = PUCK_R
    puck.vy = Math.abs(puck.vy) * WALL_BOUNCE
  } else {
    puck.y = TABLE_H - PUCK_R
    puck.vy = -Math.abs(puck.vy) * WALL_BOUNCE
  }
}

/**
 * Advances the table by `dt`: each mallet toward where it is wanted, the puck on its way, off the
 * mallets and the walls. Returns who scored where the puck went through a mouth, the table left
 * as it was at that moment; null otherwise.
 */
export function stepTable(
  table: Table,
  readerTo: Point,
  herTo: Point,
  herSpeed: number,
  dt: number = STEP
): Side | null {
  const { puck } = table
  moveMallet(table.reader, 'reader', readerTo, READER_SPEED, dt)
  moveMallet(table.her, 'her', herTo, herSpeed, dt)

  const slow = Math.exp(-DRAG * dt)
  puck.vx *= slow
  puck.vy *= slow
  puck.x += puck.vx * dt
  puck.y += puck.vy * dt

  strike(puck, table.reader)
  strike(puck, table.her)
  capSpeed(puck)
  bounceOffWalls(puck)
  // A mallet may have had it against a wall: the wall wins.
  puck.x = clamp(puck.x, PUCK_R, TABLE_W - PUCK_R)

  if (puck.y < -PUCK_R) return 'reader'
  if (puck.y > TABLE_H + PUCK_R) return 'her'
  return null
}

/** How a girl plays at one level of skill. */
export interface Play {
  /** How long she takes to see where the puck has got to, in seconds. */
  reaction: number
  /** How fast her mallet moves. */
  speed: number
  /** How far off her hand may be from where she meant it, either way. */
  error: number
  /** How well she gets back in front of her goal and reads a shot coming: 0 to 1. */
  guard: number
}

const PLAYS: Readonly<Record<number, Play>> = {
  1: { reaction: 0.36, speed: 230, error: 46, guard: 0.3 },
  2: { reaction: 0.28, speed: 310, error: 34, guard: 0.5 },
  3: { reaction: 0.21, speed: 400, error: 24, guard: 0.68 },
  4: { reaction: 0.15, speed: 500, error: 15, guard: 0.85 },
  5: { reaction: 0.1, speed: 610, error: 8, guard: 1 }
}

/** How she plays at a skill from 1 to 5; anything else is taken as the nearest of them. */
export function playAt(skill: number): Play {
  return PLAYS[clamp(Math.round(skill) || 1, 1, 5)]
}

/** What she is doing between one look at the table and the next. */
export interface Mind {
  /** Where her mallet is headed. */
  to: Point
  /** How long until she looks again. */
  wait: number
  /** Where the puck was when it last got anywhere, and how long it has lain about there since. */
  from: Point | null
  still: number
}

export function freshMind(): Mind {
  return { to: homeOf('her'), wait: 0, from: null, still: 0 }
}

/** Whose half the puck is in. */
export function halfOf(puck: Point): Side {
  return puck.y < TABLE_H / 2 ? 'her' : 'reader'
}

/**
 * Who has scored with a puck that never went all the way through: it has lain as long as a
 * stalled one, across the line of a goal mouth, where no mallet can get behind it. Null for a
 * puck anywhere else, or one still moving.
 */
export function sunk(table: Table, mind: Mind): Side | null {
  if (mind.still < STALL_S) return null
  const { puck } = table
  if (!inMouth(puck.x)) return null
  if (puck.y < PUCK_R) return 'reader'
  if (puck.y > TABLE_H - PUCK_R) return 'her'
  return null
}

/**
 * Who the puck is to be served to again, having lain in one place too long: pinned to a wall,
 * left at the line where neither will fetch it, or just not played. Null while it is still in
 * play. A serve nobody has touched yet is left to wait for whoever it is with, and a puck at
 * rest in a goal mouth is no serve but a goal: {@link sunk}.
 */
export function stalled(table: Table, mind: Mind): Side | null {
  if (mind.still < STALL_S) return null
  if (sunk(table, mind)) return null
  const side = halfOf(table.puck)
  const serve = servedPuck(side)
  const { puck } = table
  if (puck.x === serve.x && puck.y === serve.y && puck.vx === 0 && puck.vy === 0) return null
  return side
}

/** Where a puck going straight would be across the table after `time`, the side walls folded in. */
function foldedX(x: number, vx: number, time: number): number {
  const span = TABLE_W - 2 * PUCK_R
  const along = (((x - PUCK_R + vx * time) % (2 * span)) + 2 * span) % (2 * span)
  return PUCK_R + (along > span ? 2 * span - along : along)
}

/**
 * Where she means her mallet to go, looking at the table as it stands. A shot coming at her she
 * gets in front of; a puck in her half she gets behind and drives at the reader's goal; a puck in
 * his she waits for, in front of her own goal. How well she does each is her skill.
 */
export function herAim(table: Table, skill: number, random: () => number = Math.random): Point {
  const play = playAt(skill)
  const { puck, her } = table
  const home = homeOf('her')
  const slip = (random() * 2 - 1) * play.error

  // Coming at her, and still in front of her mallet: where it will cross her line, as far as
  // she can read it.
  if (puck.vy < -140 && puck.y > her.y) {
    const time = (puck.y - home.y) / -puck.vy
    const read = foldedX(puck.x, puck.vx, time)
    return inHalf('her', { x: puck.x + (read - puck.x) * play.guard + slip, y: home.y })
  }

  if (puck.y < TABLE_H / 2 + PUCK_R) {
    // Driven from behind, toward a spot in his goal.
    const at = { x: TABLE_W / 2 + slip * 1.5, y: TABLE_H }
    const far = Math.hypot(at.x - puck.x, at.y - puck.y) || 1
    const dx = (at.x - puck.x) / far
    const dy = (at.y - puck.y) / far
    const behind = her.y < puck.y - 6
    // Against her own wall there is no getting behind it: she knocks it out sideways.
    if (behind || puck.y < MALLET_R + PUCK_R)
      return inHalf('her', { x: puck.x + dx * 16 + slip * 0.4, y: puck.y + dy * 16 })
    const back = MALLET_R + PUCK_R + 14
    return inHalf('her', { x: puck.x - dx * back + slip, y: puck.y - dy * back })
  }

  // In his half: back toward her goal, shading across to the puck's side, as far as she bothers.
  const guarded = {
    x: home.x + (puck.x - home.x) * 0.45 + slip,
    y: home.y
  }
  return inHalf('her', {
    x: her.x + (guarded.x - her.x) * play.guard,
    y: her.y + (guarded.y - her.y) * play.guard
  })
}

/**
 * One step of a match: she looks at the table when her reaction time has run, and between looks
 * keeps going where she last meant to; then the table moves. Returns who scored, if anyone did.
 */
export function advance(
  table: Table,
  mind: Mind,
  readerTo: Point,
  skill: number,
  random: () => number = Math.random,
  dt: number = STEP
): Side | null {
  const play = playAt(skill)
  mind.wait -= dt
  if (mind.wait <= 0) {
    mind.to = herAim(table, skill, random)
    mind.wait = play.reaction
  }
  const by = stepTable(table, readerTo, mind.to, play.speed, dt)
  const { puck } = table
  if (!mind.from || Math.hypot(puck.x - mind.from.x, puck.y - mind.from.y) > STALL_REACH) {
    mind.from = { x: puck.x, y: puck.y }
    mind.still = 0
  } else mind.still += dt
  return by
}

/** The count after some goals: the reader's, then hers. */
export function scoreOf(goals: readonly Side[]): { mine: number; hers: number } {
  const hers = goals.filter((side) => side === 'her').length
  return { mine: goals.length - hers, hers }
}

/** Whether the match is over: one of them has the goals it is played to. */
export function matchOver(goals: readonly Side[], toWin: number): boolean {
  const { mine, hers } = scoreOf(goals)
  return mine >= toWin || hers >= toWin
}

/** A count as it is said: the leader's first, or "all" where they are level. */
function countWords(mine: number, hers: number, name: string): string {
  if (mine === hers) return `${mine}–${hers}, all level`
  return mine > hers ? `${mine}–${hers} to you` : `${hers}–${mine} to ${name}`
}

/** A goal, as the scene narrates it: who scored, and the count. */
export function goalLine(name: string, goals: readonly Side[]): string {
  const { mine, hers } = scoreOf(goals)
  const who = goals[goals.length - 1] === 'her' ? `${name} scores` : 'You score'
  return `${who}. ${countWords(mine, hers, name)}.`
}

/** How a finished match is told in the scene's own narration. */
export function matchSummary(name: string, goals: readonly Side[]): string {
  const { mine, hers } = scoreOf(goals)
  return mine > hers
    ? `You beat ${name} at air hockey, ${mine}–${hers}.`
    : `${name} beat you at air hockey, ${hers}–${mine}.`
}

/** A turn in a match worth a word from her, told plainly for whoever writes her line. */
export interface Swing {
  kind: 'lead' | 'behind' | 'level' | 'match-point'
  cue: string
}

/** How far ahead the reader is after the first `count` goals; negative where she is. */
function marginAt(goals: readonly Side[], count: number): number {
  const { mine, hers } = scoreOf(goals.slice(0, count))
  return mine - hers
}

/**
 * Whether the last goal in `goals` turned the match, and how: she takes the lead, she falls two
 * or more behind, one of them pulls level from two or more down, or one of them is a goal from
 * winning. Null for a goal that only moved the count.
 */
export function swingAt(name: string, goals: readonly Side[], toWin: number): Swing | null {
  if (goals.length === 0) return null
  const { mine, hers } = scoreOf(goals)
  const byHer = goals[goals.length - 1] === 'her'
  const now = mine - hers
  const before = marginAt(goals, goals.length - 1)
  const count = `It is the reader ${mine}, ${name} ${hers}, first to ${toWin}.`
  // The furthest the one who just scored has been behind since it was last level.
  let deepest = 0
  for (let i = goals.length - 1; i > 0; i--) {
    const margin = marginAt(goals, i) * (byHer ? -1 : 1)
    if (margin === 0) break
    deepest = Math.max(deepest, -margin)
  }

  if (now === 0 && deepest >= 2)
    return {
      kind: 'level',
      cue: `${byHer ? name : 'The reader'} has just scored to pull level after being ${deepest} goals down. ${count}`
    }
  if ((byHer ? hers : mine) === toWin - 1)
    return {
      kind: 'match-point',
      cue: `${byHer ? name : 'The reader'} has just scored and needs one more goal to win. ${count}`
    }
  if (byHer && now < 0 && before >= 0)
    return { kind: 'lead', cue: `${name} has just scored to take the lead. ${count}` }
  if (!byHer && now >= 2 && before < 2)
    return {
      kind: 'behind',
      cue: `The reader has just scored again and ${name} is now ${now} goals behind. ${count}`
    }
  return null
}

/** What she is told of a goal that turned nothing, where she talks through all of them. */
export function goalCue(name: string, goals: readonly Side[], toWin: number): string {
  const { mine, hers } = scoreOf(goals)
  const who = goals[goals.length - 1] === 'her' ? `${name} has just scored` : 'The reader has just scored'
  return `${who}. It is the reader ${mine}, ${name} ${hers}, first to ${toWin}.`
}

/** How the match stands, in a line, for anything said at the table. */
export function matchSituation(
  name: string,
  goals: readonly Side[],
  toWin: number,
  stake = ''
): string {
  const { mine, hers } = scoreOf(goals)
  const over = matchOver(goals, toWin)
  return [
    `The game is air hockey, first to ${toWin} goals, played fast across the table.`,
    `The score is the reader ${mine}, ${name} ${hers}.`,
    over
      ? 'The last goal has just gone in.'
      : goals.length === 0
        ? 'Nobody has scored yet.'
        : `${goals[goals.length - 1] === 'her' ? name : 'The reader'} scored the last goal.`,
    ...(stake ? [`Riding on it: ${stake}`] : [])
  ].join(' ')
}

/**
 * How a match stands partway through, for the scene's writer should the reader walk away from
 * it: what is being played, the goals so far in order, the score and who leads. Nothing in it
 * says the match ended.
 */
export function matchAccountSoFar(name: string, goals: readonly Side[], toWin: number): string[] {
  const { mine, hers } = scoreOf(goals)
  const called = (side: Side): string => (side === 'her' ? name : 'the reader')
  const lines = [
    `It was air hockey, first to ${toWin} goals: a fast, physical game played standing at the table, all reflexes and quick hands. It was not played to the end.`
  ]
  if (goals.length === 0) return [...lines, 'Nobody had scored yet.']

  lines.push(`The goals so far, in order: ${goals.map(called).join(', ')}.`)
  lines.push(`The score when it stopped: the reader ${mine}, ${name} ${hers}.`)
  if (mine === hers) lines.push('They were level.')
  else {
    const leader: Side = mine > hers ? 'reader' : 'her'
    const ahead = Math.abs(mine - hers)
    const short = toWin - Math.max(mine, hers)
    const leading = `${called(leader).charAt(0).toUpperCase()}${called(leader).slice(1)} was leading by ${ahead === 1 ? 'a goal' : `${ahead} goals`}`
    lines.push(
      short === 1
        ? `${leading}, and one more goal would have won it.`
        : `${leading}, ${short} short of winning.`
    )
  }
  return lines
}

/**
 * How a match against her went, for the scene's writer: what was played, the goals in order, who
 * led and whether it changed hands, a comeback, a shutout or a close finish, and the final score.
 */
export function matchAccount(name: string, goals: readonly Side[], toWin: number): string[] {
  const { mine, hers } = scoreOf(goals)
  const called = (side: Side): string => (side === 'her' ? name : 'the reader')
  const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
  const lines = [
    `It was air hockey, first to ${toWin} goals: a fast, physical game played standing at the table, all reflexes and quick hands, over in a couple of minutes.`
  ]
  if (goals.length === 0) return [...lines, 'Nobody scored.']

  lines.push(`The goals, in order: ${goals.map(called).join(', ')}.`)

  const margins = goals.map((_, i) => marginAt(goals, i + 1))
  // Who was ahead after each goal, the level counts left out: the lead as it passed between them.
  const leaders = margins.filter((m) => m !== 0).map((m): Side => (m > 0 ? 'reader' : 'her'))
  const changes = leaders.filter((side, i) => i > 0 && side !== leaders[i - 1]).length
  const levelled = margins.slice(0, -1).some((m) => m === 0)
  const winner: Side | null = mine === hers ? null : mine > hers ? 'reader' : 'her'
  const loser: Side = winner === 'reader' ? 'her' : 'reader'

  if (changes > 0)
    lines.push(
      `${capital(called(goals[0]))} scored first, and the lead changed hands ${changes === 1 ? 'once' : `${changes} times`}.`
    )
  else if (levelled)
    lines.push(
      `${capital(called(goals[0]))} scored first and was never behind, though it was level along the way.`
    )
  else lines.push(`${capital(called(goals[0]))} scored first and led from then to the end.`)

  if (winner) {
    const sign = winner === 'reader' ? 1 : -1
    const deepest = -Math.min(0, ...margins.map((m) => m * sign))
    if (deepest >= 2)
      lines.push(
        `A comeback: ${called(winner)} was ${deepest} goals down at one point and still won.`
      )
    const lost = winner === 'reader' ? hers : mine
    if (lost === 0)
      lines.push(`A shutout: ${called(loser)} did not score once.`)
    else if (lost === toWin - 1)
      lines.push(
        `It went to the last goal: at ${lost}–${lost} either of them could have won it.`
      )
    else if (toWin - lost >= 3 && deepest === 0)
      lines.push(`It was one-sided: ${called(loser)} was never close.`)
  }

  lines.push(`Final score: the reader ${mine}, ${name} ${hers}.`)
  return lines
}
