import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  AIM_REACH,
  DEPTH,
  HALF_WIDTH,
  NEAR,
  RIM,
  accountOf,
  canRerack,
  cupsFor,
  drinkState,
  dropped,
  herRerack,
  herThrow,
  newGame,
  outcomeOf,
  readerThrow,
  rerack,
  shotTold,
  sidesTold,
  standingTold,
  summaryOf,
  sweepSpeed,
  sweepWobble,
  teamName,
  throwBall,
  throwerOf,
  tipsyOf,
  type Game,
  type Shot,
  type Throw
} from '@shared/minigameRules/beerPong'
import { listed } from '@shared/minigameKit'
import { gestures, lift, press } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/BeerPong.css'

/** How many times in a game any of them says something for herself: the whole table's. */
const REMARKS = { quiet: 0, some: 4, lots: 9 } as const

/** How long she takes over a throw: long enough for the last one to be read first. */
const HER_PAUSE_MS = 1500
/** The same with several girls playing, so a round of throws is not a long wait. */
const BRISK = { afterReaderMs: 1100, betweenMs: 650, flight: 0.75 } as const
/** A ball's flight, the bounce at the end of it, and how long it lies where it stopped. */
const FLIGHT_MS = 720
const BOUNCE_MS = 260
const SETTLE_MS = 380
/** The longest a girl's throw waits on a remark being written. */
const SAY_CAP_MS = 2500
/** Two stops closer together than this are one press, heard twice. */
const PRESS_GAP_MS = 180
/**
 * How long the last throw stands told on the table before the result is handed over, read at
 * the reader's own pace with the throws kept off the box: nothing there is left for him to step
 * past, so the table would otherwise clear at once.
 */
const END_HOLD_MS = 2200

/** The two things a throw is made of, in the order they are stopped, and each one's sweep. */
const STAGES = [
  { label: 'Set your aim', sweepMs: 1200 },
  { label: 'Set the arc', sweepMs: 1100 }
] as const

/** The table as it is drawn, from above, in cup widths: the reader's end at the bottom. */
const LENGTH = 14
const VIEW = { left: -HALF_WIDTH - 0.6, top: -0.9, width: HALF_WIDTH * 2 + 1.2, height: LENGTH + 1.8 }
/** Where each side's front cup stands along the table: the reader's side's, then the other's. */
const FRONT = [9.8, 4.2] as const
const CUP_R = 0.47
const BALL_R = 0.19

/** A point of a side's rack, or of a throw at it, on the drawn table. */
function onTable(side: 0 | 1, x: number, y: number): { x: number; y: number } {
  return side === 1 ? { x, y: FRONT[1] - y } : { x: -x, y: FRONT[0] + y }
}

/** A sweep back and forth between 0 and 1, from the time since it began. */
function sweep(elapsed: number, period: number): number {
  const turn = (elapsed / period) % 2
  return turn <= 1 ? turn : 2 - turn
}

/** A ball in the air: the throw, and the game as it will stand once it has landed. */
interface Flight {
  shot: Shot
  next: Game
  /** It has come down: a cup it took is shown going. */
  down: boolean
}

/**
 * Beer Pong: the table from above, a rack of cups at each end. A throw is two stops, each a
 * click or Space: a marker sweeping across the cups, then one sweeping up the table for the
 * arc; then the ball flies and the rules say where it ends. The girls' throws are the rules' own
 * at their skill. The reader's ball strays a little from his stops, as a hand does, and every cup
 * his side drinks makes his sweeps quicker and his hand less steady. The surface shows the
 * table, the sides and the drink, and under the buttons the last throw or re-rack in a line,
 * which stays until the next; the dialogue box tells it too only where play-by-play is on.
 */
