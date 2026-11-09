import { listed } from '../minigameKit'

/**
 * Swim Race's rules: the water, what a stroke, a breath and a turn do to a swimmer, how a girl
 * swims by her skill, and how a race is placed and told. A swimmer is a plain record moved on
 * in place by the functions here; nothing reads a clock or a random source it is not handed.
 */

export type Skill = 1 | 2 | 3 | 4 | 5

/** One length, in metres. */
export const LENGTH_M = 25

/** How many lengths the `lengths` option comes to: 2, 4 or 6. */
export function lengthsOf(option: number | undefined): number {
  const value = Number.isInteger(option) ? (option as number) : 1
  return Math.min(3, Math.max(1, value)) * 2
}

/** The pull that makes the best stroke, and the time from one stroke's start to the next, in ms. */
export const PULL_MS = 450
export const CYCLE_MS = 900
/**
 * How far off the best a stroke can be and still be worth everything, as shares of the pull
 * and of the cycle: a pull under the first is short and over the second is held too long, and
 * a stroke begun sooner after the last than the third is rushed.
 */
export const PULL_SHORT = 0.9
export const PULL_LONG = 1.15
export const TEMPO_RUSHED = 0.95

/** The step the water is moved on by, in ms: a race comes out the same at any frame rate. */
export const STEP_MS = 10
/** How long a race may take for each of its lengths, in ms: past it, whoever is out did not finish. */
export const LENGTH_LIMIT_MS = 25_000

/** The longest a race of `lengths` runs, in ms from the whistle. */
export function limitOf(lengths: number): number {
  return lengths * LENGTH_LIMIT_MS
}

/** What a perfect stroke adds to a swimmer's speed, in m/s, and how fast the water takes it back. */
const KICK = 2.3
const DRAG_PER_S = 1.1
const TOP_SPEED = 3.8
/** What a pull held past the best loses, for each share of the pull it is held on. */
const LONG_LOSS = 0.8
/** A swimmer who does nothing still drifts on, so every race ends. */
const DRIFT = 0.6
/** Off the blocks. */
const DIVE_SPEED = 3.3

/** Air: full at 1. What a stroke costs, what a wasted one costs on top, and what idling costs a second. */
const AIR_STROKE = 0.085
const AIR_WASTE = 0.07
const AIR_IDLE_PER_S = 0.015
/** A breath: what it gives back, the share of speed it keeps, and how soon another can be taken. */
const BREATH_AIR = 0.7
const BREATH_KEEPS = 0.8
export const BREATH_GAP_MS = 1000
/** Out of air: how long the gasping lasts, what a stroke is worth through it, and the air it ends on. */
export const GASP_MS = 2200
const GASP_STROKE = 0.3
const GASP_AIR = 0.5

/** How close to the wall a turn can be called at all, and how close makes it good or perfect, in metres. */
export const TURN_ZONE_M = 4
export const TURN_GOOD_M = 2.2
export const TURN_PERFECT_M = 0.9

/**
 * How a turn went. `perfect` and `good` were called close to the wall; `early` was called too
 * far out and glided in; `late` was never called, and the swimmer ran into the wall.
 */
export type TurnGrade = 'perfect' | 'good' | 'early' | 'late'

/** What each turn costs at the wall, in ms, and the speed of the push off it, in m/s. */
const TURNS: Readonly<Record<TurnGrade, { holdMs: number; push: number }>> = {
  perfect: { holdMs: 0, push: 3.6 },
  good: { holdMs: 0, push: 2.8 },
  early: { holdMs: 450, push: 2.0 },
  late: { holdMs: 1100, push: 1.8 }
}

/** A reaction under this is a sharp start, in ms; a dive before the whistle is held this long. */
export const SHARP_START_MS = 260
export const FALSE_START_MS = 900
/** Anyone still on the blocks this long after the whistle goes in anyway, in ms. */
export const SLOWEST_START_MS = 1500

/** A stroke at or over this is a clean one; under the second it was thrashed. */
export const CLEAN_STROKE = 0.8
export const THRASHED_STROKE = 0.45

export interface Swimmer {
  /** How far she has swum, in metres, turns and all. */
  dist: number
  /** In m/s. */
  speed: number
  /** From 0 to 1. */
  air: number
  /** How long she is still on the blocks, in ms from the whistle. */
  blockMs: number
  /** How long she is still held at a wall, in ms, and the speed she leaves it at. */
  wallMs: number
  push: number
  /** The turn called for the wall ahead, if one has been. */
  called: TurnGrade | null
  /** How long she goes on gasping, and how long until she can breathe again, in ms. */
  gaspMs: number
  breathMs: number
  /** Her time, in ms from the whistle, once she has touched. */
  finishMs: number | null
  /** How she left the blocks, in ms after the whistle, and whether she went before it. */
  reactionMs: number
  falseStart: boolean
  /** What the race has been so far: strokes and their worth, breaths, gasps, each turn. */
  strokes: number
  worth: number
  thrashed: number
  breaths: number
  gasps: number
  turns: TurnGrade[]
}

