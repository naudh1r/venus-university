import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  AIM_SWEEP_MS,
  BOARD,
  POWER_FROM,
  POWER_SPAN,
  POWER_SWEEP_MS,
  RINGS,
  aimX,
  herRoll,
  needOf,
  outcomeOf,
  powerY,
  progressTold,
  readerRoll,
  rollTold,
  scoresOf,
  soloAccount,
  soloSummary,
  sweepAt,
  sweepFrom,
  tableOf,
  totalsOf,
  versusAccount,
  versusSummary,
  type Roll,
  type RollTold
} from '@shared/minigameRules/skeeBall'
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
  useReducedMotion
} from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/SkeeBall.css'

/** How many times in a game anything is said about a ball, by how talkative the girls are to be: the whole table's. */
const REMARKS = { quiet: 0, some: 3, lots: 7 } as const

/** How long she takes over a ball: long enough for the one before to be read first. */
const HER_PAUSE_MS = 1200
/** The beat before her ball where the text is read at the reader's own pace: no time for reading is kept. */
const STEPPED_BEAT_MS = 300
/**
 * At the reader's own pace with the balls kept off the box, how long the last ball and the result
 * stand before the game is handed over: there is no line for him to step past, so nothing else
 * holds the table open.
 */
const STEPPED_END_MS = 1800
/** The same with more than one girl rolling, and their balls shown at a brisker pace. */
const BRISK = { afterReaderMs: 900, betweenMs: 550, run: 0.75 } as const
/** A ball's trip: up the ramp, the hop onto the board, the drop into a ring or down to the gutter, and the score standing. */
const TRIP = { rampMs: 620, hopMs: 380, dropMs: 420, settleMs: 620 } as const
/** The longest a girl's ball waits on a remark being written: her line may come over the next roll. */
const SAY_CAP_MS = 2500
/** Two stops closer together than this are one press, heard twice. */
const PRESS_GAP_MS = 180
/** How long after the reader looks back nothing he presses is a stop: the press that brought him back is not one. */
const BACK_GAP_MS = 300
/** The most one frame may move a clock: a stalled frame is not time the reader had. */
const FRAME_CAP_MS = 50

/** The two things a roll is made of, in the order they are stopped, and each one's sweep. */
const STAGES = [
  { label: 'Set your line', sweepMs: AIM_SWEEP_MS },
  { label: 'Set the power', sweepMs: POWER_SWEEP_MS }
] as const

/** The alley as it is drawn, from above: the board at the top, its lip, and the ramp below it. */
const LIP_Y = BOARD.depth + 1
const START_Y = LIP_Y + 14.5
const GUTTER_Y = LIP_Y - 1.1
const VIEW = { half: BOARD.half + 1.5, height: START_Y + 2.5 }
const BALL_R = 0.8
/** A height on the board, as drawn. */
const boardY = (y: number): number => LIP_Y - y

interface Point {
  x: number
  y: number
}

const between = (a: Point, b: Point, along: number): Point => ({
  x: a.x + (b.x - a.x) * along,
  y: a.y + (b.y - a.y) * along
})

/** The path of a ball once it is down: where it comes to rest, and a point it goes by on the way. */
function wayDown(roll: Roll): { by: Point | null; rest: Point } {
  const spot = { x: roll.x, y: boardY(roll.y) }
  if (roll.ring && roll.kind !== 'rim-out') return { by: null, rest: { x: roll.ring.x, y: boardY(roll.ring.y) } }
  // Short of the board it runs back down the ramp.
  if (roll.kind === 'short') return { by: null, rest: { x: roll.x, y: START_Y + 1 } }
  const side = roll.x >= 0 ? 1 : -1
  // Over the middle rings or a corner pocket it runs round their rims, not across them.
  const round =
    Math.abs(roll.x) < 4.4 && roll.y > 3 ? 4.7 : Math.abs(roll.x) > 8.2 && roll.y > 27 ? 7.6 : null
  if (round === null) return { by: null, rest: { x: roll.x, y: GUTTER_Y } }
  return { by: { x: side * round, y: spot.y + 1.2 }, rest: { x: side * round, y: GUTTER_Y } }
}

/** A ball on its way: the roll as the rules settled it, and whether it has come down yet. */
interface Rolling {
  roll: Roll
  down: boolean
}

