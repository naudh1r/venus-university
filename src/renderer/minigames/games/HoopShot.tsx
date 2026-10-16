import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  CLEAN,
  COUNT_IN_MS,
  FLIGHT_MS,
  RELOAD_MS,
  RIM,
  SHOT_WORD,
  buzzerLine,
  counted,
  freshShooter,
  herStart,
  herStep,
  hoopAt,
  judgeShot,
  leadersOf,
  made,
  meterAt,
  movingFrom,
  movingLine,
  onFire,
  outcomeOf,
  pressedEarly,
  roundMs,
  soloAccount,
  soloSummary,
  standingTold,
  startLine,
  versusAccount,
  versusSummary,
  zoneAt,
  type Her,
  type ShotKind,
  type Shooter
} from '@shared/minigameRules/hoopShot'
import { listed } from '@shared/minigameKit'
import {
  gestures,
  lift,
  press,
  remarkBudget,
  sayCapped,
  typingIn,
  useAway,
  useOnTable,
  useReducedMotion,
  useWindowKeydown
} from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/HoopShot.css'

/** How many times in a round any of them says something for herself: the whole row's. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const
/** The longest a remark is counted as on its way: nothing in the round waits on it. */
const SAY_CAP_MS = 3000
/** A run this long is worth a word when a miss ends it. */
const BREAK_TOLD = 4
/** How long before the buzzer the last seconds are remarked on, and how near the scores must be. */
const LAST_MS = 6000
const CLOSE_BY = 4
/** The most one frame may move the clock on, in ms: a stalled frame is not played through. */
const FRAME_CAP_MS = 50
/** Back from away: how long the count before the clock runs again, and each number of it. */
const RESUME_MS = 1800
const RESUME_BEAT_MS = 600
/** A press this soon after the window is back is the one that brought it back, or its echo. */
const BACK_MS = 300
/** How often the scene is told how the round stands, should he walk away from it. */
const PROGRESS_MS = 10000
/**
 * At the reader's own pace with the round kept off the box, how long the buzzer and the result
 * stand before the round is handed over: there is no line for him to step past, so nothing else
 * holds the table open.
 */
const STEPPED_END_MS = 1800

/** The reader's cabinet as it is drawn: HoopShot.css sizes the same box. */
const VIEW = { width: 400, height: 250 }
const HOOP = { x: 200, y: 104, rx: 27, ry: 7, slide: 92 }
const HAND = { x: 200, y: 226, r: 19 }
/** How high over a straight line the ball climbs, and how small it is by the hoop. */
const ARC = 120
const FAR_R = 13

/** The reader's ball in the air. */
interface Thrown {
  /** When it left the hand, on the round's clock. */
  at: number
  kind: ShotKind
  moving: boolean
  /** Which side of the band's middle it was let go: -1 under it, 1 over. */
  side: number
  /** It has reached the hoop and been counted. */
  landed: boolean
}

/** The round as it is being played: read and written by the frame loop, never rendered from. */
interface Live {
  /** Ms on the round's clock: below zero through the count-in. It stands still while he is away. */
  at: number
  /** `performance.now()` at the last frame that moved the clock. */
  frameAt: number
  running: boolean
  over: boolean
  shooters: Shooter[]
  hers: Her[]
  thrown: Thrown | null
  /** Each score as the hoop started to move, or null before it has. */
  mark: number[] | null
  /** Who last led alone, by seat, or -1 before anyone has. */
  leader: number
  lastTold: boolean
  speaking: boolean
  /** How many remarks each girl has made, in her seat's order. */
  spoken: number[]
  count: number | null
  left: number
  /** He has been away since the clock last ran: the loop owes him a count back in. */
  wasGone: boolean
  /** `performance.now()` when the window was last seen back. */
  backAt: number
  /** Ms of the count back in still to run, or 0 where there is none. */
  resume: number
  /** The clock's reading the meter last set off from: it restarts from its low end after a stop. */
  meterFrom: number
  /** The last ten seconds of the round the scene was told of, or -1 before any. */
  told: number
}

