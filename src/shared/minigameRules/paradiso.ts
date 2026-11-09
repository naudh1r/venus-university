import { seededRand } from '../minigameKit'

/** PARADISO's rules: the chart of a song, how a step is judged, the score, and how she dances. */

/** The four pads, in the order the lanes stand on screen. */
export const LANES = ['left', 'down', 'up', 'right'] as const

/** A lane, by its place in {@link LANES}. */
export type Lane = 0 | 1 | 2 | 3

/** One step of a song. A double is two notes at the same time in different lanes. */
export interface Note {
  /** When it reaches its target, in ms from the start of the song. */
  time: number
  lane: Lane
  /** It falls between two beats. */
  off: boolean
}

export interface Chart {
  difficulty: number
  bpm: number
  /** One beat, in ms. */
  beatMs: number
  /** The count-in before the first step, in ms: a whole number of beats. */
  leadInMs: number
  /** The whole song, count-in and last beats included, in ms. */
  lengthMs: number
  /** How long an arrow takes to climb the screen, in ms: shorter is faster. */
  scrollMs: number
  /** Every step, in time order. */
  notes: readonly Note[]
}

/** What a song is at each difficulty: its tempo, and how thick with steps it is. */
interface Level {
  bpm: number
  scrollMs: number
  /** The chance of a step on a beat, and between two beats. */
  onBeat: number
  offBeat: number
  /** The chance that a step on a beat is two pads at once. */
  double: number
}

const LEVELS: readonly Level[] = [
  { bpm: 96, scrollMs: 2200, onBeat: 0.55, offBeat: 0, double: 0 },
  { bpm: 112, scrollMs: 2000, onBeat: 0.75, offBeat: 0.08, double: 0 },
  { bpm: 128, scrollMs: 1800, onBeat: 0.85, offBeat: 0.22, double: 0.05 },
  { bpm: 144, scrollMs: 1600, onBeat: 0.92, offBeat: 0.38, double: 0.1 },
  { bpm: 160, scrollMs: 1400, onBeat: 0.96, offBeat: 0.52, double: 0.16 }
]

export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = LEVELS.length
export const DEFAULT_DIFFICULTY = 2

/** A difficulty the game can play, whatever was asked for. */
export function difficultyOf(asked: number | undefined): number {
  const whole = Math.round(asked ?? DEFAULT_DIFFICULTY)
  if (!Number.isFinite(whole)) return DEFAULT_DIFFICULTY
  return Math.min(MAX_DIFFICULTY, Math.max(MIN_DIFFICULTY, whole))
}

/** The beats of the count-in, and the beats left standing after the last step. */
const LEAD_IN_BEATS = 4
const TAIL_BEATS = 2
/** How long the steps of a song run for, near enough: the song is cut to whole bars of four. */
const DANCED_MS = 50000

/** The same pad is never asked for twice inside this, in ms: nobody hammers one foot. */
export const MIN_LANE_GAP_MS = 240

/**
 * The chart of one song: a fixed tempo for the difficulty, steps on the beats and, higher up,
 * between them, the odd double. The same seed and difficulty give the same chart every time.
 *
 * Nothing in it is unplayable: a pad is never repeated inside {@link MIN_LANE_GAP_MS}, there
 * are never more than two pads at once, and a double has the half beat either side of it clear.
 */
