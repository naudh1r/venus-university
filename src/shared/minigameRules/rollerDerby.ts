import { listed } from '../minigameKit'

/**
 * Rink Race's rules: the oval, what a stride is worth by its timing, what a bend does to a
 * skater who does not lean, how a girl skates by her skill, the finishing order and what the
 * scene is told of it. Skater 0 is always the reader; the girls follow in the order they sit.
 */

/** One lap of the oval, in metres: two straights and two bends, 25 m each. */
export const LAP_M = 100
/** The stride tempo that carries best: one push every this many ms, feet alternating. */
export const BEAT_MS = 420
/** A gap this long since the last push is a fresh push-off: either foot, no tempo to keep. */
export const FRESH_MS = 900
/** How far off the tempo a stride may land, either side, and still be judged each way, in ms. */
export const WINDOWS = { perfect: 45, good: 95, rough: 160 } as const
/** The rink calls time on anyone still out after this long a lap, in ms. */
export const LIMIT_MS_PER_LAP = 30000
/** Two finishers closer than this are a photo finish, in ms. */
export const PHOTO_MS = 150

export const MIN_LAPS = 2
export const MAX_LAPS = 6
export const DEFAULT_LAPS = 3

/** A number of laps the rink can run, whatever was asked for. */
export function lapsOf(asked: number | undefined): number {
  const whole = Math.round(asked ?? DEFAULT_LAPS)
  if (!Number.isFinite(whole)) return DEFAULT_LAPS
  return Math.min(MAX_LAPS, Math.max(MIN_LAPS, whole))
}

export type Foot = 'left' | 'right'

/** How a stride landed: on the tempo, near it, well off it, nowhere near, or on the same foot twice. */
export type Stride = 'perfect' | 'good' | 'rough' | 'off' | 'same'

export const STRIDES: readonly Stride[] = ['perfect', 'good', 'rough', 'off', 'same']

/**
 * The speed a full stride adds, in m/s. The same foot again adds nothing and costs speed
 * instead. A stride that comes early is a short one, and adds less by {@link strideReach}.
 */
export const PUSH: Readonly<Record<Stride, number>> = {
  perfect: 1.9,
  good: 1.75,
  rough: 1.5,
  off: 1.0,
  same: 0
}

/**
 * How much of a full push a stride gets in, from 0 to 1, by the time since the one before: a
 * leg brought round early has not finished its glide, so hammering the keys goes nowhere.
 */
export function strideReach(intervalMs: number | null): number {
  if (intervalMs === null || intervalMs > BEAT_MS) return 1
  return Math.pow(Math.max(0, intervalMs) / BEAT_MS, 1.25)
}
/** The share of her speed a skater keeps when she pushes off the same foot twice. */
const SAME_FOOT_KEEPS = 0.85
/** How fast speed bleeds away between pushes, per second, and the extra for crouching on a straight. */
const DRAG = 0.5
const LEAN_DRAG = 0.9
/** Nobody skates faster than this, in m/s. */
export const TOP_SPEED = 10.5

/** How fast an unleaning skater slides out in a bend at 9 m/s, per second, from 0 (the line) to 1 (the wall). */
const DRIFT_RATE = 1.3
/** How fast she comes back to the line, per second: leaning in a bend, and on a straight. */
const LEAN_RECOVER = 2.2
const STRAIGHT_RECOVER = 1.6
/** How much longer the way round is at the wall than on the line. */
const WIDE_COST = 0.3
/** Reaching the wall at this speed or more is a fall; slower, a wobble off the boards. */
export const FALL_SPEED = 7
/** How long a fallen skater is down, in ms. */
export const DOWN_MS = 1500
/** What a wobble off the boards, and a clip of another skater, leave of a skater's speed. */
const WALL_KEEPS = 0.55
const CLIP_KEEPS = 0.8
/** A pass in a bend clips when either skater is this far off her line. */
const CLIP_DRIFT = 0.5
/** A bend counts as run wide once the skater is this far off the line. */
const WIDE_AT = 0.5
/** The lead changes hands when another skater is this far clear of the leader, in metres. */
const LEAD_CLEAR_M = 0.5

