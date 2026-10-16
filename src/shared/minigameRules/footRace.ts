import { listed } from '../minigameKit'

/**
 * Foot Race's rules, pure: the course at each distance, how a runner's effort becomes speed and
 * spends her stamina, how the reader's strides become effort, how each girl runs by her skill,
 * the start and its false starts, the finish order, and what is said of a race afterwards.
 *
 * Everything runs in play time, the seconds the race takes at the keyboard. The longer races
 * are compressed: the clock on the board shows play time stretched by the course's own scale,
 * so a 400 m still reads as about a minute.
 */

export type Skill = 1 | 2 | 3 | 4 | 5

/** The fixed step every runner is moved by, in seconds, whatever the frame rate. */
export const STEP_S = 1 / 60

/** The cadence, in strides a second, that is flat out. */
export const MAX_CADENCE = 5.5
/** The cadence the first stride out of the blocks is taken for. */
const FIRST_CADENCE = 3.2
/** How far a clean stride moves the cadence toward the pace it was taken at. */
const CADENCE_PULL = 0.45
/** What a stride on the same foot twice leaves of the cadence. */
const SLIP_KEEPS = 0.6
/** The effort a runner with nothing left can still make, and the stamina she must find before she can do more. */
export const SPENT_EFFORT = 0.3
const SPENT_UNTIL = 0.15
/** How long speed takes to come up to what the effort asks, and to fall away, in seconds. */
const PICKUP_S = 0.7
const LETUP_S = 0.45
/** Under this effort stamina comes back, slowly. */
const REST_UNDER = 0.5
const REST_RATE = 0.04
/** From this far round the line is in sight, and effort costs this share of what it did. */
export const HOME_FROM = 0.85
const HOME_COST = 0.4
/** What a stumble leaves of a runner's speed. */
const STUMBLE_KEEPS = 0.35

export interface Course {
  /** The option's value: 1, 2 or 3. */
  distance: number
  metres: number
  /** Flat-out speed, in metres a second of play. */
  top: number
  /** How many seconds of the board's clock one second of play is. */
  clockScale: number
  /** How long a full tank lasts flat out, in seconds of play. */
  fullBurnS: number
  /** The effort that gets a runner round with nothing wasted, as a band. */
  band: readonly [number, number]
  /** The longest the race is waited on, in seconds of play. */
  limitS: number
}

const COURSES: readonly Course[] = [
  { distance: 1, metres: 100, top: 10.4, clockScale: 1, fullBurnS: 13, band: [0.86, 1], limitS: 30 },
  { distance: 2, metres: 400, top: 22, clockScale: 2.4, fullBurnS: 9, band: [0.62, 0.76], limitS: 60 },
  { distance: 3, metres: 800, top: 26, clockScale: 3.3, fullBurnS: 14, band: [0.6, 0.74], limitS: 90 }
]

/** The course for the `distance` option; the sprint for anything else. */
export function courseOf(distance: number | undefined): Course {
  return COURSES.find((course) => course.distance === distance) ?? COURSES[0]
}

/** A sprint is run flat out; the longer races are paced. */
export const paced = (course: Course): boolean => course.distance > 1

// ---------------------------------------------------------------------------------------------
// A runner

export interface Runner {
  /** Metres run. */
  pos: number
  /** Metres a second of play. */
  speed: number
  /** What is left in the tank, from 1 to 0. */
  stamina: number
  /** The tank is empty and she is running on what is left. */
  spent: boolean
  /** How far round she was, from 0 to 1, when the tank first emptied; null if it never has. */
  spentAt: number | null
  /** When she crossed the line, in seconds of play since the gun; null until she has. */
  finishedAt: number | null
  stumbled: boolean
}

export const freshRunner = (): Runner => ({
  pos: 0,
  speed: 0,
  stamina: 1,
  spent: false,
  spentAt: null,
  finishedAt: null,
  stumbled: false
})

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value))

/** The speed an effort from 0 to 1 is worth once it is held, on a course. */
export function speedFor(course: Course, effort: number, topFactor = 1): number {
  return course.top * topFactor * Math.pow(clamp(effort, 0, 1), 0.8)
}

