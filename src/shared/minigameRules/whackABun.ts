import { listed, seededRand } from '../minigameKit'

/**
 * Whack-a-Bun's rules: the pattern of a round, what a swing lands on, the score, how a girl
 * plays the same pattern at her skill, and how a round is told.
 */

/** What comes up out of a hole: a bunny, a golden one, or a carrot that is not to be hit. */
export type Kind = 'bun' | 'gold' | 'decoy'

/** The holes of a cabinet, three rows of three, counted along the rows from the top left. */
export const HOLES = 9

/** One thing coming up out of one hole. */
export interface Pop {
  /** When it comes up, in ms from the start of the round. */
  at: number
  /** Which hole, from 0 to 8. */
  hole: number
  /** How long it stays up, in ms. */
  upMs: number
  kind: Kind
}

export interface Pattern {
  seconds: number
  pace: number
  /** The whole round, in ms. */
  lengthMs: number
  /** Everything that comes up, in the order it does. */
  pops: readonly Pop[]
}

/** How long a round lasts, in seconds, by the `seconds` option. */
const SECONDS: Readonly<Record<number, number>> = { 1: 30, 2: 45, 3: 60 }

/** What each pace is called. */
const PACES: Readonly<Record<number, string>> = { 1: 'relaxed', 2: 'lively', 3: 'frantic' }

/** How a round runs at each pace: its first value is how it opens, its second how it ends. */
interface Tempo {
  /** The wait between one coming up and the next, in ms. */
  gapMs: readonly [number, number]
  /** How long a bunny stays up, in ms. */
  upMs: readonly [number, number]
  /** The chance, in the later part of a round, that a second comes up with the first. */
  pair: number
}

const TEMPOS: Readonly<Record<number, Tempo>> = {
  1: { gapMs: [1250, 820], upMs: [1450, 1050], pair: 0.15 },
  2: { gapMs: [1000, 620], upMs: [1200, 850], pair: 0.25 },
  3: { gapMs: [800, 470], upMs: [1000, 700], pair: 0.35 }
}

/** The length option the game can play, whatever was asked for. */
export function secondsOf(asked: number | undefined): number {
  return SECONDS[Math.round(asked ?? 1)] ?? SECONDS[1]
}

/** The pace the game can play, whatever was asked for. */
export function paceOf(asked: number | undefined): number {
  const whole = Math.round(asked ?? 2)
  return TEMPOS[whole] ? whole : 2
}

/** What a pace is called. */
export function paceName(pace: number): string {
  return PACES[paceOf(pace)]
}

/** The first pop of a round, in ms: a breath after the count-in. */
const FIRST_AT_MS = 600
/** The round's last stretch in which nothing new comes up: what is up has ducked by the buzzer. */
const CLEAR_END_MS = 200
/** A hole stays empty this long after what was in it has gone, in ms. */
const HOLE_REST_MS = 260
/** Where two at once begin, as a share of the round. */
const PAIRS_FROM = 0.4
/** How long after the first of a pair the second comes up, in ms. */
const PAIR_LAG_MS = 160
/** The most that are ever up together. */
export const MOST_UP = 3
/** The round opens on plain bunnies: this many before anything else comes up. */
const PLAIN_FIRST = 3
/** The chance that what comes up is golden, and that it is a carrot. */
const GOLD_CHANCE = 0.09
const DECOY_CHANCE = 0.16
/** A golden bunny stays up for this share of a plain one's time. */
const GOLD_UP = 0.7

/**
 * The pattern of one round: when each thing comes up, where, for how long and what it is. The
 * round quickens from first to last, and from two fifths in a second sometimes comes up with
 * the first. The same seed, pace and length give the same pattern every time.
 *
 * A hole is never asked for while something is in it, no more than {@link MOST_UP} are ever up
 * together, and everything has ducked before the time runs out. Every round has at least one
 * golden bunny and one carrot in it.
 */