/**
 * A stride judged by the time since the push before it and by the foot. `intervalMs` is null
 * for a push-off from a standstill or after a long glide, which is always a good one.
 */
export function judgeStride(intervalMs: number | null, sameFoot: boolean): Stride {
  if (intervalMs === null || intervalMs > FRESH_MS) return 'good'
  if (sameFoot) return 'same'
  const off = Math.abs(intervalMs - BEAT_MS)
  if (off <= WINDOWS.perfect) return 'perfect'
  if (off <= WINDOWS.good) return 'good'
  if (off <= WINDOWS.rough) return 'rough'
  return 'off'
}

/** Whether a skater this far round the rink is in a bend. The line is in the middle of a straight. */
export function inBend(dist: number): boolean {
  const round = (((dist % LAP_M) + LAP_M) % LAP_M) / LAP_M
  return (round >= 0.125 && round < 0.375) || (round >= 0.625 && round < 0.875)
}

/** How a girl skates, from 1 (clinging to the boards) to 5 (grew up on wheels). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** How far off the tempo her strides wander, by skill: the spread of her timing, in ms. */
const TIMING_MS: Readonly<Record<Skill, number>> = { 1: 95, 2: 78, 3: 60, 4: 42, 5: 25 }
/** The chance a stride of hers comes off the wrong foot. */
const MISSTEP: Readonly<Record<Skill, number>> = { 1: 0.07, 2: 0.04, 3: 0.02, 4: 0.008, 5: 0.002 }
/** The furthest into a bend she is before she leans, in metres. */
const LEAN_LATE_M: Readonly<Record<Skill, number>> = { 1: 5.2, 2: 3.8, 3: 2.4, 4: 1.3, 5: 0.5 }
/** The chance she misjudges a bend outright and is carried to the wall. */
const LAPSE: Readonly<Record<Skill, number>> = { 1: 0.09, 2: 0.055, 3: 0.03, 4: 0.015, 5: 0.005 }

export interface Skater {
  /** Metres skated since the whistle. */
  dist: number
  /** In m/s. */
  speed: number
  /** How far off the racing line she has slid, from 0 to 1 at the wall. */
  drift: number
  /** Crouched into a lean. */
  lean: boolean
  /** How much longer she is down after a fall, in ms; 0 while she is up. */
  downMs: number
  lastFoot: Foot | null
  /** The race clock at her last push, or null before one and after a fall. */
  lastStrideAt: number | null
  /** The race clock as she crossed the line at the end, or null while she is out. */
  finishedAt: number | null
  /** The race clock at the end of each lap she has finished. */
  lapTimes: number[]
  /** Each fall: the race clock, and the lap she was on. */
  falls: { at: number; lap: number }[]
  /** Wobbles off the boards, clips of another skater, and bends run wide. */
  wobbles: number
  clips: number
  wide: number
  /** The slide she is in has been counted as a bend run wide; taken back if it ends on the boards. */
  wideNow: boolean
  strides: Record<Stride, number>
}

/** What a girl has in mind: when her next push comes, and where she leans for the bend ahead. */
interface Brain {
  skill: Skill
  nextStrideAt: number
  /** The bend she has planned for, counted from the whistle. */
  bend: number
  leanFrom: number
  leanTo: number
  /** Where the lean out of the bend before is let go. */
  holdTo: number
}

export interface Race {
  laps: number
  /** The race clock, in ms from the whistle. */
  t: number
  /** The reader, then the girls. */
  skaters: Skater[]
  brains: (Brain | null)[]
  /** Who is in front, or -1 before anyone is. */
  leader: number
  /** Each time the lead changed hands: when, and to whom. */
  leadChanges: { at: number; to: number }[]
  /** Who was first over the line at the end of each lap. */
  lapLeaders: number[]
  /** The rink called time with skaters still out. */
  called: boolean
}

