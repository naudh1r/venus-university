/**
 * Double or Nothing's rules: the board, a dart, the three ways a game goes, and how she throws.
 *
 * Coordinates are the board's own: its centre at (0, 0), the outer edge of the double ring at
 * radius 1, y pointing down. A dart is kept as where it landed and where it was aimed.
 */

import type { SkillLevel } from '../minigameKit'

/** The numbers round the board, clockwise from the top. */
export const NUMBERS = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5]

/** Where each ring starts and ends, as a share of the double ring's outer edge (170 mm). */
export const RINGS = Object.freeze({
  bull: 6.35 / 170,
  outerBull: 15.9 / 170,
  tripleIn: 99 / 170,
  tripleOut: 107 / 170,
  doubleIn: 162 / 170,
  edge: 1
})

/** How far from the centre an aim or a landing is kept: the board's surround and a little more. */
export const REACH = 1.35

/**
 * How a game goes: `house` is the reader alone for the highest score against the house's posted
 * one, `team` a countdown he and she share against the house, and `versus` 301 each counted down
 * on their own.
 */
export type Mode = 'house' | 'team' | 'versus'
export type Side = 'you' | 'her'
export type HitKind = 'miss' | 'bull' | 'outerBull' | 'single' | 'double' | 'triple'
/** What she aims for when no finish is on: the singles alone, or the trebles and doubles too. */
export type Strategy = 'safe' | 'triples'

export interface Point {
  x: number
  y: number
}

/** A dart thrown: whose, where it landed, and where it was meant to go. */
export interface Dart extends Point {
  side: Side
  aim: Point
}

export interface Hit {
  points: number
  number: number
  kind: HitKind
}

/** How someone throws, each from 0 to 100. */
export interface Traits {
  /** How tight her darts group round where she aims. */
  accuracy: number
  /** How little that grouping changes from dart to dart. */
  consistency: number
  /** How little it widens near a finish or late in the game. */
  composure: number
}

/** The ellipse a held aim is locked to, and how fast the dot inside it moves. */
export interface Ellipse extends Point {
  rx: number
  ry: number
  speed: number
}

export interface Match {
  mode: Mode
  /** In a countdown, the score counted down from. At the house, the score the house posted. */
  target: number
  /** Fixes the house's score, her darts and the path of the reader's moving dot. */
  seed: number
  darts: readonly Dart[]
}

export interface Visit {
  turn: number
  side: Side
  /** The score it opened on: what was left in a countdown, the running total at the house. */
  start: number
  darts: Dart[]
  /** What it scored: nothing for a bust. */
  points: number
  bust: boolean
  closed: boolean
}

export interface Summary {
  done: boolean
  /** Visits finished so far. */
  turn: number
  /** Whose visit is next, or under way. */
  side: Side
  /** The dart of the visit under way, from 1 to 3. */
  dart: number
  /** Each side's countdown. In a team game both are the shared one. Unused at the house. */
  left: Record<Side, number>
  /** The reader's score at the house. */
  score: number
  /** Who reached exactly zero, or null. */
  finisher: Side | null
  visits: Visit[]
  outcome: 'won' | 'lost' | 'draw' | null
}

/** The starting scores a team game may count down from, by the value of its option. */
export const TEAM_STARTS = Object.freeze([301, 501, 701])
/** The score each side counts down from in versus. */
export const VERSUS_START = 301
/** How many visits a game has in all: five alone or as a team, six each in versus. */
export const VISIT_LIMIT: Record<Mode, number> = { house: 5, team: 5, versus: 12 }