export function makePattern(seed: string, pace: number, seconds: number): Pattern {
  const tempo = TEMPOS[paceOf(pace)]
  const lengthMs = seconds * 1000
  const rand = seededRand(`whack-a-bun:${paceOf(pace)}:${seconds}:${seed}`)
  const pops: Pop[] = []
  /** When each hole is next free. */
  const freeAt = Array<number>(HOLES).fill(0)
  let lastHole = -1

  const eased = (range: readonly [number, number], through: number): number =>
    range[0] + (range[1] - range[0]) * through

  /** Puts one up at `at`, where there is a hole and the time for it. True where it did. */
  const put = (at: number, plainOnly: boolean): boolean => {
    const through = at / lengthMs
    const free = Array.from({ length: HOLES }, (_, hole) => hole).filter(
      (hole) => freeAt[hole] <= at && hole !== lastHole
    )
    const up = pops.filter((pop) => pop.at + pop.upMs > at).length
    // Drawn whatever comes of them, so a pattern is its seed's.
    const holeRoll = rand()
    const kindRoll = rand()
    if (free.length === 0 || up >= MOST_UP) return false
    const kind: Kind =
      plainOnly || pops.length < PLAIN_FIRST
        ? 'bun'
        : kindRoll < GOLD_CHANCE
          ? 'gold'
          : kindRoll < GOLD_CHANCE + DECOY_CHANCE
            ? 'decoy'
            : 'bun'
    const upMs = Math.round(eased(tempo.upMs, through) * (kind === 'gold' ? GOLD_UP : 1))
    if (at + upMs > lengthMs - CLEAR_END_MS) return false
    const hole = free[Math.floor(holeRoll * free.length)]
    pops.push({ at: Math.round(at), hole, upMs, kind })
    freeAt[hole] = at + upMs + HOLE_REST_MS
    lastHole = hole
    return true
  }

  let at = FIRST_AT_MS
  while (at < lengthMs) {
    const through = at / lengthMs
    const came = put(at, false)
    const pairRoll = rand()
    const waitRoll = rand()
    // The second of a pair is always a plain bunny: two to bop, not a puzzle.
    if (came && through >= PAIRS_FROM && pairRoll < tempo.pair) put(at + PAIR_LAG_MS, true)
    at += eased(tempo.gapMs, through) * (0.85 + 0.3 * waitRoll)
  }
  pops.sort((a, b) => a.at - b.at)

  // A round with no golden bunny or no carrot in it is given one, in place of a plain bunny.
  const swap = (kind: Kind, near: number): void => {
    if (pops.some((pop) => pop.kind === kind)) return
    const plain = pops
      .map((pop, index) => ({ pop, index }))
      .filter(({ pop, index }) => pop.kind === 'bun' && index >= PLAIN_FIRST)
      .sort((a, b) => Math.abs(a.pop.at - near) - Math.abs(b.pop.at - near))[0]
    if (!plain) return
    pops[plain.index] = {
      ...plain.pop,
      kind,
      upMs: kind === 'gold' ? Math.round(plain.pop.upMs * GOLD_UP) : plain.pop.upMs
    }
  }
  swap('gold', lengthMs * 0.55)
  swap('decoy', lengthMs * 0.3)

  return { seconds, pace: paceOf(pace), lengthMs, pops }
}

/** How many of each kind a pattern has. */
export function countsOf(pattern: Pattern): Readonly<Record<Kind, number>> {
  const counts = { bun: 0, gold: 0, decoy: 0 }
  for (const pop of pattern.pops) counts[pop.kind]++
  return counts
}

/** The most that are up together anywhere in a pattern. */
export function mostUp(pops: readonly Pop[]): number {
  return Math.max(0, ...pops.map((pop) => pops.filter((other) => other.at <= pop.at && other.at + other.upMs > pop.at).length))
}

/**
 * What can happen to a player in a round: a bunny bopped, a golden one bopped, a carrot hit, a
 * bunny that got away, a golden one that got away, and a swing at an empty hole.
 */
export type Swing = 'hit' | 'gold' | 'decoy' | 'miss' | 'slipped' | 'stray'