/**
 * One step of a runner: `effort` from 0 to 1 is what she asks of herself, `at` the time since
 * the gun as the step begins. Effort costs stamina by its cube, so pushing a little harder costs
 * a lot more, though less once the line is in sight, which is what a kick is saved for; with the
 * tank empty she can make no more than {@link SPENT_EFFORT} until some of
 * it has come back. The moment she crosses the line is worked out inside the step.
 */
export function stepRunner(
  runner: Runner,
  effort: number,
  course: Course,
  at: number,
  topFactor = 1,
  dt: number = STEP_S
): Runner {
  if (runner.finishedAt !== null) return runner
  let { stamina, spent, spentAt } = runner
  if (spent && stamina >= SPENT_UNTIL) spent = false
  const made = clamp(spent ? Math.min(effort, SPENT_EFFORT) : effort, 0, 1)
  const target = speedFor(course, made, topFactor)
  const lag = target > runner.speed ? PICKUP_S : LETUP_S
  const speed = runner.speed + (target - runner.speed) * Math.min(1, dt / lag)
  const cost = runner.pos >= course.metres * HOME_FROM ? HOME_COST : 1
  stamina -= (dt / course.fullBurnS) * made ** 3 * cost
  if (made < REST_UNDER) stamina += dt * REST_RATE * (1 - made / REST_UNDER)
  stamina = clamp(stamina, 0, 1)
  if (stamina <= 0 && !spent) {
    spent = true
    spentAt ??= runner.pos / course.metres
  }
  const pos = runner.pos + speed * dt
  if (pos >= course.metres) {
    const part = speed > 0 ? (course.metres - runner.pos) / (speed * dt) : 1
    return { ...runner, pos: course.metres, speed, stamina, spent, spentAt, finishedAt: at + part * dt }
  }
  return { ...runner, pos, speed, stamina, spent, spentAt }
}

// ---------------------------------------------------------------------------------------------
// The reader's strides

export type Side = 'left' | 'right'

export interface Strides {
  /** When the last stride was taken, in seconds since the gun; null before the first. */
  lastAt: number | null
  lastSide: Side | null
  /** Strides a second, as the recent ones have it. */
  cadence: number
  clean: number
  /** Strides on the same foot twice running. */
  slips: number
}

export const noStrides = (): Strides => ({ lastAt: null, lastSide: null, cadence: 0, clean: 0, slips: 0 })

/**
 * A stride taken at `at`. Left then right then left is running: each clean stride pulls the
 * cadence toward the pace it was taken at. The same foot twice is a slip, which costs cadence
 * and earns nothing, so hammering one key goes nowhere.
 */
export function stride(strides: Strides, side: Side, at: number): Strides {
  if (strides.lastAt === null) {
    return { lastAt: at, lastSide: side, cadence: FIRST_CADENCE, clean: 1, slips: 0 }
  }
  if (side === strides.lastSide) {
    return { ...strides, lastAt: at, cadence: strides.cadence * SLIP_KEEPS, slips: strides.slips + 1 }
  }
  const pace = Math.min(1 / Math.max(at - strides.lastAt, 0.03), MAX_CADENCE * 1.15)
  return {
    lastAt: at,
    lastSide: side,
    cadence: strides.cadence + (pace - strides.cadence) * CADENCE_PULL,
    clean: strides.clean + 1,
    slips: strides.slips
  }
}

/** The effort the reader is making at `at`, from 0 to 1: his cadence, falling away as soon as a stride is late. */
export function effortAt(strides: Strides, at: number): number {
  if (strides.lastAt === null) return 0
  const idle = at - strides.lastAt
  const cadence = idle > 0 ? Math.min(strides.cadence, 1 / idle) : strides.cadence
  return clamp(cadence / MAX_CADENCE, 0, 1)
}

// ---------------------------------------------------------------------------------------------
// The start

/** How long "on your marks" is held, in seconds. */
export const MARKS_S = 1.3
/** How long "set" is held before the gun: never the same twice. */
export function setGapS(rand: () => number = Math.random): number {
  return 0.9 + rand() * 1.7
}
/** How long a false start holds everyone before they are called back to their marks. */
export const RECALL_S = 1.8

/**
 * What the reader's false starts cost him: the first is a warning, and each after it holds him
 * in the blocks that much longer after the gun, in seconds, up to a limit. Nobody is thrown out.
 */