/** Scores a landing in the board's own coordinates. */
export function scoreHit(x: number, y: number): Hit {
  const r = Math.hypot(x, y)
  if (!(r <= 1)) return { points: 0, number: 0, kind: 'miss' }
  if (r <= RINGS.bull) return { points: 50, number: 50, kind: 'bull' }
  if (r <= RINGS.outerBull) return { points: 25, number: 25, kind: 'outerBull' }
  const angle = (Math.atan2(x, -y) + Math.PI * 2 + Math.PI / 20) % (Math.PI * 2)
  const number = NUMBERS[Math.floor(angle / (Math.PI / 10)) % 20]
  const multiplier = r >= RINGS.doubleIn ? 2 : r >= RINGS.tripleIn && r <= RINGS.tripleOut ? 3 : 1
  return {
    points: number * multiplier,
    number,
    kind: multiplier === 3 ? 'triple' : multiplier === 2 ? 'double' : 'single'
  }
}

/** A hit in words: "treble 20", "the bullseye", "a miss". */
export function hitWord(hit: Hit): string {
  switch (hit.kind) {
    case 'miss':
      return 'a miss'
    case 'bull':
      return 'the bullseye'
    case 'outerBull':
      return 'the outer bull'
    case 'triple':
      return `treble ${hit.number}`
    case 'double':
      return `double ${hit.number}`
    default:
      return `single ${hit.number}`
  }
}

/** One step of a small generator: a float in [0, 1) and the seed after it. */
export function random(seed: number): [number, number] {
  const next = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return [next / 4294967296, next]
}

/** Mixes a count into a seed, so each dart has a stream of its own. */
function mix(seed: number, count: number, salt: number): number {
  return (seed ^ salt ^ Math.imul(count + 1, 2654435761)) >>> 0
}

/** A landing anywhere inside a disc round the target, evenly spread over its area. */
export function scatter(seed: number, target: Point, radius: number): Point & { seed: number } {
  let a: number, b: number
  ;[a, seed] = random(seed)
  ;[b, seed] = random(seed)
  const r = Math.sqrt(a) * radius
  const angle = b * Math.PI * 2
  return { x: target.x + Math.cos(angle) * r, y: target.y + Math.sin(angle) * r, seed }
}

/** How wide the reader's aim ellipse is, and how fast its dot moves. */
const AIM = Object.freeze({ rx: 0.17, ry: 0.25, speed: 3.4 })

/** The ellipse a held aim locks to, kept whole inside the reach. */
export function aimEllipse(target: Point): Ellipse {
  const { rx, ry, speed } = AIM
  return {
    x: Math.max(-REACH + rx, Math.min(REACH - rx, target.x)),
    y: Math.max(-REACH + ry, Math.min(REACH - ry, target.y)),
    rx,
    ry,
    speed
  }
}

/**
 * Where the dot is inside a held ellipse after so many seconds: a smooth path that stays inside
 * it, crossing the centre about once a second, different for every dart of the game. The
 * reader's dart lands exactly where the dot is when he lets go.
 */
export function movingDot(ellipse: Ellipse, seed: number, count: number, seconds: number): Point {
  const [a, next] = random((seed ^ Math.imul(count + 1, 2654435761)) >>> 0)
  const [b] = random(next)
  const time = Math.max(0, seconds) * ellipse.speed
  const radius = Math.sin(a * Math.PI * 2 + time)
  const angle = b * Math.PI * 2 + time * 1.73
  return {
    x: ellipse.x + ellipse.rx * radius * Math.cos(angle),
    y: ellipse.y + ellipse.ry * radius * Math.sin(angle)
  }
}

/** Who throws a visit: alternate visits with her, the reader first, and all of them alone. */
function visitor(mode: Mode, turn: number): Side {
  return turn % 2 && mode !== 'house' ? 'her' : 'you'
}

/**
 * Plays the darts through. In a countdown a bust puts that side back on the score the visit
 * opened on and ends the visit, and exactly zero ends the game. At the house every point counts
 * and every visit has three darts.
 */
