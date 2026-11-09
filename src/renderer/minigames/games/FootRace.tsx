import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  FADE_BEFORE,
  MARKS_S,
  RECALL_S,
  STEP_S,
  account,
  clockText,
  courseOf,
  effortAt,
  falseStartPenaltyS,
  penaltyShownS,
  freshRunner,
  halfwayLine,
  herPlan,
  herStep,
  noStrides,
  openingLine,
  ordinal,
  outcomeOf,
  paced,
  placesNow,
  placesOf,
  setGapS,
  shownTime,
  soloSummary,
  stepRunner,
  stride,
  timeText,
  versusSummary,
  type Runner,
  type Side,
  type Strides,
  type Told
} from '@shared/minigameRules/footRace'
import { listed } from '@shared/minigameKit'
import { typingIn, useWindowKeydown } from '../kit'
import { gestures, lift, press } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/FootRace.css'

/** The keys that stride: the arrows, and A and D. */
const KEYS: Readonly<Record<string, Side>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  a: 'left',
  d: 'right'
}

/** How many times in a race anything is said by the girls, between all of them. */
const REMARKS = { quiet: 0, some: 2, lots: 4 } as const

/** The longest a frame is taken for, in seconds: a stall is not run through in one go. */
const FRAME_CAP_S = 0.05
/** How far before the gun a girl who jumps it goes, in seconds. */
const JUMP_EARLY_S = 0.18
/** Past this far round nothing more is said: the scene's own reply answers the finish. */
const QUIET_FROM = 0.92
/** How much faster the rest come home once the reader is over the line. */
const AFTER_READER = 3

type Phase = 'ready' | 'marks' | 'set' | 'recall' | 'running' | 'over'

const CALL: Readonly<Record<Phase, string>> = {
  ready: ' ',
  marks: 'On your marks…',
  set: 'Set…',
  recall: 'False start',
  running: 'GO!',
  over: 'Finished'
}

/** How the race came out for the reader, in a few words for the starter's place at the top. */
function resultCall(times: readonly (number | null)[]): string {
  if (times.length <= 1) return times[0] === null ? 'Did not finish' : 'Finished'
  const places = placesOf(times)
  if (times[0] === null) return 'Did not finish'
  if (places[0] !== 1) return `You come ${ordinal(places[0])}`
  return places.slice(1).includes(1) ? 'Dead heat' : 'You win'
}

/** The race as it is being run: read and written by the frame loop, never rendered from. */
interface Live {
  phase: Phase
  /** Seconds of unpaused time since the table opened, and when the phase began on it. */
  clock: number
  phaseAt: number
  /** How long this "set" is held. */
  gap: number
  /** `performance.now()` at the last frame. */
  lastNow: number
  paused: boolean
  /** Time owed to the fixed step, and seconds since the gun. */
  owed: number
  raceT: number
  /** The reader first, then the girls in their seats. */
  runners: Runner[]
  strides: Strides
  /** False starts by seat. */
  falseStarts: number[]
  /** A girl has already gone early once: nobody does again. */
  jumped: boolean
  /** The seat of the last runner to go before the gun, shown on her lane while everyone walks back. */
  jumper: number
  /** How long after the gun the reader is held, and how long he then took to move. */
  release: number
  reaction: number | null
  /** Everyone's place at halfway and with a fifth to go, once the race has got there. */
  half: number[] | null
  last: number[] | null
  /** Places at the last step, for a pass in the closing stretch. */
  before: number[]
  fadeTold: boolean[]
  stumbleTold: boolean[]
  kickTold: boolean
  remarks: number
  spoken: number[]
  speaking: boolean
  over: boolean
}

/**
 * Foot Race: lanes side by side, the reader in the first. He strides by alternating left and
 * right, on the arrows, A and D, or the two buttons; cadence is speed, and effort spends a
 * stamina bar that, empty, leaves him jogging. The starter's calls come off the same clock as
 * the race, with "set" held a random while; a stride before the gun is a false start. Each girl
 * runs her own race from her skill on that clock. Nothing waits on anything said: the box hears
 * the start, the order at halfway in the longer races, and the result.
 */