/** What a bunny is worth, how many of them a golden one is, and what a carrot costs. */
export const BUN_POINTS = 10
export const GOLD_TIMES = 3
export const DECOY_COST = 20
/** What a swing at an empty hole costs: little, but swinging at everything is not a way to play. */
export const STRAY_COST = 5
/** Every this many hits in a row the bonus goes up a step, and how many steps there are. */
export const STREAK_STEP = 5
const STREAK_STEPS = 2

/** What a hit is multiplied by, on a run of `streak` hits with this one counted: 1, 1.5 or 2. */
export function multiplierOf(streak: number): number {
  return 1 + 0.5 * Math.min(STREAK_STEPS, Math.floor(streak / STREAK_STEP))
}

/** One player's count through a round. */
export interface Tally {
  score: number
  /** Hits in a row without a slip, now, and the longest run so far. */
  streak: number
  best: number
  /** Plain bunnies bopped, and those that got away. */
  hits: number
  misses: number
  /** Golden bunnies bopped. */
  golds: number
  /** Carrots hit. */
  decoys: number
  /** Swings at an empty hole. */
  strays: number
}

export function emptyTally(): Tally {
  return { score: 0, streak: 0, best: 0, hits: 0, misses: 0, golds: 0, decoys: 0, strays: 0 }
}

/**
 * A tally with one more thing on it. A hit scores at the run it makes; a carrot costs its points
 * and an empty hole its few, never below nothing; a bunny away, a carrot or an empty hole ends
 * the run. A golden bunny that got away costs nothing but itself.
 */
export function tallied(tally: Tally, swing: Swing): Tally {
  if (swing === 'slipped') return tally
  if (swing === 'hit' || swing === 'gold') {
    const streak = tally.streak + 1
    const worth = BUN_POINTS * (swing === 'gold' ? GOLD_TIMES : 1) * multiplierOf(streak)
    return {
      ...tally,
      score: tally.score + worth,
      streak,
      best: Math.max(tally.best, streak),
      hits: tally.hits + (swing === 'hit' ? 1 : 0),
      golds: tally.golds + (swing === 'gold' ? 1 : 0)
    }
  }
  return {
    ...tally,
    score: Math.max(0, tally.score - (swing === 'decoy' ? DECOY_COST : swing === 'stray' ? STRAY_COST : 0)),
    streak: 0,
    misses: tally.misses + (swing === 'miss' ? 1 : 0),
    decoys: tally.decoys + (swing === 'decoy' ? 1 : 0),
    strays: tally.strays + (swing === 'stray' ? 1 : 0)
  }
}

/** What bopping each kind is. */
export const BOPPED: Readonly<Record<Kind, Swing>> = { bun: 'hit', gold: 'gold', decoy: 'decoy' }
/** What each kind going back down unbopped is: nothing at all, for a carrot left alone. */
export const DUCKED: Readonly<Record<Kind, Swing | null>> = { bun: 'miss', gold: 'slipped', decoy: null }

/** A swing this soon after a hole emptied is a moment late, not a swing at nothing, in ms. */
export const LATE_GRACE_MS = 160

/**
 * What a swing at `hole` at `at` ms lands on: the place in the pattern of what is up there and
 * not yet dealt with; `late` where the hole has only just emptied, or what was in it has been
 * bopped already, which counts for nothing either way; `stray` for a hole with nothing in it.
 */
export function swingAt(
  pops: readonly Pop[],
  done: readonly boolean[],
  hole: number,
  at: number
): number | 'late' | 'stray' {
  let late = false
  for (let i = 0; i < pops.length; i++) {
    const pop = pops[i]
    if (pop.at > at) break
    if (pop.hole !== hole) continue
    if (at <= pop.at + pop.upMs && !done[i]) return i
    if (at <= pop.at + pop.upMs + LATE_GRACE_MS) late = true
  }
  return late ? 'late' : 'stray'
}