export function summary(match: Match): Summary {
  const { mode } = match
  const limit = VISIT_LIMIT[mode]
  const start = mode === 'house' ? 0 : match.target
  const left: Record<Side, number> = { you: start, her: start }
  // Whose countdown a visit moves: each side's own in versus, the one shared in a team.
  const track = (side: Side): Side => (mode === 'versus' ? side : 'you')
  let turn = 0
  let score = 0
  let current: Visit | null = null
  let finisher: Side | null = null
  const visits: Visit[] = []
  for (const dart of match.darts) {
    if (finisher !== null || turn >= limit) break
    if (!current || current.closed) {
      const side = visitor(mode, turn)
      const opening = mode === 'house' ? score : left[track(side)]
      current = { turn, side, start: opening, darts: [], points: 0, bust: false, closed: false }
      visits.push(current)
    }
    const hit = scoreHit(dart.x, dart.y)
    current.darts.push(dart)
    if (mode === 'house') {
      score += hit.points
      current.points += hit.points
      current.closed = current.darts.length === 3
    } else {
      const side = track(current.side)
      if (hit.points > left[side]) {
        left[side] = current.start
        current.bust = current.closed = true
        current.points = 0
      } else {
        left[side] -= hit.points
        current.points = current.start - left[side]
        if (left[side] === 0) finisher = current.side
        current.closed = finisher !== null || current.darts.length === 3
      }
    }
    if (current.closed) turn++
  }
  if (mode === 'team') left.her = left.you
  const done = finisher !== null || turn >= limit
  let outcome: Summary['outcome'] = null
  if (done) {
    if (mode === 'house') outcome = score > match.target ? 'won' : score === match.target ? 'draw' : 'lost'
    else if (mode === 'team') outcome = finisher ? 'won' : 'lost'
    else
      outcome =
        finisher === 'you'
          ? 'won'
          : finisher === 'her'
            ? 'lost'
            : left.you < left.her
              ? 'won'
              : left.you > left.her
                ? 'lost'
                : 'draw'
  }
  const used = current && !current.closed ? current.darts.length : 0
  return { done, turn, side: visitor(mode, turn), dart: used + 1, left, score, finisher, visits, outcome }
}

/** A new game. A team game counts down from its start, versus from 301, and the house posts a score. */
export function newMatch(mode: Mode, seed: number, teamStart = TEAM_STARTS[0]): Match {
  const target = mode === 'house' ? houseScore(seed) : mode === 'versus' ? VERSUS_START : teamStart
  return { mode, target, seed: seed >>> 0, darts: [] }
}

/** Adds a dart for whoever is throwing, kept inside the reach. The game as it was once it is over. */
export function throwDart(match: Match, landing: Point, aim: Point): Match {
  const s = summary(match)
  if (s.done) return match
  const keep = (n: number): number => (Number.isFinite(n) ? Math.max(-REACH, Math.min(REACH, n)) : REACH)
  const dart: Dart = { side: s.side, x: keep(landing.x), y: keep(landing.y), aim: { x: keep(aim.x), y: keep(aim.y) } }
  return { ...match, darts: [...match.darts, dart] }
}

/** The centre of a named scoring region. */
export function targetRegion(number: number, kind: HitKind = 'single'): Point {
  if (kind === 'bull') return { x: 0, y: 0 }
  if (kind === 'outerBull') return { x: 0, y: -(RINGS.bull + RINGS.outerBull) / 2 }
  const index = Math.max(0, NUMBERS.indexOf(number))
  const radius =
    kind === 'triple'
      ? (RINGS.tripleIn + RINGS.tripleOut) / 2
      : kind === 'double'
        ? (RINGS.doubleIn + 1) / 2
        : 0.79
  const angle = (index * Math.PI) / 10
  return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius }
}

/**
 * The house's thrower: fifteen darts at treble 20, each landing evenly within this radius of
 * it, which averages about 395 a game (5% under 290, 5% over 510).
 *
 * The reader's dart lands where the moving dot is on release, inside an ellipse of 0.17 by 0.25
 * whose dot crosses the centre about once a second. Simulated at treble 20, a reader who releases
 * within about 0.2 s of the crossing (one standard deviation) averages about 400, and beats this
 * house in 52% of games, draws under 1%. Releasing at random averages about 300 and wins 17%, and
 * a sharp timer at 0.12 s averages about 510 and wins 86%.
 */