export function makeChart(seed: string, difficulty: number): Chart {
  const level = LEVELS[difficultyOf(difficulty) - 1]
  const rand = seededRand(`paradiso:${difficultyOf(difficulty)}:${seed}`)
  const beatMs = 60000 / level.bpm
  const beats = Math.round(DANCED_MS / beatMs / 4) * 4
  const leadInMs = LEAD_IN_BEATS * beatMs

  const notes: Note[] = []
  /** When each pad was last asked for. */
  const last = [-Infinity, -Infinity, -Infinity, -Infinity]
  let lastLane = -1
  /** The half-beat slot before this one had a step in it; the slot is kept clear after a double. */
  let stepBefore = false
  let clearNext = false

  const take = (time: number): Lane | null => {
    const free = ([0, 1, 2, 3] as const).filter((lane) => time - last[lane] >= MIN_LANE_GAP_MS)
    if (free.length === 0) return null
    // A step usually moves to another pad: the same one again is the dull choice.
    const moved = free.filter((lane) => lane !== lastLane)
    const from = moved.length > 0 && rand() < 0.85 ? moved : free
    const lane = from[Math.floor(rand() * from.length)]
    last[lane] = time
    lastLane = lane
    return lane
  }

  for (let slot = 0; slot < beats * 2; slot++) {
    const off = slot % 2 === 1
    const time = leadInMs + (slot * beatMs) / 2
    // Each slot draws the same number of times whatever comes of it, so a chart is its seed's.
    const stepRoll = rand()
    const doubleRoll = rand()
    if (clearNext) {
      clearNext = false
      stepBefore = false
      continue
    }
    // The song opens on a step, on its first beat.
    const stepped = slot === 0 || stepRoll < (off ? level.offBeat : level.onBeat)
    if (!stepped) {
      stepBefore = false
      continue
    }
    const first = take(time)
    if (first === null) {
      stepBefore = false
      continue
    }
    notes.push({ time, lane: first, off })
    if (!off && !stepBefore && slot > 0 && doubleRoll < level.double) {
      const second = take(time)
      if (second !== null) {
        notes.push({ time, lane: second, off })
        clearNext = true
      }
    }
    stepBefore = true
  }

  return {
    difficulty: difficultyOf(difficulty),
    bpm: level.bpm,
    beatMs,
    leadInMs,
    lengthMs: leadInMs + (beats + TAIL_BEATS) * beatMs,
    scrollMs: level.scrollMs,
    notes
  }
}

/** How a step landed. */
export type Judgement = 'perfect' | 'great' | 'good' | 'miss'

export const JUDGEMENTS: readonly Judgement[] = ['perfect', 'great', 'good', 'miss']

/** How far off the beat a step may land, either side, and still be judged each way, in ms. */
export const WINDOWS = { perfect: 45, great: 90, good: 140 } as const

/** What each judgement scores. */
export const POINTS: Readonly<Record<Judgement, number>> = {
  perfect: 1000,
  great: 700,
  good: 400,
  miss: 0
}

/**
 * A step judged by how far off its note it landed, early or late, in ms. Null where it was
 * nowhere near: that is a stray foot, not a step at this note.
 */
export function judge(offsetMs: number): Exclude<Judgement, 'miss'> | null {
  const off = Math.abs(offsetMs)
  if (off <= WINDOWS.perfect) return 'perfect'
  if (off <= WINDOWS.great) return 'great'
  if (off <= WINDOWS.good) return 'good'
  return null
}

/** A note has gone by unstepped: the song is past the last moment it could be hit, in ms. */
export function missed(note: Note, at: number): boolean {
  return at - note.time > WINDOWS.good
}

/**
 * The note a step on `lane` at `at` ms lands on: the earliest one in that lane not yet judged
 * and within reach. -1 where there is none, and the step counts for nothing.
 */
export function noteToHit(
  notes: readonly Note[],
  judged: readonly (Judgement | undefined)[],
  lane: Lane,
  at: number
): number {
  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    if (note.time - at > WINDOWS.good) return -1
    if (note.lane !== lane || judged[i] !== undefined) continue
    if (judge(at - note.time) !== null) return i
  }
  return -1
}

/** One dancer's count through a song. */
export interface Tally {
  score: number
  /** Steps in a row without a miss, now, and the longest run so far. */
  combo: number
  maxCombo: number
  counts: Readonly<Record<Judgement, number>>
}

export function emptyTally(): Tally {
  return { score: 0, combo: 0, maxCombo: 0, counts: { perfect: 0, great: 0, good: 0, miss: 0 } }
}

/** A tally with one more step on it. Anything but a miss keeps the combo going. */
export function tallied(tally: Tally, judgement: Judgement): Tally {
  const combo = judgement === 'miss' ? 0 : tally.combo + 1
  return {
    score: tally.score + POINTS[judgement],
    combo,
    maxCombo: Math.max(tally.maxCombo, combo),
    counts: { ...tally.counts, [judgement]: tally.counts[judgement] + 1 }
  }
}

/** A whole run of judgements, counted. */
export function tallyOf(judgements: readonly Judgement[]): Tally {
  return judgements.reduce(tallied, emptyTally())
}