/** How a girl plays, from 1 (never held the mallet) to 5 (the name on the high-score card). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** A pair of hands at a cabinet. */
export interface Hand {
  /** From a bunny coming up to the mallet landing on it, in ms, and how far either side it varies. */
  reactMs: number
  spreadMs: number
  /** How often one comes up and she is not there for it at all. */
  lapse: number
  /** Of those, how often she swings anyway and finds an empty hole. */
  flail: number
  /** How often a carrot is swung at as if it were a bunny. */
  fallFor: number
}

/** The hands each skill plays with. */
export const HANDS: Readonly<Record<Skill, Hand>> = {
  1: { reactMs: 830, spreadMs: 230, lapse: 0.2, flail: 0.5, fallFor: 0.55 },
  2: { reactMs: 730, spreadMs: 190, lapse: 0.14, flail: 0.4, fallFor: 0.4 },
  3: { reactMs: 615, spreadMs: 140, lapse: 0.07, flail: 0.3, fallFor: 0.2 },
  4: { reactMs: 540, spreadMs: 115, lapse: 0.05, flail: 0.2, fallFor: 0.12 },
  5: { reactMs: 450, spreadMs: 80, lapse: 0.02, flail: 0.1, fallFor: 0.04 }
}

/**
 * From one swing to the next, at the least, in ms: the mallet has to get there. It holds for the
 * girls' hands and for the reader's alike.
 */
export const HAND_MS = 220

/**
 * What a swing of the reader's at `hole` at `at` ms comes to, his mallet free again from
 * `freeAt`: `resting` where it is still coming back from his last swing, which is no swing at
 * all; otherwise what {@link swingAt} finds. Whatever it finds, the mallet is then away for
 * {@link HAND_MS}.
 */
export function readerSwing(
  pops: readonly Pop[],
  done: readonly boolean[],
  hole: number,
  at: number,
  freeAt: number
): number | 'late' | 'stray' | 'resting' {
  return at < freeAt ? 'resting' : swingAt(pops, done, hole, at)
}

/** A key or a click of the reader's: when, in ms from the start of the round, and at which hole. */
export interface Press {
  at: number
  hole: number
}

/**
 * A whole round as a run of the reader's presses plays it, in the order it happens: each press a
 * swing where the mallet is free and nothing where it is not, and whatever was never bopped gone
 * as it ducks. It is the reader's game as his cabinet counts it, for a round played out in one go.
 */
export function pressPlay(pattern: Pattern, presses: readonly Press[]): Move[] {
  const { pops, lengthMs } = pattern
  const done: boolean[] = []
  const moves: Move[] = []
  let freeAt = 0
  for (const press of [...presses].sort((a, b) => a.at - b.at)) {
    if (press.at < 0 || press.at >= lengthMs) continue
    const found = readerSwing(pops, done, press.hole, press.at, freeAt)
    if (found === 'resting') continue
    freeAt = press.at + HAND_MS
    if (found === 'late') continue
    if (found === 'stray') {
      moves.push({ at: press.at, pop: -1, swing: 'stray' })
      continue
    }
    done[found] = true
    moves.push({ at: press.at, pop: found, swing: BOPPED[pops[found].kind] })
  }
  pops.forEach((pop, index) => {
    const ducked = DUCKED[pop.kind]
    if (!done[index] && ducked) moves.push({ at: pop.at + pop.upMs, pop: index, swing: ducked })
  })
  return moves.sort((a, b) => a.at - b.at)
}

/** One thing that happens at a cabinet, and when. `pop` is its place in the pattern, -1 for a swing at nothing. */
export interface Move {
  at: number
  pop: number
  swing: Swing
}

/**
 * A whole round as one pair of hands plays it, in the order it happens: each bunny bopped when
 * the hands get to it, or gone if they do not in time; each carrot left alone or fallen for; the
 * odd swing at nothing. Nothing is bopped before it is up or after it has ducked, and two bops
 * are never closer than {@link HAND_MS}, so two up at once cost the slower hands one of them.
 */
