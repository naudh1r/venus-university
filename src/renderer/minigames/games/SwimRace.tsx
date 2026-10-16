import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { listed } from '@shared/minigameKit'
import {
  CLEAN_STROKE,
  CYCLE_MS,
  FALSE_START_MS,
  LENGTH_M,
  PULL_LONG,
  PULL_MS,
  PULL_SHORT,
  SHARP_START_MS,
  SLOWEST_START_MS,
  TEMPO_RUSHED,
  TOUCH_OUT_MS,
  TURN_ZONE_M,
  breathe,
  callTurn,
  clockOf,
  courseWords,
  herReaction,
  legLabel,
  lengthOn,
  lengthsOf,
  limitOf,
  newRace,
  onBlocks,
  orderNow,
  outcomeOf,
  placesOf,
  raceAccount,
  raceProgress,
  raceSummary,
  runRace,
  stroke,
  swimming,
  timeOf,
  toWall,
  turnPlace,
  waterAt,
  type Race,
  type RaceEvent,
  type TurnGrade
} from '@shared/minigameRules/swimRace'
import { typingIn, useWindowKeydown } from '../kit'
import { gestures, lift, press, useReducedMotion } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/SwimRace.css'

/** How many times in a race anyone says something, by how talkative the table is to be. */
const REMARKS = { quiet: 0, some: 2, lots: 5 } as const

/**
 * The most of a frame the race is moved on by, in ms: a stalled frame does not leap. What a
 * frame gives is swum in the rules' own fixed steps, so nobody's time hangs on the frame rate.
 */
const FRAME_CAP_MS = 50
/** How long "take your marks" is held before the whistle, in ms: the least, and the spread. */
const MARKS_MS = 1200
const MARKS_SPREAD_MS = 1400
/** How much faster the water runs for the girls still swimming once the reader has touched. */
const AFTER_TOUCH = 3

const ORDINAL = ['1st', '2nd', '3rd', '4th']

const TURN_WORD: Readonly<Record<TurnGrade, string>> = {
  perfect: 'Perfect turn',
  good: 'Good turn',
  early: 'Turned too early',
  late: 'Into the wall'
}

type Phase = 'ready' | 'marks' | 'racing' | 'over'

/** What a lane's board shows of its swimmer. */
interface LaneBoard {
  length: number
  /** Her place in the water now, from 1. */
  place: number
  /** Her time once she has touched. */
  time: string | null
  /** The last thing worth a word in her lane: a turn, a gasp. */
  word: string
}

/** The race as it is being swum: read and written by the frame loop, never rendered from. */
interface Live {
  phase: Phase
  /** How long until the whistle, in ms. */
  marksMs: number
  /**
   * Everyone in the water, the reader first and then each girl in her seat's order, on the
   * race's own clock: it stands still while the window is away.
   */
  race: Race
  /** `performance.now()` at the frame the clock was last moved to. */
  frameAt: number
  paused: boolean
  /** The reader went before the whistle. */
  jumped: boolean
  /** When the pull being held began, and when the last one did, on the race's clock. */
  pullFrom: number | null
  lastPull: number | null
  /** Who turned first at each wall, as the account names them. */
  leaders: string[]
  /** The last touch, on the race's clock, and whose it was. */
  lastTouch: { ms: number; who: number } | null
  remarks: number
  speaking: boolean
  /** Whose turn it is to remark on something the reader did. */
  voice: number
  order: string
  finished: boolean
}

function Body(): JSX.Element {
  return (
    <svg viewBox="0 0 64 24" aria-hidden="true">
      <path className="vu-swimrace-wake" d="M2 8 12 12 2 16M8 4l8 8-8 8" />
      <ellipse cx="32" cy="12" rx="17" ry="5.5" />
      <circle cx="54" cy="12" r="6.5" />
      <path className="vu-swimrace-arm" d="M38 10 50 2 61 3" />
    </svg>
  )
}

/**
 * Swim Race: a freestyle race in lanes, alone against the clock or against up to three girls.
 * The reader strokes by holding and letting go, long and even on the rhythm guide; takes a
 * breath when he chooses, at a little speed; and calls his turn as he reaches each wall. Each
 * girl swims the same water on the same clock as her skill has it. The race runs off the clock
 * and waits on nothing said: the box hears the start, the order at the turns and the finish.
 */