/** A swimmer on the blocks, who dives `reactionMs` after the whistle. */
export function onBlocks(reactionMs: number, falseStart = false): Swimmer {
  return {
    dist: 0,
    speed: 0,
    air: 1,
    blockMs: falseStart ? FALSE_START_MS : Math.max(0, reactionMs),
    wallMs: 0,
    push: 0,
    called: null,
    gaspMs: 0,
    breathMs: 0,
    finishMs: null,
    reactionMs: falseStart ? FALSE_START_MS : Math.max(0, reactionMs),
    falseStart,
    strokes: 0,
    worth: 0,
    thrashed: 0,
    breaths: 0,
    gasps: 0,
    turns: []
  }
}

/** Whether she is in open water: off the blocks, off the wall and not yet home. */
export function swimming(swimmer: Swimmer): boolean {
  return swimmer.blockMs <= 0 && swimmer.wallMs <= 0 && swimmer.finishMs === null
}

/**
 * What a stroke is worth, from 0 to 1, by how long it was pulled and how long after the last
 * one it began. Only a pull close to the best is worth everything: a short one is worth very
 * little, and one held on past it loses steadily. A stroke begun sooner than the cycle is
 * worth less by more than the time it saved, and a rushed one far less, so the even rhythm
 * is the fastest there is; one begun late is worth all of itself, and costs only the wait.
 */
export function strokeWorth(pullMs: number, cycleMs: number | null): number {
  const pull = Math.max(0, pullMs) / PULL_MS
  const pulled =
    pull < PULL_SHORT
      ? Math.pow(pull / PULL_SHORT, 1.2)
      : pull <= PULL_LONG
        ? 1
        : Math.max(0.5, 1 - (pull - PULL_LONG) * LONG_LOSS)
  if (cycleMs === null) return pulled
  const tempo = Math.max(0, cycleMs) / CYCLE_MS
  const timed =
    tempo >= 1
      ? 1
      : tempo >= TEMPO_RUSHED
        ? Math.pow(tempo, 1.5)
        : Math.pow(TEMPO_RUSHED, 1.5) * Math.pow(tempo / TEMPO_RUSHED, 3)
  return pulled * timed
}

/** What moving a swimmer on brought about. */
export type SwimEvent =
  | { kind: 'dive' }
  | { kind: 'turn'; grade: TurnGrade; length: number }
  | { kind: 'finish' }

/**
 * Moves a swimmer on by `dtMs`, to `clockMs` after the whistle, in a race of `lengths`. She
 * leaves the blocks or the wall when her time there is up, slows as the water drags at her,
 * turns at each wall as she called it, and touches at the last.
 */
export function advance(swimmer: Swimmer, dtMs: number, clockMs: number, lengths: number): SwimEvent[] {
  const events: SwimEvent[] = []
  if (swimmer.finishMs !== null || dtMs <= 0) return events
  let left = dtMs
  if (swimmer.blockMs > 0) {
    const waited = Math.min(left, swimmer.blockMs)
    swimmer.blockMs -= waited
    left -= waited
    if (swimmer.blockMs > 0) return events
    swimmer.speed = DIVE_SPEED
    events.push({ kind: 'dive' })
  }
  if (swimmer.wallMs > 0) {
    const waited = Math.min(left, swimmer.wallMs)
    swimmer.wallMs -= waited
    left -= waited
    if (swimmer.wallMs > 0) return events
    swimmer.speed = swimmer.push
  }
  if (left <= 0) return events

  if (swimmer.gaspMs > 0) {
    swimmer.gaspMs = Math.max(0, swimmer.gaspMs - left)
    if (swimmer.gaspMs === 0) swimmer.air = Math.max(swimmer.air, GASP_AIR)
  } else {
    swimmer.air = Math.max(0, swimmer.air - (AIR_IDLE_PER_S * left) / 1000)
  }
  swimmer.breathMs = Math.max(0, swimmer.breathMs - left)

  const seconds = left / 1000
  swimmer.speed = Math.max(DRIFT, swimmer.speed * Math.exp(-DRAG_PER_S * seconds))
  const wall = (Math.floor(swimmer.dist / LENGTH_M + 1e-9) + 1) * LENGTH_M
  const reached = swimmer.dist + swimmer.speed * seconds
  if (reached < wall) {
    swimmer.dist = reached
    return events
  }
  // The wall: the moment of the touch is inside this step, and what is left of it is spent there.
  const over = ((reached - wall) / swimmer.speed) * 1000
  swimmer.dist = wall
  const length = Math.round(wall / LENGTH_M)
  if (length >= lengths) {
    swimmer.finishMs = clockMs - over
    swimmer.speed = 0
    events.push({ kind: 'finish' })
    return events
  }
  const grade = swimmer.called ?? 'late'
  swimmer.called = null
  swimmer.turns.push(grade)
  swimmer.push = TURNS[grade].push
  swimmer.wallMs = Math.max(0, TURNS[grade].holdMs - over)
  swimmer.speed = swimmer.wallMs > 0 ? 0 : swimmer.push
  events.push({ kind: 'turn', grade, length })
  return events
}