export type RaceEvent =
  | { kind: 'fall' | 'wobble' | 'clip' | 'finish'; who: number }
  | { kind: 'lap'; who: number; lap: number; first: boolean }
  | { kind: 'lead'; who: number; from: number }
  | { kind: 'called' }

function freshSkater(): Skater {
  return {
    dist: 0,
    speed: 0,
    drift: 0,
    lean: false,
    downMs: 0,
    lastFoot: null,
    lastStrideAt: null,
    finishedAt: null,
    lapTimes: [],
    falls: [],
    wobbles: 0,
    clips: 0,
    wide: 0,
    wideNow: false,
    strides: { perfect: 0, good: 0, rough: 0, off: 0, same: 0 }
  }
}

/** Everyone on the line: the reader and a girl for each skill given. */
export function newRace(laps: number, skills: readonly Skill[]): Race {
  return {
    laps: lapsOf(laps),
    t: 0,
    skaters: [freshSkater(), ...skills.map(freshSkater)],
    brains: [
      null,
      ...skills.map((skill): Brain => ({ skill, nextStrideAt: 0, bend: -1, leanFrom: 0, leanTo: 0, holdTo: 0 }))
    ],
    leader: -1,
    leadChanges: [],
    lapLeaders: [],
    called: false
  }
}

/** The lap a skater is on, from 1, and never past the last. */
export function lapOf(race: Race, who: number): number {
  return Math.min(race.laps, Math.floor(race.skaters[who].dist / LAP_M) + 1)
}

/**
 * A push off one foot at `at` on the race clock: judged, and its speed added. Null where the
 * skater is down or home, and the push counts for nothing.
 */
export function stride(skater: Skater, foot: Foot, at: number): Stride | null {
  if (skater.finishedAt !== null || skater.downMs > 0) return null
  const interval = skater.lastStrideAt === null ? null : at - skater.lastStrideAt
  const fresh = interval === null || interval > FRESH_MS
  const judged = judgeStride(fresh ? null : interval, !fresh && foot === skater.lastFoot)
  skater.speed =
    judged === 'same'
      ? skater.speed * SAME_FOOT_KEEPS
      : Math.min(TOP_SPEED, skater.speed + PUSH[judged] * strideReach(fresh ? null : interval))
  skater.lastFoot = foot
  skater.lastStrideAt = at
  skater.strides[judged]++
  return judged
}

/** The reader's push, at the race clock or a moment the caller knows better. */
export function readerStride(race: Race, foot: Foot, at: number = race.t): Stride | null {
  if (race.called) return null
  return stride(race.skaters[0], foot, at)
}

/** The reader crouches into a lean, or straightens. */
export function readerLean(race: Race, on: boolean): void {
  race.skaters[0].lean = on
}

/** Roughly bell-shaped about 0, with a spread of 1. */
function wander(rand: () => number): number {
  return (rand() + rand() + rand() - 1.5) * 2
}

/** A girl's own skating for this moment: her pushes as they fall due, and her lean for the bend. */
function think(race: Race, who: number, rand: () => number): void {
  const skater = race.skaters[who]
  const brain = race.brains[who]
  if (!brain || skater.finishedAt !== null || skater.downMs > 0) return

  // Bend k runs from 12.5 + 50k metres for 25.
  const bend = Math.floor((skater.dist + 12.5) / 50)
  if (brain.bend !== bend) {
    const start = 12.5 + 50 * bend
    const lapsed = rand() < LAPSE[brain.skill]
    // A good skater is into her crouch a stride before the bend; a poor one well inside it.
    const late = lapsed ? 7.5 + 5 * rand() : LEAN_LATE_M[brain.skill] * rand() - 0.6
    brain.holdTo = brain.leanTo
    brain.bend = bend
    brain.leanFrom = start + late
    brain.leanTo = start + 25 + LEAN_LATE_M[brain.skill] * 0.6 * rand()
  }
  skater.lean = (skater.dist >= brain.leanFrom && skater.dist < brain.leanTo) || skater.dist < brain.holdTo

  if (race.t >= brain.nextStrideAt) {
    const other: Foot = skater.lastFoot === 'left' ? 'right' : 'left'
    const foot = skater.lastFoot !== null && rand() < MISSTEP[brain.skill] ? skater.lastFoot : other
    stride(skater, foot, brain.nextStrideAt)
    brain.nextStrideAt += Math.max(200, BEAT_MS + TIMING_MS[brain.skill] * wander(rand))
  }
}