/** Where the ball is drawn `since` ms after it was thrown, with the hoop's middle at `hoopX`. */
function ballAt(thrown: Thrown, since: number, hoopX: number): { x: number; y: number; r: number; fade: number } {
  const { kind, side } = thrown
  const onRim = kind === 'rim-in' || kind === 'rim-out'
  const to = {
    x: hoopX + (onRim ? side * HOOP.rx * 0.85 : 0),
    y: HOOP.y + (kind === 'short' ? 30 : kind === 'long' ? -44 : onRim ? -5 : 0)
  }
  if (since < FLIGHT_MS) {
    const along = since / FLIGHT_MS
    return {
      x: HAND.x + (to.x - HAND.x) * along,
      y: HAND.y + (to.y - HAND.y) * along - (kind === 'short' ? ARC * 0.7 : ARC) * 4 * along * (1 - along),
      r: HAND.r + (FAR_R - HAND.r) * along,
      fade: 1
    }
  }
  // What it does at the hoop: through the net, round the rim and in or off, under it, or off the board.
  const after = Math.min(1, (since - FLIGHT_MS) / (RELOAD_MS - FLIGHT_MS))
  const hop = Math.sin(Math.PI * after)
  if (kind === 'clean') return { x: to.x, y: to.y + after * 46, r: FAR_R, fade: 1 - after }
  if (kind === 'rim-in') return { x: to.x + (hoopX - to.x) * after, y: to.y - hop * 12 + after * 42, r: FAR_R, fade: 1 - after * 0.9 }
  if (kind === 'rim-out') return { x: to.x + side * 46 * after, y: to.y - hop * 24 + after * after * 70, r: FAR_R, fade: 1 - after * 0.6 }
  if (kind === 'short') return { x: to.x, y: to.y + after * 56, r: FAR_R + 1, fade: 1 - after }
  return { x: to.x + side * 34 * after, y: to.y + after * after * 120, r: FAR_R, fade: 1 - after * 0.6 }
}

/** A run as a cabinet's display says it. */
function runWord(shooter: Shooter): string {
  if (onFire(shooter.streak)) return `On fire · ${shooter.streak} in a row`
  return shooter.streak > 1 ? `${shooter.streak} in a row` : ' '
}

/**
 * Hoop Shot: a row of arcade basketball cabinets, everyone shooting at once against one clock.
 * The reader's is drawn whole: the hoop, the ball, and a power meter that never stops sweeping.
 * Space or the Shoot button lets the ball go, and where the meter stood against the marked band
 * says how it comes out; the ball is back in his hand a moment later. Each girl shoots at her
 * own cabinet by her skill, stepped on the same clock, and is shown by her score, her last shot
 * and her run. For the last third the hoop slides and takes the band with it. Nothing waits on
 * anything said: the start, the hoop starting to move and the buzzer are on the court, and on the
 * box too with the play-by-play on.
 */
