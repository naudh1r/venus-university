import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  BEAT_MS,
  FRESH_MS,
  LAP_M,
  TOP_SPEED,
  account,
  advance,
  clock,
  fallLine,
  finishOut,
  homeLine,
  inBend,
  lapLine,
  lapOf,
  lapsOf,
  newRace,
  outcomeOf,
  placings,
  readerLean,
  readerStride,
  soFar,
  standing,
  startLine,
  summary,
  type Foot,
  type Race,
  type RaceEvent,
  type Stride
} from '@shared/minigameRules/rollerDerby'
import { typingIn, useWindowKeydown } from '../kit'
import { gestures, lift, press } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/RollerDerby.css'

/** How many times in a race anyone says something, the whole rink together, by how talkative they are to be. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const

/** The count-in from the first move to the whistle, in ms. */
const COUNT_MS = 2400
/** The most of the clock one frame may carry, in ms: a stalled frame does not throw anyone round a bend. */
const MAX_FRAME_MS = 50
/** How often the board beside the rink is brought up to the race, in ms. */
const BOARD_MS = 100
/** Nobody starts on a remark once a skater is this near the end, in metres: the scene answers the finish. */
const QUIET_M = 20
/** The lead changing in the first scramble off the line is not worth a word, in ms. */
const SCRAMBLE_MS = 4000

/** How far ahead a bend is called, in seconds at the reader's speed: time to get into the crouch. */
const BEND_AHEAD_S = 0.3
/** Where each skater's name sits against her disc, by seat: above and below in turn, so names on one spot do not cover each other. */
const TAG_Y = [-15, 23, -28, 36] as const

/** The oval as it is drawn: the racing line's bend radius, and straights as long as a bend. */
const R = 100
const STRAIGHT = Math.PI * R
const HALF_BAND = 40
const MARGIN = 46
const WIDTH = STRAIGHT + 2 * (R + MARGIN)
const HEIGHT = 2 * (R + MARGIN)
const CX = WIDTH / 2
const CY = HEIGHT / 2
const X0 = CX - STRAIGHT / 2
const X1 = CX + STRAIGHT / 2
const OVAL = `M${X0} ${CY + R}H${X1}A${R} ${R} 0 0 0 ${X1} ${CY - R}H${X0}A${R} ${R} 0 0 0 ${X0} ${CY + R}Z`
/** How far apart the skaters' own lines are across the floor, and how far out the wall is. */
const LANE_GAP = 14
const WALL = 33

/** Where a skater is on the drawing: so far round, and so far out from the racing line. */
function spot(dist: number, out: number): { x: number; y: number } {
  const round = ((((dist % LAP_M) + LAP_M) % LAP_M) / LAP_M + 0.125) % 1
  const part = Math.min(3, Math.floor(round * 4))
  const along = round * 4 - part
  const r = R + out
  const turn = along * Math.PI
  if (part === 0) return { x: X0 + along * STRAIGHT, y: CY + r }
  if (part === 1) return { x: X1 + r * Math.sin(turn), y: CY + r * Math.cos(turn) }
  if (part === 2) return { x: X1 - along * STRAIGHT, y: CY - r }
  return { x: X0 - r * Math.sin(turn), y: CY - r * Math.cos(turn) }
}

const KEYS: Readonly<Record<string, Foot | 'lean'>> = {
  ArrowLeft: 'left',
  a: 'left',
  ArrowRight: 'right',
  d: 'right',
  ArrowDown: 'lean',
  s: 'lean'
}

const WORD: Readonly<Record<Stride, string>> = {
  perfect: 'On the beat',
  good: 'Good',
  rough: 'Ragged',
  off: 'Off the beat',
  same: 'Same foot!'
}

const ORDINAL = ['1st', '2nd', '3rd', '4th']

/** One line of the board beside the rink. */
interface Row {
  who: number
  name: string
  place: number
  /** Where she is: a lap, a time, or that she is down. */
  where: string
  /** How far behind the skater in front of her, in words; empty for the one in front. */
  gap: string
}