export function falseStartPenaltyS(falseStarts: number): number {
  return Math.min(1.5, Math.max(0, falseStarts - 1) * 0.5)
}

/** The reader's hold as the board's clock has it, in seconds: what it reads when he is let go. */
export function penaltyShownS(course: Course, falseStarts: number): number {
  return Math.round(falseStartPenaltyS(falseStarts) * course.clockScale * 10) / 10
}

/** How a reaction to the gun reads, in a word. */
export function reactionWord(reactionS: number): string {
  return reactionS < 0.2 ? 'razor sharp' : reactionS < 0.3 ? 'sharp' : reactionS < 0.45 ? 'fair' : 'slow'
}

// ---------------------------------------------------------------------------------------------
// Her race

/** How she paces a longer race: evenly, out too fast, or too slowly away. */
export type Pacing = 'even' | 'fast' | 'slow'

export interface HerPlan {
  skill: Skill
  /** How long after the gun she moves, in seconds. */
  reactionS: number
  /** Her flat-out speed, as a share of the course's. */
  topFactor: number
  pacing: Pacing
  /** How far from the right pace her mistake takes her, as effort. */
  off: number
  /** How far round, from 0 to 1, she stumbles; null if she does not. */
  stumbleAt: number | null
  /** She goes before the gun at the first start. */
  jumps: boolean
}

const REACTION: Record<Skill, number> = { 1: 0.4, 2: 0.33, 3: 0.27, 4: 0.21, 5: 0.16 }
const TOP: Record<Skill, number> = { 1: 0.74, 2: 0.81, 3: 0.87, 4: 0.92, 5: 0.96 }
/** How likely she is to misjudge the pace of a longer race, and by how much when she does. */
const MISPACES: Record<Skill, number> = { 1: 0.9, 2: 0.6, 3: 0.3, 4: 0.1, 5: 0 }
const OFF: Record<Skill, number> = { 1: 0.22, 2: 0.18, 3: 0.13, 4: 0.08, 5: 0 }
const STUMBLES: Record<Skill, number> = { 1: 0.45, 2: 0.25, 3: 0.1, 4: 0.03, 5: 0 }
const JUMPS: Record<Skill, number> = { 1: 0.15, 2: 0.1, 3: 0.05, 4: 0.02, 5: 0 }

/**
 * How one girl will run this race, settled before the gun. Skill is her legs, her start and her
 * judgement: a poor runner is slower flat out, slower off the gun, apt to stumble, and in a
 * longer race likely to go out too fast or dawdle away; a good one does none of it.
 */
export function herPlan(skill: Skill, course: Course, rand: () => number = Math.random): HerPlan {
  const reactionS = REACTION[skill] + rand() * 0.1
  const topFactor = TOP[skill] + (rand() - 0.5) * 0.03
  const mispaced = paced(course) && rand() < MISPACES[skill]
  const pacing: Pacing = !mispaced ? 'even' : rand() < 0.65 ? 'fast' : 'slow'
  const stumbles = rand() < STUMBLES[skill]
  const stumbleAt = stumbles ? 0.15 + rand() * 0.7 : null
  const jumps = rand() < JUMPS[skill]
  return { skill, reactionS, topFactor, pacing, off: mispaced ? OFF[skill] : 0, stumbleAt, jumps }
}

/**
 * The effort she asks of herself where she is. A sprint is flat out. In a longer race she holds
 * the middle of the course's band, less her mistake: out too fast over the first part, or too
 * slow away. A good runner kicks for the line from as far out as her tank will carry her; a
 * middling one only in the last stretch; a poor one has no kick planned at all.
 */
export function herEffort(plan: HerPlan, runner: Runner, course: Course): number {
  if (!paced(course)) return 1
  const progress = runner.pos / course.metres
  const cruise = (course.band[0] + course.band[1]) / 2
  if (plan.pacing === 'fast' && progress < 0.45) return Math.min(1, cruise + plan.off)
  if (plan.pacing === 'slow' && progress < 0.4) return cruise - plan.off
  if (plan.skill >= 4) {
    if (runner.stamina >= kickCost(runner, course, plan.topFactor) * 1.05) return 1
  } else if (plan.skill === 3 && progress >= 0.9) return 1
  else if (plan.pacing === 'slow' && progress >= 0.85) return 1
  return cruise
}

