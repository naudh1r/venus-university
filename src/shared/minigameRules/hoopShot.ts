import { listed } from '../minigameKit'

/**
 * Hoop Shot's rules: the clock, the power meter and the band on it that drops a ball, what a
 * shot comes to, the count, how a girl shoots, and how a round is told.
 */

/** How long a round runs, in seconds, by the `seconds` option. */
export const SECONDS: Readonly<Record<number, number>> = { 1: 30, 2: 45, 3: 60 }

/** A round's length in ms, whatever was asked for. */
export function roundMs(asked: number | undefined): number {
  const whole = Math.round(asked ?? 1)
  return (SECONDS[whole] ?? SECONDS[1]) * 1000
}

/** The count-in before the first ball may be thrown, in ms. */
export const COUNT_IN_MS = 3000
/** The meter's run from one end to the other, in ms: it sweeps up and back without stopping. */
export const SWEEP_MS = 800
/** A ball's flight from the hand to the hoop, in ms: its shot is counted as it gets there. */
export const FLIGHT_MS = 480
/** From one throw to the next ball being in the hand, in ms. */
export const RELOAD_MS = 700

/** Where the band's middle stands on the meter with the hoop at rest, and how far a slide carries it. */
export const ZONE_REST = 0.6
export const ZONE_SLIDE = 0.2
/** How far from the band's middle a ball still drops clean, and how far it still finds the rim. */
export const CLEAN = 0.08
export const RIM = 0.15
/** The chance a ball on the rim rolls in, at the band's inner edge and at its outer. */
const RIM_IN = { near: 0.7, far: 0.2 } as const
/** One slide of the hoop out to one side, across to the other and back, in ms. */
export const SLIDE_MS = 3400

/** What a basket scores, with the hoop still and with it sliding, and what being on fire adds. */
export const POINTS = { still: 2, moving: 3, fire: 1 } as const
/** The baskets in a row that put a shooter on fire. */
export const FIRE_AT = 3

/** When the hoop starts to slide: the last third of the round. */
export function movingFrom(lengthMs: number): number {
  return (lengthMs * 2) / 3
}

/** Where the meter stands at `at` ms, from 0 (no power) to 1 (all of it). */
export function meterAt(at: number): number {
  const turn = (((at / SWEEP_MS) % 2) + 2) % 2
  return turn <= 1 ? turn : 2 - turn
}

/** Where the hoop stands at `at` ms, from -1 (far left) to 1 (far right); 0 until it slides. */
export function hoopAt(at: number, lengthMs: number): number {
  const from = movingFrom(lengthMs)
  return at <= from ? 0 : Math.sin(((at - from) / SLIDE_MS) * 2 * Math.PI)
}

/** The middle of the band on the meter at `at` ms: it goes where the hoop goes. */
export function zoneAt(at: number, lengthMs: number): number {
  return ZONE_REST + ZONE_SLIDE * hoopAt(at, lengthMs)
}

/** How a shot came out. */
export type ShotKind = 'clean' | 'rim-in' | 'rim-out' | 'short' | 'long'

export const SHOT_WORD: Readonly<Record<ShotKind, string>> = {
  clean: 'Clean',
  'rim-in': 'Rim, in',
  'rim-out': 'Rim, out',
  short: 'Short',
  long: 'Long'
}

/** The ball went through. */
export function made(kind: ShotKind): boolean {
  return kind === 'clean' || kind === 'rim-in'
}

/**
 * A ball let go with the meter at `power` and the band's middle at `zone`. Inside the band it
 * drops clean; at its edges it is on the rim, and the random says which way it rolls; outside
 * it is short or long, with no luck in it.
 */
export function judgeShot(power: number, zone: number, rand: () => number = Math.random): ShotKind {
  const off = power - zone
  const far = Math.abs(off)
  if (far <= CLEAN) return 'clean'
  if (far > RIM) return off < 0 ? 'short' : 'long'
  const across = (far - CLEAN) / (RIM - CLEAN)
  return rand() < RIM_IN.near + (RIM_IN.far - RIM_IN.near) * across ? 'rim-in' : 'rim-out'
}