/** One skater carried forward by `dt` seconds. */
function glide(race: Race, who: number, dt: number, events: RaceEvent[]): void {
  const skater = race.skaters[who]
  if (skater.finishedAt !== null) return
  if (skater.downMs > 0) {
    skater.downMs = Math.max(0, skater.downMs - dt * 1000)
    if (skater.downMs === 0) {
      // Back on her wheels: the next push is a fresh one.
      skater.lastStrideAt = null
      const brain = race.brains[who]
      if (brain) brain.nextStrideAt = race.t + 200
    }
    return
  }
  const bend = inBend(skater.dist)
  skater.speed *= Math.exp(-(DRAG + (skater.lean && !bend ? LEAN_DRAG : 0)) * dt)
  const before = skater.drift
  if (bend && !skater.lean) skater.drift += DRIFT_RATE * (skater.speed / 9) * dt
  else skater.drift = Math.max(0, skater.drift - (bend ? LEAN_RECOVER : STRAIGHT_RECOVER) * dt)
  if (before < WIDE_AT && skater.drift >= WIDE_AT) {
    skater.wide++
    skater.wideNow = true
  } else if (skater.drift < WIDE_AT) skater.wideNow = false

  // The boards are met once: a skater already on them scrapes along until she leans away.
  skater.drift = Math.min(1, skater.drift)
  if (before < 1 && skater.drift >= 1) {
    const brain = race.brains[who]
    // One slide is one thing: a wide that ends on the boards is the wobble or the fall, not both.
    if (skater.wideNow) {
      skater.wide--
      skater.wideNow = false
    }
    if (skater.speed >= FALL_SPEED) {
      skater.falls.push({ at: race.t, lap: lapOf(race, who) })
      skater.downMs = DOWN_MS
      skater.speed = 0
      skater.drift = 0.3
      // She knows where the bend is now.
      if (brain) brain.leanFrom = skater.dist
      events.push({ kind: 'fall', who })
      return
    }
    skater.wobbles++
    skater.speed *= WALL_KEEPS
    if (brain) brain.leanFrom = skater.dist
    events.push({ kind: 'wobble', who })
  }

  const total = race.laps * LAP_M
  const rate = skater.speed / (1 + WIDE_COST * skater.drift)
  const lapBefore = Math.floor(skater.dist / LAP_M)
  const next = skater.dist + rate * dt
  if (next >= total) {
    // The clock as her wheels crossed, inside this step.
    const at = race.t - (rate > 0 ? ((next - total) / rate) * 1000 : 0)
    skater.dist = total
    skater.finishedAt = at
    skater.lapTimes.push(at)
    skater.lean = false
    events.push({ kind: 'finish', who })
    return
  }
  skater.dist = next
  const lap = Math.floor(next / LAP_M)
  if (lap > lapBefore) {
    skater.lapTimes.push(race.t)
    const first = race.lapLeaders.length < lap
    if (first) race.lapLeaders.push(who)
    events.push({ kind: 'lap', who, lap, first })
  }
}

/**
 * The race carried forward by `dtMs` on its one clock: each girl skates as her skill has it,
 * everyone glides, and what happened is handed back in order. The reader's own pushes and lean
 * come in between calls, through {@link readerStride} and {@link readerLean}.
 */