const HOUSE_SPREAD = 0.12
/** Keeps the house's darts off the game's other streams. */
const HOUSE_SALT = 0x9e3779b9
/** Keeps her darts off the game's other streams. */
const HER_SALT = 0x5bd1e995
/** Keeps her choice among equal aims off the game's other streams. */
const PICK_SALT = 0x2545f491

/** The score the house posts for a game, fixed by its seed. */
export function houseScore(seed: number): number {
  let next = (seed ^ HOUSE_SALT) >>> 0
  let score = 0
  const aim = targetRegion(20, 'triple')
  for (let i = 0; i < 15; i++) {
    const landing = scatter(next, aim, HOUSE_SPREAD)
    next = landing.seed
    score += scoreHit(landing.x, landing.y).points
  }
  return score
}

/** The house averages about this much a game, for telling a hot night from a cold one. */
export const HOUSE_AVERAGE = 395

/**
 * How a girl throws at each skill the framework gives her. A 3 throws as the house does (50
 * across the board, a grouping of about 0.14 against the house's 0.12 at treble 20, so a little
 * wider). Each step up tightens her grouping by about 0.036 of the board's radius, keeps it
 * steadier from dart to dart and under pressure. A 1 sprays darts round the board, a 5 groups
 * them about twice as tight as the house.
 */
export const SKILL_TRAITS: Readonly<Record<SkillLevel, Traits>> = Object.freeze({
  1: { accuracy: 15, consistency: 25, composure: 25 },
  2: { accuracy: 35, consistency: 40, composure: 40 },
  3: { accuracy: 50, consistency: 50, composure: 50 },
  4: { accuracy: 65, consistency: 65, composure: 65 },
  5: { accuracy: 80, consistency: 80, composure: 80 }
})

/** Her traits at a skill. Anything out of range is read as a 3. */
export function traitsFor(skill: number): Traits {
  return SKILL_TRAITS[(skill >= 1 && skill <= 5 ? Math.round(skill) : 3) as SkillLevel]
}

/** What she aims for when no finish is on: a sharp thrower chases the trebles. */
export function strategyFor(traits: Traits): Strategy {
  return traits.accuracy >= 60 ? 'triples' : 'safe'
}

/** How wide her darts group: fixed by accuracy, varied by consistency, widened under pressure. */
export function driftOf(traits: Traits, seed: number, pressed: boolean): {
  base: number
  offset: number
  pressure: number
  radius: number
  seed: number
} {
  const base = 0.26 - traits.accuracy * 0.0024
  const variation = 0.08 * (1 - traits.consistency / 100)
  const pressure = pressed ? 0.08 * (1 - traits.composure / 100) : 0
  const [roll, next] = random(seed)
  const offset = (roll * 2 - 1) * variation
  return {
    base,
    offset,
    pressure,
    radius: Math.max(0.015, Math.min(0.5, base + offset + pressure)),
    seed: next
  }
}

interface Candidate {
  kind: HitKind
  number: number
  aim: Point
  points: number
  outcomes: number[]
  chance: number
}

const candidateCache = new Map<number, Candidate[]>()

/** Every region she might aim at, with what a dart aimed there scores at this spread. */
function candidates(spread: number): Candidate[] {
  const cached = candidateCache.get(spread)
  if (cached) return cached
  const regions: { kind: HitKind; number: number }[] = []
  for (const kind of ['single', 'double', 'triple'] as const)
    for (let number = 1; number <= 20; number++) regions.push({ kind, number })
  regions.push({ kind: 'bull', number: 50 }, { kind: 'outerBull', number: 25 })
  const result = regions.map((region) => {
    const aim = targetRegion(region.number, region.kind)
    const points = scoreHit(aim.x, aim.y).points
    const outcomes: number[] = []
    for (let i = 0; i < 96; i++) {
      const radius = Math.sqrt((i + 0.5) / 96) * spread
      const angle = i * 2.399963229728653
      outcomes.push(scoreHit(aim.x + Math.cos(angle) * radius, aim.y + Math.sin(angle) * radius).points)
    }
    return { ...region, aim, points, outcomes, chance: outcomes.filter((n) => n === points).length / 96 }
  })
  candidateCache.set(spread, result)
  return result
}