export function HoopShot({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const lengthMs = roundMs(play.options.seconds)
  const slideFrom = movingFrom(lengthMs)

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [shooters, setShooters] = useState<Shooter[]>(() => [freshShooter(), ...girls.map(freshShooter)])
  // What the cabinet's own displays read: the count-in, the seconds left, the ball, the hoop.
  const [count, setCount] = useState<number | null>(null)
  const [left, setLeft] = useState(lengthMs / 1000)
  const [inHand, setInHand] = useState(true)
  const [sliding, setSliding] = useState(false)
  // How many presses found no ball to throw: what the hint's nudge is keyed on.
  const [early, setEarly] = useState(0)
  // The count back in after the window was away, or null where none is running.
  const [resuming, setResuming] = useState<number | null>(null)

  const away = useAway()
  const gone = useRef(away)
  const still = useReducedMotion()
  const calm = useRef(still)
  calm.current = still
  const onTable = useOnTable()
  const held = useRef(play)
  held.current = play
  const [budget] = useState(() => remarkBudget(play.chattiness, REMARKS))
  // The result is handed over once, whatever is run twice.
  const finished = useRef(false)

  const live = useRef<Live>({
    at: -COUNT_IN_MS,
    frameAt: 0,
    running: false,
    over: false,
    shooters: [freshShooter(), ...girls.map(freshShooter)],
    hers: [],
    thrown: null,
    mark: null,
    leader: -1,
    lastTold: false,
    speaking: false,
    spoken: girls.map(() => 0),
    count: null,
    left: lengthMs / 1000,
    wasGone: false,
    backAt: 0,
    resume: 0,
    meterFrom: 0,
    told: -1
  })
  if (away) live.current.wasGone = true
  else if (gone.current) live.current.backAt = performance.now()
  gone.current = away
  // A Space or Enter on the button was acted on as it went down: the click it ends in is not another.
  const keyed = useRef(false)

  // What the frame loop writes to, between renders.
  const marker = useRef<HTMLSpanElement>(null)
  const band = useRef<HTMLSpanElement>(null)
  const hoop = useRef<SVGGElement>(null)
  const ball = useRef<SVGCircleElement>(null)

  /** The girl who has said least so far, the first of them. */
  function quietest(): number {
    const spoken = live.current.spoken
    return girls.map((_, seat) => seat).sort((a, b) => spoken[a] - spoken[b] || a - b)[0] ?? -1
  }

  /** How the round stands, kept current for anything said at the machines. */
  function standing(): void {
    if (!girls.length) return
    const game = live.current
    const told = standingTold(names, game.shooters, game.at, lengthMs)
    held.current.situation(held.current.stake ? `${told} Riding on it: ${held.current.stake}` : told)
  }

  /**
   * Has one girl say something about what just happened, and never holds the round for it. One
   * voice at a time: a moment that comes while a line is on its way is let go, and spends
   * nothing. Nothing is said once the buzzer has gone.
   */
  function remark(seat: number, cue: string): void {
    const game = live.current
    const girl = girls[seat]
    if (!girl || game.over || game.at >= lengthMs || game.speaking || !onTable()) return
    if (!budget.take()) return
    game.speaking = true
    game.spoken[seat]++
    standing()
    void sayCapped(held.current, girl.charId, cue, SAY_CAP_MS).then(() => {
      game.speaking = false
    })
  }

  /** A shot counted for the reader (0) or a girl (her seat from 1), and whatever it is worth a word. */
  function tally(who: number, kind: ShotKind, moving: boolean): void {
    const game = live.current
    const before = game.shooters[who]
    const after = counted(before, kind, moving)
    game.shooters = game.shooters.map((shooter, seat) => (seat === who ? after : shooter))
    setShooters(game.shooters)
    if (!girls.length) return
    standing()
    const scores = game.shooters.map((shooter) => shooter.score)
    const top = leadersOf(scores)
    const was = game.leader
    if (top.length === 1) game.leader = top[0]
    // A ball still in the air at the buzzer is the last move: the result speaks to it.
    if (game.at >= lengthMs) return
    const Name = who ? names[who - 1] : 'The reader'
    const voice = who ? who - 1 : quietest()
    const person = (seat: number): string => (seat ? names[seat - 1] : 'the reader')
    if (moving && top.length === 1 && was >= 0 && was !== top[0]) {
      remark(
        top[0] ? top[0] - 1 : quietest(),
        `With the hoops sliding and ${Math.ceil((lengthMs - game.at) / 1000)} seconds left, ${person(top[0])} has just taken the lead from ${person(was)}, ${scores[top[0]]} to ${scores[was]}.`
      )
    } else if (after.streak === 3 || (after.streak === 6 && held.current.chattiness === 'lots')) {
      remark(voice, `${Name} has just made ${after.streak} baskets in a row and is on fire, every basket worth one more.`)
    } else if (after.streak === 0 && before.streak >= BREAK_TOLD) {
      remark(voice, `${Name} just missed, ${SHOT_WORD[kind].toLowerCase()}, and lost a run of ${before.streak} baskets in a row${kind === 'rim-out' ? ': it rolled round the rim and out, plain bad luck' : ''}.`)
    } else if (held.current.chattiness === 'lots' && who === 0 && kind === 'rim-in') {
      remark(voice, `The reader's ball rolled right round the rim and dropped in: a lucky one.`)
    }
  }

  /**
   * What the scene is to know should he walk away now: the scores and the time left, and the
   * scores as the hoops started to slide once they have.
   */
  function tellProgress(): void {
    const game = live.current
    const everyone = ['the reader', ...names]
    const scores = game.shooters.map((shooter) => shooter.score)
    const secondsLeft = Math.max(0, Math.ceil((lengthMs - Math.max(0, game.at)) / 1000))
    const lines: string[] = []
    if (game.at <= 0) {
      lines.push(
        girls.length
          ? `A ${lengthMs / 1000}-second round of Hoop Shot between ${listed(everyone)} had only just started, with no ball thrown yet.`
          : `A ${lengthMs / 1000}-second round of Hoop Shot alone had only just started, with no ball thrown yet.`
      )
    } else {
      lines.push(
        girls.length
          ? `In a ${lengthMs / 1000}-second round of Hoop Shot, with ${secondsLeft} seconds left on the clock, the score was ${listed(everyone.map((who, seat) => `${who} ${scores[seat]}`))}.`
          : `In a ${lengthMs / 1000}-second round of Hoop Shot alone, the reader had ${scores[0]} points with ${secondsLeft} seconds left on the clock.`
      )
    }
    const mark = game.mark
    if (mark) {
      lines.push(
        girls.length
          ? `As the hoops started to slide for the last third, the score was ${listed(everyone.map((who, seat) => `${who} ${mark[seat] ?? 0}`))}.`
          : `The reader had ${mark[0]} points as the hoop started to slide for the last third.`
      )
    }
    held.current.progress(lines)
  }

  /** The first move: the count-in starts, and from here leaving is walking away. */
  function begin(): void {
    const game = live.current
    if (game.running || game.over || !onTable()) return
    game.running = true
    game.hers = girls.map((girl) => herStart(girl.skill))
    held.current.started()
    void held.current.narrate(startLine(names, lengthMs))
    standing()
    tellProgress()
    setPhase('playing')
  }

  /** The reader lets the ball go, if he has one: the meter is read as it stands this instant. */
  function shoot(): void {
    const game = live.current
    if (!game.running || game.over) return
    // Away, or only just back: the press that brings the window back is not a shot, nor is one
    // made before the count back in is done. Nothing is read off a meter that stood still.
    if (gone.current || document.hidden || !document.hasFocus()) return
    if (game.wasGone || game.resume > 0 || performance.now() - game.backAt < BACK_MS) return
    // The clock as it is now, not as the last frame left it.
    const at = game.at + Math.min(FRAME_CAP_MS, Math.max(0, performance.now() - game.frameAt))
    if (at < 0 || at >= lengthMs) return
    if (game.thrown) {
      game.shooters = game.shooters.map((shooter, seat) => (seat === 0 ? pressedEarly(shooter) : shooter))
      setEarly((presses) => presses + 1)
      return
    }
    const power = meterAt(at - game.meterFrom)
    const zone = zoneAt(at, lengthMs)
    game.thrown = {
      at,
      kind: judgeShot(power, zone),
      moving: at >= slideFrom,
      side: power < zone ? -1 : 1,
      landed: false
    }
    setInHand(false)
  }

  /** Space, or the button: the way in before the round, a shot during it. */
  function act(): void {
    if (live.current.running) shoot()
    else begin()
  }

  useWindowKeydown((event) => {
    if (event.code !== 'Space' || event.ctrlKey || event.metaKey || event.altKey) return
    // A key typed to her is a character, and a button under focus answers Space itself.
    if (typingIn(event)) return
    if (event.target instanceof Element && event.target.closest('button')) return
    event.preventDefault()
    if (!event.repeat) act()
  })

  // The round itself: every frame moves the one clock on and brings everything up to it.
  useEffect(() => {
    if (phase !== 'playing') return
    const game = live.current
    let frame = 0
    game.frameAt = performance.now()

    const end = (): void => {
      game.over = true
      if (finished.current) return
      finished.current = true
      const scores = game.shooters.map((shooter) => shooter.score)
      void held.current.narrate(buzzerLine(names, game.shooters))
      standing()
      setPhase('over')
      const result = (): void => {
        if (!onTable()) return
        held.current.finish(
          girls.length
            ? {
                outcome: outcomeOf(scores),
                summary: versusSummary(names, game.shooters),
                account: versusAccount(names, game.shooters, game.mark, lengthMs)
              }
            : {
                outcome: 'played',
                summary: soloSummary(game.shooters[0], lengthMs),
                account: soloAccount(game.shooters[0], lengthMs)
              }
        )
      }
      if (held.current.stepped && !held.current.playByPlay) {
        tellProgress()
        setTimeout(result, STEPPED_END_MS)
      } else result()
    }

    const loop = (): void => {
      if (!onTable() || game.over) return
      const now = performance.now()
      const passed = Math.min(FRAME_CAP_MS, now - game.frameAt)
      game.frameAt = now
      // Away: the clock stands, and so does everything read off it.
      if (gone.current) {
        game.wasGone = true
        frame = requestAnimationFrame(loop)
        return
      }
      // Back: the count-in starts over, or a short count runs before the clock does. Either way
      // the meter sets off again from its low end, so nothing seen before the stop is of use.
      if (game.wasGone) {
        game.wasGone = false
        if (game.at < 0) {
          game.at = -COUNT_IN_MS
          game.meterFrom = game.at
        } else {
          game.resume = RESUME_MS
          if (marker.current) marker.current.style.left = '0%'
        }
      }
      if (game.resume > 0) {
        game.resume -= passed
        if (game.resume > 0) {
          setResuming(Math.ceil(game.resume / RESUME_BEAT_MS))
        } else {
          game.resume = 0
          game.meterFrom = game.at
          setResuming(null)
        }
        frame = requestAnimationFrame(loop)
        return
      }
      game.at += passed
      const at = game.at

      // The meter, the band on it, and the hoop the band follows.
      const slid = hoopAt(at, lengthMs)
      if (marker.current) marker.current.style.left = `${(meterAt(at - game.meterFrom) * 100).toFixed(2)}%`
      if (band.current) band.current.style.left = `${((zoneAt(at, lengthMs) - RIM) * 100).toFixed(2)}%`
      hoop.current?.setAttribute('transform', `translate(${(slid * HOOP.slide).toFixed(1)} 0)`)

      const counting = at < 0 ? Math.ceil(-at / 1000) : null
      if (counting !== game.count) {
        game.count = counting
        setCount(counting)
      }
      const seconds = Math.max(0, Math.ceil((lengthMs - Math.max(0, at)) / 1000))
      if (seconds !== game.left) {
        game.left = seconds
        setLeft(seconds)
      }

      // The reader's ball: on its way, counted as it gets there, and back in his hand after.
      const thrown = game.thrown
      if (thrown) {
        const since = at - thrown.at
        if (!thrown.landed && since >= FLIGHT_MS) {
          thrown.landed = true
          tally(0, thrown.kind, thrown.moving)
        }
        if (since >= RELOAD_MS) {
          game.thrown = null
          if (ball.current) ball.current.style.visibility = 'hidden'
          setInHand(true)
        } else if (ball.current && !calm.current) {
          const drawn = ballAt(thrown, since, HOOP.x + slid * HOOP.slide)
          ball.current.setAttribute('cx', drawn.x.toFixed(1))
          ball.current.setAttribute('cy', drawn.y.toFixed(1))
          ball.current.setAttribute('r', drawn.r.toFixed(1))
          ball.current.style.opacity = drawn.fade.toFixed(2)
          ball.current.style.visibility = 'visible'
        }
      }

      // Each girl's balls, let go by now on the same clock.
      if (at >= 0) {
        girls.forEach((girl, seat) => {
          const step = herStep(game.hers[seat], at, lengthMs, girl.skill)
          game.hers[seat] = step.her
          for (const shot of step.shots) tally(seat + 1, shot.kind, shot.moving)
        })
      }

      if (!game.mark && at >= slideFrom) {
        game.mark = game.shooters.map((shooter) => shooter.score)
        setSliding(true)
        void held.current.narrate(movingLine(names, game.shooters))
        standing()
        tellProgress()
      }
      const tenth = at < 0 ? -1 : Math.floor(at / PROGRESS_MS)
      if (tenth > game.told && at < lengthMs) {
        game.told = tenth
        tellProgress()
      }
      if (!game.lastTold && at >= lengthMs - LAST_MS) {
        game.lastTold = true
        const scores = game.shooters.map((shooter) => shooter.score)
        const ranked = [...scores].sort((a, b) => b - a)
        if (girls.length && ranked[0] - ranked[1] <= CLOSE_BY) {
          remark(
            quietest(),
            `${LAST_MS / 1000} seconds left on the clock and it is close: ${listed(['the reader', ...names].map((who, seat) => `${who} ${scores[seat]}`))}.`
          )
        }
      }

      // The buzzer; a ball already in the air is let land first.
      if (at >= lengthMs && (!game.thrown || game.thrown.landed)) {
        end()
        return
      }
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
    // The round starts once and runs to its buzzer off the clock.
  }, [phase])

  const over = phase === 'over'
  const playing = phase === 'playing'
  const mine = shooters[0]
  const scores = shooters.map((shooter) => shooter.score)
  const ahead = scores.some((score) => score > 0) ? leadersOf(scores) : []
  const canShoot = playing && count === null && resuming === null && !away
  const dead = over || (playing && !canShoot)
  const label = !playing ? (over ? 'Buzzer' : 'Start') : count !== null || resuming !== null ? 'Get ready' : 'Shoot'
  const clock = `0:${String(left).padStart(2, '0')}`.replace('0:60', '1:00')
  // How the round came out, on the court once the buzzer has gone: the box says it only with the
  // play-by-play on.
  const result = !over
    ? ''
    : !girls.length
      ? `${mine.score} points`
      : outcomeOf(scores) === 'won'
        ? 'you win'
        : outcomeOf(scores) === 'draw'
          ? 'tied'
          : ahead.length === 1
            ? `${names[ahead[0] - 1]} wins`
            : `${listed(ahead.map((seat) => names[seat - 1]))} tie`

  return (
    <div className="vu-hoopshot" data-phase={phase} data-paused={(playing && away) || undefined}>
      <div className="vu-hoopshot-cabinet">
        <div className="vu-hoopshot-court">
          <svg
            className="vu-hoopshot-view"
            viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
            role="img"
            aria-label={`Your cabinet: ${mine.score} points, ${left} seconds left${sliding ? ', the hoop sliding' : ''}`}
          >
            <rect className="vu-hoopshot-back" x="6" y="6" width={VIEW.width - 12} height={VIEW.height - 12} rx="18" />
            {/* The rail the hoop slides on, shown for as long as it does. */}
            <line
              className="vu-hoopshot-rail"
              data-live={sliding || undefined}
              x1={HOOP.x - HOOP.slide - 44}
              x2={HOOP.x + HOOP.slide + 44}
              y1="26"
              y2="26"
            />
            <g ref={hoop}>
              <rect className="vu-hoopshot-board" x={HOOP.x - 48} y="30" width="96" height="66" rx="6" />
              <rect className="vu-hoopshot-square" x={HOOP.x - 19} y="56" width="38" height="30" />
              <path
                className="vu-hoopshot-net"
                d={`M${HOOP.x - HOOP.rx} ${HOOP.y} l9 40 h36 l9 -40 M${HOOP.x - 14} ${HOOP.y + 4} l5 36 M${HOOP.x} ${HOOP.y + 6} v34 M${HOOP.x + 14} ${HOOP.y + 4} l-5 36 M${HOOP.x - 23} ${HOOP.y + 16} h46 M${HOOP.x - 20} ${HOOP.y + 29} h40`}
              />
              <ellipse className="vu-hoopshot-rim" cx={HOOP.x} cy={HOOP.y} rx={HOOP.rx} ry={HOOP.ry} />
            </g>
            <line className="vu-hoopshot-rack" x1="120" x2="280" y1={HAND.y + HAND.r + 2} y2={HAND.y + HAND.r + 2} />
            {/* The ball in his hand, and the one in the air: the loop places the second. */}
            <g className="vu-hoopshot-held" data-live={(inHand && !over) || undefined}>
              <circle cx={HAND.x} cy={HAND.y} r={HAND.r} />
              <path d={`M${HAND.x - HAND.r} ${HAND.y} h${HAND.r * 2} M${HAND.x} ${HAND.y - HAND.r} v${HAND.r * 2}`} />
            </g>
            <circle ref={ball} className="vu-hoopshot-ball" cx={HAND.x} cy={HAND.y} r={HAND.r} />
          </svg>

          {/* Keyed on the count, so each shot's word lands as a new one. */}
          {playing && mine.last && (
            <motion.span
              key={mine.attempts}
              className="vu-hoopshot-call"
              data-made={made(mine.last) || undefined}
              initial={{ opacity: 0.4, scale: 1.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
              {made(mine.last) ? '✓ ' : '✗ '}
              {SHOT_WORD[mine.last]}
            </motion.span>
          )}
          {sliding && !over && <span className="vu-hoopshot-three">3 points</span>}
          {over && (
            <span className="vu-hoopshot-three" role="status">
              {result}
            </span>
          )}

          {phase === 'ready' && (
            <div className="vu-hoopshot-card">
              <p className="vu-hoopshot-how">
                Let the ball go as the meter crosses the band: Space, or the Shoot button. The ball
                takes a moment to come back.
              </p>
              <p className="vu-hoopshot-terms">
                {lengthMs / 1000} seconds · 2 a basket · 3 once the hoop moves · 3 in a row is on fire
              </p>
            </div>
          )}
          {playing && count !== null && !away && (
            <motion.span
              key={count}
              className="vu-hoopshot-count"
              initial={{ opacity: 0.3, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {count}
            </motion.span>
          )}
          {playing && resuming !== null && !away && (
            <motion.span
              key={`back-${resuming}`}
              className="vu-hoopshot-count"
              role="status"
              initial={{ opacity: 0.3, scale: 1.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              {resuming}
            </motion.span>
          )}
          {playing && away && (
            <div className="vu-hoopshot-card" role="status">
              <p className="vu-hoopshot-paused">Paused</p>
              <p className="vu-hoopshot-how">
                The clock waits while the window is away. Back, it counts you in and the meter starts
                over.
              </p>
            </div>
          )}
        </div>

        <div className="vu-hoopshot-meter" data-waiting={!canShoot || undefined}>
          <span className="vu-hoopshot-end">short</span>
          <span className="vu-hoopshot-track" role="img" aria-label="Power meter">
            <span
              ref={band}
              className="vu-hoopshot-band"
              style={{ left: `${(zoneAt(0, lengthMs) - RIM) * 100}%`, width: `${RIM * 200}%` }}
            >
              <span className="vu-hoopshot-sweet" style={{ width: `${(CLEAN / RIM) * 100}%` }} />
            </span>
            <span ref={marker} className="vu-hoopshot-marker" />
          </span>
          <span className="vu-hoopshot-end">long</span>
        </div>

        <div className="vu-hoopshot-desk">
          <div className="vu-hoopshot-read">
            <span className="vu-hoopshot-label">you{ahead.length === 1 && ahead[0] === 0 && girls.length ? ' · leading' : ''}</span>
            <span className="vu-hoopshot-score">{mine.score}</span>
          </div>
          <div className="vu-hoopshot-read">
            <span className="vu-hoopshot-label">clock</span>
            <span className="vu-hoopshot-clock" data-last={(playing && count === null && left <= 5) || undefined}>
              {clock}
            </span>
          </div>
          <div className="vu-hoopshot-read vu-hoopshot-read--wide">
            <span className="vu-hoopshot-label">
              {mine.makes} of {mine.attempts} in
            </span>
            <span className="vu-hoopshot-run" data-fire={onFire(mine.streak) || undefined}>
              {runWord(mine)}
            </span>
          </div>
          <div className="vu-hoopshot-shoot">
            <motion.button
              type="button"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              inert={dead || undefined}
              data-waiting={dead || undefined}
              {...gestures(dead, lift, press)}
              // The press is the shot, at the moment it is made; focus stays where it was.
              onMouseDown={(event) => event.preventDefault()}
              onPointerDown={(event) => {
                if (event.button === 0) act()
              }}
              // Space or Enter on a button under focus is the shot as the key goes down, not as
              // it comes up; the window's own key handler leaves a button's keys to it.
              onKeyDown={(event) => {
                if (event.code !== 'Space' && event.code !== 'Enter' && event.code !== 'NumpadEnter') return
                if (event.ctrlKey || event.metaKey || event.altKey) return
                event.preventDefault()
                if (event.repeat) return
                keyed.current = true
                act()
              }}
              onKeyUp={(event) => {
                if (!keyed.current) return
                // The click a key ends in comes with the key-up: it is let go by, then forgotten.
                event.preventDefault()
                setTimeout(() => {
                  keyed.current = false
                }, 0)
              }}
              // A click with neither pointer nor key behind it is an assistive press.
              onClick={(event) => {
                if (event.detail === 0 && !keyed.current) act()
              }}
            >
              {label}
            </motion.button>
            {/* Keyed on the presses with no ball, so each one nudges the hint. */}
            <motion.span
              key={early}
              className="vu-hoopshot-hint"
              data-live={(playing && !inHand) || undefined}
              initial={early ? { opacity: 0.3 } : false}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              {playing && !inHand ? 'ball on its way back…' : 'Space shoots'}
            </motion.span>
          </div>
        </div>
      </div>

      {girls.length > 0 && (
        <div className="vu-hoopshot-row" data-seats={girls.length}>
          {girls.map((girl, seat) => {
            const hers = shooters[seat + 1]
            const leads = ahead.length === 1 && ahead[0] === seat + 1
            return (
              <div key={girl.charId} className="vu-hoopshot-hers" data-leads={leads || undefined}>
                <div className="vu-hoopshot-side">
                  <span className="vu-hoopshot-who" title={girl.name}>
                    {girl.name}
                  </span>
                  {/* Keyed on her count, so each ball's word lands as a new one. */}
                  <motion.span
                    key={hers.attempts}
                    className="vu-hoopshot-last"
                    data-made={(hers.last && made(hers.last)) || undefined}
                    initial={hers.attempts ? { opacity: 0.3 } : false}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18 }}
                  >
                    {hers.last ? `${made(hers.last) ? '\u2713' : '\u2717'} ${SHOT_WORD[hers.last]}` : '\u00A0'}
                  </motion.span>
                  <span className="vu-hoopshot-run" data-fire={onFire(hers.streak) || undefined}>
                    {runWord(hers)}
                  </span>
                </div>
                <div className="vu-hoopshot-side vu-hoopshot-side--count">
                  <span className="vu-hoopshot-label">{leads ? 'leading' : '\u00A0'}</span>
                  <span className="vu-hoopshot-score">{hers.score}</span>
                  <span className="vu-hoopshot-label">
                    {hers.makes} of {hers.attempts} in
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