export function SwimRace({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const lengths = lengthsOf(play.options.lengths)
  /** The pool or the sea: the same race, told in the words of where it is swum. */
  const water = waterAt(play.location)
  const sea = water === 'sea'
  const reduced = useReducedMotion()
  const turnWord = (grade: TurnGrade): string => (sea && grade === 'late' ? 'Wide of the mark' : TURN_WORD[grade])
  const names = ['You', ...girls.map((girl) => girl.name)]
  /** Each swimmer as the scene's writer is told of her. */
  const told = (index: number): string => (index === 0 ? 'the reader' : names[index])

  const [phase, setPhase] = useState<Phase>('ready')
  const [paused, setPaused] = useState(false)
  const [whistled, setWhistled] = useState(false)
  const [boards, setBoards] = useState<LaneBoard[]>(() =>
    names.map((_, index) => ({ length: 1, place: index + 1, time: null, word: '' }))
  )
  const [feel, setFeel] = useState({ word: '', count: 0 })

  const live = useRef<Live>({
    phase: 'ready',
    marksMs: 0,
    race: newRace(lengths, [], []),
    frameAt: 0,
    paused: false,
    jumped: false,
    pullFrom: null,
    lastPull: null,
    leaders: [],
    lastTouch: null,
    remarks: 0,
    speaking: false,
    voice: 0,
    order: '',
    finished: false
  })
  const mounted = useRef(true)
  const held = useRef(play)
  held.current = play
  const opened = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const lanes = useRef<(HTMLDivElement | null)[]>([])
  const clockText = useRef<HTMLSpanElement>(null)

  /** The race's clock at this instant, between frames included. */
  function raceNow(): number {
    const game = live.current
    const race = game.race
    if (game.paused || game.phase !== 'racing') return race.clock + race.owed
    return race.clock + race.owed + Math.min(FRAME_CAP_MS, Math.max(0, performance.now() - game.frameAt))
  }

  /** How the race stands, for anything said in the water. */
  function standing(): string {
    const game = live.current
    const who = listed(girls.map((girl) => girl.name))
    const stake = held.current.stake ? ` Riding on it: ${held.current.stake}` : ''
    const terms = `The game is a freestyle swimming race ${courseWords(lengths, water)} between the reader and ${who}, ${sea ? 'side by side in the sea' : 'each in a lane of their own'}.`
    if (game.phase === 'ready' || game.phase === 'marks') {
      return `${terms} They are at the edge of the water, about to dive in.${stake}`
    }
    const order = orderNow(game.race.swimmers)
      .map((index) => {
        const swimmer = game.race.swimmers[index]
        return swimmer.finishMs !== null
          ? `${told(index)} (finished in ${clockOf(swimmer.finishMs)})`
          : `${told(index)} (${sea ? `on leg ${legLabel(lengthOn(swimmer, lengths), lengths, water).toLowerCase()}` : `on length ${lengthOn(swimmer, lengths)}`})`
      })
      .join(', then ')
    return `${terms} They are mid-race, heads down in the water, with breath for a gasped word at most. In order: ${order}.${stake}`
  }

  /**
   * Has one girl say something about what just happened, and never holds the race for it. One
   * voice at a time, capped for the table, and nothing once everyone is home.
   */
  function remark(charId: string, cue: string): void {
    const game = live.current
    if (girls.length === 0 || game.finished || game.speaking || !mounted.current) return
    if (game.remarks >= REMARKS[held.current.chattiness]) return
    game.remarks++
    game.speaking = true
    held.current.situation(standing())
    void held.current
      .say(charId, cue)
      .catch(() => undefined)
      .finally(() => {
        game.speaking = false
      })
  }

  /** The girl who speaks about something a swimmer did: herself, or the next in turn for the reader. */
  function voiceFor(index: number): string {
    if (index > 0) return girls[index - 1].charId
    return girls[live.current.voice++ % girls.length].charId
  }

  function board(index: number, change: Partial<LaneBoard>): void {
    if (!mounted.current) return
    setBoards((now) => now.map((lane, at) => (at === index ? { ...lane, ...change } : lane)))
  }

  function felt(word: string): void {
    if (mounted.current) setFeel((now) => ({ word, count: now.count + 1 }))
  }

  /**
   * Takes the focus off whatever button has it: with one focused the keys would be that
   * button's, and Space would press it instead of pulling.
   */
  function unfocus(): void {
    const focused = document.activeElement
    if (focused instanceof HTMLElement && focused.tagName === 'BUTTON') focused.blur()
  }

  /** Onto the blocks: the first move, and the wait for the whistle. */
  function toMarks(): void {
    const game = live.current
    if (game.phase !== 'ready' || !mounted.current) return
    game.phase = 'marks'
    game.marksMs = MARKS_MS + Math.random() * MARKS_SPREAD_MS
    unfocus()
    held.current.started()
    setPhase('marks')
  }

  /** The stroke key or button going down: the marks, the dive, or the start of a pull. */
  function pullDown(): void {
    const game = live.current
    if (!mounted.current || game.paused) return
    if (game.phase === 'ready') {
      toMarks()
      return
    }
    if (game.phase === 'marks') {
      if (!game.jumped) {
        game.jumped = true
        felt('False start')
      }
      return
    }
    if (game.phase !== 'racing') return
    const me = game.race.swimmers[0]
    if (me.blockMs > 0) {
      // The dive: he leaves the blocks with the next frame, at the reaction he showed.
      if (!me.falseStart && me.reactionMs >= SLOWEST_START_MS) {
        me.reactionMs = Math.max(1, Math.round(raceNow()))
        me.blockMs = 1
      }
      return
    }
    if (swimming(me) && game.pullFrom === null) game.pullFrom = raceNow()
  }

  /** Letting go: the stroke is made, worth what its length and its tempo come to. */
  function pullUp(): void {
    const game = live.current
    if (!mounted.current || game.pullFrom === null) return
    const from = game.pullFrom
    game.pullFrom = null
    if (game.phase !== 'racing' || game.paused) return
    const me = game.race.swimmers[0]
    if (!swimming(me)) return
    const pullMs = Math.max(0, raceNow() - from)
    const cycleMs = game.lastPull === null ? null : from - game.lastPull
    game.lastPull = from
    const gasping = me.gaspMs > 0
    const { worth, emptied } = stroke(me, pullMs, cycleMs)
    if (emptied) {
      felt('Out of air!')
      board(0, { word: 'Gasping' })
      if (girls.length > 0) {
        remark(voiceFor(0), 'The reader has just run out of air mid-length and come up gasping, losing speed.')
      }
    } else if (gasping) felt('Gasping')
    else if (worth >= CLEAN_STROKE) felt('Smooth')
    else if (pullMs < PULL_MS * PULL_SHORT) felt('Too short')
    else if (cycleMs !== null && cycleMs < CYCLE_MS * TEMPO_RUSHED) felt('Rushed')
    else if (pullMs > PULL_MS * PULL_LONG) felt('Too long')
    else felt('Heavy')
  }

  function takeBreath(): void {
    const game = live.current
    if (!mounted.current || game.phase !== 'racing' || game.paused) return
    if (breathe(game.race.swimmers[0])) felt('Breath')
  }

  function turnNow(): void {
    const game = live.current
    if (!mounted.current || game.phase !== 'racing' || game.paused) return
    const grade = callTurn(game.race.swimmers[0], lengths)
    if (grade) felt(grade === 'early' ? 'Too early' : grade === 'perfect' ? 'Perfect!' : 'Good')
  }

  useWindowKeydown((event) => {
    // A key typed to her is a character, never a stroke.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const target = event.target
    if (target instanceof HTMLElement && target.isContentEditable) return
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    if (target instanceof HTMLElement && target.tagName === 'BUTTON') {
      // Space on a focused button is that button's until the race is on; from the marks on
      // every swim key is the race's, and the button gives the focus up before it can be pressed.
      const on = live.current.phase === 'marks' || live.current.phase === 'racing'
      if (key === ' ' && !on) return
      if ([' ', 'j', 'w', 's', 'ArrowUp', 'ArrowDown'].includes(key)) target.blur()
    }
    if (key === ' ' || key === 'j') {
      event.preventDefault()
      if (!event.repeat) pullDown()
    } else if (key === 'ArrowUp' || key === 'w') {
      event.preventDefault()
      if (!event.repeat) takeBreath()
    } else if (key === 'ArrowDown' || key === 's') {
      event.preventDefault()
      if (!event.repeat) turnNow()
    }
  })
  const release = useRef(pullUp)
  release.current = pullUp

  // A race agreed with someone is under way as the table opens: the box says so, once.
  useEffect(() => {
    if (opened.current || girls.length === 0) return
    opened.current = true
    play.narrate(
      `You and ${listed(girls.map((girl) => girl.name))} line up at the edge of the water: ${sea ? `${courseWords(lengths, water)}, first home` : `${lengths} lengths, first to touch`}.`
    )
    play.situation(standing())
    // Once, as the table opens.
  }, [])

  // The race itself: every frame moves the clock on and brings the water up to it.
  useEffect(() => {
    mounted.current = true
    const game = live.current
    let frame = 0
    game.frameAt = performance.now()

    const whistle = (): void => {
      game.phase = 'racing'
      game.race = newRace(
        lengths,
        [
          game.jumped ? onBlocks(FALSE_START_MS, true) : onBlocks(SLOWEST_START_MS),
          ...girls.map((girl) => onBlocks(herReaction(girl.skill)))
        ],
        [null, ...girls.map((girl) => girl.skill)]
      )
      setWhistled(true)
      setPhase('racing')
    }

    const everyone = (): { name: string; swimmer: Race['swimmers'][number] }[] =>
      game.race.swimmers.map((swimmer, index) => ({ name: names[index], swimmer }))

    /** The race so far, kept with the scene in case it is walked away from. */
    const keep = (clock: number): void => held.current.progress(raceProgress(everyone(), lengths, clock, water))

    const end = (): void => {
      game.finished = true
      game.phase = 'over'
      game.pullFrom = null
      const all = everyone()
      const times = game.race.swimmers.map((swimmer) => swimmer.finishMs ?? Infinity)
      // Time was called on whoever is still out.
      game.race.swimmers.forEach((swimmer, index) => {
        if (swimmer.finishMs === null) board(index, { time: 'DNF', word: '' })
      })
      if (girls.length > 0) held.current.situation(standing())
      setPhase('over')
      held.current.finish({
        outcome: girls.length === 0 ? 'played' : outcomeOf(times),
        summary: raceSummary(all, lengths, water),
        account: raceAccount(all, lengths, game.leaders, water)
      })
    }

    /** What a step of the race brought about for one swimmer, told. */
    const tell = (index: number, event: RaceEvent, clock: number): void => {
      const swimmer = game.race.swimmers[index]
      if (event.kind === 'gasp') {
        board(index, { word: 'Gasping' })
        if (game.race.swimmers[0].finishMs === null) {
          remark(girls[index - 1].charId, `${names[index]} has just run out of air mid-length and come up gasping, losing speed.`)
        }
      } else if (event.kind === 'dive') {
        if (index !== 0) return
        // His start stays on his lane until his first turn takes its place.
        board(0, { word: swimmer.falseStart ? 'Called back' : `Dive ${timeOf(swimmer.reactionMs)}` })
        held.current.narrate(
          swimmer.falseStart
            ? 'You go before the whistle and are called back; by the time you dive the water ahead is already churning.'
            : swimmer.reactionMs <= SHARP_START_MS
              ? `The whistle, and you are ${sea ? 'in and away' : 'off the blocks'} at once: ${timeOf(swimmer.reactionMs)}.`
              : `The whistle. You dive ${timeOf(swimmer.reactionMs)} after it.`
        )
        if (girls.length > 0) held.current.situation(standing())
        keep(clock)
      } else if (event.kind === 'turn') {
        if (game.leaders[event.length - 1] === undefined) game.leaders[event.length - 1] = told(index)
        board(index, { length: event.length + 1, word: turnWord(event.grade) })
        keep(clock)
        if (index === 0) {
          // A pull held into the wall begins again as he comes off it, the wall's hold served.
          if (game.pullFrom !== null) game.pullFrom = clock + swimmer.wallMs
          game.lastPull = null
          felt(turnWord(event.grade))
          // The order at the turn, on a race long enough to have a middle.
          if (lengths >= 4) {
            if (girls.length === 0) {
              if (event.length * 2 === lengths) held.current.narrate(`Halfway, in ${timeOf(clock)}.`)
            } else {
              const order = orderNow(game.race.swimmers).map((at) => (at === 0 ? 'you' : names[at]))
              held.current.narrate(
                `${sea ? (event.length % 2 ? 'Round the buoy' : 'Off the shore again') : `Turn ${event.length} of ${lengths - 1}`}: ${order[0]} in front, then ${listed(order.slice(1))}.`
              )
            }
          }
        }
        if (girls.length === 0) return
        held.current.situation(standing())
        // Once he has touched the rest come home at speed: nothing said then would be in step.
        if (game.race.swimmers[0].finishMs !== null) return
        // A turn is worth a word only at a talkative table: a quieter one keeps its few for
        // someone out of air and for a touch-out.
        if (held.current.chattiness !== 'lots') return
        const whose = index === 0 ? "The reader's" : `${names[index]}'s`
        const at = sea ? `at ${turnPlace(event.length, water)}` : `at the end of length ${event.length}`
        if (event.grade === 'perfect') {
          remark(voiceFor(index), `${whose} turn ${at} was perfectly timed: ${sea ? 'tight round and away at full stretch' : 'a tumble and a hard push off the wall'}.`)
        } else if (event.grade === 'late') {
          remark(voiceFor(index), `${whose} turn ${at} was botched: ${sea ? 'swung wide and almost stopped' : 'straight into the wall'}, and a scramble to get going again.`)
        }
      } else {
        const ms = swimmer.finishMs ?? clock
        board(index, { length: lengths, time: clockOf(ms), word: '' })
        if (index === 0) game.pullFrom = null
        const before = game.lastTouch
        game.lastTouch = { ms, who: index }
        const stillOut = game.race.swimmers.some((other) => other.finishMs === null)
        if (stillOut) keep(clock)
        if (index === 0 && stillOut) held.current.narrate(`You touch in ${timeOf(ms)}.`)
        // A touch-out is worth a word only while someone is still swimming: the last touch
        // is the result's to tell.
        if (stillOut && before && ms - before.ms < TOUCH_OUT_MS && girls.length > 0) {
          remark(
            voiceFor(index),
            `${index === 0 ? 'The reader' : names[index]} has just finished ${timeOf(ms - before.ms)} behind ${told(before.who)}: ${sea ? 'beaten home by a stroke' : 'touched out at the wall'}.`
          )
        }
      }
    }

    const draw = (): void => {
      const me = game.race.swimmers[0]
      game.race.swimmers.forEach((swimmer, index) => {
        const lane = lanes.current[index]
        if (!lane) return
        const at = Math.min(lengths - 1, Math.floor(swimmer.dist / LENGTH_M + 1e-9))
        const along = Math.min(1, (swimmer.dist - at * LENGTH_M) / LENGTH_M)
        const back = at % 2 === 1
        lane.style.setProperty('--at', (back ? 1 - along : along).toFixed(4))
        lane.style.setProperty('--face', swimmer.finishMs !== null ? (lengths % 2 ? '1' : '-1') : back ? '-1' : '1')
      })
      const place = root.current
      if (place && me) {
        const since = game.pullFrom ?? game.lastPull
        const clock = game.race.clock
        const beat = since === null ? (clock % CYCLE_MS) / CYCLE_MS : Math.min(1, Math.max(0, clock - since) / CYCLE_MS)
        place.style.setProperty('--air', me.air.toFixed(3))
        place.style.setProperty('--beat', beat.toFixed(3))
        const flag = (name: string, on: boolean): void => {
          if ((place.dataset[name] !== undefined) !== on) {
            if (on) place.dataset[name] = ''
            else delete place.dataset[name]
          }
        }
        flag('pulling', game.pullFrom !== null)
        flag('gasping', me.gaspMs > 0)
        flag('low', me.air < 0.25 && me.gaspMs <= 0)
        flag('turn', swimming(me) && me.called === null && lengthOn(me, lengths) < lengths && toWall(me) <= TURN_ZONE_M)
      }
      if (clockText.current && me) clockText.current.textContent = clockOf(me.finishMs ?? game.race.clock)
      const order = orderNow(game.race.swimmers)
      const key = order.join('')
      if (key !== game.order) {
        game.order = key
        setBoards((now) => now.map((lane, index) => ({ ...lane, place: order.indexOf(index) + 1 })))
      }
    }

    const loop = (): void => {
      if (!mounted.current || game.finished) return
      frame = requestAnimationFrame(loop)
      const now = performance.now()
      const dt = Math.min(FRAME_CAP_MS, Math.max(0, now - game.frameAt))
      game.frameAt = now
      // Away: the clock stands, and so does everything read off it.
      if (game.paused || dt === 0) return
      if (game.phase === 'marks') {
        game.marksMs -= dt
        if (game.marksMs <= 0) whistle()
        return
      }
      if (game.phase !== 'racing') return
      // Once he has touched there is nothing to play: the rest come home quickly.
      runRace(game.race, dt * (game.race.swimmers[0].finishMs !== null ? AFTER_TOUCH : 1), Math.random, tell)
      draw()
      // Everyone home, or time called on whoever is not.
      if (game.race.over) {
        cancelAnimationFrame(frame)
        end()
      }
    }

    // A window hidden or out of focus draws no frames and hears no keys: the race stops for it
    // and picks up where it stood, a pull that was being held let go of.
    const stop = (): void => {
      if (game.finished || game.paused) return
      game.paused = true
      game.pullFrom = null
      setPaused(true)
    }
    const resume = (): void => {
      if (game.finished || !game.paused) return
      if (document.hidden || !document.hasFocus()) return
      game.paused = false
      game.frameAt = performance.now()
      // Back from away on the marks: the wait begins again, so the whistle never comes unannounced.
      if (game.phase === 'marks') game.marksMs = MARKS_MS + Math.random() * MARKS_SPREAD_MS
      setPaused(false)
    }
    const seen = (): void => (document.hidden ? stop() : resume())
    const keyUp = (event: KeyboardEvent): void => {
      if (event.key === ' ' || event.key.toLowerCase() === 'j') release.current()
    }
    document.addEventListener('visibilitychange', seen)
    window.addEventListener('blur', stop)
    window.addEventListener('focus', resume)
    window.addEventListener('keyup', keyUp)
    if (document.hidden || !document.hasFocus()) stop()

    if (!game.finished) frame = requestAnimationFrame(loop)
    return () => {
      mounted.current = false
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', seen)
      window.removeEventListener('blur', stop)
      window.removeEventListener('focus', resume)
      window.removeEventListener('keyup', keyUp)
    }
    // The loop is set up once and reads everything else through refs.
  }, [])

  const over = phase === 'over'
  const racing = phase === 'racing'
  const finalPlaces = over
    ? placesOf(live.current.race.swimmers.map((swimmer) => swimmer.finishMs ?? Infinity))
    : null
  const timedOut = over && live.current.race.swimmers.some((swimmer) => swimmer.finishMs === null)
  // How it came out for the reader, in the starter's place: time called on him, or his place.
  const result = !finalPlaces
    ? ''
    : live.current.race.swimmers[0].finishMs === null
      ? 'Time!'
      : names.length === 1
        ? timedOut
          ? 'Time!'
          : 'Finished'
        : finalPlaces[0] !== 1
          ? `You come ${ORDINAL[finalPlaces[0] - 1]}`
          : finalPlaces.filter((place) => place === 1).length > 1
            ? 'Dead heat'
            : 'You win'
  const zone = `${((TURN_ZONE_M / LENGTH_M) * 100).toFixed(1)}%`

  return (
    <div
      ref={root}
      className="vu-swimrace"
      data-phase={phase}
      data-paused={paused || undefined}
      style={{ ['--zone' as string]: zone }}
    >
      <div className="vu-swimrace-head">
        <span className="vu-swimrace-distance">
          {sea ? `${lengths > 2 ? `${lengths / 2}× ` : ''}to the buoy and back` : `${lengths} lengths`} ·{' '}
          {lengths * LENGTH_M} m
        </span>
        <span ref={clockText} className="vu-swimrace-clock">
          0.00
        </span>
        <span className="vu-swimrace-call" role="status">
          {phase === 'marks' ? 'Take your marks…' : racing && whistled ? 'Go!' : over ? result : ' '}
        </span>
      </div>

      <div className="vu-swimrace-water">
        {names.map((name, index) => {
          const lane = boards[index]
          const place = finalPlaces ? finalPlaces[index] : lane.place
          return (
            <div
              key={index}
              ref={(el) => void (lanes.current[index] = el)}
              className="vu-swimrace-lane"
              data-mine={index === 0 || undefined}
            >
              <span className="vu-swimrace-name">{name}</span>
              <div className="vu-swimrace-track">
                <span className="vu-swimrace-zone vu-swimrace-zone--near" aria-hidden="true" />
                <span className="vu-swimrace-zone vu-swimrace-zone--far" aria-hidden="true" />
                <span className="vu-swimrace-swimmer" aria-hidden="true">
                  <Body />
                </span>
              </div>
              <span className="vu-swimrace-tally">
                <span className="vu-swimrace-place">{names.length > 1 && whistled ? ORDINAL[place - 1] : ' '}</span>
                <span className="vu-swimrace-length">{lane.time ?? legLabel(lane.length, lengths, water)}</span>
                <span className="vu-swimrace-word">{lane.time ? ' ' : lane.word || ' '}</span>
              </span>
            </div>
          )
        })}

        {phase === 'ready' && (
          <div className="vu-swimrace-over">
            <p className="vu-swimrace-how">
              Hold <kbd>Space</kbd> for each stroke: let go as the marker crosses from pull to
              glide, press again as it reaches the end. <kbd>W</kbd> breathes before your air runs
              out. <kbd>S</kbd> turns, just as you reach {sea ? 'the buoy or the shore' : 'the wall'}.
              Dive on the whistle with <kbd>Space</kbd>, not before. Time is called at{' '}
              {timeOf(limitOf(lengths))}.
            </p>
            <motion.button
              type="button"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              {...gestures(false, lift, press)}
              onClick={toMarks}
            >
              Take your marks
            </motion.button>
          </div>
        )}
        {paused && !over && phase !== 'ready' && (
          <div className="vu-swimrace-over" role="status">
            <p className="vu-swimrace-paused">Paused</p>
            <p className="vu-swimrace-how">The race waits while the window is away.</p>
          </div>
        )}
      </div>

      <div className="vu-swimrace-deck" inert={!racing || undefined} data-waiting={!racing || undefined}>
        <div className="vu-swimrace-gauge">
          <span className="vu-swimrace-label vu-swimrace-label--air">Air</span>
          <div className="vu-swimrace-air" role="meter" aria-label="Air" aria-valuemin={0} aria-valuemax={100}>
            <span className="vu-swimrace-airfill" />
          </div>
        </div>
        <div className="vu-swimrace-gauge">
          <span className="vu-swimrace-label">Stroke</span>
          <div className="vu-swimrace-rhythm" aria-hidden="true">
            <span className="vu-swimrace-half vu-swimrace-half--pull">pull</span>
            <span className="vu-swimrace-half">glide</span>
            <span className="vu-swimrace-beat" />
          </div>
        </div>
        {/* Keyed on the count, so each stroke's word lands as a new one. */}
        <motion.span
          key={feel.count}
          className="vu-swimrace-feel"
          role="status"
          initial={reduced ? false : { scale: 1.3 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {feel.word || ' '}
        </motion.span>
        <div className="vu-swimrace-keys">
          <button
            type="button"
            tabIndex={-1}
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-swimrace-key vu-swimrace-key--stroke"
            onPointerDown={(event) => {
              event.preventDefault()
              pullDown()
            }}
            onPointerUp={pullUp}
            onPointerLeave={pullUp}
            onPointerCancel={pullUp}
            onContextMenu={(event) => event.preventDefault()}
          >
            Stroke
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-swimrace-key vu-swimrace-key--breath"
            onPointerDown={(event) => {
              event.preventDefault()
              takeBreath()
            }}
          >
            Breathe
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-swimrace-key vu-swimrace-key--turn"
            onPointerDown={(event) => {
              event.preventDefault()
              turnNow()
            }}
          >
            Turn
          </button>
        </div>
      </div>
    </div>
  )
}