interface Route {
  chance: number
  route: Candidate[]
}

/** The likeliest way to reach exactly zero in the darts left, or null where there is none. */
function routeToZero(
  balance: number,
  darts: number,
  regions: Candidate[],
  memo = new Map<string, Route | null>()
): Route | null {
  if (balance === 0) return { chance: 1, route: [] }
  if (!darts || balance > darts * 60) return null
  const key = `${balance}:${darts}`
  if (memo.has(key)) return memo.get(key) ?? null
  let best: Route | null = null
  for (const region of regions) {
    if (!region.chance || region.points > balance) continue
    const next = routeToZero(balance - region.points, darts - 1, regions, memo)
    if (!next) continue
    const chance = region.chance * next.chance
    if (
      !best ||
      chance > best.chance + 1e-9 ||
      (Math.abs(chance - best.chance) < 1e-9 && next.route.length + 1 < best.route.length)
    )
      best = { chance, route: [region, ...next.route] }
  }
  memo.set(key, best)
  return best
}

/** Whether exactly zero can be reached from this score in this many darts. */
export function checkoutOn(balance: number, darts = 3): boolean {
  return balance > 0 && routeToZero(balance, darts, candidates(0.06)) !== null
}

/** Goes for a finish where one is on, and otherwise weighs points against the risk of a bust. */
function aimFor(
  balance: number,
  darts: number,
  lost: number,
  strategy: Strategy,
  spread: number,
  pickSeed: number
): Point {
  const regions = candidates(spread)
  const finish = routeToZero(balance, darts, regions)
  if (finish?.route.length) return finish.route[0].aim
  const choices = regions.filter(
    (r) => r.points <= balance && (strategy === 'triples' || !['triple', 'double'].includes(r.kind))
  )
  const scored = choices.map((r) => ({
    ...r,
    utility:
      r.outcomes.reduce((sum, n) => sum + (n > balance ? -lost - 25 : n), 0) / r.outcomes.length +
      (balance - r.points <= 60 ? 3 : 0)
  }))
  if (!scored.length) return targetRegion(1)
  const best = Math.max(...scored.map((r) => r.utility))
  const shortlist = scored.filter((r) => r.utility >= best - 2)
  const [pick] = random(pickSeed)
  return shortlist[Math.floor(pick * shortlist.length)]?.aim ?? targetRegion(1)
}

/**
 * Her next dart, where it is hers to throw: aimed at her best target from where the countdown
 * stands, landing within her grouping for that dart. Pressure widens it near a finish (60 or
 * less) or late on (her last visit). Each dart is drawn from the game's seed and how many she
 * has thrown, so the same game plays the same.
 */
export function herDart(match: Match, traits: Traits): Dart | null {
  const s = summary(match)
  if (s.done || s.side !== 'her' || match.mode === 'house') return null
  const balance = s.left.her
  const visit = s.visits[s.visits.length - 1]
  const lost = visit && !visit.closed ? visit.points : 0
  const late = s.turn >= VISIT_LIMIT[match.mode] - 2
  const count = match.darts.filter((d) => d.side === 'her').length
  const drift = driftOf(traits, mix(match.seed, count, HER_SALT), balance <= 60 || late)
  const target = aimFor(
    balance,
    4 - s.dart,
    lost,
    strategyFor(traits),
    drift.base + drift.pressure,
    mix(match.seed, count, PICK_SALT)
  )
  const landing = scatter(drift.seed, target, drift.radius)
  return { side: 'her', x: landing.x, y: landing.y, aim: target }
}

/** How far a dart landed from where it was aimed. */
export function missBy(dart: Dart): number {
  return Math.hypot(dart.x - dart.aim.x, dart.y - dart.aim.y)
}