/** What the board beside the rink shows. */
interface Board {
  rows: Row[]
  speed: number
  clock: number
  bend: boolean
  lean: boolean
  last: Stride | null
  /** How many strides have been judged: what the judgement's pop is keyed on. */
  strides: number
  next: Foot | null
  count: number
}

/** The race as it is being run: read and written by the frame loop and the keys, never rendered from. */
interface Live {
  phase: 'ready' | 'count' | 'racing' | 'over'
  /** What is left of the count-in, in ms. */
  count: number
  /** `performance.now()` at the last frame. */
  lastNow: number
  paused: boolean
  leanKey: boolean
  leanTap: boolean
  last: Stride | null
  strides: number
  boardAt: number
  /** Remarks made so far, the rink's and each girl's by her seat. */
  remarks: number
  spoken: number[]
  speaking: boolean
  /** The run to the line with two of them side by side has had its word. */
  neckTold: boolean
}

/**
 * Rink Race: laps of a roller rink's oval, seen from above. The reader pushes off left and
 * right in turn on a steady tempo, with the arrow keys, A and D, or the two pads, and leans
 * through each bend with Down, S or the pad between them. Each girl skates the same floor on
 * the same clock as her skill has it. Alone it is a timed run. The race runs off the clock and
 * waits on nothing said: the box hears the start, each lap's leader, a fall and a girl home.
 */
