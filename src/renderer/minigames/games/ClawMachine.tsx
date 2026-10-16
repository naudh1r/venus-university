import { useEffect, useRef, useState, type JSX, type PointerEvent as ReactPointerEvent } from 'react'
import { motion } from 'motion/react'
import {
  COUNTDOWN_MS,
  DEPTH,
  HOME,
  LIMIT,
  WIDTH,
  accountOf,
  carryPoint,
  choicesOf,
  cueOf,
  goShown,
  goTold,
  layPile,
  outcomeOf,
  pickAsk,
  pickToy,
  pinnedBy,
  standingTold,
  stopOf,
  summaryOf,
  takeGo,
  tierOf,
  wonIn,
  type Go,
  type Tier,
  type Toy
} from '@shared/minigameRules/clawMachine'
import { seededRand } from '@shared/minigameKit'
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
import '../../vu_styles/ClawMachine.css'

/** How many times in a game she says something for herself: there are five goes at most. */
const REMARKS = { quiet: 0, some: 2, lots: 4 } as const
/** The longest her line is waited on before another may be asked for. */
const SAY_CAP_MS = 3000
/** The longest the first go waits on her saying which toy she wants. */
const PICK_CAP_MS = 12000

/** The claw's drop, in ms: down, closing, the trip back with what it holds, and letting go. */
const DOWN_MS = 650
const CLOSE_MS = 260
const CARRY_MS = 1700
const LET_MS = 380
/** How long a toy that slips takes to fall back onto the pile. */
const FALL_MS = 280
/**
 * How long the last go stands on the machine before the table is cleared, where the box does not
 * tell it: the result is read off the front and the count, and wants a moment.
 */
const LAST_GO_MS = 1800
/** The longest step of the clock a frame may take, so a stalled frame is not a jump. */
const FRAME_CAP_MS = 50
/** How much quicker the drop is shown to a reader who asked for less motion. */
const BRISK = 5

/** The cabinet from the front, as it is drawn: deeper is higher up the floor and smaller. */
const FRONT = { width: WIDTH, height: 72, floor: 66 } as const
const floorY = (z: number): number => FRONT.floor - z * 0.3
const scaleAt = (z: number): number => 1 - (0.3 * z) / DEPTH
const railY = (z: number): number => 9 - z * 0.08
/** How far under the claw's hub a toy hangs, and how low a toy's middle lies off the floor. */
const HANG = 6
const LIE = 0.85
const restY = (toy: Toy, z: number): number => floorY(z) - toy.size * scaleAt(z) * LIE
const mix = (from: number, to: number, share: number): number => from + (to - from) * share

/** How many dots a toy is marked with, by how easily the claw holds it: the legend says so in words. */
const PIPS: Record<Tier, number> = { easy: 3, fair: 2, hard: 1 }

type Axis = 'x' | 'z'
/**
 * Where a go has got to: she is choosing, what was last said is still being reached, the claw
 * waits to be run across, runs, waits to be run back, runs, drops by itself, and after the last
 * go the game is over.
 */
type Phase = 'picking' | 'reading' | 'ready-x' | 'moving-x' | 'ready-z' | 'moving-z' | 'drop' | 'over'

/** The game as it stands between renders: the loop reads and writes it every frame. */
interface Live {
  rand: () => number
  pile: Toy[]
  wanted: Toy | null
  goes: Go[]
  phase: Phase
  /** How long each way has been held this go, in ms: the claw is where that puts it. */
  msX: number
  msZ: number
  /** What is left of the go's countdown. */
  left: number
  /** The way being held now. */
  held: Axis | null
  /** The go being shown, settled as the claw dropped, and how far into showing it. */
  go: Go | null
  t: number
}

const axisOf = (event: KeyboardEvent): Axis | null => {
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  return key === 'ArrowRight' || key === 'd' ? 'x' : key === 'ArrowUp' || key === 'w' ? 'z' : null
}