/** How far off the reader's release was, from 0 at the ellipse's centre to 1 at its edge. */
export function releaseOff(dart: Dart): number {
  return Math.min(1, Math.hypot((dart.x - dart.aim.x) / AIM.rx, (dart.y - dart.aim.y) / AIM.ry))
}

/** A visit in a line: "treble 20, 5 and a miss: 65", or how it bust. */
export function visitLine(who: string, visit: Visit, mode: Mode): string {
  const hits = visit.darts.map((d) => hitWord(scoreHit(d.x, d.y)))
  const listedHits = hits.length > 1 ? `${hits.slice(0, -1).join(', ')} and ${hits[hits.length - 1]}` : hits[0]
  if (visit.bust) return `${who}: ${listedHits}. Bust, the visit scores nothing.`
  const after = mode === 'house' ? visit.start + visit.points : visit.start - visit.points
  if (mode !== 'house' && after === 0) return `${who}: ${listedHits}. Checkout!`
  return `${who}: ${listedHits}, for ${visit.points}.`
}

/** The terms, as the situation and the account give them. */
export function termsLine(mode: Mode, target: number, her: string | null): string {
  if (mode === 'house')
    return `The game is darts, Beat the House: the reader alone, five visits of three darts, every point counting, against the ${target} the house posted.`
  if (mode === 'team')
    return `The game is darts, the reader and ${her} as a team against the house: one shared countdown from ${target} to exactly zero, five visits in all, taking alternate visits with the reader first. Going below zero is a bust and scores nothing.`
  return `The game is darts, the reader against ${her}: ${target} each counted down to exactly zero, alternate visits with the reader first, six visits each. Going below zero is a bust and scores nothing. The first to exactly zero wins, and otherwise the lower score left wins.`
}

/** What the scene is told of the game, the reader as "the reader", play told from luck. */
export function accountOf(match: Match, her: string | null, traits: Traits | null): string[] {
  const s = summary(match)
  const lines = [termsLine(match.mode, match.target, her)]
  const sides: Side[] = match.mode === 'house' ? ['you'] : ['you', 'her']
  for (const side of sides) {
    const who = side === 'you' ? 'The reader' : her ?? 'She'
    const visits = s.visits.filter((v) => v.side === side)
    if (!visits.length) continue
    const darts = visits.flatMap((v) => v.darts)
    const hits = darts.map((d) => scoreHit(d.x, d.y))
    const trebles = hits.filter((h) => h.kind === 'triple').length
    const bulls = hits.filter((h) => h.kind === 'bull' || h.kind === 'outerBull').length
    const busts = visits.filter((v) => v.bust).length
    const points = visits.reduce((n, v) => n + v.points, 0)
    const marks = [
      trebles ? `${trebles} treble${trebles === 1 ? '' : 's'}` : '',
      bulls ? `${bulls} on the bull` : '',
      busts ? `${busts} bust${busts === 1 ? '' : 's'}` : ''
    ].filter(Boolean)
    lines.push(
      `${who} threw ${visits.length} visit${visits.length === 1 ? '' : 's'} for ${points}${marks.length ? `, with ${marks.join(', ')}` : ''}.`
    )
    if (side === 'you') {
      const off = darts.reduce((n, d) => n + releaseOff(d), 0) / darts.length
      lines.push(
        off < 0.35
          ? 'The reader timed his releases well, close to where he aimed: good play.'
          : off > 0.65
            ? 'The reader let go loosely, far off where he aimed: poor play, not bad luck.'
            : 'The reader timed his releases fairly, neither sharp nor loose.'
      )
    } else {
      const spread = darts.reduce((n, d) => n + missBy(d), 0) / darts.length
      lines.push(spreadLine(who, spread, traits ?? SKILL_TRAITS[3]))
    }
  }
  const busted = s.visits.filter((v) => v.bust && v.start <= 60)
  if (busted.length)
    lines.push(
      `${busted.length === 1 ? 'A bust came' : 'Busts came'} with a finish in reach: the nerves of a close game more than luck.`
    )
  if (match.mode === 'house') {
    lines.push(
      match.target > HOUSE_AVERAGE + 75
        ? `The house posted ${match.target}, a hot night for it: hard luck to draw.`
        : match.target < HOUSE_AVERAGE - 75
          ? `The house posted ${match.target}, a cold night for it: an easy draw.`
          : `The house posted ${match.target}, about its usual.`
    )
    if (s.done) lines.push(`Final: the reader ${s.score} to the house's ${match.target}.`)
  } else if (match.mode === 'team') {
    if (s.done)
      lines.push(
        s.finisher
          ? `${s.finisher === 'you' ? 'The reader' : her} checked out on exactly zero: the team beat the house.`
          : `The team finished with ${s.left.you} left: the house won.`
      )
    else lines.push(`${s.left.you} left, with ${VISIT_LIMIT.team - s.turn} visits to go.`)
  } else {
    if (s.done)
      lines.push(
        s.finisher
          ? `${s.finisher === 'you' ? 'The reader' : her} checked out first and won.`
          : `After six visits each: the reader ${s.left.you} left, ${her} ${s.left.her} left.`
      )
    else lines.push(`Left so far: the reader ${s.left.you}, ${her} ${s.left.her}.`)
  }
  return lines
}