/**
 * A stroke of the given worth, taken now. Returns whether it emptied her: the stroke that
 * leaves her with no air starts her gasping. Nothing happens on the blocks, at a wall or home.
 */
export function strokeOf(swimmer: Swimmer, worth: number): boolean {
  if (!swimming(swimmer)) return false
  const clean = Math.min(1, Math.max(0, worth))
  const gasping = swimmer.gaspMs > 0
  swimmer.speed = Math.min(TOP_SPEED, swimmer.speed + KICK * clean * (gasping ? GASP_STROKE : 1))
  swimmer.strokes++
  swimmer.worth += clean
  if (clean < THRASHED_STROKE) swimmer.thrashed++
  if (gasping) return false
  swimmer.air -= AIR_STROKE + AIR_WASTE * (1 - clean)
  if (swimmer.air > 0) return false
  swimmer.air = 0
  swimmer.gaspMs = GASP_MS
  swimmer.gasps++
  return true
}

/** The reader's stroke: pulled for `pullMs`, begun `cycleMs` after his last. Returns its worth. */
export function stroke(swimmer: Swimmer, pullMs: number, cycleMs: number | null): { worth: number; emptied: boolean } {
  if (!swimming(swimmer)) return { worth: 0, emptied: false }
  const worth = strokeWorth(pullMs, cycleMs)
  return { worth, emptied: strokeOf(swimmer, worth) }
}

/** A breath, where one can be taken: in open water, not gasping, not straight after the last. */
export function breathe(swimmer: Swimmer): boolean {
  if (!swimming(swimmer) || swimmer.gaspMs > 0 || swimmer.breathMs > 0) return false
  swimmer.air = Math.min(1, swimmer.air + BREATH_AIR)
  swimmer.speed *= BREATH_KEEPS
  swimmer.breathMs = BREATH_GAP_MS
  swimmer.breaths++
  return true
}

/** How far the wall ahead is, in metres. */
export function toWall(swimmer: Swimmer): number {
  return (Math.floor(swimmer.dist / LENGTH_M + 1e-9) + 1) * LENGTH_M - swimmer.dist
}

/** The length a swimmer is on, from 1, and no more than the race has. */
export function lengthOn(swimmer: Swimmer, lengths: number): number {
  return Math.min(lengths, Math.floor(swimmer.dist / LENGTH_M + 1e-9) + 1)
}

/**
 * Calls the turn for the wall ahead, once, and says how it was judged: null where there is no
 * turn to call, out of the zone, on the last length, or with one called already.
 */
export function callTurn(swimmer: Swimmer, lengths: number): TurnGrade | null {
  if (!swimming(swimmer) || swimmer.called !== null) return null
  if (lengthOn(swimmer, lengths) >= lengths) return null
  const away = toWall(swimmer)
  if (away > TURN_ZONE_M) return null
  swimmer.called = away <= TURN_PERFECT_M ? 'perfect' : away <= TURN_GOOD_M ? 'good' : 'early'
  return swimmer.called
}

/** How clean a swimmer's strokes have been on the whole, from 0 to 1. */
export function smoothness(swimmer: Swimmer): number {
  return swimmer.strokes === 0 ? 0 : swimmer.worth / swimmer.strokes
}

// ── How she swims ──────────────────────────────────────────────────────────────────────────

/** What her stroke is worth when she is fresh, and how far either side of it one may fall. */
const HER_STROKE: Record<Skill, number> = { 1: 0.68, 2: 0.78, 3: 0.895, 4: 0.925, 5: 0.985 }
const HER_SPREAD: Record<Skill, number> = { 1: 0.22, 2: 0.18, 3: 0.12, 4: 0.08, 5: 0.04 }
/** What her stroke loses for every hundred metres behind her: the unfit fade. */
const HER_FADE: Record<Skill, number> = { 1: 0.16, 2: 0.11, 3: 0.02, 4: 0.015, 5: 0.01 }
/** How unevenly she keeps the tempo, as a share of the cycle. */
const HER_TEMPO: Record<Skill, number> = { 1: 0.3, 2: 0.22, 3: 0.14, 4: 0.08, 5: 0.04 }
/** The air she breathes at, and the chance she puts a due breath off by a stroke. */
const HER_BREATH_AT: Record<Skill, number> = { 1: 0.18, 2: 0.22, 3: 0.28, 4: 0.32, 5: 0.34 }
const HER_LAPSE: Record<Skill, number> = { 1: 0.3, 2: 0.2, 3: 0.1, 4: 0.03, 5: 0 }
/** The chances of each turn; what is left over is a wall run into. */
const HER_TURNS: Record<Skill, readonly [perfect: number, good: number, early: number]> = {
  1: [0.05, 0.25, 0.35],
  2: [0.12, 0.38, 0.28],
  3: [0.28, 0.44, 0.16],
  4: [0.48, 0.4, 0.08],
  5: [0.7, 0.26, 0.03]
}