/** A plush toy, drawn in a box one unit either way from its middle. */
function ToyShape({ id }: { id: string }): JSX.Element {
  switch (id) {
    case 'duckling':
      return (
        <>
          <ellipse className="vu-claw-fur" cx="-0.1" cy="0.3" rx="0.85" ry="0.62" />
          <circle className="vu-claw-fur" cx="0.42" cy="-0.42" r="0.44" />
          <path className="vu-claw-trim" d="M 0.8 -0.5 L 1.2 -0.36 L 0.8 -0.24 Z" />
          <circle className="vu-claw-dot" cx="0.5" cy="-0.5" r="0.07" />
        </>
      )
    case 'mushroom':
      return (
        <>
          <rect className="vu-claw-fur" x="-0.32" y="-0.05" width="0.64" height="0.95" rx="0.22" />
          <path className="vu-claw-trim" d="M -0.95 0.05 A 0.95 0.9 0 0 1 0.95 0.05 Z" />
          <circle className="vu-claw-spot" cx="-0.4" cy="-0.35" r="0.14" />
          <circle className="vu-claw-spot" cx="0.3" cy="-0.5" r="0.17" />
        </>
      )
    case 'strawberry':
      return (
        <>
          <path className="vu-claw-fur" d="M -0.8 -0.4 Q -0.85 0.5 0 0.95 Q 0.85 0.5 0.8 -0.4 Q 0 -0.8 -0.8 -0.4 Z" />
          <path className="vu-claw-trim" d="M -0.5 -0.55 L 0 -0.95 L 0.5 -0.55 L 0 -0.3 Z" />
          <circle className="vu-claw-dot" cx="-0.3" cy="0.05" r="0.06" />
          <circle className="vu-claw-dot" cx="0.3" cy="0.05" r="0.06" />
          <circle className="vu-claw-dot" cx="0" cy="0.45" r="0.06" />
        </>
      )
    case 'frog':
      return (
        <>
          <ellipse className="vu-claw-fur" cx="0" cy="0.25" rx="0.95" ry="0.62" />
          <circle className="vu-claw-fur" cx="-0.45" cy="-0.42" r="0.3" />
          <circle className="vu-claw-fur" cx="0.45" cy="-0.42" r="0.3" />
          <circle className="vu-claw-dot" cx="-0.45" cy="-0.42" r="0.1" />
          <circle className="vu-claw-dot" cx="0.45" cy="-0.42" r="0.1" />
          <path className="vu-claw-line" d="M -0.5 0.3 Q 0 0.6 0.5 0.3" />
        </>
      )
    case 'star':
      return (
        <path
          className="vu-claw-trim"
          d="M 0 -1 L 0.27 -0.33 L 0.95 -0.31 L 0.42 0.13 L 0.59 0.81 L 0 0.44 L -0.59 0.81 L -0.42 0.13 L -0.95 -0.31 L -0.27 -0.33 Z"
        />
      )
    case 'penguin':
      return (
        <>
          <ellipse className="vu-claw-dark" cx="0" cy="0.05" rx="0.68" ry="0.95" />
          <ellipse className="vu-claw-fur" cx="0" cy="0.25" rx="0.42" ry="0.66" />
          <path className="vu-claw-trim" d="M -0.14 -0.42 L 0.14 -0.42 L 0 -0.2 Z" />
        </>
      )
    case 'bunny':
      return (
        <>
          <ellipse className="vu-claw-fur" cx="-0.3" cy="-0.5" rx="0.17" ry="0.5" />
          <ellipse className="vu-claw-fur" cx="0.3" cy="-0.5" rx="0.17" ry="0.5" />
          <circle className="vu-claw-fur" cx="0" cy="0.3" r="0.66" />
          <circle className="vu-claw-dot" cx="-0.24" cy="0.2" r="0.07" />
          <circle className="vu-claw-dot" cx="0.24" cy="0.2" r="0.07" />
          <circle className="vu-claw-spot" cx="0" cy="0.42" r="0.09" />
        </>
      )
    case 'cat':
      return (
        <>
          <path className="vu-claw-fur" d="M -0.72 -0.1 L -0.66 -0.9 L -0.15 -0.5 Z" />
          <path className="vu-claw-fur" d="M 0.72 -0.1 L 0.66 -0.9 L 0.15 -0.5 Z" />
          <ellipse className="vu-claw-fur" cx="0" cy="0.2" rx="0.8" ry="0.68" />
          <path className="vu-claw-line" d="M -0.95 0.2 L -0.4 0.3 M 0.95 0.2 L 0.4 0.3" />
          <circle className="vu-claw-dot" cx="-0.28" cy="0.05" r="0.07" />
          <circle className="vu-claw-dot" cx="0.28" cy="0.05" r="0.07" />
        </>
      )
    case 'moon':
      return <path className="vu-claw-fur" d="M 0.35 -0.95 A 0.98 0.98 0 1 0 0.35 0.95 A 0.72 0.8 0 1 1 0.35 -0.95 Z" />
    case 'octopus':
      return (
        <>
          <path className="vu-claw-fur" d="M -0.8 0.25 A 0.8 0.85 0 0 1 0.8 0.25 Z" />
          {[-0.6, -0.2, 0.2, 0.6].map((x) => (
            <circle key={x} className="vu-claw-fur" cx={x} cy="0.5" r="0.24" />
          ))}
          <circle className="vu-claw-dot" cx="-0.25" cy="-0.1" r="0.08" />
          <circle className="vu-claw-dot" cx="0.25" cy="-0.1" r="0.08" />
        </>
      )
    case 'bear':
      return (
        <>
          <circle className="vu-claw-fur" cx="-0.62" cy="-0.6" r="0.28" />
          <circle className="vu-claw-fur" cx="0.62" cy="-0.6" r="0.28" />
          <circle className="vu-claw-fur" cx="0" cy="0.08" r="0.86" />
          <ellipse className="vu-claw-spot" cx="0" cy="0.34" rx="0.34" ry="0.26" />
          <circle className="vu-claw-dot" cx="-0.3" cy="-0.12" r="0.07" />
          <circle className="vu-claw-dot" cx="0.3" cy="-0.12" r="0.07" />
          <circle className="vu-claw-dot" cx="0" cy="0.26" r="0.08" />
        </>
      )
    default:
      // The whale: a long body, a fluke, a spout.
      return (
        <>
          <path className="vu-claw-fur" d="M 0.55 0.2 L 1 -0.3 L 0.98 0.55 Z" />
          <ellipse className="vu-claw-fur" cx="-0.15" cy="0.3" rx="0.85" ry="0.55" />
          <path className="vu-claw-line" d="M -0.4 -0.3 Q -0.6 -0.8 -0.85 -0.7 M -0.4 -0.3 Q -0.3 -0.85 -0.05 -0.8" />
          <circle className="vu-claw-dot" cx="-0.6" cy="0.2" r="0.07" />
        </>
      )
  }
}