/** The stamina it would take to run flat out from where she is to the line. */
function kickCost(runner: Runner, course: Course, topFactor: number): number {
  const home = course.metres * HOME_FROM
  const full = Math.max(0, home - runner.pos)
  const cheap = course.metres - Math.max(home, runner.pos)
  return (full + cheap * HOME_COST) / (course.top * topFactor) / course.fullBurnS
}

/** One step of hers: still in the blocks until she reacts, then running to her plan. */
export function herStep(runner: Runner, plan: HerPlan, course: Course, at: number, dt: number = STEP_S): Runner {
  if (runner.finishedAt !== null || at + dt <= plan.reactionS) return runner
  const next = stepRunner(runner, herEffort(plan, runner, course), course, at, plan.topFactor, dt)
  const mark = plan.stumbleAt === null ? null : plan.stumbleAt * course.metres
  if (mark !== null && !runner.stumbled && runner.pos < mark && next.pos >= mark && next.finishedAt === null) {
    return { ...next, speed: next.speed * STUMBLE_KEEPS, stumbled: true }
  }
  return next
}

/** Her whole race run through at once: how she finishes if nothing interrupts it. */
export function herRace(plan: HerPlan, course: Course): Runner {
  let runner = freshRunner()
  for (let i = 0; runner.finishedAt === null && i * STEP_S < course.limitS * 4; i++) {
    runner = herStep(runner, plan, course, i * STEP_S)
  }
  return runner
}

// ---------------------------------------------------------------------------------------------
// The finish

/** A time on the board's clock, to the hundredth, from a time in play; null stays null. */
export function shownTime(course: Course, playS: number | null): number | null {
  return playS === null ? null : Math.round(playS * course.clockScale * 100) / 100
}

/** A board time as it is written: `11.42 s`, `1:02.31`. */
export function timeText(shown: number | null): string {
  if (shown === null) return 'did not finish'
  if (shown < 60) return `${shown.toFixed(2)} s`
  const minutes = Math.floor(shown / 60)
  const rest = shown - minutes * 60
  return `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(2)}`
}

/** The clock as it runs: tenths only, so it can be read. */
export function clockText(course: Course, playS: number): string {
  // Whole tenths, cut and never rounded up, so the clock cannot read 60.0 or 1:60.0.
  const tenths = Math.floor(Math.max(0, playS) * course.clockScale * 10 + 1e-9)
  const minutes = Math.floor(tenths / 600)
  const rest = (tenths - minutes * 600) / 10
  return minutes > 0 ? `${minutes}:${rest < 10 ? '0' : ''}${rest.toFixed(1)}` : rest.toFixed(1)
}

/**
 * Everyone's place from their board times: the same time to the hundredth is the same place,
 * and the next place after a tie is skipped, as on a results sheet. Anyone who did not finish
 * is placed after everyone who did.
 */
export function placesOf(times: readonly (number | null)[]): number[] {
  return times.map((time) =>
    time === null
      ? 1 + times.filter((other) => other !== null).length
      : 1 + times.filter((other) => other !== null && other < time).length
  )
}

/** Places while the race is on: by how far each has run, a finisher ahead of anyone still running. */
export function placesNow(runners: readonly Runner[]): number[] {
  const ahead = (a: Runner, b: Runner): boolean =>
    a.finishedAt !== null && b.finishedAt !== null
      ? a.finishedAt < b.finishedAt
      : a.finishedAt !== null || (b.finishedAt === null && a.pos > b.pos + 1e-9)
  return runners.map((runner) => 1 + runners.filter((other) => ahead(other, runner)).length)
}

export const ordinal = (place: number): string =>
  `${place}${place === 1 ? 'st' : place === 2 ? 'nd' : place === 3 ? 'rd' : 'th'}`

export type RaceOutcome = 'won' | 'lost' | 'draw' | 'played'

/** The race from the reader's side, who is first in `places`: alone on top, sharing it, or not. */
export function outcomeOf(places: readonly number[]): RaceOutcome {
  if (places.length <= 1) return 'played'
  if (places[0] !== 1) return 'lost'
  return places.slice(1).includes(1) ? 'draw' : 'won'
}