/** How long after the whistle she dives, in ms: a practised swimmer is off the blocks sooner. */
export function herReaction(skill: Skill, rand: () => number = Math.random): number {
  return Math.round(170 + (5 - skill) * 70 + rand() * 180)
}

/** The turn she will make at the next wall. */
export function herTurn(skill: Skill, rand: () => number = Math.random): TurnGrade {
  const [perfect, good, early] = HER_TURNS[skill]
  const drawn = rand()
  if (drawn < perfect) return 'perfect'
  if (drawn < perfect + good) return 'good'
  return drawn < perfect + good + early ? 'early' : 'late'
}

/** What her next stroke is worth, `dist` metres into the race. */
export function herStroke(skill: Skill, dist: number, rand: () => number = Math.random): number {
  const worth = HER_STROKE[skill] - (HER_FADE[skill] * dist) / 100 + (rand() - 0.5) * 2 * HER_SPREAD[skill]
  return Math.min(1, Math.max(0.15, worth))
}

/** What a girl carries through a race besides her swimmer: when she next strokes, and the turn she has in mind. */
export interface HerMind {
  strokeInMs: number
  /** The turn drawn for the wall ahead, once she is close enough to think of it. */
  turn: TurnGrade | null
}

export function herMind(): HerMind {
  return { strokeInMs: 0, turn: null }
}

/**
 * What she does in the `dtMs` just gone: a stroke when one is due, a breath when she is short
 * of air, the turn she has in mind once she is where it is called from. Returns whether a
 * stroke just emptied her. Call it after {@link advance}.
 */
export function herMove(
  swimmer: Swimmer,
  mind: HerMind,
  skill: Skill,
  dtMs: number,
  lengths: number,
  rand: () => number = Math.random
): boolean {
  if (!swimming(swimmer)) {
    // Off a wall or the blocks she strokes at once.
    mind.strokeInMs = 0
    mind.turn = null
    return false
  }
  const away = toWall(swimmer)
  if (lengthOn(swimmer, lengths) < lengths && swimmer.called === null && away <= TURN_ZONE_M) {
    if (mind.turn === null) mind.turn = herTurn(skill, rand)
    const from =
      mind.turn === 'perfect' ? TURN_PERFECT_M * 0.7 : mind.turn === 'good' ? TURN_GOOD_M * 0.8 : TURN_ZONE_M
    // A good turn called a step late is a perfect one by the wall's own measure: hold it out of there.
    if (mind.turn !== 'late' && away <= from && (mind.turn !== 'good' || away > TURN_PERFECT_M)) {
      callTurn(swimmer, lengths)
    }
  }
  mind.strokeInMs -= dtMs
  if (mind.strokeInMs > 0) return false
  mind.strokeInMs += CYCLE_MS * (1 + (rand() - 0.5) * 2 * HER_TEMPO[skill])
  if (mind.strokeInMs <= 0) mind.strokeInMs = CYCLE_MS
  // A breath where she is short, unless she puts it off; never one she cannot take.
  if (swimmer.air < HER_BREATH_AT[skill] && swimmer.gaspMs <= 0 && swimmer.breathMs <= 0) {
    if (rand() >= HER_LAPSE[skill]) breathe(swimmer)
  }
  return strokeOf(swimmer, herStroke(skill, swimmer.dist, rand))
}

/** A girl's whole race swum alone, on the race's own step: her swimmer as she touches. */
export function herRace(skill: Skill, lengths: number, rand: () => number = Math.random): Swimmer {
  const race = newRace(lengths, [onBlocks(herReaction(skill, rand))], [skill])
  while (!race.over) runRace(race, STEP_MS, rand)
  return race.swimmers[0]
}

// ── The race on its clock ──────────────────────────────────────────────────────────────────

/** Everyone in the water on one clock. Whoever has no skill is swum from outside: the reader. */
export interface Race {
  lengths: number
  /** Since the whistle, in ms, in whole steps; and the time handed in that no step has used yet. */
  clock: number
  owed: number
  swimmers: Swimmer[]
  skills: (Skill | null)[]
  minds: HerMind[]
  /** Everyone is home, or time has been called on whoever is not. */
  over: boolean
}