/** One shooter's count through a round. */
export interface Shooter {
  score: number
  makes: number
  attempts: number
  /** Baskets in a row now, and the longest run so far. */
  streak: number
  best: number
  /** How many separate times a run reached {@link FIRE_AT}. */
  fires: number
  last: ShotKind | null
  clean: number
  rimIn: number
  rimOut: number
  /** The same count for the stretch with the hoop sliding. */
  movingMakes: number
  movingAttempts: number
  /** Presses with no ball in the hand: the reader's only. */
  early: number
}

export function freshShooter(): Shooter {
  return {
    score: 0,
    makes: 0,
    attempts: 0,
    streak: 0,
    best: 0,
    fires: 0,
    last: null,
    clean: 0,
    rimIn: 0,
    rimOut: 0,
    movingMakes: 0,
    movingAttempts: 0,
    early: 0
  }
}

/** A run long enough to be on fire. */
export function onFire(streak: number): boolean {
  return streak >= FIRE_AT
}

/** What a basket scores for a shooter whose run it brings to `streak`. */
export function pointsFor(streak: number, moving: boolean): number {
  return (moving ? POINTS.moving : POINTS.still) + (onFire(streak) ? POINTS.fire : 0)
}

/** A count with one more shot on it; `moving` is whether the hoop was sliding as it was thrown. */
export function counted(shooter: Shooter, kind: ShotKind, moving: boolean): Shooter {
  const went = made(kind)
  const streak = went ? shooter.streak + 1 : 0
  return {
    ...shooter,
    score: shooter.score + (went ? pointsFor(streak, moving) : 0),
    makes: shooter.makes + Number(went),
    attempts: shooter.attempts + 1,
    streak,
    best: Math.max(shooter.best, streak),
    fires: shooter.fires + Number(streak === FIRE_AT),
    last: kind,
    clean: shooter.clean + Number(kind === 'clean'),
    rimIn: shooter.rimIn + Number(kind === 'rim-in'),
    rimOut: shooter.rimOut + Number(kind === 'rim-out'),
    movingMakes: shooter.movingMakes + Number(went && moving),
    movingAttempts: shooter.movingAttempts + Number(moving)
  }
}

/** A count with one more press that had no ball to throw. */
export function pressedEarly(shooter: Shooter): Shooter {
  return { ...shooter, early: shooter.early + 1 }
}

/** How a girl shoots, from 1 (heaves it) to 5 (cannot miss). */
export type Skill = 1 | 2 | 3 | 4 | 5

/** What her skill comes to at the machine. */
interface Hand {
  /** How far off the band's middle her release strays, as a spread on the meter. */
  spread: number
  /** How much wider that is once the hoop slides. */
  sliding: number
  /** Her time from one shot to the next, in ms, and the chance she fumbles a ball and loses a beat. */
  beatMs: number
  fumble: number
}

const HANDS: Readonly<Record<Skill, Hand>> = {
  1: { spread: 0.15, sliding: 1.7, beatMs: 1900, fumble: 0.22 },
  2: { spread: 0.115, sliding: 1.55, beatMs: 1700, fumble: 0.16 },
  3: { spread: 0.088, sliding: 1.4, beatMs: 1480, fumble: 0.1 },
  4: { spread: 0.078, sliding: 1.25, beatMs: 1450, fumble: 0.05 },
  5: { spread: 0.068, sliding: 1.12, beatMs: 1400, fumble: 0.02 }
}

/** What a fumbled ball costs her, in ms. */
const FUMBLE_MS = 650

/** A girl partway through a round: when her next ball goes up. */
export interface Her {
  nextAt: number
}

/** One ball of hers: when she let it go, how it came out, and whether the hoop was sliding. */
export interface HerShot {
  at: number
  kind: ShotKind
  moving: boolean
}