// ---------------------------------------------------------------------------------------------
// What is said of it

/** One runner's race as it is told afterwards. The reader is first in every list of these. */
export interface Told {
  /** Her name; unused for the reader. */
  name: string
  /** Board time; null if she did not finish. */
  time: number | null
  /** From the gun, or for a reader held in the blocks from his release, to the first stride; null if there was none. */
  reactionS: number | null
  falseStarts: number
  spentAt: number | null
  stumbled: boolean
  /** What was left in the tank at the line. */
  staminaLeft: number
  /** Her place at halfway and with a fifth of the race left; 0 where the race never got there. */
  placeAtHalf: number
  placeAtLast: number
}

/** How the reader judged a longer race. */
export type ReaderPacing = 'even' | 'too-fast' | 'left-too-much'

/** A runner whose tank emptied before this far round went out too fast. */
export const FADE_BEFORE = 0.88

export function readerPacing(reader: Told): ReaderPacing {
  if (reader.spentAt !== null && reader.spentAt < FADE_BEFORE) return 'too-fast'
  if (reader.time !== null && reader.staminaLeft > 0.3) return 'left-too-much'
  return 'even'
}

const who = (told: readonly Told[], seat: number, reader: string): string => (seat === 0 ? reader : told[seat].name)

/** Seats in finishing order. */
function finishOrder(told: readonly Told[]): number[] {
  const places = placesOf(told.map((one) => one.time))
  return told.map((_, seat) => seat).sort((a, b) => places[a] - places[b] || a - b)
}

/** The order and the times, as a list: "1st Ana 11.20 s, 2nd you 11.42 s". */
export function orderText(told: readonly Told[], reader: string): string {
  const places = placesOf(told.map((one) => one.time))
  return finishOrder(told)
    .map((seat) =>
      told[seat].time === null
        ? `${who(told, seat, reader)} did not finish`
        : `${ordinal(places[seat])} ${who(told, seat, reader)} ${timeText(told[seat].time)}`
    )
    .join(', ')
}

/** The board time between two finishers under which it took a photo to part them, in seconds. */
export const PHOTO_S = 0.1

/** The opening line, with company. */
export function openingLine(course: Course, names: readonly string[]): string {
  return `${listed(names)} ${names.length > 1 ? 'line' : 'lines'} up beside you for the ${course.metres} m. Wait for the gun.`
}

/** The order at halfway, as narration, the reader as "you". */
export function halfwayLine(course: Course, names: readonly string[], runners: readonly Runner[]): string {
  const places = placesNow(runners)
  const order = runners
    .map((_, seat) => seat)
    .sort((a, b) => places[a] - places[b] || a - b)
    .map((seat) => (seat === 0 ? 'you' : names[seat - 1]))
  if (order.length === 1) return `Halfway: ${course.metres / 2} m gone.`
  return `Halfway, ${course.metres / 2} m gone: ${order[0]} in front, then ${listed(order.slice(1))}.`
}

export function soloSummary(course: Course, reader: Told): string {
  return reader.time === null
    ? `You set off on the ${course.metres} m alone and pull up before the line.`
    : `You run the ${course.metres} m alone against the clock: ${timeText(reader.time)}.`
}

/** The race in a sentence or two of narration: who it was against, how the reader did, and everyone's time. */
export function versusSummary(course: Course, told: readonly Told[]): string {
  const names = told.slice(1).map((one) => one.name)
  const places = placesOf(told.map((one) => one.time))
  const sharing = names.filter((_, i) => places[i + 1] === 1)
  const did =
    told[0].time === null
      ? 'do not finish'
      : places[0] !== 1
        ? `come ${ordinal(places[0])}`
        : sharing.length > 0
          ? `dead-heat with ${listed(sharing)} for first`
          : 'win'
  return `You race ${listed(names)} over ${course.metres} m and ${did}. ${orderText(told, 'you')}.`
}

/** Seats that gained places over the last fifth of the race, with one of those they passed. */
function kicks(told: readonly Told[]): { seat: number; past: number }[] {
  const places = placesOf(told.map((one) => one.time))
  return told.flatMap((one, seat) => {
    if (one.time === null || one.placeAtLast === 0 || places[seat] >= one.placeAtLast) return []
    const past = told.findIndex(
      (other, at) => at !== seat && other.placeAtLast < one.placeAtLast && places[at] > places[seat]
    )
    return past < 0 ? [] : [{ seat, past }]
  })
}