export function advance(race: Race, dtMs: number, rand: () => number = Math.random): RaceEvent[] {
  const events: RaceEvent[] = []
  if (race.called || dtMs <= 0) return events
  race.t += dtMs
  const dt = dtMs / 1000
  const before = race.skaters.map((skater) => skater.dist)
  for (let who = 0; who < race.skaters.length; who++) {
    think(race, who, rand)
    glide(race, who, dt, events)
  }

  // A pass in a bend, with either of them off her line: the one coming through is clipped.
  for (let a = 0; a < race.skaters.length; a++) {
    for (let b = 0; b < race.skaters.length; b++) {
      const [passer, passed] = [race.skaters[a], race.skaters[b]]
      if (a === b || before[a] >= before[b] || passer.dist <= passed.dist) continue
      if (passer.downMs > 0 || passed.downMs > 0 || passer.finishedAt !== null || passed.finishedAt !== null) continue
      if (!inBend(passer.dist) || Math.max(passer.drift, passed.drift) < CLIP_DRIFT) continue
      passer.speed *= CLIP_KEEPS
      passer.clips++
      events.push({ kind: 'clip', who: a })
    }
  }

  // Who is in front. A skater who is home stays there.
  if (race.skaters.length > 1 && !race.skaters.some((skater) => skater.finishedAt !== null)) {
    let front = 0
    for (let who = 1; who < race.skaters.length; who++) {
      if (race.skaters[who].dist > race.skaters[front].dist) front = who
    }
    const held = race.leader < 0 ? -Infinity : race.skaters[race.leader].dist
    if (front !== race.leader && race.skaters[front].dist > 3 && race.skaters[front].dist > held + LEAD_CLEAR_M) {
      if (race.leader >= 0) {
        race.leadChanges.push({ at: race.t, to: front })
        events.push({ kind: 'lead', who: front, from: race.leader })
      }
      race.leader = front
    }
  }

  if (race.t >= race.laps * LIMIT_MS_PER_LAP && race.skaters.some((skater) => skater.finishedAt === null)) {
    race.called = true
    events.push({ kind: 'called' })
  }
  return events
}

/** Whether every girl is home. True of a run alone. */
export function girlsHome(race: Race): boolean {
  return race.skaters.every((skater, who) => who === 0 || skater.finishedAt !== null)
}

/**
 * The girls still out skate on to the line, or to the rink calling time, in steps of the same
 * clock: what is left of the race once the reader is home.
 */
export function finishOut(race: Race, rand: () => number = Math.random): void {
  while (!race.called && !girlsHome(race)) advance(race, 16, rand)
}

/** A time as the board shows it: 34.27 s. */
export function clock(ms: number): string {
  return `${(Math.round(ms / 10) / 100).toFixed(2)} s`
}

export interface Placing {
  who: number
  /**
   * From 1; skaters with the same time to the hundredth share a place. Those not home when time
   * was called come after everyone who is, the further round the better.
   */
  place: number
  /** In ms, or null where the rink called time first. */
  time: number | null
}

/** The finishing order, best first. */
export function placings(race: Race): Placing[] {
  const hundredths = (who: number): number => {
    const at = race.skaters[who].finishedAt
    return at === null ? Infinity : Math.round(at / 10)
  }
  // Two skaters still out have no times to tell them apart, so the floor does it.
  const round = (who: number): number => (race.skaters[who].finishedAt === null ? race.skaters[who].dist : 0)
  const order = race.skaters
    .map((_, who) => who)
    .sort((a, b) => (hundredths(a) === hundredths(b) ? round(b) - round(a) || a - b : hundredths(a) - hundredths(b)))
  const out: Placing[] = []
  order.forEach((who, i) => {
    const same = i > 0 && hundredths(order[i - 1]) === hundredths(who) && round(order[i - 1]) === round(who)
    out.push({ who, place: same ? out[i - 1].place : i + 1, time: race.skaters[who].finishedAt })
  })
  return out
}

/** The reader's result: alone on top, sharing the top, or beaten; `played` for a run alone. */
export function outcomeOf(race: Race): 'won' | 'lost' | 'draw' | 'played' {
  if (race.skaters.length === 1) return 'played'
  const order = placings(race)
  const mine = order.find((placing) => placing.who === 0)
  if (!mine || mine.place !== 1 || mine.time === null) return 'lost'
  return order.filter((placing) => placing.place === 1).length > 1 ? 'draw' : 'won'
}