/** A draw off the bell curve, from two of the random's. */
function bell(a: number, b: number): number {
  return Math.sqrt(-2 * Math.log(1 - a)) * Math.cos(2 * Math.PI * b)
}

/** Her at the buzzer that starts the round: she takes a moment over her first ball. */
export function herStart(skill: Skill, rand: () => number = Math.random): Her {
  return { nextAt: 250 + rand() * HANDS[skill].beatMs * 0.4 }
}

/**
 * Her shooting brought up to `to` ms on the round's clock: every ball she lets go by then, in
 * order. She shoots on her own beat, steadier and quicker the better she is; each release strays
 * from the band's middle by her touch, further once the hoop slides, and the shot is then judged
 * as anyone's is. Nothing goes up once the round is over.
 */
export function herStep(
  her: Her,
  to: number,
  lengthMs: number,
  skill: Skill,
  rand: () => number = Math.random
): { her: Her; shots: HerShot[] } {
  const hand = HANDS[skill]
  const shots: HerShot[] = []
  let nextAt = her.nextAt
  while (nextAt <= to && nextAt < lengthMs) {
    const moving = nextAt >= movingFrom(lengthMs)
    // Every ball draws the same number of times, so a round is its random's.
    const [a, b, roll, beat, slip] = [rand(), rand(), rand(), rand(), rand()]
    const zone = zoneAt(nextAt, lengthMs)
    const power = zone + bell(a, b) * hand.spread * (moving ? hand.sliding : 1)
    shots.push({ at: nextAt, kind: judgeShot(power, zone, () => roll), moving })
    nextAt += hand.beatMs * (0.88 + 0.24 * beat) + (slip < hand.fumble ? FUMBLE_MS : 0)
  }
  return { her: { nextAt }, shots }
}

/** A whole round of hers, counted. */
export function herRound(lengthMs: number, skill: Skill, rand: () => number = Math.random): Shooter {
  const { shots } = herStep(herStart(skill, rand), lengthMs, lengthMs, skill, rand)
  return shots.reduce((shooter, shot) => counted(shooter, shot.kind, shot.moving), freshShooter())
}

export type Outcome = 'won' | 'lost' | 'draw' | 'played'

/** How the round came out for the reader, whose score is the first: alone it is only played. */
export function outcomeOf(scores: readonly number[]): Outcome {
  if (scores.length < 2) return 'played'
  const top = Math.max(...scores)
  if (scores[0] < top) return 'lost'
  return scores.filter((score) => score === top).length === 1 ? 'won' : 'draw'
}

/** Who is in front, by place in `scores`: everyone level on the top score. */
export function leadersOf(scores: readonly number[]): number[] {
  const top = Math.max(...scores)
  return scores.flatMap((score, who) => (score === top ? [who] : []))
}

/** How the reader shot, as far as the count can say. */
export type Touch = 'rushed' | 'clean' | 'streaky' | 'steady' | 'cold'

export function touchOf(shooter: Shooter): Touch {
  const rate = shooter.attempts ? shooter.makes / shooter.attempts : 0
  if (shooter.early >= 4 && shooter.early * 4 >= shooter.attempts) return 'rushed'
  if (rate >= 0.7 && shooter.clean * 3 >= shooter.makes * 2) return 'clean'
  if (shooter.best >= 4 && shooter.best * 2 >= shooter.makes) return 'streaky'
  return rate >= 0.45 ? 'steady' : 'cold'
}

const TOUCH_TOLD: Readonly<Record<Touch, string>> = {
  rushed: 'The reader rushed: he kept hammering the button before the ball was back in his hand, and threw away his rhythm.',
  clean: 'The reader shot cleanly: an even rhythm, most of his baskets dropping without touching the rim. That was touch, not luck.',
  streaky: 'The reader was streaky: most of his baskets came in one hot run, with cold spells either side of it.',
  steady: 'The reader shot steadily without ever getting hot.',
  cold: 'The reader never found the range: more of his shots missed than went in.'
}