export function handPlay(pattern: Pattern, hand: Hand, rand: () => number = Math.random): Move[] {
  const moves: Move[] = []
  let freeAt = 0
  pattern.pops.forEach((pop, index) => {
    // The same four draws for each, whatever comes of them.
    const lapseRoll = rand()
    const early = rand()
    const late = rand()
    const judgeRoll = rand()
    const down = pop.at + pop.upMs
    const ducked = DUCKED[pop.kind]
    const gone = (): void => {
      if (ducked) moves.push({ at: down, pop: index, swing: ducked })
    }
    const when = Math.max(freeAt, pop.at + hand.reactMs + hand.spreadMs * (early + late - 1))
    if (pop.kind === 'decoy') {
      // Seen for what it is, or too slow to make the mistake.
      if (judgeRoll >= hand.fallFor || when > down) return
    } else if (lapseRoll < hand.lapse) {
      if (judgeRoll < hand.flail && when <= down) {
        moves.push({ at: when, pop: -1, swing: 'stray' })
        freeAt = when + HAND_MS
      }
      gone()
      return
    } else if (when > down) {
      gone()
      return
    }
    moves.push({ at: when, pop: index, swing: BOPPED[pop.kind] })
    freeAt = when + HAND_MS
  })
  return moves.sort((a, b) => a.at - b.at)
}

/** A girl's whole round at her skill, in the order it happens. */
export function herGame(pattern: Pattern, skill: Skill, rand: () => number = Math.random): Move[] {
  return handPlay(pattern, HANDS[skill], rand)
}

/** A run of moves, counted. */
export function tallyOf(moves: readonly Move[]): Tally {
  return moves.reduce((tally, move) => tallied(tally, move.swing), emptyTally())
}

/** How it came out for the reader, his score first: alone on top, sharing the top, or neither. */
export function outcomeOf(scores: readonly number[]): 'won' | 'draw' | 'lost' {
  const best = Math.max(...scores)
  if (scores[0] < best) return 'lost'
  return scores.filter((score) => score === best).length > 1 ? 'draw' : 'won'
}

/** Who is alone on top, by place, the reader 0; -1 where the top is shared. */
export function leaderOf(scores: readonly number[]): number {
  const best = Math.max(...scores)
  return scores.filter((score) => score === best).length === 1 ? scores.indexOf(best) : -1
}

/** How the reader went about a round. */
export type ReaderPlay = 'sharp' | 'wild' | 'slow' | 'cautious' | 'steady'

/**
 * How the reader played, from his count and what the pattern offered: wild where a good share of
 * his swings went on carrots and empty holes, sharp where he got nearly everything and wasted
 * little, slow where a lot of bunnies got away from him. Cautious is kept for a round that shows
 * it: carrots came up and he hit none of them, with hardly a swing at nothing, and some bunnies
 * went by. Whether he let one go or was late for it the count cannot say, so it is not said.
 */
export function readerPlay(pattern: Pattern, tally: Tally): ReaderPlay {
  const counts = countsOf(pattern)
  const targets = counts.bun + counts.gold
  const landed = tally.hits + tally.golds
  const wasted = tally.strays + tally.decoys
  const swings = landed + wasted
  const got = targets > 0 ? landed / targets : 0
  const waste = swings > 0 ? wasted / swings : 0
  if (waste >= 0.2 && wasted >= 3) return 'wild'
  if (got >= 0.8) return 'sharp'
  if (got < 0.6) return 'slow'
  if (counts.decoy >= 2 && tally.decoys === 0 && tally.strays <= 1) return 'cautious'
  return 'steady'
}

/** A girl's place at the cabinets beside the reader's. */
export interface Rival {
  name: string
  tally: Tally
}

const scoresOf = (mine: Tally, rivals: readonly Rival[]): number[] => [mine.score, ...rivals.map((rival) => rival.tally.score)]

/** The round's terms as the box says them, where the reader plays alone or the girls are named. */
export function startLine(pattern: Pattern, names: readonly string[]): string {
  const terms = `${pattern.seconds} seconds at a ${paceName(pattern.pace)} pace: bop the bunnies, triple for a golden one, and leave the carrots alone`
  if (names.length === 0) return `You take up the mallet at the Whack-a-Bun cabinet. ${terms}.`
  return `You and ${listed(names)} take a Whack-a-Bun cabinet each, side by side, the same bunnies coming up on every one. ${terms}.`
}