/** The gap between the first two home, in ms, or null where fewer than two finished. */
export function winningGap(race: Race): number | null {
  const [first, second] = placings(race)
  if (!first || !second || first.time === null || second.time === null) return null
  return second.time - first.time
}

/** The share of a skater's strides that were on or near the tempo, from 0 to 1. */
export function rhythmShare(strides: Readonly<Record<Stride, number>>): number {
  const all = STRIDES.reduce((sum, kind) => sum + strides[kind], 0)
  return all > 0 ? (strides.perfect + strides.good) / all : 0
}

/** A rhythm in a word or two. */
export function rhythmWord(strides: Readonly<Record<Stride, number>>): string {
  const share = rhythmShare(strides)
  if (share >= 0.85) return 'metronome-clean'
  if (share >= 0.65) return 'mostly steady'
  if (share >= 0.4) return 'ragged'
  return 'all over the place'
}

const ORDINALS = ['1st', '2nd', '3rd', '4th']

const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`)

/** Everyone in the race by name, the reader first as `me`: "You and Ana", "the reader, Ana and Bea". */
export function racers(me: string, girls: readonly string[]): string {
  return listed([me, ...girls])
}

/** Everyone rolling up to the line, as the scene's narration says it. */
export function startLine(laps: number, girls: readonly string[]): string {
  return girls.length > 0
    ? `${racers('You', girls)} roll up to the line under the disco lights: ${laps} laps of the Starlight oval, first one home.`
    : `You roll up to the line under the disco lights: ${laps} laps of the Starlight oval against the clock.`
}

/** The first skater over the line at the end of a lap, as the scene's narration says it. */
export function lapLine(race: Race, girls: readonly string[], who: number, lap: number): string {
  const left = race.laps - lap
  const togo = left === 1 ? 'Last lap' : `${left} laps to go`
  if (girls.length === 0) return `${togo}: ${clock(race.skaters[0].lapTimes[lap - 1] ?? race.t)} on the clock.`
  const name = who === 0 ? 'you lead' : `${girls[who - 1]} leads`
  const chaser = race.skaters
    .map((skater, i) => ({ i, dist: skater.dist }))
    .filter((entry) => entry.i !== who)
    .sort((a, b) => b.dist - a.dist)[0]
  const gap = Math.max(0, race.skaters[who].dist - chaser.dist)
  const behind = chaser.i === 0 ? 'you' : girls[chaser.i - 1]
  return `${togo}: ${name}, ${behind} ${gap < 1 ? 'right behind' : `${Math.round(gap)} m back`}.`
}

/** A fall, as the scene's narration says it. */
export function fallLine(girls: readonly string[], who: number): string {
  return who === 0
    ? 'You run out of rink in the bend and go down on the boards.'
    : `${girls[who - 1]} runs wide in the bend and goes down.`
}

/** A girl home before the reader, as the scene's narration says it. */
export function homeLine(race: Race, girls: readonly string[], who: number): string {
  return `${girls[who - 1]} crosses the line: ${clock(race.skaters[who].finishedAt ?? race.t)}.`
}

/** How the race stands, for anything said on the rink. */
export function standing(race: Race, girls: readonly string[], stake = ''): string {
  if (girls.length === 0) return ''
  const name = (who: number): string => (who === 0 ? 'the reader' : girls[who - 1])
  const order = race.skaters
    .map((skater, who) => ({ who, skater }))
    .sort(
      (a, b) =>
        (a.skater.finishedAt ?? Infinity) - (b.skater.finishedAt ?? Infinity) || b.skater.dist - a.skater.dist
    )
  const rows = order.map(({ who, skater }, i) => {
    const where =
      skater.finishedAt !== null
        ? `home in ${clock(skater.finishedAt)}`
        : `on lap ${lapOf(race, who)}${skater.downMs > 0 ? ', down on the floor' : ''}`
    const fell = skater.falls.length > 0 ? `, fell ${times(skater.falls.length)}` : ''
    return `${ORDINALS[i]} ${name(who)} (${where}${fell})`
  })
  return [
    `The game is Rink Race: ${racers('the reader', girls)} are racing ${race.laps} laps of the roller rink's oval on quad skates, ${girls.length === 1 ? 'both' : 'all'} of them skating hard and short of breath.`,
    race.t <= 0 ? 'They are on the line, about to start.' : `As it stands: ${rows.join('; ')}.`,
    ...(stake ? [`Riding on it: ${stake}`] : [])
  ].join(' ')
}