/** A toy with what marks it: the ring and heart on the one she wants, the hatch on one held down. */
function ToyMarks({ wanted }: { wanted: boolean }): JSX.Element | null {
  if (!wanted) return null
  return (
    <>
      <circle className="vu-claw-want" cx="0" cy="0" r="1.25" />
      <path className="vu-claw-heart" d="M 0 -1.2 C -0.55 -1.55 -0.32 -1.95 0 -1.68 C 0.32 -1.95 0.55 -1.55 0 -1.2 Z" />
    </>
  )
}

/**
 * Claw Machine: a glass cabinet from the front, a pile of plush toys on its floor, a claw on a
 * gantry, and a small view from above so that depth can be read. A go is two holds, each on a
 * key or a button: across, then back into the cabinet; then the claw drops by itself and the
 * rules say what it closes on and whether it holds. It is the reader's game: a girl with him
 * says which toy she wants before the first go, is shown her toy marked, and has a word at the
 * moments worth one. How each go came out is written on the machine's front until the next;
 * the scene's dialogue box tells it too where the play-by-play is on.
 */
export function ClawMachine({ play }: { play: GamePlay }): JSX.Element {
  const her = play.opponents[0]
  const tries = play.options.tries ?? 3
  const [live] = useState<Live>(() => {
    const rand = seededRand(`claw-${Math.random()}`)
    return {
      rand,
      pile: layPile(rand),
      wanted: null,
      goes: [],
      phase: play.opponents.length > 0 ? 'picking' : 'ready-x',
      msX: 0,
      msZ: 0,
      left: COUNTDOWN_MS,
      held: null,
      go: null,
      t: 0
    }
  })
  const [phase, setPhase] = useState<Phase>(live.phase)
  const [budget] = useState(() => remarkBudget(play.chattiness, REMARKS))
  const onTable = useOnTable()
  const away = useAway()
  const reduced = useReducedMotion()
  // The loop outlives a render: it reads the table, and whether to run, through these.
  const latest = useRef(play)
  latest.current = play
  const awayNow = useRef(away)
  awayNow.current = away
  const briskNow = useRef(false)
  briskNow.current = reduced === true
  // The terms are said once and the result handed over once, whatever is run twice.
  const opened = useRef(false)
  const begun = useRef(false)
  const finished = useRef(false)
  // A remark is being written: another is not asked for until it is in, or has been given up on.
  const saying = useRef(false)

  // What the loop writes to, between renders.
  const clawFront = useRef<SVGGElement>(null)
  const cable = useRef<SVGLineElement>(null)
  const rail = useRef<SVGLineElement>(null)
  const shadow = useRef<SVGEllipseElement>(null)
  const clawTop = useRef<SVGGElement>(null)
  const heldFront = useRef<SVGGElement>(null)
  const heldTop = useRef<SVGGElement>(null)
  const clockFill = useRef<HTMLSpanElement>(null)

  function to(next: Phase): void {
    live.phase = next
    setPhase(next)
  }

  /**
   * The reader takes hold of one way: across first, then back, each once a go. Says whether a
   * go was begun by it.
   */
  function hold(axis: Axis): boolean {
    if (awayNow.current || finished.current) return false
    if (axis === 'x' && live.phase === 'ready-x') {
      if (!begun.current) {
        begun.current = true
        play.started()
      }
      live.held = 'x'
      to('moving-x')
      return true
    }
    if (axis === 'z' && live.phase === 'ready-z') {
      live.held = 'z'
      to('moving-z')
    }
    return false
  }

  /** He lets go: across is settled, or the claw drops. */
  function letGo(axis: Axis): void {
    if (live.held !== axis) return
    live.held = null
    if (live.phase === 'moving-x') to('ready-z')
    else if (live.phase === 'moving-z') drop()
  }

  /** The claw drops where it is: what it does is settled now and shown on the way. */
  function drop(): void {
    if (live.phase !== 'moving-x' && live.phase !== 'ready-z' && live.phase !== 'moving-z') return
    live.held = null
    live.go = takeGo(live.pile, stopOf(live.msX, live.msZ), live.rand)
    live.t = 0
    to('drop')
  }

  /** Has her say something about the go just had, unless she is still on the last thing. */
  function remark(cue: string): void {
    if (!her || saying.current || !budget.take()) return
    saying.current = true
    void sayCapped(latest.current, her.charId, cue, SAY_CAP_MS).then(() => {
      saying.current = false
    })
  }

  /** The claw is back over the chute: the go is counted and told, and the next one is his. */
  function land(): void {
    const go = live.go
    if (!go || finished.current || !onTable()) return
    live.pile = go.pile
    live.goes = [...live.goes, go]
    live.go = null
    live.msX = 0
    live.msZ = 0
    live.left = COUNTDOWN_MS
    const name = her?.name ?? null
    const left = tries - live.goes.length
    const told = play.narrate(goTold(go, live.wanted?.id ?? null))
    if (left > 0) {
      play.progress(accountOf(name, live.wanted, live.goes, tries))
      if (her) {
        // A catch, a slip, a near miss, and the last go coming; talkative, any go at all.
        const cue = cueOf(go, her.name, live.wanted, live.goes, left)
        if (cue.notable || left === 1 || play.chattiness === 'lots') remark(cue.text)
      }
      if (!play.stepped) {
        to('ready-x')
        return
      }
      // At his own pace the next go is not his until how this one went is on the box: taking
      // hold of the stick is then him moving on from it, and the countdown runs on nothing unread.
      to('reading')
      void told
        .catch(() => undefined)
        .then(() => {
          if (live.phase === 'reading' && !finished.current && onTable()) to('ready-x')
        })
      return
    }
    finished.current = true
    to('over')
    const result = {
      outcome: outcomeOf(live.goes, her ? (live.wanted?.id ?? '') : null),
      summary: summaryOf(name, live.wanted, live.goes, tries),
      account: accountOf(name, live.wanted, live.goes, tries)
    }
    // Told on the box, the last go has its time there; otherwise it stands on the front a moment.
    if (play.playByPlay) {
      play.finish(result)
      return
    }
    play.progress(result.account)
    setTimeout(() => {
      if (onTable()) latest.current.finish(result)
    }, LAST_GO_MS)
  }

  /** Which toy she wants is settled, by her or for her, and the first go is his. */
  function settlePick(got: Record<string, string> | null): void {
    if (live.phase !== 'picking' || !her || !onTable()) return
    // A toy held down is not hers to want in a game too short to free it.
    const named = got ? choicesOf(live.pile, tries).find((toy) => toy.name === got.toy) : undefined
    const wanted = named ?? pickToy(live.pile, live.rand, tries)
    live.wanted = wanted
    let told: Promise<void>
    if (named && got?.line) {
      void Promise.resolve()
        .then(() => play.speak(her.charId, got.line))
        .catch(() => undefined)
      told = play.narrate(`She means the ${wanted.name}: it is the one marked behind the glass. The first go is yours.`)
    } else {
      told = play.narrate(`${her.name} taps the glass over the ${wanted.name}: that is the one she has her eye on. The first go is yours.`)
    }
    // The first go is his once that line is on the box, which is after what she said: timed, her
    // line has had its time by then; at his own pace, he has stepped past it.
    to('reading')
    void Promise.resolve(told)
      .catch(() => undefined)
      .then(() => {
        if (live.phase === 'reading' && !finished.current && onTable()) to('ready-x')
      })
  }

  // With her beside him the game is on as the table opens, and she is asked which toy she wants.
  useEffect(() => {
    if (opened.current || !her) return
    opened.current = true
    begun.current = true
    play.situation(standingTold(her.name, null, [], tries))
    play.narrate(
      `You feed the claw machine for ${tries} ${tries === 1 ? 'go' : 'goes'} while ${her.name} looks over the toys behind the glass.`
    )
    const asked = pickAsk(her.name, live.pile, tries)
    void Promise.resolve()
      .then(() =>
        play.round({
          brief: asked.brief,
          fields: { toy: asked.names, line: 'text' }
        })
      )
      .then(
        (got) => pick.current(got),
        () => pick.current(null)
      )
    // Once, as the table opens.
  }, [])

  // She is given only so long to choose before a toy is chosen for her.
  useEffect(() => {
    if (phase !== 'picking') return
    const timer = setTimeout(() => pick.current(null), PICK_CAP_MS)
    return () => clearTimeout(timer)
  }, [phase])

  // How the game stands, for anything said at the glass.
  useEffect(() => {
    if (!her) return
    play.situation(
      `${standingTold(her.name, live.wanted, live.goes, tries)}${play.stake ? ` Riding on it: ${play.stake}` : ''}`
    )
  }, [phase])

  // What the loop and the listeners call, as this render has them.
  const acts = useRef({ hold, letGo, drop, land })
  acts.current = { hold, letGo, drop, land }
  const pick = useRef(settlePick)
  pick.current = settlePick

  useWindowKeydown((event) => {
    // A key typed to her is a character.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const axis = axisOf(event)
    if (!axis) return
    event.preventDefault()
    // A key already down when its way's turn comes takes hold on its next repeat: hold() takes
    // only the way that is live. A go begun by key is him moving on from what was on the box,
    // as a press on the stick is.
    if (hold(axis)) play.moved()
  })

  // The one clock: the runs, the countdown and the drop, stopped while the window is away.
  useEffect(() => {
    let frame = 0
    let last = performance.now()

    /** Sets the claw, its shadow and whatever it holds where the game has them. */
    const draw = (): void => {
      const go = live.go
      const toy = go && (go.kind === 'catch' || go.kind === 'slip') ? go.aimed : null
      // The toy a near miss knocks aside: it goes as the claw closes, and lies there after.
      const pushed = go && go.kind === 'nudge' && go.landed ? go.aimed : null
      let at = { ...stopOf(live.msX, live.msZ), up: 1 }
      let closed = false
      // The toy in the claw's keeping: where it is on the floor plan, how high it is drawn, how faint.
      let kept: { x: number; z: number; y: number; faint: number } | null = null

      if (go && live.phase === 'drop') {
        // How low the claw comes: onto the toy it takes, or nearly to the floor.
        const low = (z: number): number =>
          floorY(z) - ((toy ? toy.size * LIE : 2) + HANG) * scaleAt(z)
        const hubY = (point: { z: number; up: number }): number =>
          mix(low(point.z), railY(point.z) + 7 * scaleAt(point.z), point.up)
        const hung = (point: { x: number; z: number; up: number }): { x: number; z: number; y: number; faint: number } => ({
          x: point.x,
          z: point.z,
          y: hubY(point) + HANG * scaleAt(point.z),
          faint: 0
        })
        const since = live.t - DOWN_MS - CLOSE_MS
        const along = Math.min(1, Math.max(0, since / CARRY_MS))
        at =
          live.t < DOWN_MS
            ? { ...go.stop, up: 1 - live.t / DOWN_MS }
            : since < 0
              ? { ...go.stop, up: 0 }
              : carryPoint(go.stop, along)
        closed = live.t > DOWN_MS + CLOSE_MS / 2
        if (toy) {
          const rest = { x: toy.x, z: toy.z, y: restY(toy, toy.z), faint: 0 }
          if (since < 0) {
            // As the claw closes the toy is drawn in under it.
            const drawn = Math.max(0, (live.t - DOWN_MS) / CLOSE_MS)
            const grip = hung({ ...go.stop, up: 0 })
            kept = { x: mix(rest.x, grip.x, drawn), z: mix(rest.z, grip.z, drawn), y: mix(rest.y, grip.y, drawn), faint: 0 }
          } else if (go.kind === 'slip' && along >= go.slipAt && go.landed) {
            // It has slipped: from where the claw had it, down to where it comes to rest.
            closed = false
            const from = hung(carryPoint(go.stop, go.slipAt))
            const fall = Math.min(1, (since - go.slipAt * CARRY_MS) / FALL_MS)
            kept = {
              x: mix(from.x, go.landed.x, fall),
              z: mix(from.z, go.landed.z, fall),
              y: mix(from.y, restY(toy, go.landed.z), fall * fall),
              faint: 0
            }
          } else if (go.kind === 'catch' && along >= 1) {
            // Over the chute the claw opens and the toy is gone down it.
            closed = false
            const gone = Math.min(1, (since - CARRY_MS) / LET_MS)
            const from = hung(carryPoint(go.stop, 1))
            kept = { ...from, y: mix(from.y, FRONT.height, gone * gone), faint: gone }
          } else {
            kept = hung(at)
          }
        } else if (pushed && go.landed) {
          const knocked = Math.min(1, Math.max(0, (live.t - DOWN_MS) / CLOSE_MS))
          const z = mix(pushed.z, go.landed.z, knocked)
          kept = { x: mix(pushed.x, go.landed.x, knocked), z, y: restY(pushed, z), faint: 0 }
        }
        const scale = scaleAt(at.z)
        const y = hubY(at)
        clawFront.current?.setAttribute('transform', `translate(${at.x} ${y}) scale(${scale})`)
        cable.current?.setAttribute('y2', String(y))
      } else {
        const scale = scaleAt(at.z)
        const y = railY(at.z) + 7 * scale
        clawFront.current?.setAttribute('transform', `translate(${at.x} ${y}) scale(${scale})`)
        cable.current?.setAttribute('y2', String(y))
      }
      const scale = scaleAt(at.z)
      cable.current?.setAttribute('x1', String(at.x))
      cable.current?.setAttribute('x2', String(at.x))
      cable.current?.setAttribute('y1', String(railY(at.z)))
      rail.current?.setAttribute('y1', String(railY(at.z)))
      rail.current?.setAttribute('y2', String(railY(at.z)))
      clawFront.current?.toggleAttribute('data-closed', closed)
      // The shadow lies on the floor under the claw, and gathers as the claw comes down.
      shadow.current?.setAttribute('cx', String(at.x))
      shadow.current?.setAttribute('cy', String(floorY(at.z)))
      shadow.current?.setAttribute('rx', String(4.4 * scale * (1.25 - 0.45 * (1 - at.up))))
      shadow.current?.setAttribute('ry', String(1.3 * scale * (1.25 - 0.45 * (1 - at.up))))
      clawTop.current?.setAttribute('transform', `translate(${at.x} ${DEPTH - at.z})`)
      const shown = toy ?? pushed
      if (shown && kept) {
        heldFront.current?.setAttribute(
          'transform',
          `translate(${kept.x} ${kept.y}) scale(${shown.size * scaleAt(kept.z)})`
        )
        heldTop.current?.setAttribute('transform', `translate(${kept.x} ${DEPTH - kept.z}) scale(${shown.size})`)
        heldFront.current?.setAttribute('opacity', String(1 - kept.faint))
        heldTop.current?.setAttribute('opacity', String(1 - kept.faint))
      }
      if (clockFill.current) clockFill.current.style.width = `${Math.max(0, live.left / COUNTDOWN_MS) * 100}%`
    }

    const tick = (now: number): void => {
      const step = Math.min(FRAME_CAP_MS, Math.max(0, now - last))
      last = now
      if (awayNow.current) {
        // Away, no key is heard coming up: whatever was held is let go of, and the clock stands.
        if (live.held) acts.current.letGo(live.held)
      } else if (live.phase === 'drop') {
        live.t += step * (briskNow.current ? BRISK : 1)
        if (live.t >= DOWN_MS + CLOSE_MS + CARRY_MS + LET_MS) acts.current.land()
      } else if (live.phase === 'moving-x' || live.phase === 'ready-z' || live.phase === 'moving-z') {
        if (live.phase === 'moving-x') live.msX += step
        if (live.phase === 'moving-z') live.msZ += step
        live.left -= step
        const stop = stopOf(live.msX, live.msZ)
        // The countdown out, or the claw at the back of its run, and it drops; at the end of
        // its run across it stops as if let go of.
        if (live.left <= 0 || (live.phase === 'moving-z' && stop.z >= LIMIT.z)) acts.current.drop()
        else if (live.phase === 'moving-x' && stop.x >= LIMIT.x) acts.current.letGo('x')
      }
      draw()
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)

    const keyUp = (event: KeyboardEvent): void => {
      const axis = axisOf(event)
      if (axis) acts.current.letGo(axis)
    }
    window.addEventListener('keyup', keyUp)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('keyup', keyUp)
    }
    // The loop is set up once and reads everything else through refs.
  }, [])

  /** A button held as its key is: down takes hold, and up, or the pointer lost, lets go. */
  const stick = (axis: Axis): Record<string, (event: ReactPointerEvent<HTMLButtonElement>) => void> => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      hold(axis)
    },
    onPointerUp: () => letGo(axis),
    onPointerCancel: () => letGo(axis),
    onLostPointerCapture: () => letGo(axis)
  })

  const going = phase === 'drop' ? live.go : null
  // The toy the claw has, or knocks aside, drawn by the loop and left out of the pile while it is.
  const taken =
    going && (going.kind === 'catch' || going.kind === 'slip' || (going.kind === 'nudge' && going.landed))
      ? going.aimed
      : null
  const lying = live.pile.filter((toy) => toy.id !== taken?.id)
  // From above, what lies on top is drawn on top: the toys held down go first.
  const fromAbove = [...lying].sort(
    (a, b) => Number(Boolean(pinnedBy(live.pile, b))) - Number(Boolean(pinnedBy(live.pile, a)))
  )
  const won = wonIn(live.goes)
  // The last go, said on the machine's front until the next one comes down.
  const lastGo = live.goes[live.goes.length - 1]
  const goNow = Math.min(tries, live.goes.length + 1)
  const acrossDead = phase !== 'ready-x' && phase !== 'moving-x'
  const backDead = phase !== 'ready-z' && phase !== 'moving-z'
  const prompt =
    phase === 'picking'
      ? `${her?.name ?? 'She'} is choosing which toy she wants…`
      : phase === 'ready-x'
        ? 'Hold → to run the claw across'
        : phase === 'moving-x'
          ? 'Let go to stop it'
          : phase === 'ready-z'
            ? 'Hold ↑ to run it back'
            : phase === 'moving-z'
              ? 'Let go to drop'
              : phase === 'drop'
                ? 'The claw drops…'
                : phase === 'reading'
                  ? play.stepped && play.playByPlay
                    ? 'Continue to go on'
                    : 'Get ready…'
                  : 'Out of goes'

  const toyClass = (toy: Toy): string =>
    `vu-claw-toy${pinnedBy(live.pile, toy) ? ' vu-claw-toy--pinned' : ''}`
  const label = (toy: Toy): string =>
    `${toy.name} (${tierOf(toy)} to hold${pinnedBy(live.pile, toy) ? ', pinned under another' : ''}${toy.id === live.wanted?.id ? ', the one she wants' : ''})`

  return (
    <div className="vu-claw">
      <svg
        className="vu-claw-cabinet"
        viewBox={`0 0 ${FRONT.width} ${FRONT.height}`}
        role="img"
        aria-label={`The cabinet from the front: ${live.pile.length} toys on the floor${lastGo ? `; go ${live.goes.length}: ${goShown(lastGo, live.wanted?.id ?? null)}` : ''}`}
      >
        <rect className="vu-claw-back" x="0" y="0" width={FRONT.width} height={FRONT.height} rx="2" />
        <path
          className="vu-claw-floor"
          d={`M 0 ${floorY(DEPTH)} H ${FRONT.width} V ${FRONT.floor} H 0 Z`}
        />
        <rect className="vu-claw-lip" x="0" y={FRONT.floor} width={FRONT.width} height={FRONT.height - FRONT.floor} />
        {/* The chute, at the front left, under where the claw waits. */}
        <path className="vu-claw-chute" d={`M 2 ${floorY(11)} H 17 V ${FRONT.height} H 2 Z`} />
        {/* How the last go came out, on the front under the glass, beside the chute. */}
        {lastGo && (
          <text className="vu-claw-told" x="58.5" y={(FRONT.floor + FRONT.height) / 2}>
            {`Go ${live.goes.length}: ${goShown(lastGo, live.wanted?.id ?? null)}`}
          </text>
        )}
        <path className="vu-claw-track" d={`M 1 ${railY(0)} L 4 ${railY(DEPTH)} M 99 ${railY(0)} L 96 ${railY(DEPTH)}`} />
        <ellipse ref={shadow} className="vu-claw-shadow" cx={HOME.x} cy={floorY(0)} rx="4.4" ry="1.3" />
        {[...lying]
          .sort((a, b) => b.z - a.z)
          .map((toy) => (
            <g
              key={toy.id}
              className={toyClass(toy)}
              transform={`translate(${toy.x} ${restY(toy, toy.z)}) scale(${toy.size * scaleAt(toy.z)})`}
            >
              <title>{label(toy)}</title>
              <ToyShape id={toy.id} />
              <ToyMarks wanted={toy.id === live.wanted?.id} />
            </g>
          ))}
        {taken && (
          <g
            ref={heldFront}
            className="vu-claw-toy"
            transform={`translate(${taken.x} ${restY(taken, taken.z)}) scale(${taken.size * scaleAt(taken.z)})`}
          >
            <ToyShape id={taken.id} />
            <ToyMarks wanted={taken.id === live.wanted?.id} />
          </g>
        )}
        {/* How well each toy holds, in dots on the floor under it: over the pile, so none is hidden. */}
        {lying.map((toy) => {
          const pips = PIPS[tierOf(toy)]
          return (
            <g key={toy.id} className="vu-claw-pips" transform={`translate(${toy.x} ${floorY(toy.z) + 1.2})`}>
              {Array.from({ length: pips }, (_, index) => (
                <circle key={index} cx={(index - (pips - 1) / 2) * 1.7} cy="0" r="0.62" />
              ))}
            </g>
          )
        })}
        <line ref={rail} className="vu-claw-rail" x1="1" x2="99" y1={railY(0)} y2={railY(0)} />
        <line ref={cable} className="vu-claw-cable" x1={HOME.x} x2={HOME.x} y1={railY(0)} y2={railY(0) + 7} />
        <g ref={clawFront} className="vu-claw-claw" transform={`translate(${HOME.x} ${railY(0) + 7})`}>
          <path className="vu-claw-prong vu-claw-prong--left" d="M -1.4 0.8 Q -6.2 2.6 -3.9 7.6" />
          <path className="vu-claw-prong vu-claw-prong--right" d="M 1.4 0.8 Q 6.2 2.6 3.9 7.6" />
          <rect className="vu-claw-hub" x="-2.1" y="-1.6" width="4.2" height="3" rx="0.8" />
        </g>
        <rect className="vu-claw-glass" x="0.5" y="0.5" width={FRONT.width - 1} height={FRONT.height - 1} rx="2" />
      </svg>

      <div className="vu-claw-side">
        <figure className="vu-claw-plan">
          <svg
            className="vu-claw-above"
            viewBox={`0 0 ${WIDTH} ${DEPTH}`}
            role="img"
            aria-label="The cabinet from above: the glass along the bottom, the back wall along the top"
          >
            <rect className="vu-claw-floor" x="0" y="0" width={WIDTH} height={DEPTH} rx="2" />
            <rect className="vu-claw-chute" x="2" y={DEPTH - 11} width="15" height="11" />
            {fromAbove.map((toy) => (
              <g
                key={toy.id}
                className={toyClass(toy)}
                transform={`translate(${toy.x} ${DEPTH - toy.z}) scale(${toy.size})`}
              >
                <title>{label(toy)}</title>
                <ToyShape id={toy.id} />
                <ToyMarks wanted={toy.id === live.wanted?.id} />
              </g>
            ))}
            {taken && (
              <g
                ref={heldTop}
                className="vu-claw-toy"
                transform={`translate(${taken.x} ${DEPTH - taken.z}) scale(${taken.size})`}
              >
                <ToyShape id={taken.id} />
              </g>
            )}
            {/* A toy held down says so in a word, on the side clear of what lies on it. */}
            {lying.map((toy) => {
              const top = pinnedBy(live.pile, toy)
              if (!top) return null
              const side = toy.x >= top.x ? 1 : -1
              return (
                <text
                  key={toy.id}
                  className="vu-claw-under"
                  x={Math.min(WIDTH - 8, Math.max(8, toy.x + side * 3))}
                  y={Math.max(4.5, DEPTH - toy.z - toy.size - 0.8)}
                  textAnchor="middle"
                >
                  under
                </text>
              )
            })}
            <g ref={clawTop} className="vu-claw-sight" transform={`translate(${HOME.x} ${DEPTH - HOME.z})`}>
              <circle cx="0" cy="0" r="3.6" />
              <path d="M -6 0 H 6 M 0 -6 V 6" />
            </g>
          </svg>
          <figcaption>from above: the glass is at the bottom</figcaption>
        </figure>

        <p className="vu-claw-legend">
          dots under a toy: <span>●●●</span> easy to hold · <span>●●</span> fair · <span>●</span> hard to hold
          <br />a grab off a toy’s middle is likelier to slip
        </p>

        <div className="vu-claw-state">
          <span className="vu-claw-go">
            {phase === 'over' ? 'Out of goes' : `Go ${goNow} of ${tries}`}
          </span>
          {her && (
            <span className="vu-claw-wish">
              {live.wanted
                ? `♥ ${her.name} wants the ${live.wanted.name} · ${tierOf(live.wanted)} to hold`
                : `${her.name} is looking the toys over`}
            </span>
          )}
          <span className="vu-claw-won">
            {won.length > 0
              ? `Won: ${won.map((toy) => toy.name).join(', ')}`
              : phase === 'over'
                ? 'Nothing won'
                : 'Nothing won yet'}
          </span>
        </div>

        {/* The countdown keeps its place between goes, so the surface does not jump. */}
        <div
          className="vu-claw-clock"
          data-live={(phase === 'moving-x' || phase === 'ready-z' || phase === 'moving-z') || undefined}
        >
          <span className="vu-claw-clocklabel">drops in</span>
          <span className="vu-claw-clocktrack">
            <span ref={clockFill} className="vu-claw-clockfill" />
          </span>
        </div>

        <div className="vu-claw-stick">
          <span className="vu-claw-prompt">{away && phase !== 'over' ? 'Waiting for you to come back' : prompt}</span>
          <div className="vu-claw-buttons">
            <motion.button
              type="button"
              className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-claw-key"
              inert={acrossDead || undefined}
              data-waiting={acrossDead || undefined}
              {...gestures(acrossDead, lift, press)}
              {...stick('x')}
            >
              → Across
            </motion.button>
            <motion.button
              type="button"
              className="vu-btn vu-btn--outline vu-paper vu-btn--panel vu-claw-key"
              inert={backDead || undefined}
              data-waiting={backDead || undefined}
              {...gestures(backDead, lift, press)}
              {...stick('z')}
            >
              ↑ Back
            </motion.button>
          </div>
          <span className="vu-claw-hint">
            hold → or D and let go, then hold ↑ or W and let go: each way runs once, then it drops
          </span>
        </div>
      </div>
    </div>
  )
}