/** A score as a share of the most a song of `notes` steps can give, from 0 to 1. */
export function scoreShare(score: number, notes: number): number {
  return notes > 0 ? score / (notes * POINTS.perfect) : 0
}

export type Grade = 'AAA' | 'AA' | 'A' | 'B' | 'C' | 'D'

/** The least share of the full score each grade asks for, best first. */
export const GRADES: readonly { grade: Grade; from: number }[] = [
  { grade: 'AAA', from: 0.95 },
  { grade: 'AA', from: 0.88 },
  { grade: 'A', from: 0.78 },
  { grade: 'B', from: 0.65 },
  { grade: 'C', from: 0.5 },
  { grade: 'D', from: 0 }
]

/** The letter the machine gives a share of the full score. */
export function gradeOf(share: number): Grade {
  return GRADES.find((step) => share >= step.from)?.grade ?? 'D'
}

/** How a girl dances, from 1 (never stood on a pad) to 5 (knows the machine by heart). */
export type Skill = 1 | 2 | 3 | 4 | 5

/**
 * How she lands every step of a song of `notes` steps, in order. Her skill is weighed against
 * the difficulty: the best dancer is on the beat nearly every time whatever is playing, and the
 * weakest keeps up with a slow song and comes apart on a fast one.
 *
 * She does not miss evenly. She loses the beat, misses most of a few steps running, and finds
 * it again: how often she loses it is what her skill and the difficulty settle.
 */
export function herDance(
  notes: number,
  skill: Skill,
  difficulty: number,
  rand: () => number = Math.random
): Judgement[] {
  const ease = skill - 0.55 * difficultyOf(difficulty)
  // Both run on a curve with no flat ends, so every step of skill or difficulty tells.
  const perfect = 0.04 + 0.94 / (1 + Math.exp(-1.1 * (ease - 0.6)))
  const slip = 0.3 / (1 + Math.exp(1.6 * (ease + 1.2)))
  const RECOVER = 0.3
  let lost = false
  return Array.from({ length: notes }, (): Judgement => {
    lost = lost ? rand() >= RECOVER : rand() < slip
    const roll = rand()
    if (lost) return roll < 0.75 ? 'miss' : 'good'
    if (roll < perfect) return 'perfect'
    return (roll - perfect) / (1 - perfect) < 0.65 ? 'great' : 'good'
  })
}