/**
 * A race still being run, as the scene's writer is told it should the reader walk away now: who
 * is racing, the lap, and the order with any falls.
 */
export function soFar(race: Race, girls: readonly string[]): string[] {
  const name = (who: number): string => (who === 0 ? 'the reader' : girls[who - 1])
  const fell = (who: number): string =>
    race.skaters[who].falls.length > 0 ? ` (fell ${times(race.skaters[who].falls.length)})` : ''
  const lap = `lap ${lapOf(race, 0)} of ${race.laps}`
  if (girls.length === 0) {
    return [
      `The reader was skating a timed run alone at the Starlight Roller Rink: ${race.laps} laps of the oval on quad skates.`,
      `The run was not finished: the reader${fell(0)} was on ${lap} with ${clock(race.t)} on the clock.`
    ]
  }
  const order = race.skaters
    .map((skater, who) => ({ who, skater }))
    .sort(
      (a, b) =>
        (a.skater.finishedAt ?? Infinity) - (b.skater.finishedAt ?? Infinity) || b.skater.dist - a.skater.dist
    )
  return [
    `${racers('The reader', girls)} were racing ${race.laps} laps of the oval at the Starlight Roller Rink on quad skates.`,
    `The race was not finished: with the reader on ${lap} and ${clock(race.t)} on the clock, the order was ${order
      .map(({ who }, i) => `${ORDINALS[i]} ${name(who)}${fell(who)}`)
      .join(', ')}.`
  ]
}

/** What the race comes to, as the scene's narration says it. */
export function summary(race: Race, girls: readonly string[]): string {
  const me = race.skaters[0]
  const fell = me.falls.length > 0 ? ` You fell ${times(me.falls.length)} on the way.` : ''
  if (girls.length === 0) {
    return me.finishedAt === null
      ? `You set out on a timed ${race.laps}-lap run at the Starlight Roller Rink and the rink calls time before you are round.${fell}`
      : `You skate a timed ${race.laps}-lap run at the Starlight Roller Rink in ${clock(me.finishedAt)} and roll off the floor out of breath.${fell}`
  }
  const order = placings(race)
  const mine = order.find((placing) => placing.who === 0) as Placing
  const said = (placing: Placing): string =>
    `${placing.who === 0 ? 'you' : girls[placing.who - 1]} ${placing.time === null ? 'not home when time was called' : clock(placing.time)}`
  const sharing = order.filter((placing) => placing.place === mine.place && placing.who !== 0)
  const result =
    mine.time === null
      ? 'do not make it home before the rink calls time'
      : mine.place === 1
        ? sharing.length > 0
          ? `cross the line dead level with ${listed(sharing.map((placing) => girls[placing.who - 1]))} for first`
          : 'win'
        : `lose, coming in ${ORDINALS[mine.place - 1]} behind ${girls[order[0].who - 1]}`
  return `You race ${listed(girls)} over ${race.laps} laps of the Starlight Roller Rink and ${result}. The order: ${order.map(said).join(', ')}.${fell}`
}

/**
 * The race as the scene's writer is told it: the order and the times, how near it was, who led
 * and when the lead changed, who fell and where, how the reader skated, and the state they are
 * all in. Alone, the same of the one run.
 */