/** A race about to start: `skills` has each swimmer's skill in the swimmers' order, null for one the caller swims. */
export function newRace(lengths: number, swimmers: Swimmer[], skills: readonly (Skill | null)[]): Race {
  return {
    lengths,
    clock: 0,
    owed: 0,
    swimmers,
    skills: swimmers.map((_, index) => skills[index] ?? null),
    minds: swimmers.map(() => herMind()),
    over: false
  }
}

/** What a step of the race brought about, and for whom: a swimmer's own events, or a girl emptied of air. */
export type RaceEvent = SwimEvent | { kind: 'gasp' }

/**
 * Moves the race on by `frameMs` of real time, in whole steps of {@link STEP_MS}: what is left
 * over is owed to the next call, so a race swims the same whatever the frames it is given.
 * `tell` hears each thing that happens, as it happens. Time is called at the limit.
 */
export function runRace(
  race: Race,
  frameMs: number,
  rand: () => number = Math.random,
  tell?: (who: number, event: RaceEvent, clockMs: number) => void
): void {
  if (race.over) return
  race.owed += Math.max(0, frameMs)
  const limit = limitOf(race.lengths)
  // A hair of slack, so steps that add up to a frame in floating point are all taken.
  while (race.owed >= STEP_MS - 1e-6 && !race.over) {
    race.owed = Math.max(0, race.owed - STEP_MS)
    race.clock += STEP_MS
    race.swimmers.forEach((swimmer, who) => {
      if (swimmer.finishMs !== null) return
      for (const event of advance(swimmer, STEP_MS, race.clock, race.lengths)) tell?.(who, event, race.clock)
      const skill = race.skills[who]
      if (skill !== null && herMove(swimmer, race.minds[who], skill, STEP_MS, race.lengths, rand)) {
        tell?.(who, { kind: 'gasp' }, race.clock)
      }
    })
    if (race.swimmers.every((swimmer) => swimmer.finishMs !== null) || race.clock >= limit) race.over = true
  }
}

// ── Placing and telling ────────────────────────────────────────────────────────────────────

/** A time as the board shows it, to the hundredth: "23.41", "1:03.07". */
export function clockOf(ms: number): string {
  const hundredths = Math.round(Math.max(0, ms) / 10)
  const minutes = Math.floor(hundredths / 6000)
  const seconds = ((hundredths % 6000) / 100).toFixed(2)
  return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds
}

/** A time as it is told, with its unit: "23.41 s", and past the minute "1:03.07". */
export function timeOf(ms: number): string {
  const clock = clockOf(ms)
  return clock.includes(':') ? clock : `${clock} s`
}

/** A time to the hundredth it is judged at. */
const hundredthsOf = (ms: number): number => Math.round(ms / 10)

/**
 * The place of each time given, in the order given, from 1: equal to the hundredth is the same
 * place, and the next swimmer is as many places back as there are ahead of her. A swimmer who
 * did not finish has no time, given as `Infinity`, and is placed behind everyone who did.
 */
export function placesOf(times: readonly number[]): number[] {
  const judged = times.map(hundredthsOf)
  return judged.map((time) => 1 + judged.filter((other) => other < time).length)
}

/** How the race came out for the reader, whose time is the first: not to finish is to lose. */
export function outcomeOf(times: readonly number[]): 'won' | 'lost' | 'draw' {
  if (!Number.isFinite(times[0])) return 'lost'
  const places = placesOf(times)
  if (places[0] !== 1) return 'lost'
  return places.filter((place) => place === 1).length > 1 ? 'draw' : 'won'
}

/** A finish closer than this is a touch-out, in ms. */
export const TOUCH_OUT_MS = 300

/** Who is where right now, by how far each has swum: the indexes, furthest first. */
export function orderNow(swimmers: readonly Swimmer[]): number[] {
  return swimmers
    .map((swimmer, index) => ({ swimmer, index }))
    .sort((a, b) => {
      const [x, y] = [a.swimmer.finishMs, b.swimmer.finishMs]
      if (x !== null || y !== null) return (x ?? Infinity) - (y ?? Infinity) || a.index - b.index
      return b.swimmer.dist - a.swimmer.dist || a.index - b.index
    })
    .map((entry) => entry.index)
}

const ORDINALS = ['first', 'second', 'third', 'fourth']

/**
 * Where a race is swum, for its wording alone: lengths of a pool, or out to a buoy in the sea
 * and back. `water` is anywhere, in words that suit both. The rules are the same in each.
 */
export type Water = 'pool' | 'sea' | 'water'

/** The water at a scene's location: the stadium's pool, the sea off the beach, or just water. */
export function waterAt(location: string | null | undefined): Water {
  return location === 'selkie_beach' ? 'sea' : location === 'palaestra_stadium' ? 'pool' : 'water'
}

/** How many times a race at sea goes out to the buoy and back. */
const tripsOf = (lengths: number): number => Math.max(1, Math.round(lengths / 2))