/** The halfway mark, as the scene's narration says it. */
export function halfwayLine(mine: Tally, rivals: readonly Rival[]): string {
  if (rivals.length === 0) return `Halfway: ${mine.score} points, your best run ${mine.best} in a row.`
  const lead = leaderOf(scoresOf(mine, rivals))
  const ahead = lead < 0 ? 'level at the top' : lead === 0 ? 'you are ahead' : `${rivals[lead - 1].name} is ahead`
  return `Halfway: you ${mine.score}, ${rivals.map((rival) => `${rival.name} ${rival.tally.score}`).join(', ')}; ${ahead}.`
}

/**
 * How a round stands at `at` ms, as the scene's writer is told it should the reader walk away
 * there: the terms, how far in it was, and the scores.
 */
export function standingAccount(pattern: Pattern, at: number, mine: Tally, rivals: readonly Rival[]): string[] {
  const left = Math.max(0, Math.ceil((pattern.lengthMs - at) / 1000))
  const terms = `${pattern.seconds} seconds at a ${paceName(pattern.pace)} pace`
  const where = at <= 0 ? 'had only just begun' : `had ${left} of its ${pattern.seconds} seconds left`
  if (rivals.length === 0) {
    return [
      `The reader was playing a round of Whack-a-Bun alone at the arcade, ${terms}, and it ${where}.`,
      at <= 0
        ? 'Nothing was scored yet.'
        : `He had ${mine.score} points: ${mine.hits + mine.golds} bunnies bopped, ${mine.misses} away, ${mine.decoys} carrots hit, best run ${mine.best} in a row.`
    ]
  }
  const lead = leaderOf(scoresOf(mine, rivals))
  return [
    `The reader and ${listed(rivals.map((rival) => rival.name))} were playing a round of Whack-a-Bun at the arcade, a cabinet each, ${terms}, and it ${where}.`,
    at <= 0
      ? 'Nothing was scored yet.'
      : `The score then: the reader ${mine.score}, ${rivals.map((rival) => `${rival.name} ${rival.tally.score}`).join(', ')}; ${lead < 0 ? 'nobody alone in front' : lead === 0 ? 'the reader ahead' : `${rivals[lead - 1].name} ahead`}.`
  ]
}

/** The buzzer, as the scene's narration says it. The scores are the result's to say. */
export function endLine(): string {
  return 'The buzzer goes and every bunny drops out of sight.'
}

/** What a round played alone comes to, as the scene's narration says it. */
export function soloSummary(pattern: Pattern, mine: Tally): string {
  const counts = countsOf(pattern)
  const played = `You play ${pattern.seconds} seconds of Whack-a-Bun and score ${mine.score}`
  const clean = mine.misses === 0 && mine.decoys === 0 && mine.strays === 0
  if (clean && mine.golds === counts.gold) return `${played}, without letting one bunny get away.`
  return `${played}, bopping ${mine.hits + mine.golds} of ${counts.bun + counts.gold} bunnies with a best run of ${mine.best}.`
}

/** What a round against the girls comes to, as the scene's narration says it. */
export function versusSummary(mine: Tally, rivals: readonly Rival[]): string {
  const scores = scoresOf(mine, rivals)
  const outcome = outcomeOf(scores)
  const names = rivals.map((rival) => rival.name)
  const board = rivals.map((rival) => `${rival.name} ${rival.tally.score}`).join(', ')
  const played = `You play Whack-a-Bun against ${listed(names)}`
  if (outcome === 'won') return `${played} and win with ${mine.score} points: ${board}.`
  if (outcome === 'draw') {
    const sharing = rivals.filter((rival) => rival.tally.score === mine.score).map((rival) => rival.name)
    return rivals.length === 1
      ? `${played} and it ends level, ${mine.score} points each.`
      : `${played} and share the top score of ${mine.score} with ${listed(sharing)}: ${board}.`
  }
  const best = Math.max(...scores)
  const winners = rivals.filter((rival) => rival.tally.score === best).map((rival) => rival.name)
  return rivals.length === 1
    ? `${played} and lose, ${mine.score} points to ${best}.`
    : `${played} and lose with ${mine.score} points; ${listed(winners)} ${winners.length > 1 ? 'share the top score' : 'wins'}: ${board}.`
}