export function RollerDerby({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const laps = lapsOf(play.options.laps)
  // Everyone is put on the line once, as the rink is rolled onto.
  const [race] = useState<Race>(() =>
    newRace(
      laps,
      girls.map((girl) => girl.skill)
    )
  )
  const [phase, setPhase] = useState<Live['phase']>('ready')
  const [paused, setPaused] = useState(false)

  const live = useRef<Live>({
    phase: 'ready',
    count: COUNT_MS,
    lastNow: 0,
    paused: false,
    leanKey: false,
    leanTap: false,
    last: null,
    strides: 0,
    boardAt: -Infinity,
    remarks: 0,
    spoken: [],
    speaking: false,
    neckTold: false
  })
  // The rink can be cleared mid-race: nothing is said or set once it has been.
  const mounted = useRef(true)
  const opened = useRef(false)
  const held = useRef(play)
  held.current = play
  const root = useRef<HTMLDivElement>(null)
  const drawn = useRef<(SVGGElement | null)[]>([])

  const who = (index: number): string => (index === 0 ? 'the reader' : names[index - 1])

  /** The board beside the rink, as the race stands now. */
  function board(): Board {
    const game = live.current
    const me = race.skaters[0]
    const done = game.phase === 'over'
    const order = done
      ? placings(race).map((placing) => ({ index: placing.who, place: placing.place }))
      : race.skaters
          .map((skater, index) => ({ index, skater }))
          .sort(
            (a, b) =>
              (a.skater.finishedAt ?? Infinity) - (b.skater.finishedAt ?? Infinity) ||
              b.skater.dist - a.skater.dist ||
              a.index - b.index
          )
          .map((entry, i) => ({ index: entry.index, place: i + 1 }))
    const rows = order.map(({ index, place }, i): Row => {
      const skater = race.skaters[index]
      const ahead = i > 0 ? race.skaters[order[i - 1].index] : null
      const where =
        skater.finishedAt !== null
          ? clock(skater.finishedAt)
          : done
            ? 'time called'
            : skater.downMs > 0
              ? 'down!'
              : lapOf(race, index) === race.laps && race.laps > 1
                ? 'last lap'
                : `lap ${lapOf(race, index)}/${race.laps}`
      const gap =
        ahead && skater.finishedAt === null && ahead.finishedAt === null
          ? `+${Math.max(0, ahead.dist - skater.dist).toFixed(0)} m`
          : ''
      return { who: index, name: index === 0 ? 'You' : names[index - 1], place, where, gap }
    })
    const since = me.lastStrideAt === null ? Infinity : race.t - me.lastStrideAt
    return {
      rows,
      speed: me.speed,
      clock: Math.max(0, race.t),
      bend: game.phase === 'racing' && (inBend(me.dist) || inBend(me.dist + me.speed * BEND_AHEAD_S)),
      lean: me.lean,
      last: game.last,
      strides: game.strides,
      // After a glide either foot will do.
      next: me.lastFoot === null || since > FRESH_MS ? null : me.lastFoot === 'left' ? 'right' : 'left',
      count: game.phase === 'count' ? Math.ceil(game.count / (COUNT_MS / 3)) : 0
    }
  }

  const [view, setView] = useState<Board>(board)

  /** Everyone put where she is on the drawing, and the tempo's pulse brought up to the clock. */
  function draw(): void {
    const n = race.skaters.length
    race.skaters.forEach((skater, index) => {
      const mark = drawn.current[index]
      if (!mark) return
      const lane = (index - (n - 1) / 2) * LANE_GAP
      const at = spot(skater.dist, lane + skater.drift * (WALL - lane))
      mark.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)})`)
      const down = skater.downMs > 0
      if ((mark.dataset.down !== undefined) !== down) {
        if (down) mark.dataset.down = ''
        else delete mark.dataset.down
      }
    })
    const me = race.skaters[0]
    const since = me.lastStrideAt === null ? FRESH_MS : race.t - me.lastStrideAt
    // The pulse runs from the last push to the next one due: full at the tempo, fading past it.
    root.current?.style.setProperty('--since', Math.min(1.6, Math.max(0, since / BEAT_MS)).toFixed(3))
    root.current?.style.setProperty('--speed', Math.min(1, me.speed / TOP_SPEED).toFixed(3))
  }

  /**
   * Has one of the girls say something about what just happened, and never holds the race for
   * it: the one it happened to where there is one, otherwise whoever has said least. Nothing is
   * said over a line still on its way, past the rink's cap, or with the finish in sight.
   */
  function remark(cue: string, about = 0, closing = false): void {
    const game = live.current
    if (girls.length === 0 || game.phase !== 'racing' || game.speaking || !mounted.current) return
    if (game.remarks >= REMARKS[held.current.chattiness]) return
    const total = race.laps * LAP_M
    if (!closing && race.skaters.some((skater) => skater.dist > total - QUIET_M)) return
    let seat = about - 1
    if (seat < 0) {
      seat = 0
      for (let i = 1; i < girls.length; i++) {
        if ((game.spoken[i] ?? 0) < (game.spoken[seat] ?? 0)) seat = i
      }
    }
    game.remarks++
    game.spoken[seat] = (game.spoken[seat] ?? 0) + 1
    game.speaking = true
    held.current.situation(standing(race, names, held.current.stake))
    void held.current
      .say(girls[seat].charId, cue)
      .catch(() => undefined)
      .finally(() => {
        game.speaking = false
      })
  }

  /** The race is over: the girls still out are skated home, and the result is handed over, once. */
  function end(): void {
    const game = live.current
    if (game.phase === 'over') return
    game.phase = 'over'
    finishOut(race)
    readerLean(race, false)
    if (girls.length > 0) held.current.situation(standing(race, names, held.current.stake))
    draw()
    setView(board())
    setPhase('over')
    held.current.finish({
      outcome: outcomeOf(race),
      summary: summary(race, names),
      account: account(race, names)
    })
  }

  /** What one step of the clock brought: told to the box where it is worth a line, and to the girls. */
  function told(events: readonly RaceEvent[]): void {
    const game = live.current
    const lots = held.current.chattiness === 'lots'
    const readerHome = race.skaters[0].finishedAt !== null
    for (const event of events) {
      if (game.phase !== 'racing' || readerHome) break
      if (event.kind === 'fall') {
        held.current.narrate(fallLine(names, event.who))
        remark(
          event.who === 0
            ? `The reader just took a bend too fast without leaning and went down on the boards on lap ${lapOf(race, 0)}; he is scrambling back onto his skates.`
            : `${who(event.who)} just took a bend too fast without leaning and fell on lap ${lapOf(race, event.who)}; she is scrambling back up as the others go by.`,
          event.who
        )
      } else if (event.kind === 'lap' && event.first) {
        held.current.narrate(lapLine(race, names, event.who, event.lap))
        held.current.progress(soFar(race, names))
        if (girls.length > 0) held.current.situation(standing(race, names, held.current.stake))
        if (event.lap === race.laps - 1) {
          remark(`The last lap has just begun with ${who(event.who)} in front, everyone breathing hard.`)
        } else if (lots) {
          remark(`${who(event.who)} was first over the line at the end of lap ${event.lap}.`)
        }
      } else if (event.kind === 'lap' && event.who === 0) {
        // His own lap line, behind the leader: the race walked away from is known as it stood.
        held.current.progress(soFar(race, names))
      } else if (event.kind === 'lead' && race.t > SCRAMBLE_MS) {
        remark(
          `${who(event.who)} has just skated past ${who(event.from)} to take the lead on lap ${lapOf(race, event.who)}.`,
          event.who > 0 ? event.who : event.from
        )
      } else if (event.kind === 'finish' && event.who > 0) {
        held.current.narrate(homeLine(race, names, event.who))
      } else if (lots && event.kind === 'wobble') {
        remark(
          `${who(event.who)} just ran wide in a bend and wobbled off the boards, losing most of ${event.who === 0 ? 'his' : 'her'} speed.`,
          event.who
        )
      } else if (lots && event.kind === 'clip') {
        remark(`${who(event.who)} just clipped another skater squeezing past in a bend.`, event.who)
      }
    }
    // Two of them side by side coming to the last bend: the one word kept for a close finish.
    const total = race.laps * LAP_M
    if (!game.neckTold && girls.length > 0 && !readerHome && game.phase === 'racing') {
      const order = race.skaters.map((skater, index) => ({ index, dist: skater.dist })).sort((a, b) => b.dist - a.dist)
      if (order[0].dist >= total - 40) {
        game.neckTold = true
        if (order[0].dist - order[1].dist < 2) {
          remark(
            `${who(order[0].index)} and ${who(order[1].index)} are side by side going into the last bend: it could be a photo finish.`,
            0,
            true
          )
        }
      }
    }
  }

  /** The first move: the count-in starts, and from here leaving is walking away. */
  function begin(): void {
    const game = live.current
    if (game.phase !== 'ready' || !mounted.current) return
    game.phase = 'count'
    game.count = COUNT_MS
    game.lastNow = performance.now()
    held.current.started()
    if (girls.length === 0) held.current.narrate(startLine(race.laps, names))
    setView(board())
    setPhase('count')
  }

  /** A push off one foot, at the moment the key or the tap happened where the event knows it. */
  function push(foot: Foot, stamp?: number): void {
    const game = live.current
    if (!mounted.current || game.phase === 'over') return
    if (game.phase === 'ready') {
      begin()
      return
    }
    if (game.phase !== 'racing' || game.paused) return
    const late = stamp === undefined ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, stamp - game.lastNow))
    const judged = readerStride(race, foot, race.t + late)
    if (!judged) return
    game.last = judged
    game.strides++
    setView(board())
  }

  function lean(): void {
    const game = live.current
    readerLean(race, game.phase !== 'over' && (game.leanKey || game.leanTap))
  }

  useWindowKeydown((event) => {
    // A key typed to her is a character, never a stride.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const key = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (key === undefined) return
    event.preventDefault()
    if (key === 'lean') {
      // A key held through a pause comes back as repeats: one of those takes the lean up again.
      if (event.repeat && live.current.leanKey) return
      live.current.leanKey = true
      lean()
    } else if (!event.repeat) {
      push(key, event.timeStamp)
    }
  })

  // The crouch lasts as long as the key is held, wherever the key comes up.
  useEffect(() => {
    const up = (event: KeyboardEvent): void => {
      const key = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
      if (key !== 'lean') return
      live.current.leanKey = false
      lean()
    }
    window.addEventListener('keyup', up)
    return () => window.removeEventListener('keyup', up)
    // One listener for as long as the rink is up.
  }, [])

  // A race agreed with the girls is under way as the rink opens, and says so once.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (girls.length === 0) return
    held.current.narrate(startLine(race.laps, names))
    held.current.situation(standing(race, names, held.current.stake))
    // Once, as the rink opens.
  }, [])

  // The race itself: every frame carries the clock on and brings the drawing up to it.
  useEffect(() => {
    mounted.current = true
    const game = live.current
    let frame = 0
    game.lastNow = performance.now()

    const loop = (): void => {
      if (!mounted.current) return
      const now = performance.now()
      const dt = game.paused ? 0 : Math.min(MAX_FRAME_MS, Math.max(0, now - game.lastNow))
      game.lastNow = now
      if (game.phase === 'count' && dt > 0) {
        game.count -= dt
        if (game.count <= 0) {
          game.phase = 'racing'
          setPhase('racing')
        }
        game.boardAt = -Infinity
      } else if (game.phase === 'racing' && dt > 0) {
        const events = advance(race, dt)
        told(events)
        if (race.skaters[0].finishedAt !== null || race.called) end()
      }
      draw()
      if (game.phase !== 'over' && now - game.boardAt >= BOARD_MS) {
        game.boardAt = now
        setView(board())
      }
      if (game.phase !== 'over') frame = requestAnimationFrame(loop)
    }

    // A window hidden or out of focus draws no frames and hears no keys: the race stands
    // still for it, the girls with it, and picks up where it stood.
    const stop = (): void => {
      if (game.paused) return
      game.paused = true
      game.leanKey = false
      lean()
      setPaused(true)
    }
    const resume = (): void => {
      if (!game.paused || document.hidden || !document.hasFocus()) return
      game.paused = false
      game.lastNow = performance.now()
      // Nobody comes back to half a count-in: it is counted again from the top.
      if (game.phase === 'count') game.count = COUNT_MS
      setPaused(false)
    }
    const seen = (): void => (document.hidden ? stop() : resume())
    document.addEventListener('visibilitychange', seen)
    window.addEventListener('blur', stop)
    window.addEventListener('focus', resume)
    if (document.hidden || !document.hasFocus()) stop()

    if (game.phase !== 'over') frame = requestAnimationFrame(loop)
    else draw()
    return () => {
      mounted.current = false
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', seen)
      window.removeEventListener('blur', stop)
      window.removeEventListener('focus', resume)
    }
    // The loop starts once and runs off the clock to the end of the race.
  }, [])

  const over = phase === 'over'
  const racing = phase === 'racing'
  const call = !racing ? null : view.bend ? (view.lean ? null : 'lean') : view.lean ? 'free' : null
  // Once it is over the lean's line says how it came out for the reader.
  const mine = over ? placings(race).find((placing) => placing.who === 0) : undefined
  const result = !mine
    ? ''
    : mine.time === null
      ? 'Time called'
      : girls.length === 0
        ? 'Finished'
        : mine.place !== 1
          ? `You come ${ORDINAL[mine.place - 1] ?? `${mine.place}th`}`
          : placings(race).filter((placing) => placing.place === 1).length > 1
            ? 'Dead heat'
            : 'You win'

  return (
    <div
      ref={root}
      className="vu-rink"
      data-phase={phase}
      data-paused={(paused && (phase === 'count' || racing)) || undefined}
    >
      <div className="vu-rink-floor">
        <svg
          className="vu-rink-track"
          viewBox={`0 0 ${WIDTH.toFixed(1)} ${HEIGHT}`}
          role="img"
          aria-label="The rink from above"
        >
          <path className="vu-rink-boards" d={OVAL} strokeWidth={HALF_BAND * 2 + 8} />
          <path className="vu-rink-boardwalk" d={OVAL} strokeWidth={HALF_BAND * 2} />
          <path className="vu-rink-line" d={OVAL} />
          <line className="vu-rink-finish" x1={CX} x2={CX} y1={CY + R - HALF_BAND} y2={CY + R + HALF_BAND} />
          {[-1.1, -0.55, 0, 0.55, 1.1].map((along, i) => (
            <circle
              key={along}
              className="vu-rink-light"
              data-tone={i % 2 === 0 ? 'accent' : 'plain'}
              cx={CX + (along * STRAIGHT) / 2.4}
              cy={CY + (i % 2 === 0 ? -14 : 16)}
              r={i % 2 === 0 ? 24 : 17}
              style={{ animationDelay: `${-i * 0.7}s` }}
            />
          ))}
          {race.skaters.map((_, index) => (
            <g
              key={index}
              ref={(el) => void (drawn.current[index] = el)}
              className="vu-rink-skater"
              data-me={index === 0 || undefined}
              data-seat={index}
            >
              <circle r={index === 0 ? 10 : 9} />
              <text y={TAG_Y[index] ?? -15} textAnchor="middle">
                {index === 0 ? 'You' : names[index - 1]}
              </text>
            </g>
          ))}
        </svg>

        {phase === 'ready' && (
          <div className="vu-rink-over">
            <p className="vu-rink-how">
              Push off left and right in turn, in time with the pulse: ← → or A D. Hold ↓ or S to
              lean through each bend, or you slide wide; hit the boards at speed and you fall. Let
              go on the straights: leaning there is a crouch that slows you right down.
            </p>
            <motion.button
              type="button"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              {...gestures(false, lift, press)}
              onClick={begin}
            >
              {girls.length > 0 ? 'To the line' : 'Start the run'}
            </motion.button>
          </div>
        )}
        {phase === 'count' && !paused && (
          <div className="vu-rink-over vu-rink-over--clear" role="status">
            <span key={view.count} className="vu-rink-count">
              {view.count}
            </span>
          </div>
        )}
        {paused && (phase === 'count' || racing) && (
          <div className="vu-rink-over" role="status">
            <p className="vu-rink-paused">Paused</p>
            <p className="vu-rink-how">The race waits while the window is away.</p>
          </div>
        )}
      </div>

      <div className="vu-rink-side">
        <ol className="vu-rink-order" aria-label={over ? 'Finishing order' : 'Positions'}>
          {view.rows.map((row) => (
            <li key={row.who} className="vu-rink-row" data-me={row.who === 0 || undefined}>
              <span className="vu-rink-place">{row.place}</span>
              <span className="vu-rink-name">{row.name}</span>
              <span className="vu-rink-where">{row.where}</span>
              <span className="vu-rink-gap">{row.gap || ' '}</span>
            </li>
          ))}
        </ol>

        <div className="vu-rink-dash">
          <span className="vu-rink-clock">{clock(view.clock)}</span>
          <span className="vu-rink-speed" role="meter" aria-label="Speed" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((view.speed / TOP_SPEED) * 100)}>
            <span className="vu-rink-speed-fill" />
          </span>
        </div>

        <div className="vu-rink-tempo" aria-hidden="true">
          <span className="vu-rink-tempo-zone" />
          <span className="vu-rink-tempo-dot" />
        </div>
        {/* Keyed on the count, so each stride's judgement lands as a new one. */}
        <span key={view.strides} className="vu-rink-judged" data-stride={view.last ?? undefined}>
          {view.last ? WORD[view.last] : ' '}
        </span>
        {/* The lean has its own line: wanted in a bend, to be let go of on a straight. */}
        <span className="vu-rink-call" data-call={call || undefined} role="status">
          {call === 'lean' ? 'Lean!' : call === 'free' ? 'Let go' : result || ' '}
        </span>

        <div className="vu-rink-pads" inert={!racing || undefined} data-waiting={!racing || undefined}>
          <button
            type="button"
            tabIndex={-1}
            className="vu-rink-pad"
            data-next={view.next === 'left' || undefined}
            aria-label="Push off the left foot"
            onPointerDown={(event) => {
              event.preventDefault()
              push('left', event.timeStamp)
            }}
          >
            ← Left
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="vu-rink-pad vu-rink-pad--lean"
            data-wanted={view.bend || undefined}
            aria-pressed={view.lean}
            aria-label="Lean"
            onPointerDown={(event) => {
              event.preventDefault()
              if (live.current.paused) return
              live.current.leanTap = !live.current.leanTap
              lean()
              setView(board())
            }}
          >
            {call === 'free' ? '↓ Let go' : '↓ Lean'}
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="vu-rink-pad"
            data-next={view.next === 'right' || undefined}
            aria-label="Push off the right foot"
            onPointerDown={(event) => {
              event.preventDefault()
              push('right', event.timeStamp)
            }}
          >
            Right →
          </button>
        </div>
      </div>
    </div>
  )
}