/**
 * The race for the scene's writer, one line each: the terms, the order and times, the start,
 * who led, who faded, stumbled or kicked, and how the reader paced it.
 */
export function account(course: Course, told: readonly Told[]): string[] {
  const reader = 'the reader'
  const names = told.slice(1).map((one) => one.name)
  const lines: string[] = []
  lines.push(
    names.length > 0
      ? `A foot race over ${course.metres} m, the reader against ${listed(names)}, really run: the times are what the clock showed.`
      : `The reader ran ${course.metres} m alone against the clock.`
  )
  lines.push(`Finish: ${orderText(told, reader)}.`)
  const order = finishOrder(told).filter((seat) => told[seat].time !== null)
  for (let i = 1; i < order.length; i++) {
    const [a, b] = [order[i - 1], order[i]]
    const gap = (told[b].time as number) - (told[a].time as number)
    if (gap === 0) lines.push(`${who(told, a, reader)} and ${who(told, b, reader)} could not be separated: a dead heat.`)
    else if (gap <= PHOTO_S)
      lines.push(`${who(told, a, reader)} beat ${who(told, b, reader)} by ${gap.toFixed(2)} s: a photo finish.`)
  }

  told.forEach((one, seat) => {
    if (one.falseStarts === 0) return
    const name = who(told, seat, reader)
    const penalty = seat === 0 ? penaltyShownS(course, one.falseStarts) : 0
    lines.push(
      penalty > 0
        ? `${name} went before the gun ${one.falseStarts} times: a warning, then held in the blocks until the clock read ${penalty.toFixed(1)} s as a penalty.`
        : `${name} went before the gun once, a false start, and was warned.`
    )
  })
  const starts = told
    .map((one, seat) =>
      one.reactionS === null ? null : `${who(told, seat, reader)} ${one.reactionS.toFixed(2)} s (${reactionWord(one.reactionS)})`
    )
    .filter((line) => line !== null)
  if (starts.length > 0) lines.push(`Reaction off the mark, in real seconds: ${starts.join(', ')}.`)

  if (names.length > 0 && told.every((one) => one.placeAtHalf > 0)) {
    const half = told.map((_, seat) => seat).sort((a, b) => told[a].placeAtHalf - told[b].placeAtHalf || a - b)
    const leader = who(told, half[0], reader)
    const first = finishOrder(told)[0]
    lines.push(
      first === half[0]
        ? `${leader} led at halfway and was still in front at the line.`
        : `${leader} led at halfway, but ${who(told, first, reader)} was in front at the line.`
    )
  }
  told.forEach((one, seat) => {
    const name = who(told, seat, reader)
    if (one.spentAt !== null && one.spentAt < FADE_BEFORE && (seat > 0 || !paced(course))) {
      lines.push(`${name} ran out of legs with ${Math.round((1 - one.spentAt) * course.metres)} m to go and faded.`)
    }
    if (one.stumbled) lines.push(`${name} stumbled and lost ground.`)
  })
  for (const { seat, past } of kicks(told)) {
    lines.push(`${who(told, seat, reader)} kicked past ${who(told, past, reader)} in the last ${Math.round(course.metres / 5)} m.`)
  }

  const me = told[0]
  if (me.time === null) lines.push('The reader gave up before the line.')
  else if (paced(course)) {
    const pacing = readerPacing(me)
    lines.push(
      pacing === 'too-fast'
        ? `The reader went out too fast: nothing left with ${Math.round((1 - (me.spentAt ?? 1)) * course.metres)} m to go, and hung on from there. Poor pacing, not bad luck.`
        : pacing === 'left-too-much'
          ? 'The reader ran within himself and crossed the line with plenty left: he could have gone harder or kicked sooner.'
          : 'The reader paced it evenly and emptied the tank at the line: a well-judged run.'
    )
  } else {
    lines.push('A sprint is the start and leg speed, flat out all the way.')
  }
  lines.push(names.length > 0 ? 'Everyone is out of breath, hands on knees.' : 'The reader is out of breath.')
  return lines
}
