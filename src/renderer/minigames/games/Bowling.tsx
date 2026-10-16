import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  DRIFT,
  LANE_HALF,
  PINS,
  START_REACH,
  ballTold,
  ballX,
  herThrow,
  lastFrameCue,
  outcomeOf,
  pathOf,
  resolvePins,
  rollsOf,
  sheetOf,
  soloAccount,
  soloSummary,
  tableOf,
  totalsOf,
  versusAccount,
  versusSummary,
  type Ball,
  type BallTold,
  type Throw
} from '@shared/minigameRules/bowling'
import { listed } from '@shared/minigameKit'
import { gestures, lift, press } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/Bowling.css'

/** How many times in a game anything is said about a ball, by how talkative the girls are to be: the whole table's, however many of them are bowling. */
const REMARKS = { quiet: 0, some: 3, lots: 8 } as const

/** How long she takes over a ball: long enough for the reader's own to be read first. */
const HER_PAUSE_MS = 1700
/** How long the pins stand as they fell before the rack is reset. */
const SETTLE_MS = 800
/**
 * The same with more than one girl bowling, so a frame's worth of their balls is not a long
 * wait: a shorter beat after the reader's ball and a shorter one still between their own, a
 * quicker trip down the lane and less time over the fallen pins.
 */
const BRISK = { afterReaderMs: 1200, betweenMs: 700, run: 0.7, settleMs: 500 } as const
/** The longest a girl's ball waits on a remark being written: her line may come over the next throw. */
const SAY_CAP_MS = 2500
/** Two stops closer together than this are one press, heard twice. */
const PRESS_GAP_MS = 180
/**
 * How long the result stands told on the lane before it is handed over, read at the reader's own
 * pace with the balls kept off the box: nothing there is left for him to step past, so the table
 * would otherwise clear at once.
 */
const END_HOLD_MS = 2200

/** The three things a throw is made of, in the order they are stopped, and each one's sweep. */
const STAGES = [
  { label: 'Set your spot', sweepMs: 1500 },
  { label: 'Set the power', sweepMs: 1000 },
  { label: 'Set the hook', sweepMs: 1100 }
] as const

/** The lane as it is drawn, in inches across and a shortened run to the pins. */
const VIEW = { half: LANE_HALF + 5.5, height: 140 }
const HEAD_Y = 40
const ROW_Y = 10.4
const START_Y = 131
const pinY = (row: number): number => HEAD_Y - row * ROW_Y

/** A sweep back and forth between 0 and 1, from the time since it began. */
function sweep(elapsed: number, period: number): number {
  const turn = (elapsed / period) % 2
  return turn <= 1 ? turn : 2 - turn
}

/** A ball on its way: whose, how it was thrown, and what it takes when it gets there. */
interface Rolling extends Ball {
  /** It has reached the pins. */
  hit: boolean
}

/**
 * Bowling: a lane from above, the pins at the far end. A throw is three stops, each a click or
 * Space: where the ball is set down, how hard, and how much hook; then it rolls and the rules
 * say what falls. Alone the reader bowls every frame; with girls everyone bowls each frame in
 * turn, the reader first, and each girl's throws are the rules' own at her skill. The surface
 * shows the lane and the sheet, and under the button the last ball in a line, which stays until
 * the next, and at the end the result; the dialogue box tells it too only where play-by-play is on.
 */