/**
 * Skee-Ball: the alley from above, the rings at the top of it. A roll is two stops, each a click
 * or Space: the line across the lane, then the power on a meter; then the ball runs up the ramp,
 * hops and the rules say where it drops. Alone the reader rolls every ball; with girls everyone
 * rolls one ball in turn, the reader first, and each girl's rolls are the rules' own at her skill.
 * The surface shows the alley, each ball's score, whose ball is next and how the game came out;
 * the scene's dialogue box has the balls too only with the play-by-play on.
 */
export function SkeeBall({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const several = girls.length > 1
  const balls = play.options.balls ?? 6
  const [rolls, setRolls] = useState<Roll[]>([])
  const [rolling, setRolling] = useState<Rolling | null>(null)
  // Which of the two stops is next.
  const [stage, setStage] = useState(0)
  // One of them is saying something about the last ball: the next girl's ball waits for it.
  const [speaking, setSpeaking] = useState(false)
  const [budget] = useState(() => remarkBudget(play.chattiness, REMARKS))
  // Remarks asked for and not yet answered, however long the model takes over them.
  const flying = useRef(0)
  // How many remarks each girl has made, in her seat's order.
  const spoken = useRef<number[]>([])
  // When the last ball was counted, for the beat before a girl's.
  const landedAt = useRef(0)
  // How many balls' lines the reader has moved past, where he steps through them himself.
  const [reached, setReached] = useState(0)
  // The terms are said once and the result handed over once, whatever is run twice.
  const opened = useRef(false)
  const finished = useRef(false)
  const onTable = useOnTable()
  const away = useAway()
  const still = useReducedMotion() === true

  const table = tableOf(rolls, balls, girls.length)
  // The girl whose ball is next, if it is one of theirs.
  const her = table.over || table.who === 0 ? undefined : girls[table.who - 1]
  const waiting = table.over || her !== undefined || rolling !== null

  // What the sweeps and the ball write to, between renders.
  const ballMark = useRef<SVGCircleElement>(null)
  const lineMark = useRef<SVGLineElement>(null)
  const spotMark = useRef<SVGCircleElement>(null)
  const meterMark = useRef<HTMLSpanElement>(null)
  // The two clocks, each run only while the reader is looking: the sweep's and the ball's.
  const sweepClock = useRef(0)
  const tripClock = useRef(0)
  const swept = useRef(0)
  const aim = useRef(0)
  const pressedAt = useRef(0)
  // When the reader last looked away or back, heard as it happens and not a render later.
  const turnedAt = useRef(-BACK_GAP_MS)
  useEffect(() => {
    const turned = (): void => {
      turnedAt.current = performance.now()
    }
    document.addEventListener('visibilitychange', turned)
    window.addEventListener('blur', turned)
    window.addEventListener('focus', turned)
    return () => {
      document.removeEventListener('visibilitychange', turned)
      window.removeEventListener('blur', turned)
      window.removeEventListener('focus', turned)
    }
  }, [])
  /** The sweep is stopped for a reader looking elsewhere, and nothing he presses on the way back stops it for him. */
  const paused = (): boolean =>
    away || document.hidden || !document.hasFocus() || performance.now() - turnedAt.current < BACK_GAP_MS

  // With company the game is on from the moment the balls rattle down, and the terms are said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (girls.length > 0)
      play.narrate(
        `The balls rattle down the chute. ${balls} each against ${listed(names)}, one ball at a time, and you are up first.`
      )
    // Once, as the table opens.
  }, [])

  /** Sends a ball up the ramp: where it drops is settled already and shown when it gets there. */
  function launch(roll: Roll): void {
    tripClock.current = 0
    setRolling({ roll, down: false })
  }

  /** The reader stops whatever is sweeping; the second stop is the roll. */
  function stop(): void {
    if (waiting || paused()) return
    const now = performance.now()
    if (now - pressedAt.current < PRESS_GAP_MS) return
    pressedAt.current = now
    if (rolls.length === 0 && stage === 0) play.started()
    sweepClock.current = 0
    if (stage === 0) {
      aim.current = swept.current * 2 - 1
      setStage(1)
      return
    }
    launch({ who: 0, ...readerRoll(aim.current, swept.current) })
  }

  /**
   * Which girl has something to say about a ball: whoever rolled it, if one of them did; of the
   * reader's, the girl who has said least so far, and among those the one nearest him in score.
   */
  function speakerFor(all: readonly Roll[]): number {
    const roller = all[all.length - 1].who
    if (roller > 0) return roller - 1
    const totals = totalsOf(all, girls.length)
    const said = (seat: number): number => spoken.current[seat] ?? 0
    const apart = (seat: number): number => Math.abs(totals[seat + 1] - totals[0])
    return girls
      .map((_, seat) => seat)
      .sort((a, b) => said(a) - said(b) || apart(a) - apart(b) || a - b)[0]
  }

  /**
   * Has one girl say something about the ball just rolled, where it is worth it: a 100, a gutter
   * ball, the lead changing hands, the last ball coming with the game still open. A few times a
   * game at most between all of them, one voice a ball, never while another remark is still
   * being written, and never on the last ball, which the scene's own reply answers. A remark not
   * made spends nothing.
   */
  function remark(all: readonly Roll[], told: RollTold): void {
    if (girls.length === 0 || flying.current > 0) return
    // Talkative, they have a word for a 50 too.
    const worth = told.moments.length > 0 || (play.chattiness === 'lots' && all[all.length - 1].score >= 50)
    if (!worth || !budget.take()) return
    const seat = speakerFor(all)
    spoken.current[seat] = (spoken.current[seat] ?? 0) + 1
    setSpeaking(true)
    // The wait on her is capped; the count of remarks in the air is not, so two never cross.
    const counted: GamePlay = {
      ...play,
      say: (charId, cue) => {
        flying.current++
        return play.say(charId, cue).finally(() => {
          flying.current--
        })
      }
    }
    void sayCapped(counted, girls[seat].charId, told.cue, SAY_CAP_MS).then(() => {
      if (onTable()) setSpeaking(false)
    })
  }

  /** The ball is down and counted: onto the board, into the scene, and on. */
  function land(roll: Roll): void {
    if (!onTable() || finished.current) return
    landedAt.current = performance.now()
    const all = [...rolls, roll]
    const told = rollTold(names, all, balls)
    sweepClock.current = 0
    setRolls(all)
    setRolling(null)
    setStage(0)
    void play.narrate(told.narration)
    play.progress(progressTold(names, all, balls))
    // At the reader's own pace a girl's ball waits until he has moved past the line for the one before it.
    if (play.stepped) {
      const onBox = (): void => {
        if (onTable() && !finished.current) setReached((count) => Math.max(count, all.length))
      }
      void play.read().then(onBox, onBox)
    }
    if (!tableOf(all, balls, girls.length).over) {
      remark(all, told)
      return
    }

    finished.current = true
    const totals = totalsOf(all, girls.length)
    const result = (): void => {
      if (!onTable()) return
      play.finish(
        girls.length === 0
          ? { outcome: 'played', summary: soloSummary(all), account: soloAccount(all) }
          : { outcome: outcomeOf(totals), summary: versusSummary(names, totals), account: versusAccount(names, all, balls) }
      )
    }
    if (play.stepped && !play.playByPlay) setTimeout(result, STEPPED_END_MS)
    else result()
  }
  const landNow = useRef(land)
  landNow.current = land

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (girls.length === 0) return
    const totals = totalsOf(rolls, girls.length)
    play.situation(
      [
        `The game is Skee-Ball, ${balls} balls each, one ball each in turn, the reader first.`,
        `The score is the reader ${totals[0]}, ${names.map((name, seat) => `${name} ${totals[seat + 1]}`).join(', ')}.`,
        table.over
          ? 'The last ball has just been rolled.'
          : `It is ball ${table.ball + 1} of ${balls} and ${her ? `${her.name}'s` : "the reader's"} roll.`,
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  }, [rolls])

  // A girl's ball, after a beat: rolled at her own skill, for what the score asks of her.
  useEffect(() => {
    if (!her || rolling || speaking || away) return
    // Read at his own pace, the ball before hers has to have been read past first: the board never runs ahead.
    if (play.stepped && reached < rolls.length) return
    const afterReader = rolls.length > 0 && rolls[rolls.length - 1].who === 0
    const pause = !several ? HER_PAUSE_MS : afterReader ? BRISK.afterReaderMs : BRISK.betweenMs
    // The beat runs from the ball before hers, so time spent on a remark is not waited out twice.
    // Stepping past the line for the ball before is the reader's time to take it in; with the balls
    // kept off the box there is no such line, and the beat is the same as at the box's own pace.
    const left =
      play.stepped && play.playByPlay
        ? STEPPED_BEAT_MS
        : Math.max(300, pause - (performance.now() - landedAt.current))
    const who = table.who
    const timer = setTimeout(
      () => launch({ who, ...herRoll(her.skill, needOf(rolls, who, balls, girls.length)) }),
      left
    )
    return () => clearTimeout(timer)
    // A girl's turn comes round once per ball landed, which the count alone says.
  }, [her === undefined, rolls.length, rolling === null, speaking, away, reached])

  // The sweep under the reader's hand: the ball across the lane, then the spot up the board.
  useEffect(() => {
    if (waiting || away) return
    // Each sweep begins somewhere of its own, and begins again when the reader looks back.
    sweepClock.current = sweepFrom(STAGES[stage].sweepMs)
    let last = performance.now()
    let frame = 0
    const tick = (now: number): void => {
      sweepClock.current += Math.min(FRAME_CAP_MS, Math.max(0, now - last))
      last = now
      const at = sweepAt(sweepClock.current, STAGES[stage].sweepMs)
      swept.current = at
      if (stage === 0) {
        const x = String(aimX(at * 2 - 1))
        ballMark.current?.setAttribute('cx', x)
        lineMark.current?.setAttribute('x1', x)
        lineMark.current?.setAttribute('x2', x)
      } else {
        spotMark.current?.setAttribute('cx', String(aimX(aim.current)))
        spotMark.current?.setAttribute('cy', String(Math.min(LIP_Y + 2.4, Math.max(0.4, boardY(powerY(at))))))
        if (meterMark.current) meterMark.current.style.bottom = `${at * 100}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [waiting, stage, away])

  // The ball in the hand between rolls and while the reader looks away, and the meter at rest.
  useEffect(() => {
    if (rolling) return
    // A line already set is kept: only the sweep still running begins again.
    const x = String(stage === 1 ? aimX(aim.current) : 0)
    const ball = ballMark.current
    if (ball) {
      ball.setAttribute('cx', x)
      ball.setAttribute('cy', String(START_Y))
      ball.setAttribute('r', String(BALL_R))
      ball.style.opacity = '1'
    }
    lineMark.current?.setAttribute('x1', x)
    lineMark.current?.setAttribute('x2', x)
    if (meterMark.current) meterMark.current.style.bottom = '0%'
  }, [rolling === null, rolls.length, away])

  // The ball on its way: up the ramp on its line, the hop, down where it dropped, and the count.
  const roll = rolling?.roll
  useEffect(() => {
    if (!roll || away) return
    // A reader who asked for less motion is shown where the ball went, not the trip.
    const pace = several && roll.who > 0 ? BRISK.run : 1
    const rampMs = still ? 1 : TRIP.rampMs * pace
    const hopMs = still ? 1 : TRIP.hopMs * pace
    const dropMs = still ? 1 : TRIP.dropMs * pace
    const settleMs = TRIP.settleMs * pace
    const from = { x: aimX(roll.aim), y: START_Y }
    const spot = { x: roll.x, y: boardY(roll.y) }
    // A ball too soft to reach the lip stops where it stops, with no hop to make.
    const short = roll.kind === 'short'
    const lip = short ? spot : { x: from.x + (spot.x - from.x) * 0.7, y: LIP_Y }
    const down = wayDown(roll)
    const sunk = roll.ring !== null && roll.kind !== 'rim-out'
    let last = performance.now()
    let frame = 0
    let marked = false
    const tick = (now: number): void => {
      tripClock.current += Math.min(FRAME_CAP_MS, Math.max(0, now - last))
      last = now
      const t = tripClock.current
      const up = Math.min(1, t / rampMs)
      const hop = Math.min(1, Math.max(0, (t - rampMs) / hopMs))
      const drop = Math.min(1, Math.max(0, (t - rampMs - hopMs) / dropMs))
      let at: Point
      if (up < 1) at = between(from, lip, 1 - (1 - up) * (1 - up))
      else if (hop < 1) at = between(lip, spot, hop)
      else if (down.by) at = drop < 0.4 ? between(spot, down.by, drop / 0.4) : between(down.by, down.rest, (drop - 0.4) / 0.6)
      else at = between(spot, down.rest, drop)
      // Seen from above, the height of the hop is the ball drawn larger; a ball in a ring sits low in it.
      const size = up < 1 || short ? 1 : hop < 1 ? 1 + 0.45 * Math.sin(Math.PI * hop) : 1 - (sunk ? 0.35 : 0.15) * drop
      const ball = ballMark.current
      if (ball) {
        ball.setAttribute('cx', String(at.x))
        ball.setAttribute('cy', String(at.y))
        ball.setAttribute('r', String(BALL_R * size))
        ball.style.opacity = String(1 - 0.45 * drop)
      }
      if (hop >= 1 && !marked) {
        marked = true
        setRolling((now) => (now && !now.down ? { ...now, down: true } : now))
      }
      if (t < rampMs + hopMs + dropMs + settleMs) {
        frame = requestAnimationFrame(tick)
        return
      }
      landNow.current(roll)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // One trip per roll, picked up where it was when the reader looks back.
  }, [roll, away])

  // Space stops as a click does, wherever the pointer is, unless the reader is typing to her. It
  // is heard on the way down, so a line waiting to be stepped past never takes the press instead:
  // the one press is his stop and him moving on.
  const onSpace = useRef<(event: KeyboardEvent) => void>(() => undefined)
  onSpace.current = (event) => {
    if (event.code !== 'Space' || event.repeat || typingIn(event)) return
    // A button under focus answers Space itself.
    if (event.target instanceof Element && event.target.closest('button, a')) return
    event.preventDefault()
    if (waiting || paused()) return
    play.moved()
    stop()
  }
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => onSpace.current(event)
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  const totals = totalsOf(rolls, girls.length)
  const players = ['You', ...names]
  // Looking elsewhere with a stop to make, the sweep is put away until he is back.
  const hidden = away && !waiting
  // Her ball waits on a line the reader has yet to move past, where he steps through them himself.
  const held = her !== undefined && play.stepped && reached < rolls.length
  // How it came out, where the box says it only with the play-by-play on.
  const best = Math.max(...totals)
  const top = players.filter((_, who) => totals[who] === best)
  const ending = !table.over
    ? ''
    : girls.length === 0
      ? `${totals[0]} points`
      : outcomeOf(totals) === 'won'
        ? `You win, with ${best}`
        : top.length === 1
          ? `${top[0]} wins, with ${best}`
          : top.includes('You')
            ? `A tie on ${best}`
            : `${listed(top)} tie on ${best}`
  const prompt = table.over
    ? 'Game over'
    : rolling
      ? '…'
      : her
        ? held
          ? `${her.name} is up: Continue to go on`
          : `${her.name} is up`
        : hidden
          ? 'Paused'
          : STAGES[stage].label
  const shown = rolling?.down ? rolling.roll : null
  // What the power meter's marks stand beside: each ring's height up the board.
  const marks = [20, 30, 40, 50, 100].map((value) => {
    const ring = RINGS.find((each) => each.value === value)
    return { value, at: ring ? (ring.y - POWER_FROM) / POWER_SPAN : 0 }
  })

  return (
    <div className="vu-skeeball">
      <svg
        className="vu-skeeball-alley"
        viewBox={`${-VIEW.half} 0 ${VIEW.half * 2} ${VIEW.height}`}
        role="img"
        aria-label="The alley: rings worth 20 to 50 up the middle of the board, a 100 pocket in each top corner"
        onClick={stop}
      >
        <rect className="vu-skeeball-cabinet" x={-VIEW.half} y="0" width={VIEW.half * 2} height={VIEW.height} rx="2.2" />
        <rect className="vu-skeeball-ramp" x={-BOARD.half} y={LIP_Y} width={BOARD.half * 2} height={VIEW.height - LIP_Y - 1} />
        <rect className="vu-skeeball-board" x={-BOARD.half} y="1" width={BOARD.half * 2} height={BOARD.depth} rx="1.2" />
        <rect className="vu-skeeball-gutter" x={-BOARD.half + 1} y={GUTTER_Y - 0.9} width={BOARD.half * 2 - 2} height="1.8" rx="0.9" />
        <text className="vu-skeeball-value" x={BOARD.half - 2.6} y={GUTTER_Y - 1.5}>
          10
        </text>
        <line className="vu-skeeball-lip" x1={-BOARD.half} x2={BOARD.half} y1={LIP_Y} y2={LIP_Y} />
        {RINGS.map((ring) => (
          <g key={`${ring.value}${ring.x}`} className="vu-skeeball-ring" data-corner={ring.value === 100 || undefined}>
            <circle cx={ring.x} cy={boardY(ring.y)} r={ring.r} />
            <text
              className="vu-skeeball-value"
              x={ring.x}
              y={ring.value === 100 ? boardY(ring.y) + ring.r + 2 : boardY(ring.y) + 0.7}
            >
              {ring.value}
            </text>
          </g>
        ))}
        {/* The reader's marks: his line up the alley, then a spot running up and down it. */}
        <line
          ref={lineMark}
          className="vu-skeeball-line"
          data-live={(!waiting && !hidden) || undefined}
          x1="0"
          x2="0"
          y1="1"
          y2={START_Y}
        />
        <circle
          ref={spotMark}
          className="vu-skeeball-spot"
          data-live={(!waiting && !hidden && stage === 1) || undefined}
          cx="0"
          cy={LIP_Y}
          r="1"
        />
        <circle ref={ballMark} className="vu-skeeball-ball" cx="0" cy={START_Y} r={BALL_R} />
        {hidden && (
          <text className="vu-skeeball-paused" x="0" y={LIP_Y + 7}>
            Paused
          </text>
        )}
        {shown && (
          <text
            className="vu-skeeball-pop"
            data-still={still || undefined}
            x={Math.max(-BOARD.half + 3, Math.min(BOARD.half - 3, shown.x))}
            y={Math.max(4, boardY(Math.max(0, shown.y)) - 2.6)}
          >
            {shown.score}
          </text>
        )}
      </svg>

      {/* The power meter stands beside the alley, the height of each ring marked on it. */}
      <div
        className="vu-skeeball-meter"
        data-live={(!waiting && !hidden && stage === 1) || undefined}
        data-waiting={waiting || hidden || undefined}
        onClick={stop}
      >
        <span className="vu-skeeball-meterlabel">power</span>
        <span className="vu-skeeball-track">
          {marks.map((mark) => (
            <span key={mark.value} className="vu-skeeball-tick" style={{ bottom: `${mark.at * 100}%` }}>
              {mark.value}
            </span>
          ))}
          <span ref={meterMark} className="vu-skeeball-mark" />
        </span>
      </div>

      <div className="vu-skeeball-side">
        <table className="vu-skeeball-sheet" data-tight={balls > 6 || undefined}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: balls }, (_, ball) => (
                <th key={ball} scope="col">
                  {ball + 1}
                </th>
              ))}
              <th scope="col">total</th>
            </tr>
          </thead>
          <tbody>
            {players.map((name, who) => {
              const scores = scoresOf(rolls, who)
              const up = !table.over && table.who === who
              return (
                <tr key={who} data-up={up || undefined}>
                  <th scope="row" title={name}>
                    {up ? '▸ ' : ''}
                    {name}
                  </th>
                  {Array.from({ length: balls }, (_, ball) => (
                    <td
                      key={ball}
                      data-now={(up && table.ball === ball) || undefined}
                      data-top={scores[ball] === 100 || undefined}
                    >
                      {scores[ball] ?? '·'}
                    </td>
                  ))}
                  <td className="vu-skeeball-total">{totals[who]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div
          className="vu-skeeball-roll"
          inert={waiting || undefined}
          data-waiting={waiting || undefined}
          data-over={table.over || undefined}
        >
          <motion.button
            type="button"
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
            {...gestures(waiting, lift, press)}
            onClick={(event) => {
              // Pressed by key, it is the reader moving on, as a press on the table is.
              if (event.detail === 0 && !waiting && !paused()) play.moved()
              stop()
            }}
            // Enter held on the button is one press, as Space is.
            onKeyDown={(event) => {
              if (event.repeat) event.preventDefault()
            }}
          >
            {prompt}
          </motion.button>
          <span className="vu-skeeball-hint" role={table.over ? 'status' : undefined}>
            {table.over ? ending : 'click or Space, twice: your line, then your power'}
          </span>
        </div>
      </div>
    </div>
  )
}