export function account(race: Race, girls: readonly string[]): string[] {
  const name = (who: number): string => (who === 0 ? 'the reader' : girls[who - 1])
  const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
  const me = race.skaters[0]
  const solo = girls.length === 0
  const order = placings(race)
  const lines: string[] = []

  lines.push(
    solo
      ? `The reader skated a timed run alone at the Starlight Roller Rink: ${race.laps} laps of the oval on quad skates.`
      : `${racers('The reader', girls)} raced ${race.laps} laps of the oval at the Starlight Roller Rink on quad skates, all starting together.`
  )
  if (solo) {
    lines.push(
      me.finishedAt === null
        ? 'The rink called time before the reader finished.'
        : `The reader's time was ${clock(me.finishedAt)}${me.lapTimes.length > 1 ? `, the best lap ${clock(Math.min(...me.lapTimes.map((at, i) => at - (me.lapTimes[i - 1] ?? 0))))}` : ''}.`
    )
  } else {
    lines.push(
      `Finishing order: ${order
        .map(
          (placing) =>
            `${ORDINALS[placing.place - 1]} ${name(placing.who)}, ${placing.time === null ? 'still out when the rink called time' : clock(placing.time)}`
        )
        .join('; ')}.`
    )
    const gap = winningGap(race)
    if (gap !== null) {
      const [first, second] = order
      lines.push(
        first.place === second.place
          ? `${cap(name(first.who))} and ${name(second.who)} crossed the line together: a dead heat.`
          : gap < PHOTO_MS
            ? `It was a photo finish: ${name(first.who)} beat ${name(second.who)} by ${clock(gap)}.`
            : `${cap(name(first.who))} beat ${name(second.who)} by ${clock(gap)}.`
      )
    }
    const laps = race.lapLeaders.map((who, i) => `lap ${i + 1} ${name(who)}`)
    lines.push(
      `The lead changed hands ${race.leadChanges.length === 0 ? 'not once' : times(race.leadChanges.length)}${laps.length > 0 ? `; first over the line at the end of each lap: ${laps.join(', ')}` : ''}.`
    )
  }

  const fallers = race.skaters
    .map((skater, who) => ({ who, falls: skater.falls }))
    .filter((entry) => entry.falls.length > 0)
  lines.push(
    fallers.length === 0
      ? solo
        ? 'The reader did not fall.'
        : 'Nobody fell.'
      : `Falls, each from going into a bend too fast without leaning: ${fallers
          .map(
            (entry) =>
              `${name(entry.who)} ${entry.falls.map((fall) => `on lap ${fall.lap} at ${clock(fall.at)}`).join(' and ')}`
          )
          .join('; ')}.`
  )

  const all = STRIDES.reduce((sum, kind) => sum + me.strides[kind], 0)
  lines.push(
    all === 0
      ? 'The reader never pushed off.'
      : `The reader's stride rhythm was ${rhythmWord(me.strides)}: of ${all} strides, ${me.strides.perfect + me.strides.good} on the tempo, ${me.strides.rough} ragged, ${me.strides.off} rushed or late and ${me.strides.same} off the wrong foot.`
  )
  const loose = [
    ...(me.wide > 0 ? [`ran wide in a bend ${times(me.wide)}`] : []),
    ...(me.wobbles > 0 ? [`wobbled off the boards ${times(me.wobbles)}`] : []),
    ...(me.clips > 0 ? [`clipped another skater ${times(me.clips)}`] : [])
  ]
  lines.push(loose.length > 0 ? `In the bends the reader ${listed(loose)}.` : 'The reader held the line through every bend.')
  for (let who = 1; who < race.skaters.length; who++) {
    const skater = race.skaters[who]
    const slips = skater.wide + skater.wobbles
    lines.push(
      `${girls[who - 1]} skated with a ${rhythmWord(skater.strides)} stride${slips > 0 ? ` and lost the line in a bend ${times(slips)}` : ' and kept her line in the bends'}.`
    )
  }
  lines.push(
    solo
      ? 'It was hard skating: the reader rolls off flushed and out of breath, still on the skates.'
      : `It was hard skating: ${girls.length === 1 ? 'both' : 'all'} of them roll to a stop flushed and out of breath, still on their skates.`
  )
  return lines
}