/**
 * Her grouping on the night, told as play or luck: how good a thrower she is, from her traits,
 * and whether her darts landed wider or tighter than that. A dart lands on average two thirds of
 * its grouping's radius from its aim.
 */
function spreadLine(who: string, spread: number, traits: Traits): string {
  const usual = (2 / 3) * (0.26 - traits.accuracy * 0.0024)
  const thrower =
    traits.accuracy >= 65 ? 'a sharp thrower' : traits.accuracy >= 45 ? 'a fair thrower' : 'a loose thrower'
  const night =
    spread > usual * 1.25
      ? 'and her darts landed wider than her usual: luck against her tonight'
      : spread < usual * 0.8
        ? 'and her darts landed tighter than her usual: luck with her tonight'
        : 'and her darts landed about as her skill would have them'
  return `${who} is ${thrower}, ${night}.`
}

/** The summary, in the second person, saying who won. */
export function summaryOf(match: Match, her: string | null): string {
  const s = summary(match)
  if (match.mode === 'house') {
    if (s.outcome === 'won') return `You play darts alone against the house's posted ${match.target} and beat it, ${s.score} to ${match.target}.`
    if (s.outcome === 'draw') return `You play darts alone against the house and tie its ${match.target} exactly.`
    return `You play darts alone against the house's posted ${match.target} and fall short with ${s.score}.`
  }
  if (match.mode === 'team') {
    if (s.outcome === 'won')
      return `You and ${her} team up at darts against the house, ${match.target} down, and ${s.finisher === 'you' ? 'you check out' : `${her} checks out`} on exactly zero to win.`
    return `You and ${her} team up at darts against the house, ${match.target} down, and run out of visits with ${s.left.you} left: the house wins.`
  }
  if (s.finisher === 'you') return `You play ${her} at darts, ${VERSUS_START} each, and check out first to win, with ${her} on ${s.left.her}.`
  if (s.finisher === 'her') return `You play ${her} at darts, ${VERSUS_START} each, and she checks out first to win, with you on ${s.left.you}.`
  if (s.outcome === 'won') return `You play ${her} at darts, ${VERSUS_START} each. After six visits each nobody has checked out, and you win with ${s.left.you} left to her ${s.left.her}.`
  if (s.outcome === 'lost') return `You play ${her} at darts, ${VERSUS_START} each. After six visits each nobody has checked out, and ${her} wins with ${s.left.her} left to your ${s.left.you}.`
  return `You play ${her} at darts, ${VERSUS_START} each, and after six visits each you are level on ${s.left.you}: a draw.`
}