/** One player's round, as the account tells it. */
function playedLine(who: string, pattern: Pattern, tally: Tally): string {
  const counts = countsOf(pattern)
  return `${who} scored ${tally.score}: ${tally.hits} of ${counts.bun} bunnies bopped and ${tally.misses} got away, ${tally.golds} of ${counts.gold} golden ones caught, ${tally.decoys} of ${counts.decoy} carrots hit by mistake, ${tally.strays} swings at an empty hole, best run ${tally.best} in a row.`
}

const PLAYED: Readonly<Record<ReaderPlay, string>> = {
  sharp: 'The reader played sharp: nearly everything bopped and hardly a swing wasted.',
  wild: 'The reader played wild: swinging at everything, carrots and empty holes included, which kept breaking his run.',
  slow: 'The reader was slow: a lot of bunnies had ducked before his mallet got to them.',
  cautious: 'The reader played carefully: not one carrot hit and hardly a swing wasted, though some bunnies got away.',
  steady: 'The reader played steadily: most of the bunnies, the odd one away.'
}

/** A margin under this many plain bunnies is a close game. */
const CLOSE_BUNS = 3

/**
 * A round played alone as the scene's writer is told it: the terms, the count, and how he went
 * about it.
 */
export function soloAccount(pattern: Pattern, mine: Tally): string[] {
  return [
    `The reader played one round of Whack-a-Bun alone at the arcade, ${pattern.seconds} seconds at a ${paceName(pattern.pace)} pace: bunnies to bop for 10, golden ones for triple, carrots that cost 20 if hit, 5 off for a swing at an empty hole.`,
    playedLine('The reader', pattern, mine),
    PLAYED[readerPlay(pattern, mine)]
  ]
}

/**
 * A round against the girls as the scene's writer is told it: the terms, everyone's count, who
 * led at halfway, how the reader went about it, and how near it was. `halfway` is everyone's
 * score at the halfway mark, the reader's first.
 */
export function versusAccount(
  pattern: Pattern,
  mine: Tally,
  rivals: readonly Rival[],
  halfway: readonly number[]
): string[] {
  const who = (place: number): string => (place === 0 ? 'the reader' : rivals[place - 1].name)
  const scores = scoresOf(mine, rivals)
  const best = Math.max(...scores)
  const top = scores.map((score, place) => ({ score, place })).filter((entry) => entry.score === best)
  const second = Math.max(...scores.filter((score) => score < best), 0)
  const led = leaderOf(halfway)
  const won = leaderOf(scores)
  const cap = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
  return [
    `They played one round of Whack-a-Bun at the arcade, the reader and ${listed(rivals.map((rival) => rival.name))} at a cabinet each with the same pattern at the same time, ${pattern.seconds} seconds at a ${paceName(pattern.pace)} pace: bunnies to bop for 10, golden ones for triple, carrots that cost 20 if hit, 5 off for a swing at an empty hole.`,
    playedLine('The reader', pattern, mine),
    ...rivals.map((rival) => playedLine(rival.name, pattern, rival.tally)),
    led < 0
      ? 'At halfway nobody was alone in front.'
      : `At halfway ${who(led)} led${won >= 0 && won !== led ? `, and ${who(won)} came past in the second half` : ''}.`,
    PLAYED[readerPlay(pattern, mine)],
    top.length > 1
      ? `It ended level at the top: ${listed(top.map((entry) => who(entry.place)))} on ${best} each.`
      : best - second < CLOSE_BUNS * BUN_POINTS
        ? `It was close: ${who(top[0].place)} won by only ${best - second} points.`
        : `${cap(who(top[0].place))} won by ${best - second} points.`,
    'Everyone had the same bunnies at the same moments, so the difference was hands and judgement, not luck.'
  ]
}