export function BeerPong({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const several = girls.length > 1
  const [game, setGame] = useState<Game>(() => newGame(girls.length, cupsFor(play.options.cups ?? 1)))
  const [flight, setFlight] = useState<Flight | null>(null)
  // Which of the two stops is next.
  const [stage, setStage] = useState(0)
  // One of them is saying something: the next girl's throw waits for it.
  const [speaking, setSpeaking] = useState(false)
  // The last throw or re-rack, as it is told, shown under the buttons until the next.
  const [lastTold, setLastTold] = useState<string | null>(null)
  const remarks = useRef(0)
  const saying = useRef(0)
  const sayCap = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // How many remarks each girl has made, in her seat's order.
  const spoken = useRef<number[]>([])
  // When the last throw was counted, for the beat before a girl's.
  const landedAt = useRef(0)
  // The terms are said once and the result handed over once, whatever is run twice.
  const opened = useRef(false)
  const finished = useRef(false)

  const over = game.winner !== null
  const who = throwerOf(game)
  const her = over || who === 0 ? undefined : girls[who - 1]
  const waiting = over || her !== undefined || flight !== null
  const tipsy = tipsyOf(game, 0)

  // What the sweeps and the flight write to, between renders.
  const aimMark = useRef<SVGLineElement>(null)
  const arcMark = useRef<SVGCircleElement>(null)
  const meterMark = useRef<HTMLSpanElement>(null)
  const ballMark = useRef<SVGCircleElement>(null)
  const swept = useRef(0)
  const aim = useRef(0)
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

  // The game is on as the table opens, and the sides are said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    play.narrate(
      `${listed(names)} ${several ? 'rack' : 'racks'} the cups, ${game.racked} a side: ${sidesTold(names, game)}. Two throws a turn, and you are up first.`
    )
    // Once, as the table opens.
  }, [])

  /** Sends a ball up: where it ends is settled now and shown when it gets there. */
  function launch(thrown: Throw): void {
    const next = throwBall(game, thrown)
    setFlight({ shot: next.log[next.log.length - 1], next, down: false })
  }

  /**
   * The reader stops whatever is sweeping; the second stop is the throw. A stop made by key is
   * him moving on from the line on the box, as a press on the table already is.
   */
  function stop(byKey = false): void {
    if (waiting) return
    const now = performance.now()
    if (now - pressedAt.current < PRESS_GAP_MS) return
    pressedAt.current = now
    if (byKey) play.moved()
    if (stage === 0) {
      aim.current = swept.current * 2 - 1
      setStage(1)
      return
    }
    launch(readerThrow({ aim: aim.current, power: swept.current }, tipsy))
  }

  /** The reader has the cups he is throwing at pulled together, once. */
  function askRerack(byKey = false): void {
    if (waiting || !canRerack(game, 0)) return
    if (byKey) play.moved()
    const left = game.sides[1].cups.length
    setGame(rerack(game, 0))
    setStage(0)
    const line = `You call your re-rack: the ${left} cups left are pulled in tight.`
    setLastTold(line)
    play.narrate(line)
    remark(lastSaid(), `The reader used his side's one re-rack: the ${left} cups he is throwing at were pulled in tight.`)
  }

  /** The girl who has said least so far, the first of them. */
  function lastSaid(): number {
    return girls.map((_, seat) => seat).sort((a, b) => (spoken.current[a] ?? 0) - (spoken.current[b] ?? 0) || a - b)[0]
  }

  /**
   * Has one girl say something about what just happened. A few times a game at most between all
   * of them, one voice a moment. Nobody throws while a remark is being written, and the game
   * waits on one only so long.
   */
  function remark(seat: number, cue: string): void {
    if (!girls[seat] || remarks.current >= REMARKS[play.chattiness] || saying.current > 0) return
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
      .say(girls[seat].charId, cue)
      .catch(() => undefined)
      .finally(() => {
        saying.current--
        heard()
      })
  }

  /** The ball has stopped: the cups are counted, the throw is told, and on. */
  function land(next: Game): void {
    if (!live.current || finished.current) return
    landedAt.current = performance.now()
    const told = shotTold(names, next)
    const shot = next.log[next.log.length - 1]
    setGame(next)
    setFlight(null)
    setStage(0)
    setLastTold(told.narration)
    play.narrate(told.narration)
    if (next.winner === null) {
      // A moment worth a word; talkative, any cup that goes and any ball off the table too.
      const worth = told.moments.length > 0 || (play.chattiness === 'lots' && (told.hit || shot.kind === 'off'))
      if (worth) remark(shot.who > 0 ? shot.who - 1 : lastSaid(), told.cue)
      return
    }
    finished.current = true
    const result = { outcome: outcomeOf(next), summary: summaryOf(names, next), account: accountOf(names, next) }
    if (!play.stepped || play.playByPlay) {
      play.finish(result)
      return
    }
    setTimeout(() => {
      if (live.current) play.finish(result)
    }, END_HOLD_MS)
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    play.situation(`${standingTold(names, game)}${play.stake ? ` Riding on it: ${play.stake}` : ''}`)
  }, [game])

  // A girl's throw, after a beat: her re-rack first where the cups are scattered, then the ball.
  // Read at the reader's pace her move is made once he has moved past everything said so far,
  // the throw before it included; with the throws kept off the box that may be at once, so the
  // beat is still given, for the last throw to be seen on the table.
  useEffect(() => {
    if (!her || flight || speaking) return
    const side = game.turn
    const last = game.log[game.log.length - 1]
    const pause = !several ? HER_PAUSE_MS : !last || last.who === 0 ? BRISK.afterReaderMs : BRISK.betweenMs
    // The beat runs from the throw before hers, so time spent on a remark is not waited out twice.
    const beat = (): number => Math.max(300, pause - (performance.now() - landedAt.current))
    if (play.stepped) {
      // The reader's own side's re-rack is his to call.
      const pulls = side === 1 && herRerack(game, side)
      const cups = game.sides[0].cups.length
      let on = true
      void play
        .read()
        .catch(() => undefined)
        .then(() => (play.playByPlay ? undefined : new Promise((resolve) => setTimeout(resolve, beat()))))
        .then(() => {
          if (!on || !live.current || finished.current) return
          if (pulls) {
            landedAt.current = performance.now()
            setGame(rerack(game, side))
            const line = `${her.name} calls ${several ? 'their' : 'her'} re-rack: your ${cups} cups are pulled in tight.`
            setLastTold(line)
            play.narrate(line)
            remark(who - 1, `${her.name} used her side's one re-rack: the ${cups} cups she is throwing at were pulled in tight.`)
            return
          }
          launch(herThrow(game.sides[side === 0 ? 1 : 0].cups, her.skill, tipsyOf(game, side)))
        })
      return () => {
        on = false
      }
    }
    const timer = setTimeout(() => {
      // The reader's own side's re-rack is his to call.
      if (side === 1 && herRerack(game, side)) {
        const cups = game.sides[0].cups.length
        landedAt.current = performance.now()
        setGame(rerack(game, side))
        const line = `${her.name} calls ${several ? 'their' : 'her'} re-rack: your ${cups} cups are pulled in tight.`
        setLastTold(line)
        play.narrate(line)
        remark(who - 1, `${her.name} used her side's one re-rack: the ${cups} cups she is throwing at were pulled in tight.`)
        return
      }
      launch(herThrow(game.sides[side === 0 ? 1 : 0].cups, her.skill, tipsyOf(game, side)))
    }, beat())
    return () => clearTimeout(timer)
  }, [game, flight === null, speaking])

  // The sweep under the reader's hand: across the cups, then up the table. Drink speeds it and shakes it.
  useEffect(() => {
    if (waiting) return
    const began = performance.now()
    const period = STAGES[stage].sweepMs / sweepSpeed(tipsy)
    const wobble = sweepWobble(tipsy)
    let frame = 0
    const tick = (now: number): void => {
      const elapsed = now - began
      const at = Math.min(1, Math.max(0, sweep(elapsed, period) + wobble * Math.sin(elapsed / 83) + wobble * 0.6 * Math.sin(elapsed / 37)))
      swept.current = at
      if (stage === 0) {
        const x = String((at * 2 - 1) * AIM_REACH)
        aimMark.current?.setAttribute('x1', x)
        aimMark.current?.setAttribute('x2', x)
      } else {
        arcMark.current?.setAttribute('cx', String(aim.current * AIM_REACH))
        arcMark.current?.setAttribute('cy', String(FRONT[1] - (NEAR + at * DEPTH)))
        if (meterMark.current) meterMark.current.style.left = `${at * 100}%`
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [waiting, stage, tipsy])

  // A new throw starts with the meter at rest.
  useEffect(() => {
    if (stage === 0 && meterMark.current) meterMark.current.style.left = '0%'
  }, [stage, game])

  // The ball on its way: up in an arc, down at its spot, off a rim or into a cup, and then the count.
  const shot = flight?.shot
  useEffect(() => {
    if (!flight || !shot) return
    const target: 0 | 1 = shot.side === 0 ? 1 : 0
    const from = { x: 0, y: shot.side === 0 ? LENGTH + 0.5 : -0.5 }
    const to = onTable(target, shot.point.x, shot.point.y)
    const cup = shot.cup ? onTable(target, shot.cup.x, shot.cup.y) : null
    // Off a rim it drops to the middle of the cup or hops away from it.
    const away = cup && shot.kind === 'rim-out' ? Math.max(0.01, Math.hypot(to.x - cup.x, to.y - cup.y)) : 1
    const rest =
      cup && dropped(shot.kind)
        ? cup
        : cup
          ? { x: cup.x + ((to.x - cup.x) / away) * (RIM + 0.55), y: cup.y + ((to.y - cup.y) / away) * (RIM + 0.55) }
          : to
    // A reader who asked for less motion is shown where the ball went, not the trip.
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const brisk = several && shot.who > 0
    const flightMs = still ? 1 : FLIGHT_MS * (brisk ? BRISK.flight : 1)
    const bounceMs = still ? 1 : BOUNCE_MS
    const began = performance.now()
    let frame = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    let down = false
    const tick = (now: number): void => {
      const along = Math.min(1, (now - began) / flightMs)
      const after = Math.min(1, Math.max(0, (now - began - flightMs) / bounceMs))
      const x = along < 1 ? from.x + (to.x - from.x) * along : to.x + (rest.x - to.x) * after
      const y = along < 1 ? from.y + (to.y - from.y) * along : to.y + (rest.y - to.y) * after
      // Seen from above, the height of the arc is the ball drawn larger.
      const lift = along < 1 ? Math.sin(Math.PI * along) : shot.kind === 'rim-out' ? Math.sin(Math.PI * after) * 0.3 : 0
      ballMark.current?.setAttribute('cx', String(x))
      ballMark.current?.setAttribute('cy', String(y))
      ballMark.current?.setAttribute('r', String(BALL_R * (1 + lift * 1.1)))
      if (along >= 1 && !down) {
        down = true
        setFlight((now) => (now && !now.down ? { ...now, down: true } : now))
      }
      if (after < 1) {
        frame = requestAnimationFrame(tick)
        return
      }
      timer = setTimeout(() => land(flight.next), still ? 1 : SETTLE_MS)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(timer)
    }
    // One trip per throw; marking the ball down partway is this effect's own doing.
  }, [shot])

  // Space stops as a click does, wherever the pointer is, unless the reader is typing to her.
  const stopNow = useRef(stop)
  stopNow.current = stop
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || event.repeat) return
      const target = event.target as HTMLElement | null
      // A button under focus answers Space itself.
      if (target && (['TEXTAREA', 'INPUT', 'BUTTON'].includes(target.tagName) || target.isContentEditable)) return
      event.preventDefault()
      stopNow.current(true)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  // The cup a ball in the air has just taken, shown going before the count.
  const going = flight?.down && shot && dropped(shot.kind) ? { side: shot.side === 0 ? 1 : 0, id: shot.cup?.id } : null
  // The stretch of the arc meter that reaches the cups standing.
  const depths = game.sides[1].cups.map((cup) => cup.y)
  const reach = depths.length
    ? { from: (Math.min(...depths) - 0.34 - NEAR) / DEPTH, to: (Math.max(...depths) + 0.34 - NEAR) / DEPTH }
    : null
  const rerackable = !waiting && canRerack(game, 0)
  const prompt = over ? 'Game over' : flight ? '…' : her ? `${her.name} is up` : STAGES[stage].label
  const person = (index: number): string => (index === 0 ? 'You' : names[index - 1])

  return (
    <div className="vu-beerpong">
      <svg
        className="vu-beerpong-table"
        viewBox={`${VIEW.left} ${VIEW.top} ${VIEW.width} ${VIEW.height}`}
        role="img"
        aria-label={`The table: ${game.sides[1].cups.length} cups at the far end, ${game.sides[0].cups.length} at yours`}
        onClick={() => stop()}
      >
        <rect className="vu-beerpong-top" x={-HALF_WIDTH} y="0" width={HALF_WIDTH * 2} height={LENGTH} rx="0.3" />
        <line className="vu-beerpong-mid" x1={-HALF_WIDTH} x2={HALF_WIDTH} y1={LENGTH / 2} y2={LENGTH / 2} />
        {([0, 1] as const).map((side) =>
          game.sides[side].cups.map((cup) => {
            const at = onTable(side, cup.x, cup.y)
            const gone = going?.side === side && going.id === cup.id
            return (
              <g key={`${side}-${cup.id}`} className={`vu-beerpong-cup${gone ? ' vu-beerpong-cup--gone' : ''}`}>
                <circle cx={at.x} cy={at.y} r={CUP_R} />
                <circle className="vu-beerpong-beer" cx={at.x} cy={at.y} r={CUP_R * 0.62} />
              </g>
            )
          })
        )}
        {/* The reader's marks: a line across the far cups, then a spot running up it. */}
        <line
          ref={aimMark}
          className="vu-beerpong-aim"
          data-live={!waiting || undefined}
          x1="0"
          x2="0"
          y1={FRONT[1] - (NEAR + DEPTH)}
          y2={FRONT[1] - NEAR}
        />
        <circle
          ref={arcMark}
          className="vu-beerpong-arc"
          data-live={(!waiting && stage === 1) || undefined}
          cx="0"
          cy={FRONT[1] - NEAR}
          r="0.24"
        />
        <circle ref={ballMark} className="vu-beerpong-ball" data-live={flight !== null || undefined} cx="0" cy={LENGTH + 0.5} r={BALL_R} />
      </svg>

      <div className="vu-beerpong-side">
        <div className="vu-beerpong-teams">
          {([1, 0] as const).map((side) => {
            const members = game.sides[side].members
            const level = tipsyOf(game, side)
            return (
              <div key={side} className="vu-beerpong-team" data-up={(!over && game.turn === side) || undefined}>
                <span className="vu-beerpong-teamname" title={teamName(names, members)}>
                  {listed(members.map(person))}
                </span>
                <span className="vu-beerpong-left">
                  {game.sides[side].cups.length} cup{game.sides[side].cups.length === 1 ? '' : 's'} left
                  {game.leader !== null && game.turn === side ? ' · redemption' : game.overtimes ? ' · overtime' : ''}
                </span>
                <span className="vu-beerpong-drinks">
                  {members.map((member) => (
                    <span key={member} data-up={(!over && who === member) || undefined}>
                      {!over && who === member ? '\u25B8 ' : ''}
                      {person(member)} {game.drinks[member]} ({drinkState(game.drinks[member])})
                    </span>
                  ))}
                </span>
                <span className="vu-beerpong-tipsy" role="img" aria-label={`Tipsiness ${Math.round(level * 100)}%`}>
                  <span className="vu-beerpong-tipsylabel">tipsy</span>
                  <span className="vu-beerpong-tipsytrack">
                    <span className="vu-beerpong-tipsyfill" style={{ width: `${level * 100}%` }} />
                  </span>
                  <span className="vu-beerpong-tipsylabel">{Math.round(level * 100)}%</span>
                </span>
              </div>
            )
          })}
        </div>

        {/* The meter keeps its place when no throw is being made, so the surface does not jump. */}
        <div className="vu-beerpong-meter" data-waiting={waiting || undefined} data-live={(!waiting && stage === 1) || undefined}>
          <span className="vu-beerpong-meterlabel">arc</span>
          <span className="vu-beerpong-track">
            {reach && (
              <span
                className="vu-beerpong-reach"
                style={{ left: `${reach.from * 100}%`, width: `${(reach.to - reach.from) * 100}%` }}
              />
            )}
            <span ref={meterMark} className="vu-beerpong-mark" />
          </span>
        </div>

        <div className="vu-beerpong-throw">
          <div className="vu-beerpong-buttons">
            <motion.button
              type="button"
              className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
              inert={waiting || undefined}
              data-waiting={waiting || undefined}
              {...gestures(waiting, lift, press)}
              // A click with no pointer behind it is the button answering a key.
              onClick={(event) => stop(event.detail === 0)}
              // Enter held on the button is one press, as Space is.
              onKeyDown={(event) => {
                if (event.repeat) event.preventDefault()
              }}
            >
              {prompt}
            </motion.button>
            <motion.button
              type="button"
              className="vu-btn vu-btn--outline vu-paper vu-btn--panel"
              inert={!rerackable || undefined}
              data-waiting={!rerackable || undefined}
              {...gestures(!rerackable, lift, press)}
              onClick={(event) => askRerack(event.detail === 0)}
              onKeyDown={(event) => {
                if (event.repeat) event.preventDefault()
              }}
            >
              {game.sides[0].reracked ? 'Re-rack used' : 'Re-rack'}
            </motion.button>
          </div>
          {/* The last throw told, in the hint's place, once there is one. */}
          <span className="vu-beerpong-hint" data-told={lastTold !== null || undefined} aria-live="polite">
            {lastTold ?? 'click or Space, twice: aim, then arc'}
          </span>
        </div>
      </div>
    </div>
  )
}