/** The course as a race is swum over it: "over 4 lengths of the pool", "twice out to the buoy and back". */
export function courseWords(lengths: number, water: Water = 'water'): string {
  if (water !== 'sea') return `over ${lengths} lengths${water === 'pool' ? ' of the pool' : ''}`
  const trips = tripsOf(lengths)
  const times = trips === 1 ? '' : trips === 2 ? 'twice ' : trips === 3 ? 'three times ' : `${trips} times `
  return `${times}out to the buoy and back`
}

/** How far a race is, in words. */
export function distanceWords(lengths: number, water: Water = 'water'): string {
  const metres = `${lengths * LENGTH_M} metres`
  if (water === 'sea') return `${courseWords(lengths, water)} in the sea, ${metres}`
  return `${lengths} lengths${water === 'pool' ? ' of the pool' : ''}, ${metres}`
}

/** Where the turn at the end of a length is made, as a place: a wall, or at sea the buoy and then the shore. */
export function turnPlace(length: number, water: Water = 'water'): string {
  if (water !== 'sea') return 'the wall'
  return length % 2 === 1 ? 'the buoy' : 'the shore'
}

/** The leg a swimmer is on, as a lane's board has it: "2/4", and at sea "Out", "Back 2/3". */
export function legLabel(length: number, lengths: number, water: Water = 'water'): string {
  if (water !== 'sea') return `${length}/${lengths}`
  const trips = tripsOf(lengths)
  const leg = length % 2 === 1 ? 'Out' : 'Back'
  return trips === 1 ? leg : `${leg} ${Math.ceil(length / 2)}/${trips}`
}

/** A race's finish as a verb, in the past and the present: a wall is touched, a shore is not. */
const touched = (water: Water): string => (water === 'sea' ? 'finished' : 'touched')
const touch = (water: Water): string => (water === 'sea' ? 'finish' : 'touch')

/** One swimmer in a finished race: the reader is the first handed in, under the name "You". */
export interface Finisher {
  name: string
  swimmer: Swimmer
}

/** The finishers in the order they touched, each with her place. */
function finishOrder(all: readonly Finisher[]): { who: Finisher; place: number; index: number }[] {
  const places = placesOf(all.map((entry) => entry.swimmer.finishMs ?? Infinity))
  return all
    .map((who, index) => ({ who, place: places[index], index }))
    .sort((a, b) => a.place - b.place || a.index - b.index)
}

/** How far short of the finish a swimmer is, in whole metres, and never none while she is out. */
const shortOf = (swimmer: Swimmer, lengths: number): number =>
  Math.max(1, Math.round(lengths * LENGTH_M - swimmer.dist))

/** The result as the scene narrates it, to "you". The first finisher is the reader. */
export function raceSummary(all: readonly Finisher[], lengths: number, water: Water = 'water'): string {
  const [me, ...girls] = all
  const out = me.swimmer.finishMs === null
  const mine = timeOf(me.swimmer.finishMs ?? 0)
  const called = `time is called at ${timeOf(limitOf(lengths))} with you still ${shortOf(me.swimmer, lengths)} metres short`
  if (girls.length === 0) {
    return out
      ? `You swim ${distanceWords(lengths, water)}, alone against the clock, and do not finish: ${called}.`
      : `You swim ${distanceWords(lengths, water)}, alone against the clock, and ${touch(water)} in ${mine}.`
  }
  const names = listed(girls.map((girl) => girl.name))
  const course = courseWords(lengths, water)
  const outcome = outcomeOf(all.map((entry) => entry.swimmer.finishMs ?? Infinity))
  const order = finishOrder(all)
  if (girls.length === 1) {
    const her = girls[0].swimmer.finishMs
    if (out) {
      return her === null
        ? `You race ${names} ${course} and neither of you finishes: ${called}, and she is not home either.`
        : `You race ${names} ${course} and do not finish: she ${touch(water) === 'touch' ? 'touches' : 'finishes'} in ${timeOf(her)}, and ${called}.`
    }
    if (her === null) return `You race ${names} ${course} and win in ${mine}: she does not finish before time is called.`
    if (outcome === 'draw') return `You race ${names} ${course} and ${touch(water)} together, ${mine} each: a dead heat.`
    return outcome === 'won'
      ? `You race ${names} ${course} and win, ${mine} to her ${timeOf(her)}.`
      : `You race ${names} ${course} and lose, ${mine} to her ${timeOf(her)}.`
  }
  const told = order
    .map(({ who, index }) => {
      const name = index === 0 ? 'you' : who.name
      return who.swimmer.finishMs === null ? `${name} did not finish` : `${name} ${timeOf(who.swimmer.finishMs)}`
    })
    .join(', ')
  const said = `You race ${names} ${course}`
  if (out) return `${said} and do not finish: ${called}. ${told[0].toUpperCase()}${told.slice(1)}.`
  if (outcome === 'won') return `${said} and win: ${told}.`
  if (outcome === 'draw') {
    const level = order.filter((entry) => entry.place === 1 && entry.index !== 0).map((entry) => entry.who.name)
    return `${said} and ${touch(water)} first together with ${listed(level)}: ${told}.`
  }
  const winners = order.filter((entry) => entry.place === 1).map((entry) => entry.who.name)
  const place = order.find((entry) => entry.index === 0)?.place ?? all.length
  return `${said} and come ${ORDINALS[place - 1] ?? 'last'}; ${listed(winners)} ${winners.length > 1 ? 'win' : 'wins'}: ${told}.`
}