export function FootRace({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const course = courseOf(play.options.distance)
  // How each girl will run it is settled once, as they line up.
  const [plans] = useState(() => girls.map((girl) => herPlan(girl.skill, course)))
  const [phase, setPhase] = useState<Phase>('ready')
  const [paused, setPaused] = useState(false)
  const [held, setHeld] = useState(0)
  // How it came out, from the reader's side, in place of the starter's last call.
  const [result, setResult] = useState('')

  const live = useRef<Live>({
    phase: 'ready',
    clock: 0,
    phaseAt: 0,
    gap: 0,
    lastNow: 0,
    paused: false,
    owed: 0,
    raceT: 0,
    runners: [freshRunner(), ...girls.map(freshRunner)],
    strides: noStrides(),
    falseStarts: [0, ...girls.map(() => 0)],
    jumped: false,
    jumper: -1,
    release: 0,
    reaction: null,
    half: null,
    last: null,
    before: [],
    fadeTold: [],
    stumbleTold: [],
    kickTold: false,
    remarks: 0,
    spoken: [],
    speaking: false,
    over: false
  })
  // The table can be cleared mid-race: nothing is said or set once it has been.
  const mounted = useRef(true)
  const latest = useRef(play)
  latest.current = play
  // The line-up is said once and the result handed over once, whatever is run twice.
  const opened = useRef(false)
  const finished = useRef(false)

  const markers = useRef<(HTMLSpanElement | null)[]>([])
  const places = useRef<(HTMLSpanElement | null)[]>([])
  const clock = useRef<HTMLSpanElement>(null)
  const gone = useRef<HTMLSpanElement>(null)
  const tank = useRef<HTMLSpanElement>(null)
  const pace = useRef<HTMLSpanElement>(null)

  const who = (seat: number): string => (seat === 0 ? 'the reader' : names[seat - 1])
  const lead = (): number => Math.max(...live.current.runners.map((runner) => runner.pos)) / course.metres

  /** How the race stands, for anything said beside the track. */
  function standing(): string {
    const game = live.current
    const order = placesNow(game.runners)
    const where =
      game.phase === 'over'
        ? 'The race has just finished.'
        : game.phase === 'running'
          ? `They are running: ${game.runners
              .map((runner, seat) => `${who(seat)} ${ordinal(order[seat])} with ${Math.round(runner.pos)} m run`)
              .join(', ')}.`
          : game.phase === 'recall'
            ? 'A false start has just been called and everyone is walking back to the line.'
            : 'They are at the start line, waiting on the starter.'
    return [
      `The game is a foot race over ${course.metres} m, the reader against ${listed(names)}, each in a lane; once it is on everyone is running too hard to say more than a few words.`,
      where,
      ...(latest.current.stake ? [`Riding on it: ${latest.current.stake}`] : [])
    ].join(' ')
  }

  /**
   * Has one girl say something about what just happened, and never holds the race for it: the
   * girl it happened to, or else whoever has said least. A few times a race between all of
   * them, never over a line still on its way, and never once the line is close.
   */
  function remark(seat: number | null, cue: string): void {
    const game = live.current
    if (girls.length === 0 || game.over || game.speaking || !mounted.current) return
    if (game.remarks >= REMARKS[latest.current.chattiness]) return
    if (game.phase === 'running' && lead() >= QUIET_FROM) return
    const said = (at: number): number => game.spoken[at] ?? 0
    const speaker =
      seat !== null && seat > 0
        ? seat - 1
        : girls.map((_, at) => at).sort((a, b) => said(a) - said(b) || a - b)[0]
    game.remarks++
    game.spoken[speaker] = said(speaker) + 1
    game.speaking = true
    latest.current.situation(standing())
    void latest.current
      .say(girls[speaker].charId, cue)
      .catch(() => undefined)
      .finally(() => {
        game.speaking = false
      })
  }

  function toPhase(next: Phase): void {
    const game = live.current
    game.phase = next
    game.phaseAt = game.clock
    if (next === 'marks') game.gap = setGapS()
    if (mounted.current) setPhase(next)
    if (girls.length > 0) latest.current.situation(standing())
  }

  /** The reader steps up: the first move, and the starter begins. */
  function begin(): void {
    const game = live.current
    if (game.phase !== 'ready' || game.over || game.paused || !mounted.current) return
    latest.current.started()
    if (girls.length === 0) {
      latest.current.narrate(`You step up to the line for the ${course.metres} m, alone against the clock.`)
    }
    toPhase('marks')
  }

  /** Someone has moved before the gun: everyone is called back. Seat 0 is the reader. */
  function falseStart(seat: number): void {
    const game = live.current
    const count = ++game.falseStarts[seat]
    game.jumper = seat
    toPhase('recall')
    if (seat === 0) {
      game.release = falseStartPenaltyS(count)
      setHeld(penaltyShownS(course, count))
      latest.current.narrate(
        count === 1
          ? 'You go before the gun: a false start. A warning, and back to your marks.'
          : `You go before the gun again. Back to your marks: you will be held until the clock reads ${penaltyShownS(course, count).toFixed(1)} s.`
      )
      remark(
        null,
        count === 1
          ? 'The reader just went before the gun: a false start, a warning, and everyone is called back to the line.'
          : `The reader has false-started for the ${ordinal(count)} time and will be held back at the gun as a penalty.`
      )
    } else {
      game.jumped = true
      latest.current.narrate(`${who(seat)} goes before the gun: a false start. A warning, and back to the marks.`)
      remark(seat, `${who(seat)} herself just went before the gun: a false start, a warning, and everyone is called back to the line.`)
    }
  }

  function gun(): void {
    const game = live.current
    game.raceT = 0
    game.owed = 0
    game.strides = noStrides()
    game.reaction = null
    game.runners = game.runners.map(freshRunner)
    toPhase('running')
  }

  /** A foot down: the way up to the line, a false start, or a stride. */
  function step(side: Side): void {
    const game = live.current
    if (game.over || game.paused || !mounted.current) return
    if (game.phase === 'ready') begin()
    else if (game.phase === 'set') falseStart(0)
    else if (game.phase === 'running') {
      // To the moment of the key, not of the last frame: cadence is read from the gaps.
      const at = game.raceT + game.owed + Math.min(FRAME_CAP_S, Math.max(0, (performance.now() - game.lastNow) / 1000))
      // Held in the blocks, or already home: the foot counts for nothing.
      if (at < game.release || game.runners[0].finishedAt !== null) return
      game.reaction ??= at - game.release
      game.strides = stride(game.strides, side, at)
    }
  }

  function end(): void {
    const game = live.current
    if (finished.current) return
    finished.current = true
    game.over = true
    const told: Told[] = game.runners.map((runner, seat) => ({
      name: seat === 0 ? '' : names[seat - 1],
      time: shownTime(course, runner.finishedAt),
      reactionS: seat === 0 ? game.reaction : plans[seat - 1].reactionS,
      falseStarts: game.falseStarts[seat],
      spentAt: runner.spentAt,
      stumbled: runner.stumbled,
      staminaLeft: runner.stamina,
      placeAtHalf: game.half?.[seat] ?? 0,
      placeAtLast: game.last?.[seat] ?? 0
    }))
    if (mounted.current) setResult(resultCall(told.map((one) => one.time)))
    toPhase('over')
    if (girls.length === 0) {
      latest.current.finish({
        outcome: 'played',
        summary: soloSummary(course, told[0]),
        account: account(course, told)
      })
      return
    }
    latest.current.finish({
      outcome: outcomeOf(placesOf(told.map((one) => one.time))),
      summary: versusSummary(course, told),
      account: account(course, told)
    })
  }

  /** One fixed step of the race, and whatever it brought about. */
  function tick(): void {
    const game = live.current
    const at = game.raceT
    const effort = at < game.release ? 0 : effortAt(game.strides, at)
    game.runners = game.runners.map((runner, seat) =>
      seat === 0 ? stepRunner(runner, effort, course, at) : herStep(runner, plans[seat - 1], course, at)
    )
    game.raceT += STEP_S
    const front = lead()
    const order = placesNow(game.runners)
    const leader = order.indexOf(1)

    if (!game.half && front >= 0.5) {
      game.half = order
      if (paced(course)) {
        latest.current.narrate(halfwayLine(course, names, game.runners))
        if (latest.current.chattiness === 'lots') {
          remark(leader, `Halfway round, ${who(leader)} is in front; ${who(order.indexOf(Math.max(...order)))} is last.`)
        }
      }
    }
    if (!game.last && front >= 0.8) game.last = order

    game.runners.forEach((runner, seat) => {
      const left = Math.round(course.metres - runner.pos)
      if (runner.stumbled && !game.stumbleTold[seat]) {
        game.stumbleTold[seat] = true
        remark(seat, `${who(seat)} herself just stumbled mid-stride and lost ground, with ${left} m to go.`)
      }
      if (runner.spentAt === null || game.fadeTold[seat]) return
      game.fadeTold[seat] = true
      if (!paced(course) || runner.spentAt >= FADE_BEFORE) return
      remark(
        seat,
        seat === 0
          ? `The reader went out too fast and has nothing left with ${left} m to go: he is fading.`
          : `${who(seat)} herself went out too fast and has nothing left with ${left} m to go: she is fading.`
      )
    })

    // A pass in the closing stretch: whoever went by, or the girl who was gone by.
    if (game.last && !game.kickTold && game.before.length === order.length) {
      const passer = order.findIndex(
        (place, seat) =>
          place < game.before[seat] && order.some((other, at) => other > place && game.before[at] < game.before[seat])
      )
      if (passer >= 0) {
        const passed = order.findIndex((other, at) => other > order[passer] && game.before[at] < game.before[passer])
        game.kickTold = true
        const left = Math.round(course.metres - game.runners[passer].pos)
        remark(
          passer > 0 ? passer : passed,
          `${who(passer)}${passer > 0 ? ' herself' : ''} has just kicked past ${who(passed)} with ${left} m to go.`
        )
      }
    }
    game.before = order

    if (game.runners.every((runner) => runner.finishedAt !== null) || game.raceT >= course.limitS) end()
  }

  /** The frame's worth of time, on whichever part of the race it falls. */
  function advance(dt: number): void {
    const game = live.current
    game.clock += dt
    const into = game.clock - game.phaseAt
    if (game.phase === 'marks' && into >= MARKS_S) toPhase('set')
    else if (game.phase === 'set') {
      const jumper = game.jumped || game.falseStarts[0] > 0 ? -1 : plans.findIndex((plan) => plan.jumps)
      if (jumper >= 0 && into >= game.gap - JUMP_EARLY_S) falseStart(jumper + 1)
      else if (into >= game.gap) gun()
    } else if (game.phase === 'recall' && into >= RECALL_S) toPhase('marks')
    else if (game.phase === 'running') {
      game.owed += dt * (game.runners[0].finishedAt !== null ? AFTER_READER : 1)
      while (game.owed >= STEP_S && !game.over) {
        tick()
        game.owed -= STEP_S
      }
    }
  }

  /** The board brought up to the race: the runners, their places, the clock and the reader's two meters. */
  function draw(): void {
    const game = live.current
    const running = game.phase === 'running' || game.phase === 'over'
    const order = placesNow(game.runners)
    const finalPlaces = game.over
      ? placesOf(game.runners.map((runner) => shownTime(course, runner.finishedAt)))
      : []
    game.runners.forEach((runner, seat) => {
      const marker = markers.current[seat]
      if (marker) marker.style.left = `${((running ? runner.pos : 0) / course.metres) * 100}%`
      const place = places.current[seat]
      if (!place) return
      // Before the gun a lane says who went early: called back just now, or warned already.
      const text = !running
        ? game.phase === 'recall' && game.jumper === seat
          ? 'false start'
          : game.falseStarts[seat] > 0
            ? 'warned'
            : ''
        : runner.finishedAt !== null
          ? `${game.over && girls.length > 0 ? `${ordinal(finalPlaces[seat])} ` : ''}${timeText(shownTime(course, runner.finishedAt))}`
          : game.over
            ? 'DNF'
            : game.raceT > 0.6
              ? ordinal(order[seat])
              : ''
      if (place.textContent !== text) place.textContent = text
    })
    const me = game.runners[0]
    const time = clockText(course, running ? (me.finishedAt ?? game.raceT) : 0)
    if (clock.current && clock.current.textContent !== time) clock.current.textContent = time
    const flat = game.phase === 'running' && me.spent && me.finishedAt === null
    const run = `${Math.round(running ? me.pos : 0)} m${flat ? ' · spent' : ''}`
    if (gone.current && gone.current.textContent !== run) gone.current.textContent = run
    if (tank.current) {
      tank.current.style.transform = `scaleX(${(running ? me.stamina : 1).toFixed(3)})`
      if (running && me.spent) tank.current.dataset.spent = ''
      else delete tank.current.dataset.spent
    }
    if (pace.current) {
      const effort = game.phase === 'running' && me.finishedAt === null ? effortAt(game.strides, game.raceT + game.owed) : 0
      pace.current.style.left = `${(effort * 100).toFixed(1)}%`
    }
  }

  useWindowKeydown((event) => {
    // A key typed to her is a character, never a stride.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const side = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (side === undefined) return
    event.preventDefault()
    if (!event.repeat) step(side)
  })

  // The one clock: the starter's calls and the race both run off it, and it stands still while
  // the window is hidden or out of focus, so nothing is called or run unseen.
  useEffect(() => {
    const game = live.current
    mounted.current = true
    let frame = 0
    game.lastNow = performance.now()

    const loop = (): void => {
      if (!mounted.current) return
      const now = performance.now()
      const dt = Math.min(FRAME_CAP_S, Math.max(0, (now - game.lastNow) / 1000))
      game.lastNow = now
      if (!game.paused && !game.over) advance(dt)
      draw()
      if (!game.over) frame = requestAnimationFrame(loop)
    }

    const stop = (): void => {
      if (game.over || game.paused) return
      game.paused = true
      setPaused(true)
    }
    const resume = (): void => {
      if (!game.paused || document.hidden || !document.hasFocus()) return
      game.paused = false
      game.lastNow = performance.now()
      setPaused(false)
      // Back from away mid-call: the starter begins again, so the gun never comes unannounced.
      if (game.phase === 'marks' || game.phase === 'set') toPhase('marks')
    }
    const seen = (): void => (document.hidden ? stop() : resume())
    document.addEventListener('visibilitychange', seen)
    window.addEventListener('blur', stop)
    window.addEventListener('focus', resume)
    if (document.hidden || !document.hasFocus()) stop()

    frame = requestAnimationFrame(loop)
    return () => {
      mounted.current = false
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', seen)
      window.removeEventListener('blur', stop)
      window.removeEventListener('focus', resume)
    }
    // Once, for as long as the table stands.
  }, [])

  // With company the race is on from the moment they line up, and it is said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (girls.length === 0) return
    play.narrate(openingLine(course, names))
    play.situation(standing())
    // Once, as the table opens.
  }, [])

  const over = phase === 'over'
  const lanes = ['You', ...names]
  const quarters = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="vu-footrace" data-phase={phase} data-paused={paused || undefined}>
      <div className="vu-footrace-head">
        <span className="vu-footrace-distance">{course.metres} m</span>
        <span key={phase} className="vu-footrace-call" role="status">
          {phase === 'over' && result ? result : CALL[phase]}
        </span>
        <span ref={clock} className="vu-footrace-clock" aria-label="Clock" />
      </div>

      <div className="vu-footrace-track">
        <div className="vu-footrace-posts" aria-hidden="true">
          {quarters.map((part) => (
            <span key={part} style={{ left: `${part * 100}%` }}>
              {part === 0 ? 'start' : part === 1 ? 'finish' : `${course.metres * part} m`}
            </span>
          ))}
        </div>
        {lanes.map((name, seat) => (
          <div key={seat} className="vu-footrace-lane" data-you={seat === 0 || undefined}>
            <span className="vu-footrace-name">{name}</span>
            <div className="vu-footrace-run">
              {quarters.slice(1, 4).map((part) => (
                <span key={part} className="vu-footrace-post" style={{ left: `${part * 100}%` }} />
              ))}
              <span ref={(el) => void (markers.current[seat] = el)} className="vu-footrace-runner">
                {seat + 1}
              </span>
            </div>
            <span ref={(el) => void (places.current[seat] = el)} className="vu-footrace-place" />
          </div>
        ))}
        {phase === 'ready' && !paused && (
          <div className="vu-footrace-card">
            <p className="vu-footrace-how">
              Stride by alternating left and right: the arrow keys, A and D, or the two buttons.
              Wait for GO. {paced(course) ? 'Hold your pace in the band and save something for the finish.' : 'Then flat out.'}
            </p>
            <motion.button
              type="button"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              {...gestures(false, lift, press)}
              onClick={begin}
            >
              Take your marks
            </motion.button>
          </div>
        )}
        {paused && !over && (
          <div className="vu-footrace-card" role="status">
            <p className="vu-footrace-paused">Paused</p>
            <p className="vu-footrace-how">The race waits while the window is away.</p>
          </div>
        )}
      </div>

      <div className="vu-footrace-foot" inert={over || undefined}>
        <motion.button
          type="button"
          tabIndex={-1}
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-footrace-foot-left"
          aria-label="Left foot"
          {...gestures(over, lift, press)}
          onPointerDown={(event) => {
            event.preventDefault()
            step('left')
          }}
        >
          ← Left
        </motion.button>
        <div className="vu-footrace-meters">
          <div className="vu-footrace-meter">
            <span className="vu-footrace-label">Pace</span>
            <div className="vu-footrace-rail">
              <span
                className="vu-footrace-band"
                style={{ left: `${course.band[0] * 100}%`, width: `${(course.band[1] - course.band[0]) * 100}%` }}
              />
              <span ref={pace} className="vu-footrace-needle" />
            </div>
          </div>
          <div className="vu-footrace-meter">
            <span className="vu-footrace-label">Stamina</span>
            <div className="vu-footrace-rail">
              <span ref={tank} className="vu-footrace-tank" />
            </div>
          </div>
          <p className="vu-footrace-note">
            <span ref={gone} />
            {held > 0 && !over ? ` · held until ${held.toFixed(1)} s on the clock` : ''}
          </p>
        </div>
        <motion.button
          type="button"
          tabIndex={-1}
          className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-footrace-foot-right"
          aria-label="Right foot"
          {...gestures(over, lift, press)}
          onPointerDown={(event) => {
            event.preventDefault()
            step('right')
          }}
        >
          Right →
        </motion.button>
      </div>
    </div>
  )
}