/** A score as it is printed: 45,300. */
export function points(score: number): string {
  return String(Math.round(score)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** The song starting, as the scene's narration says it. Her name where she is on the other pad. */
export function startLine(chart: Chart, name?: string): string {
  const song = `difficulty ${chart.difficulty}, ${chart.bpm} beats a minute`
  return name
    ? `You and ${name} step up onto the two pads. PARADISO counts you in: ${song}.`
    : `You step up onto the pad. PARADISO counts you in: ${song}.`
}

/** The halfway mark, as the scene's narration says it. */
export function halfwayLine(mine: Tally, hers?: { name: string; tally: Tally }): string {
  if (!hers) return `Halfway through the song: ${points(mine.score)} points, your best run ${mine.maxCombo} steps.`
  const gap = mine.score - hers.tally.score
  const lead =
    gap === 0 ? 'dead level' : gap > 0 ? 'you are ahead' : `${hers.name} is ahead`
  return `Halfway through the song: you ${points(mine.score)}, ${hers.name} ${points(hers.tally.score)}, ${lead}.`
}

/** The machine's own scoreboard as the song ends, as the scene's narration says it. */
export function resultLine(notes: number, mine: Tally, hers?: { name: string; tally: Tally }): string {
  const board = (tally: Tally): string =>
    `${points(tally.score)}, grade ${gradeOf(scoreShare(tally.score, notes))}`
  return hers
    ? `The song ends and the scores come up. You: ${board(mine)}. ${hers.name}: ${board(hers.tally)}.`
    : `The song ends and the score comes up: ${board(mine)}.`
}

/** What a song danced alone comes to, as the scene's narration says it. */
export function soloSummary(difficulty: number, notes: number, mine: Tally): string {
  const grade = gradeOf(scoreShare(mine.score, notes))
  const said = `${points(mine.score)} points and a grade of ${grade}`
  const danced = `You dance a song on PARADISO at difficulty ${difficultyOf(difficulty)}`
  if (mine.counts.miss === 0 && notes > 0) return `${danced} and come off the pad out of breath with ${said}, without missing a step.`
  if (grade === 'D') return `${danced} and come off the pad out of breath with ${said}. The arrows got away from you.`
  return `${danced} and come off the pad out of breath with ${said}.`
}

/** What a song danced against her comes to, as the scene's narration says it. */
export function versusSummary(name: string, mine: number, hers: number): string {
  if (mine > hers) return `You dance PARADISO side by side with ${name} and win, ${points(mine)} points to ${points(hers)}.`
  if (mine < hers) return `You dance PARADISO side by side with ${name} and lose, ${points(mine)} points to ${points(hers)}.`
  return `You dance PARADISO side by side with ${name} and it ends level, ${points(mine)} points each.`
}

/** A margin under this share of the full score is a close game; over the other, a rout. */
const CLOSE_SHARE = 0.05
const ROUT_SHARE = 0.25

/** One dancer's song, as the account tells it. */
function dancedLine(who: string, notes: number, tally: Tally): string {
  const { perfect, great, good, miss } = tally.counts
  return `${who} scored ${points(tally.score)}, grade ${gradeOf(scoreShare(tally.score, notes))}: ${perfect} Perfect, ${great} Great, ${good} Good and ${miss} missed, with a longest combo of ${tally.maxCombo} steps.`
}

/**
 * A song danced alone as the scene's writer is told it: the song, the score, grade, longest
 * combo and judgements, whether a step was missed at all, and what it took out of him.
 */
export function soloAccount(chart: Chart, mine: Tally): string[] {
  const notes = chart.notes.length
  const landed = notes - mine.counts.miss
  return [
    `The reader danced one song alone on the PARADISO machine, ${notes} steps at difficulty ${chart.difficulty} of ${MAX_DIFFICULTY} (${chart.bpm} beats a minute).`,
    dancedLine('The reader', notes, mine),
    ...(notes > 0 && mine.counts.miss === 0
      ? ['It was a full combo: not one step missed from the first to the last.']
      : landed === 0
        ? ['The reader did not land a single step.']
        : []),
    'It was a physical minute, stamping on the pad at speed: the reader comes off the machine flushed and out of breath.'
  ]
}

/**
 * The game against her as the scene's writer is told it: the song, each dancer's score, grade,
 * longest combo and judgements, who was ahead halfway, how near it was, and what it took out of
 * them. `halfway` is the reader's score less hers at the halfway mark.
 */
export function versusAccount(
  name: string,
  chart: Chart,
  mine: Tally,
  hers: Tally,
  halfway: number
): string[] {
  const notes = chart.notes.length
  const gap = mine.score - hers.score
  const share = scoreShare(Math.abs(gap), notes)
  const ahead = (by: number): string => (by > 0 ? 'the reader' : name)
  return [
    `They danced one song on the PARADISO machine, side by side on its two pads, the same ${notes} steps at the same time, at difficulty ${chart.difficulty} of ${MAX_DIFFICULTY} (${chart.bpm} beats a minute).`,
    dancedLine('The reader', notes, mine),
    dancedLine(name, notes, hers),
    halfway === 0
      ? 'At the halfway mark they were level.'
      : `At the halfway mark ${ahead(halfway)} was ahead${Math.sign(halfway) !== Math.sign(gap) && gap !== 0 ? `, and ${ahead(gap)} came back to take it in the second half` : ''}.`,
    gap === 0
      ? 'It ended dead level, to the point.'
      : share < CLOSE_SHARE
        ? `It was close: ${ahead(gap)} won by only ${points(Math.abs(gap))} points.`
        : share > ROUT_SHARE
          ? `It was not close: ${ahead(gap)} won by ${points(Math.abs(gap))} points.`
          : `${ahead(gap).charAt(0).toUpperCase()}${ahead(gap).slice(1)} won by ${points(Math.abs(gap))} points.`,
    'It was a physical minute, stamping on the pads at speed: both of them come off the machine flushed and out of breath.'
  ]
}