/** A swimmer's turns in a clause, or nothing where she made none. */
function turnsTold(turns: readonly TurnGrade[], water: Water): string {
  if (turns.length === 0) return ''
  const count = (grade: TurnGrade): number => turns.filter((turn) => turn === grade).length
  const parts = [
    ...(count('perfect') ? [`${count('perfect')} perfectly timed`] : []),
    ...(count('good') ? [`${count('good')} decent`] : []),
    ...(count('early') ? [`${count('early')} begun too early and glided in`] : []),
    ...(count('late') ? [`${count('late')} botched, ${water === 'sea' ? 'swinging wide of the mark' : 'swimming straight into the wall'}`] : [])
  ]
  return `${turns.length === 1 ? 'one turn' : `${turns.length} turns`}: ${parts.join(', ')}`
}

/** How a swimmer's stroke was, in a phrase. */
function strokeTold(swimmer: Swimmer): string {
  const smooth = smoothness(swimmer)
  if (swimmer.strokes === 0) return 'barely took a stroke and drifted'
  if (swimmer.thrashed > swimmer.strokes / 2 || smooth < THRASHED_STROKE) return 'thrashed at the water with short, hurried strokes'
  if (smooth >= CLEAN_STROKE) return 'kept a long, smooth, even stroke'
  return 'had an uneven stroke, some long pulls and some rushed ones'
}

/** How a swimmer managed her air, in a phrase. */
function airTold(swimmer: Swimmer): string {
  const breaths = `${swimmer.breaths} ${swimmer.breaths === 1 ? 'breath' : 'breaths'}`
  if (swimmer.gasps > 0) {
    return `ran out of air ${swimmer.gasps === 1 ? 'once' : `${swimmer.gasps} times`} and came up gasping, losing speed (${breaths} taken by choice)`
  }
  return swimmer.breaths === 0 ? 'never came up for a breath' : `breathed in good time (${breaths}) and never ran short`
}

/** How a swimmer left the blocks, in a phrase. */
function startTold(swimmer: Swimmer, water: Water): string {
  if (swimmer.falseStart) return `went before the whistle and was held back ${water === 'sea' ? 'at the water\'s edge' : 'on the blocks'}`
  if (swimmer.reactionMs <= SHARP_START_MS) return `a sharp start, ${timeOf(swimmer.reactionMs)} off the whistle`
  return swimmer.reactionMs >= 600
    ? `a slow start, ${timeOf(swimmer.reactionMs)} off the whistle`
    : `a fair start, ${timeOf(swimmer.reactionMs)} off the whistle`
}

/**
 * The race for the scene's writer, the reader as "the reader": the terms, the finish, who led
 * at each turn, and how each of them swam it. `leaders` is who turned first at each wall, as
 * the names in `all` have them with the reader as "the reader".
 */