const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1)
const times = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`

/** The scores in seat order, as a line reads them: "you 24, Ana 18 and Bea 30". */
function scoresTold(me: string, names: readonly string[], shooters: readonly Shooter[]): string {
  return listed([me, ...names].map((who, index) => `${who} ${shooters[index].score}`))
}

/** The round starting, as the scene's narration says it. */
export function startLine(names: readonly string[], lengthMs: number): string {
  const terms = `${lengthMs / 1000} seconds on the clock, and the hoop starts moving for the last ${Math.round(lengthMs / 3000)}`
  return names.length
    ? `You and ${listed(names)} take a cabinet each and the balls roll down. ${terms}.`
    : `You feed the machine and the balls roll down. ${terms}.`
}

/** The hoop starting to slide, as the scene's narration says it. */
export function movingLine(names: readonly string[], shooters: readonly Shooter[]): string {
  return names.length
    ? `The hoops start to slide, and baskets are worth three: ${scoresTold('you', names, shooters)}.`
    : `The hoop starts to slide, and baskets are worth three: you have ${shooters[0].score}.`
}

/** The buzzer, as the scene's narration says it. */
export function buzzerLine(names: readonly string[], shooters: readonly Shooter[]): string {
  return names.length
    ? `The buzzer. ${capital(scoresTold('you', names, shooters))}.`
    : `The buzzer: ${times(shooters[0].score, 'point')}.`
}

/** How the round stands, for anything said at the machines. `at` is ms on the round's clock. */
export function standingTold(
  names: readonly string[],
  shooters: readonly Shooter[],
  at: number,
  lengthMs: number
): string {
  const left = Math.max(0, Math.ceil((lengthMs - at) / 1000))
  const where =
    at < 0
      ? 'The machine is counting them in.'
      : at >= lengthMs
        ? 'The buzzer has just gone.'
        : at >= movingFrom(lengthMs)
          ? `The hoops are sliding from side to side and baskets are worth 3; ${times(left, 'second')} left.`
          : `The hoops are still; ${times(left, 'second')} left.`
  const hot = ['the reader', ...names].filter((_, who) => onFire(shooters[who].streak))
  return [
    `The game is Hoop Shot, arcade basketball: the reader and ${listed(names)} are side by side at a cabinet each, all shooting at once against one ${lengthMs / 1000}-second clock, too busy to say much.`,
    where,
    `The score is ${scoresTold('the reader', names, shooters)}.`,
    ...(hot.length ? [`${capital(listed(hot))} ${hot.length === 1 ? 'is' : 'are'} on fire, three or more baskets in a row.`] : [])
  ].join(' ')
}

/** What a round shot alone comes to, as the scene's narration says it. */
export function soloSummary(mine: Shooter, lengthMs: number): string {
  const said = `You shoot a ${lengthMs / 1000}-second round of Hoop Shot and finish on ${times(mine.score, 'point')}, ${mine.makes} of ${times(mine.attempts, 'shot')} in`
  if (mine.attempts === 0) return `You stand at the Hoop Shot machine for ${lengthMs / 1000} seconds and never throw a ball.`
  return mine.best >= FIRE_AT ? `${said}, with a best run of ${mine.best} in a row.` : `${said}.`
}

/** What a round against the girls comes to, as the scene's narration says it. */
export function versusSummary(names: readonly string[], shooters: readonly Shooter[]): string {
  const scores = shooters.map((shooter) => shooter.score)
  const said = `You shoot a round of Hoop Shot against ${listed(names)}`
  const told = scoresTold('you', names, shooters)
  const best = leadersOf(scores).filter((who) => who > 0).map((who) => names[who - 1])
  const outcome = outcomeOf(scores)
  if (outcome === 'won') return `${said} and win: ${told}.`
  if (outcome === 'draw') return `${said} and share the top score with ${listed(best)}: ${told}.`
  return `${said} and lose; ${listed(best)} ${best.length === 1 ? 'wins' : 'share the win'}: ${told}.`
}

/** One shooter's round, as the account tells it. */
function shotLine(who: string, shooter: Shooter): string {
  if (shooter.attempts === 0) return `${capital(who)} never threw a ball.`
  const luck =
    shooter.rimIn + shooter.rimOut === 0
      ? ''
      : ` Off the rim ${shooter.rimIn} rolled in and ${shooter.rimOut} rolled out: luck, either way.`
  const hot = shooter.fires ? `, on fire ${shooter.fires === 1 ? 'once' : `${shooter.fires} times`}` : ''
  const sliding = shooter.movingAttempts ? `; ${shooter.movingMakes} of ${shooter.movingAttempts} with the hoop moving` : ''
  return `${capital(who)} scored ${shooter.score}: ${shooter.makes} of ${times(shooter.attempts, 'shot')} in, ${shooter.clean} of them clean, best run ${shooter.best} in a row${hot}${sliding}.${luck}`
}

const TERMS =
  'a basket was 2 points, 3 in the last third once the hoop started sliding from side to side, and three in a row put a shooter on fire for 1 more a basket'

/** A round shot alone as the scene's writer is told it. */
export function soloAccount(mine: Shooter, lengthMs: number): string[] {
  return [
    `The reader shot one ${lengthMs / 1000}-second round alone on the Hoop Shot arcade basketball machine: ${TERMS}.`,
    shotLine('the reader', mine),
    ...(mine.attempts ? [TOUCH_TOLD[touchOf(mine)]] : [])
  ]
}

/**
 * A round against the girls as the scene's writer is told it: the terms, each shooter's count
 * with rim luck set apart from touch, who led as the hoop started to move and whether that held,
 * how the reader shot, and how it ended. `mark` is each score at the moving-hoop mark, in seat
 * order, or null where the round never got there.
 */
export function versusAccount(
  names: readonly string[],
  shooters: readonly Shooter[],
  mark: readonly number[] | null,
  lengthMs: number
): string[] {
  const who = ['the reader', ...names]
  const scores = shooters.map((shooter) => shooter.score)
  const first = leadersOf(scores)
  const rest = scores.filter((score) => score < scores[first[0]])
  const gap = rest.length ? scores[first[0]] - Math.max(...rest) : 0
  const lines = [
    `They shot one ${lengthMs / 1000}-second round of Hoop Shot, arcade basketball, the reader and ${listed(names)} at a cabinet each, all shooting at once on the same clock: ${TERMS}.`,
    ...shooters.map((shooter, index) => shotLine(who[index], shooter))
  ]
  if (mark) {
    const led = leadersOf(mark)
    const held = led.length === first.length && led.every((seat) => first.includes(seat))
    const turn = held
      ? ' and stayed in front to the buzzer'
      : first.length === 1 && !led.includes(first[0])
        ? `, and ${who[first[0]]} came from behind over the moving hoop to take it`
        : ''
    lines.push(
      led.length === who.length
        ? `When the hoop started to move they were all level on ${mark[0]}.`
        : `When the hoop started to move ${listed(led.map((seat) => who[seat]))} led${led.length > 1 ? ' together' : ''}, ${listed(who.map((name, seat) => `${name} ${mark[seat]}`))}${turn}.`
    )
  }
  if (shooters[0].attempts) lines.push(TOUCH_TOLD[touchOf(shooters[0])])
  lines.push(
    first.length === who.length
      ? `It ended level, everyone on ${scores[0]}: a draw.`
      : first.length > 1
        ? `${capital(listed(first.map((seat) => who[seat])))} shared the top score of ${scores[first[0]]}, ${gap} clear${first.includes(0) ? ': a draw for the reader' : ''}.`
        : `${capital(who[first[0]])} won with ${scores[first[0]]}, by ${times(gap, 'point')}${gap <= POINTS.moving + POINTS.fire ? ': one basket in it' : gap >= 15 ? ': not close' : ''}.`
  )
  return lines
}