export function Bowling({ play }: { play: GamePlay }): JSX.Element {
  const [balls, setBalls] = useState<Ball[]>([])
  const [rolling, setRolling] = useState<Rolling | null>(null)
  // Which of the three stops is next.
  const [stage, setStage] = useState(0)
  // One of them is saying something about the last ball: the next girl's ball waits for it.
  const [speaking, setSpeaking] = useState(false)
  // The last ball as it is told, or the result once the game is over, shown under the button.
  const [lastTold, setLastTold] = useState<string | null>(null)
  const remarks = useRef(0)
  // Remarks asked for and not yet on the box, and the cap on the wait for the last of them.
  const saying = useRef(0)
  const sayCap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // When the last ball was counted, for the beat before a girl's.
  const landedAt = useRef(0)
  // The terms are said once and the result handed over once, whatever is run twice.
  const opened = useRef(false)
  const finished = useRef(false)
  // How many remarks each girl has made, in her seat's order.
  const spoken = useRef<number[]>([])
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const several = girls.length > 1
  const frames = play.options.frames ?? 5

  const table = tableOf(balls, frames, girls.length)
  // The girl whose ball is next, if it is one of theirs.
  const her = table.over || table.who === 0 ? undefined : girls[table.who - 1]
  const herTurn = her !== undefined
  const waiting = table.over || herTurn || rolling !== null

  // What the sweeps write to, between renders.
  const ballMark = useRef<SVGCircleElement>(null)
  const powerMark = useRef<HTMLSpanElement>(null)
  const hookMark = useRef<HTMLSpanElement>(null)
  // The stop under the hand, and the ones already made for this throw.
  const swept = useRef(0)
  const aim = useRef<Throw>({ position: 0, power: 0.7, hook: 0 })
  const pressedAt = useRef(0)
  // Nothing is set once the table has been taken down.
  const live = useRef(true)
  useEffect(() => {
    live.current = true
    return () => {
      live.current = false
      clearTimeout(sayCap.current)
    }
  }, [])

  // With company the game is on from the moment a ball is picked up, and the terms are said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (several) play.narrate(`${listed(names)} pick out a ball each and wave you up first. ${frames} frames each, everyone bowling in turn.`)
    else if (girls[0]) play.narrate(`${girls[0].name} picks out a ball and waves you up first. ${frames} frames each, taking turns.`)
    // Once, as the table opens.
  }, [])

  /** Sends a ball down the lane: what it takes is settled now and shown when it gets there. */
  function bowl(thrown: Throw, who: number): void {
    const path = pathOf(thrown)
    const fallen = path.gutter
      ? []
      : resolvePins(path.arriveX, path.angle, thrown.power, table.standing)
    setRolling({ who, thrown, before: table.standing, fallen, hit: false })
  }

  /** The reader stops whatever is sweeping; the third stop is the throw. Says whether it was one. */
  function stop(): boolean {
    if (waiting) return false
    const now = performance.now()
    if (now - pressedAt.current < PRESS_GAP_MS) return false
    pressedAt.current = now
    if (balls.length === 0 && stage === 0) play.started()
    if (stage === 0) aim.current.position = swept.current * 2 - 1
    else if (stage === 1) aim.current.power = swept.current
    else {
      bowl({ ...aim.current, hook: swept.current * 2 - 1 }, 0)
      return true
    }
    setStage(stage + 1)
    return true
  }

  /** The ball has stopped and the pins are counted: onto the sheet, into the scene, and on. */
  function land(ball: Ball): void {
    if (!live.current || finished.current) return
    landedAt.current = performance.now()
    const all = [...balls, ball]
    const told = ballTold(names, all, all.length - 1, frames)
    setBalls(all)
    setRolling(null)
    setStage(0)
    setLastTold(told.narration)
    play.narrate(told.narration)
    if (!tableOf(all, frames, girls.length).over) {
      remark(all, told)
      return
    }

    finished.current = true
    const totals = totalsOf(all, frames, girls.length)
    const result =
      girls.length === 0
        ? { outcome: 'played' as const, summary: soloSummary(all, frames), account: soloAccount(all, frames) }
        : { outcome: outcomeOf(totals), summary: versusSummary(names, totals), account: versusAccount(names, all, frames) }
    // The last ball is on the sheet; what the game came to is said under it.
    setLastTold(result.summary)
    if (!play.stepped || play.playByPlay) {
      play.finish(result)
      return
    }
    setTimeout(() => {
      if (live.current) play.finish(result)
    }, END_HOLD_MS)
  }

  /**
   * Which girl has something to say about a ball: whoever bowled it, if one of them did; of the
   * reader's, the girl who has said least so far, and among those the one nearest him in score.
   */
  function speakerFor(all: readonly Ball[]): number {
    const bowler = all[all.length - 1].who
    if (bowler > 0) return bowler - 1
    const totals = totalsOf(all, frames, girls.length)
    const said = (seat: number): number => spoken.current[seat] ?? 0
    const apart = (seat: number): number => Math.abs(totals[seat + 1] - totals[0])
    return girls
      .map((_, seat) => seat)
      .sort((a, b) => said(a) - said(b) || apart(a) - apart(b) || a - b)[0]
  }

  /**
   * Has one girl say something about the ball just thrown, where it is worth it: a strike, a
   * gutter ball, a split picked up, a turkey, or the last frame coming with the game still open.
   * A few times a game at most between all of them, one voice a ball, and never on the last
   * ball, which the scene's own reply answers. Nobody starts on a ball while the last remark
   * is still being written, and the game waits on one only so long.
   */
  function remark(all: readonly Ball[], told: BallTold): void {
    if (girls.length === 0 || remarks.current >= REMARKS[play.chattiness]) return
    if (saying.current > 0) return
    const decider = lastFrameCue(names, all, frames)
    // Talkative, they have a word for an ordinary frame too.
    if (!told.notable && !decider && !(play.chattiness === 'lots' && told.closed)) return
    const seat = speakerFor(all)
    remarks.current++
    spoken.current[seat] = (spoken.current[seat] ?? 0) + 1
    saying.current++
    setSpeaking(true)
    const heard = (): void => {
      clearTimeout(sayCap.current)
      if (live.current) setSpeaking(false)
    }
    clearTimeout(sayCap.current)
    sayCap.current = setTimeout(heard, SAY_CAP_MS)
    void play
      .say(girls[seat].charId, decider ? `${told.cue} ${decider}` : told.cue)
      .catch(() => undefined)
      .finally(() => {
        saying.current--
        heard()
      })
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (girls.length === 0) return
    const totals = totalsOf(balls, frames, girls.length)
    play.situation(
      [
        `The game is ten-pin bowling, ${frames} frames each, ${several ? 'everyone bowling each frame in turn, the reader first' : 'taking alternate frames'}.`,
        `The score is the reader ${totals[0]}, ${names.map((name, seat) => `${name} ${totals[seat + 1]}`).join(', ')}.`,
        table.over
          ? 'The last ball has just been bowled.'
          : `It is frame ${table.frame + 1} of ${frames} and ${her ? `${her.name}'s` : "the reader's"} ball, with ${table.standing.length === 10 ? 'all ten pins' : `${table.standing.length} pin${table.standing.length === 1 ? '' : 's'}`} standing.`,
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  }, [balls])

  // A girl's ball, after a beat: thrown at what is standing, at her own skill. Read at the
  // reader's own pace she bowls once he has moved past everything said of the ball before; with
  // the balls kept off the box that may be at once, so the beat is still given, for the last
  // ball to be seen on the lane and the sheet.
  useEffect(() => {
    if (!her || rolling || speaking) return
    const afterReader = balls.length > 0 && balls[balls.length - 1].who === 0
    const pause = !several ? HER_PAUSE_MS : afterReader ? BRISK.afterReaderMs : BRISK.betweenMs
    // The beat runs from the ball before hers, so time spent on a remark is not waited out twice.
    const beat = (): number => Math.max(300, pause - (performance.now() - landedAt.current))
    if (play.stepped) {
      let mine = true
      void play
        .read()
        .catch(() => undefined)
        .then(() => (play.playByPlay ? undefined : new Promise((resolve) => setTimeout(resolve, beat()))))
        .then(() => {
          if (mine && live.current && !finished.current) bowl(herThrow(table.standing, her.skill), table.who)
        })
      return () => {
        mine = false
      }
    }
    const timer = setTimeout(() => bowl(herThrow(table.standing, her.skill), table.who), beat())
    return () => clearTimeout(timer)
    // A girl's turn comes round once per ball landed, which the count alone says.
  }, [herTurn, balls.length, rolling === null, speaking])

  // The sweep under the reader's hand: the ball along the foul line, then the two meters.
  useEffect(() => {
    if (waiting) return
    const began = performance.now()
    let frame = 0
    const tick = (now: number): void => {
      const at = sweep(now - began, STAGES[stage].sweepMs)
      swept.current = at
      if (stage === 0) {
        ballMark.current?.setAttribute('cx', String((at * 2 - 1) * START_REACH))
        ballMark.current?.setAttribute('cy', String(START_Y))
      } else {
        const mark = stage === 1 ? powerMark.current : hookMark.current
        if (mark) mark.style.left = `${at * 100}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [waiting, stage])

  // A new throw starts with both meters at rest.
  useEffect(() => {
    if (stage !== 0) return
    if (powerMark.current) powerMark.current.style.left = '0%'
    if (hookMark.current) hookMark.current.style.left = '50%'
  }, [stage, balls.length])

  // The ball on its way: down the lane on its line, through the rack, and then the count.
  const thrown = rolling?.thrown
  useEffect(() => {
    if (!rolling || !thrown) return
    const path = pathOf(thrown)
    // A reader who asked for less motion is shown where the ball went, not the trip.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // With several girls bowling, theirs are shown at a brisker pace than the reader's own.
    const brisk = several && rolling.who > 0
    const runMs = still ? 1 : (1700 - 900 * thrown.power) * (brisk ? BRISK.run : 1)
    const deckMs = still ? 1 : runMs * 0.32
    const began = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = (now: number): void => {
      const along = (now - began) / runMs
      const past = Math.min(1, Math.max(0, (now - began - runMs) / deckMs))
      const gutter = Math.sign(path.arriveX) * (LANE_HALF + 2.6)
      const x =
        along < 1
          ? ballX(thrown, along)
          : path.gutter
            ? gutter
            : Math.max(-LANE_HALF, Math.min(LANE_HALF, path.arriveX + path.angle * DRIFT * past * 3.6))
      const y = along < 1 ? START_Y + (HEAD_Y - START_Y) * along : HEAD_Y - past * (HEAD_Y + 6)
      ballMark.current?.setAttribute('cx', String(x))
      ballMark.current?.setAttribute('cy', String(y))
      if (along >= 1 && !rolling.hit) setRolling((now) => (now && !now.hit ? { ...now, hit: true } : now))
      if (past < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      const { who, before, fallen } = rolling
      timer = setTimeout(() => land({ who, thrown, before, fallen }), brisk ? BRISK.settleMs : SETTLE_MS)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
    // One trip per throw; the pins falling partway is this effect's own doing.
  }, [thrown])

  // The ball back in the hand between throws.
  useEffect(() => {
    if (rolling) return
    ballMark.current?.setAttribute('cx', '0')
    ballMark.current?.setAttribute('cy', String(START_Y))
  }, [rolling === null, balls.length])

  // Space stops as a click does, wherever the pointer is, unless the reader is typing to her.
  const stopNow = useRef(stop)
  stopNow.current = stop
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      // A button under focus answers Space itself.
      if (target && (['TEXTAREA', 'INPUT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) return
      // The table's own listener, heard first, has already taken this press as him moving on.
      const stepped = event.defaultPrevented
      event.preventDefault()
      if (!stopNow.current()) return
      // A stop by key is him moving on, and the one step this press is worth.
      event.stopImmediatePropagation()
      if (!stepped) play.moved()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // The rack as it is shown: mid-throw the one thrown at, with what fell lying where it stood.
  const standing = rolling ? rolling.before : table.over ? [] : table.standing
  const down = rolling?.hit ? rolling.fallen : []
  const bowlers = ['You', ...names]
  const prompt = table.over
    ? 'Game over'
    : rolling
      ? '…'
      : herTurn
        ? `${her.name} is up`
        : STAGES[stage].label

  return (
    <div className="vu-bowling">
      <svg
        className="vu-bowling-lane"
        viewBox={`${-VIEW.half} 0 ${VIEW.half * 2} ${VIEW.height}`}
        role="img"
        aria-label={`The lane, ${standing.length - down.length} pins standing`}
        onClick={() => void stop()}
      >
        <rect className="vu-bowling-gutter" x={-VIEW.half} y="0" width={VIEW.half * 2} height={VIEW.height} rx="3" />
        <rect className="vu-bowling-boards" x={-LANE_HALF} y="0" width={LANE_HALF * 2} height={VIEW.height} />
        <line className="vu-bowling-foul" x1={-LANE_HALF} x2={LANE_HALF} y1={START_Y - 6} y2={START_Y - 6} />
        {[-10, -5, 0, 5, 10].map((x) => (
          <path
            key={x}
            className="vu-bowling-arrow"
            d={`M ${x - 1.2} ${96 + Math.abs(x) * 0.6} l 1.2 -4 l 1.2 4 z`}
          />
        ))}
        {PINS.filter((pin) => standing.includes(pin.id)).map((pin) => (
          <circle
            key={pin.id}
            className={`vu-bowling-pin${down.includes(pin.id) ? ' vu-bowling-pin--down' : ''}`}
            cx={pin.x}
            cy={pinY(pin.row)}
            r="2.4"
          />
        ))}
        <circle ref={ballMark} className="vu-bowling-ball" cx="0" cy={START_Y} r="4.25" />
      </svg>

      <div className="vu-bowling-side">
        <table className="vu-bowling-sheet" data-tight={bowlers.length > 2 || undefined}>
          <thead>
            <tr>
              <th />
              {Array.from({ length: frames }, (_, frame) => (
                <th key={frame} scope="col">
                  {frame + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bowlers.map((name, who) => (
              <tr key={who} data-up={(!table.over && table.who === who) || undefined}>
                <th scope="row" title={name}>
                  {name}
                </th>
                {sheetOf(rollsOf(balls, who), frames).map((frame, i) => (
                  <td
                    key={i}
                    data-now={(!table.over && table.who === who && table.frame === i) || undefined}
                  >
                    <span className="vu-bowling-marks">{frame.marks.join(' ') || ' '}</span>
                    <span className="vu-bowling-total">{frame.total ?? ' '}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {/* The meters keep their place when no throw is being made, so the surface does not jump. */}
        <div className="vu-bowling-meters" data-waiting={waiting || undefined}>
          <div className="vu-bowling-meter" data-live={(!waiting && stage === 1) || undefined}>
            <span className="vu-bowling-meterlabel">power</span>
            <span className="vu-bowling-track">
              <span className="vu-bowling-sweet" />
              <span ref={powerMark} className="vu-bowling-mark" />
            </span>
          </div>
          <div className="vu-bowling-meter" data-live={(!waiting && stage === 2) || undefined}>
            <span className="vu-bowling-meterlabel">hook</span>
            <span className="vu-bowling-track">
              <span className="vu-bowling-centre" />
              <span ref={hookMark} className="vu-bowling-mark" />
            </span>
          </div>
        </div>

        <div className="vu-bowling-throw" inert={waiting || undefined} data-waiting={waiting || undefined}>
          <motion.button
            type="button"
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
            {...gestures(waiting, lift, press)}
            // Pressed by key there was no press on the surface to say he has moved on.
            onClick={(event) => {
              if (stop() && event.detail === 0) play.moved()
            }}
            // Enter held on the button is one press, as Space is.
            onKeyDown={(event) => {
              if (event.repeat) event.preventDefault()
            }}
          >
            {prompt}
          </motion.button>
          {/* The last ball told, in the hint's place, once there is one. */}
          <span className="vu-bowling-hint" data-told={lastTold !== null || undefined} aria-live="polite">
            {lastTold ?? 'click or Space, three times: spot, power, hook'}
          </span>
        </div>
      </div>
    </div>
  )
}