export function raceAccount(
  all: readonly Finisher[],
  lengths: number,
  leaders: readonly string[],
  water: Water = 'water'
): string[] {
  const where = water === 'sea' ? 'in the sea off the beach' : water === 'pool' ? 'in the stadium pool' : 'in the water'
  const [me, ...girls] = all
  const named = (index: number, who: Finisher): string => (index === 0 ? 'the reader' : who.name)
  const lines: string[] = []
  lines.push(
    girls.length === 0
      ? `The reader swam a freestyle time trial alone ${where}: ${distanceWords(lengths, water)}.`
      : `A freestyle race ${where} between the reader and ${listed(girls.map((girl) => girl.name))}: ${distanceWords(lengths, water)}, ${water === 'sea' ? 'first back to the shore' : 'first to touch'} wins.`
  )
  const order = finishOrder(all)
  const out = all.filter((entry) => entry.swimmer.finishMs === null)
  if (girls.length === 0) {
    if (me.swimmer.finishMs !== null) lines.push(`The reader ${touched(water)} in ${timeOf(me.swimmer.finishMs)}.`)
  } else {
    lines.push(
      `Finish: ${order
        .map(({ who, place, index }) =>
          who.swimmer.finishMs === null
            ? `${named(index, who)} did not finish`
            : `${place}. ${named(index, who)} ${timeOf(who.swimmer.finishMs)}`
        )
        .join('; ')}.`
    )
    const firsts = order.filter((entry) => entry.place === 1)
    if (out.length === all.length) {
      lines.push('Nobody finished, so nobody won.')
    } else if (order[1].who.swimmer.finishMs === null) {
      lines.push(`${named(order[0].index, order[0].who)} won, the only one to finish.`)
    } else if (firsts.length > 1) {
      lines.push(`${listed(firsts.map((entry) => named(entry.index, entry.who)))} ${touched(water)} in the same hundredth: a dead heat for first.`)
    } else if (order.length > 1) {
      const gap = (order[1].who.swimmer.finishMs ?? 0) - (order[0].who.swimmer.finishMs ?? 0)
      const [first, second] = [named(order[0].index, order[0].who), named(order[1].index, order[1].who)]
      lines.push(
        gap < TOUCH_OUT_MS
          ? `${first} ${water === 'sea' ? 'beat' : 'touched'} ${second} ${water === 'sea' ? 'home' : 'out'} by ${timeOf(gap)}: it was decided on the last stroke.`
          : gap > 4000
            ? `${first} won by a long way, ${timeOf(gap)} clear of ${second}.`
            : `${first} won by ${timeOf(gap)} from ${second}.`
      )
    }
    if (leaders.length > 0) {
      const same = leaders.every((leader) => leader === leaders[0])
      lines.push(
        leaders.length === 1
          ? `${leaders[0]} led at ${water === 'sea' ? 'the buoy' : 'the turn'}.`
          : same
            ? `${leaders[0]} led at every turn.`
            : `Leading at each turn in order: ${leaders.join(', ')}.`
      )
    }
  }
  // Timed out is not walked away: whoever was still out was swimming when time was called.
  if (out.length > 0) {
    const short = out.map((entry) => `${named(all.indexOf(entry), entry)} ${shortOf(entry.swimmer, lengths)} metres short`)
    lines.push(
      `Time was called at ${timeOf(limitOf(lengths))}, the limit for this distance, with ${listed(short)}: still in the water and swimming, too slow to finish, not given up.`
    )
  }
  all.forEach((who, index) => {
    const swimmer = who.swimmer
    const turns = turnsTold(swimmer.turns, water)
    const name = named(index, who)
    lines.push(
      `${name[0].toUpperCase()}${name.slice(1)}: ${startTold(swimmer, water)}; ${strokeTold(swimmer)}; ${airTold(swimmer)}${turns ? `; ${turns}` : ''}.`
    )
  })
  if (girls.length > 0) {
    const faded = girls.filter((girl) => girl.swimmer.gasps > 0 || smoothness(girl.swimmer) < 0.5)
    if (faded.length > 0) lines.push(`${listed(faded.map((girl) => girl.name))} visibly tired and struggled toward the end.`)
  }
  const after = water === 'sea' ? 'in the shallows' : water === 'pool' ? 'in the pool at the wall' : 'in the water'
  lines.push(
    girls.length === 0
      ? `The reader is ${out.length > 0 ? 'still out in the water' : `${after} at the finish`}, soaked and out of breath.`
      : out.length > 0
        ? 'Everyone is still in the water, soaked, hair dripping and out of breath.'
        : `Everyone is still ${after} at the finish, soaked, hair dripping and out of breath.`
  )
  return lines
}

/**
 * The race so far for the scene's writer, should it be walked away from now: the terms, and
 * who is where. Said again at each turn, it is all an unfinished race leaves behind.
 */
export function raceProgress(all: readonly Finisher[], lengths: number, clockMs: number, water: Water = 'water'): string[] {
  const where = water === 'sea' ? 'in the sea off the beach' : water === 'pool' ? 'in the stadium pool' : 'in the water'
  const girls = all.slice(1)
  const named = (index: number): string => (index === 0 ? 'the reader' : all[index].name)
  const at = (swimmer: Swimmer): string => {
    if (swimmer.finishMs !== null) return `finished in ${timeOf(swimmer.finishMs)}`
    const length = lengthOn(swimmer, lengths)
    return water === 'sea' ? `on leg ${legLabel(length, lengths, water).toLowerCase()}` : `on length ${length} of ${lengths}`
  }
  const order = orderNow(all.map((entry) => entry.swimmer))
  const terms =
    girls.length === 0
      ? `The reader was swimming a freestyle time trial alone ${where}: ${distanceWords(lengths, water)}.`
      : `A freestyle race ${where} between the reader and ${listed(girls.map((girl) => girl.name))}: ${distanceWords(lengths, water)}.`
  const stood =
    girls.length === 0
      ? `Unfinished: ${timeOf(clockMs)} after the whistle the reader was ${at(all[0].swimmer)}.`
      : `Unfinished: ${timeOf(clockMs)} after the whistle ${named(order[0])} led (${at(all[order[0]].swimmer)}), then ${listed(order.slice(1).map((index) => `${named(index)} (${at(all[index].swimmer)})`))}.`
  return [terms, stood]
}
