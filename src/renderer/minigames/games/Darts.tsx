import { useEffect, useRef, useState, type JSX } from 'react'
import {
  REACH,
  TEAM_STARTS,
  VISIT_LIMIT,
  aimEllipse,
  accountOf,
  checkoutOn,
  herDart,
  hitWord,
  movingDot,
  newMatch,
  scoreHit,
  summary,
  summaryOf,
  termsLine,
  throwDart,
  traitsFor,
  visitLine,
  type Dart,
  type Ellipse,
  type Match,
  type Mode,
  type Point,
  type Summary,
  type Visit
} from '@shared/minigameRules/darts'
import { typingIn, useAway, useReducedMotion, type GamePlay, type PlayResult } from '../kit'
import { C, DartsBoard, R, SIZE, type Flight, type Impact } from './DartsBoard'
import '../../vu_styles/Darts.css'

/** The dart seen side-on, one for each dart of the visit. */
const DART_ICON = new URL('./darts/dart-hud-side.png', import.meta.url).href

/** How many times in a game she says something about a visit, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const
/** The longest her next dart waits on a remark of hers: the model may be slow, the game is not. */
const REMARK_WAIT_MS = 3000
/** How long a dart is in the air, and with less motion asked for. */
const FLIGHT_MS = 430
const FLIGHT_STILL_MS = 100
/** The beat before her first dart of a visit, so the reader's last can be seen, and between hers. */
const HER_FIRST_MS = 1500
const HER_NEXT_MS = 950
/** How long the last dart stays on the board before the game is handed back. */
const END_HOLD_MS = 2000
/** How far an arrow key moves the aim, in board radii. Shift moves it finer. */
const KEY_STEP = 0.025

/** A held aim: the ellipse it locked to, when, and the pointer holding it, or null for Space. */
interface Hold {
  ellipse: Ellipse
  time: number
  pointer: number | null
}

/** Where the countdown stands for the side panel and the narration, in a few words. */
function standing(match: Match, s: Summary, her: string): string {
  if (match.mode === 'house') return `${s.score} so far against the house's ${match.target}.`
  if (match.mode === 'team') return `${s.left.you} left, ${VISIT_LIMIT.team - s.turn} visits to go.`
  return `You ${s.left.you}, ${her} ${s.left.her}.`
}

/**
 * Double or Nothing: darts at the dartboard. The reader aims with the pointer or the arrow keys,
 * holds the click or Space to lock an ellipse round his aim with a dot moving inside it, and
 * lets go: the dart lands where the dot is. Alone it is Beat the House, five visits for the most
 * points against the score the house posted. With a girl the two either team up on one countdown
 * against the house or play 301 against each other, alternate visits, the reader first. Her
 * darts are the rules' own at her skill. The board shows every dart, the panel beside it the
 * score and the last visit, and the dialogue box tells the visits only where play-by-play is on.
 */
export function Darts({ play }: { play: GamePlay }): JSX.Element {
  const her = play.opponents[0]
  const name = her?.name ?? ''
  const traits = her ? traitsFor(her.skill) : null
  // Alone is always Beat the House. With her the option picks the team or versus game.
  const mode: Mode = !her ? 'house' : play.options.match === 1 ? 'versus' : 'team'
  const teamStart = TEAM_STARTS[play.options.countdown ?? 0] ?? TEAM_STARTS[0]
  const [match, setMatch] = useState(() =>
    newMatch(mode, Math.floor(Math.random() * 0x100000000), teamStart)
  )
  const [flight, setFlight] = useState<Flight | null>(null)
  // She is saying something about the last visit: her next dart waits for it.
  const [speaking, setSpeaking] = useState(false)
  const [lastTold, setLastTold] = useState<string | null>(null)
  const reduced = useReducedMotion() ?? false
  const away = useAway()

  // What the drawing loop and the timers read, kept current between renders.
  const matchRef = useRef(match)
  const flightRef = useRef<Flight | null>(null)
  const impactRef = useRef<Impact | null>(null)
  const aim = useRef<Point>({ x: 0, y: -0.6 })
  const hold = useRef<Hold | null>(null)
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced
  const latest = useRef(play)
  latest.current = play

  const remarks = useRef(0)
  // A remark has been asked for and has not come back: no other is asked for meanwhile.
  const saying = useRef(false)
  // Who was ahead in versus after the last pair of visits: -1 the reader, 1 her, 0 level.
  const lead = useRef(0)
  const opened = useRef(false)
  const finished = useRef(false)
  const live = useRef(true)
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>())

  const canvas = useRef<HTMLCanvasElement>(null)
  const overlay = useRef<SVGSVGElement>(null)

  /** A timeout that is cleared if the table is taken down first. */
  function later(run: () => void, ms: number): void {
    const timer = setTimeout(() => {
      timers.current.delete(timer)
      if (live.current) run()
    }, ms)
    timers.current.add(timer)
  }

  useEffect(() => {
    live.current = true
    const pending = timers.current
    return () => {
      live.current = false
      for (const timer of pending) clearTimeout(timer)
      pending.clear()
    }
  }, [])

  const s = summary(match)
  const herTurn = Boolean(her) && !s.done && s.side === 'her'
  const canAim = (): boolean => {
    const now = summary(matchRef.current)
    return !finished.current && !now.done && now.side === 'you' && flightRef.current === null
  }

  // With her the game is on from the moment the darts are handed round, and the terms are said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (!her) return
    if (mode === 'team')
      play.narrate(
        `${name} takes three darts from the rack and hands you yours. The two of you against the house: ${teamStart} down to exactly zero in five visits, yours first.`
      )
    else
      play.narrate(
        `${name} chalks up 301 for each of you. First to exactly zero wins, six visits each, and you throw first.`
      )
    // Once, as the table opens.
  }, [])

  // The board, drawn every frame from what the refs say.
  useEffect(() => {
    const element = canvas.current
    if (!element) return
    const mine = getComputedStyle(element).getPropertyValue('--vu-accent').trim()
    const board = new DartsBoard(element, mine)
    let frame = 0
    const paint = (now: number): void => {
      const m = matchRef.current
      const flying = flightRef.current
      const active = canAim()
      if (!active) hold.current = null
      const locked = hold.current
      const dot = locked ? movingDot(locked.ellipse, m.seed, m.darts.length, (now - locked.time) / 1000) : null
      board.draw(
        {
          darts: m.darts,
          aim: active ? (locked?.ellipse ?? aim.current) : null,
          ellipse: active ? (locked?.ellipse ?? null) : null,
          dot: active ? dot : null,
          flight: flying,
          impact: impactRef.current,
          reduced: reducedRef.current
        },
        now
      )
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => {
      cancelAnimationFrame(frame)
      board.dispose()
    }
  }, [])

  // Looking away lets go of a held aim without throwing.
  useEffect(() => {
    if (away) hold.current = null
  }, [away])

  /** Sends a dart at the board: it lands, and counts, when its flight is over. */
  function launch(dart: Dart): void {
    const duration = reducedRef.current ? FLIGHT_STILL_MS : FLIGHT_MS
    const flying = { dart, time: performance.now(), duration }
    flightRef.current = flying
    setFlight(flying)
    later(() => land(dart), duration)
  }

  /** A dart has landed: onto the board, and the visit told once it is over. */
  function land(dart: Dart): void {
    if (finished.current) return
    const next = throwDart(matchRef.current, dart, dart.aim)
    matchRef.current = next
    setMatch(next)
    flightRef.current = null
    setFlight(null)
    const landed = next.darts[next.darts.length - 1]
    if (landed) impactRef.current = { dart: landed, time: performance.now() }
    const after = summary(next)
    const visit = after.visits[after.visits.length - 1]
    if (visit?.closed && visit.darts[visit.darts.length - 1] === landed) closeVisit(next, after, visit)
  }

  /** A visit is over: told, and then the game handed back, or her word on it where it is worth one. */
  function closeVisit(m: Match, after: Summary, visit: Visit): void {
    const now = latest.current
    const line = `${visitLine(visit.side === 'you' ? 'You' : name, visit, m.mode)}${after.done ? '' : ` ${standing(m, after, name)}`}`
    setLastTold(line)
    void now.narrate(line)
    if (after.done) {
      finished.current = true
      hold.current = null
      const result: PlayResult = {
        outcome: after.outcome ?? 'draw',
        summary: summaryOf(m, her ? name : null),
        account: accountOf(m, her ? name : null, traits)
      }
      setLastTold(result.summary)
      if (now.playByPlay) now.finish(result)
      else later(() => latest.current.finish(result), END_HOLD_MS)
      return
    }
    now.progress(accountOf(m, her ? name : null, traits))
    remark(m, after, visit)
  }

  /**
   * Has her say something about the visit just thrown, where it is worth it: a bust, a treble or
   * the bull, the lead changing hands in versus, or a checkout on for whoever throws next. A few
   * times a game at most, never at quiet, and never on the last visit, which the scene's own
   * reply answers. Talkative, she has a word for an ordinary visit too.
   */
  function remark(m: Match, after: Summary, visit: Visit): void {
    if (!her) return
    const hits = visit.darts.map((d) => scoreHit(d.x, d.y))
    const big = hits.filter((h) => h.kind === 'triple' || h.kind === 'bull')
    let turned = false
    if (m.mode === 'versus' && visit.side === 'her') {
      const now = Math.sign(after.left.her - after.left.you)
      turned = now !== 0 && lead.current !== 0 && now !== lead.current
      if (now !== 0) lead.current = now
    }
    const nextSide = after.side
    const nextLeft = after.left[nextSide]
    const checkout = m.mode !== 'house' && checkoutOn(nextLeft)
    const notable = visit.bust || big.length > 0 || turned || checkout
    const table = latest.current
    if (!notable && table.chattiness !== 'lots') return
    if (saying.current || remarks.current >= REMARKS[table.chattiness]) return
    remarks.current++
    const thrower = visit.side === 'you' ? 'The reader' : name
    const parts = [
      visit.bust
        ? `${thrower} bust: needing ${visit.start}, went over, so the visit scores nothing.`
        : `${thrower} threw ${visit.darts.map((d) => hitWord(scoreHit(d.x, d.y))).join(', ')} for ${visit.points}.`
    ]
    if (big.length && !visit.bust) parts.push(`That ${big.length > 1 ? 'was a fine visit' : `had ${hitWord(big[0])} in it`}.`)
    if (turned) parts.push(`That puts ${after.left.her < after.left.you ? name : 'the reader'} ahead.`)
    if (m.mode === 'team') parts.push(`The team needs ${after.left.you} with ${VISIT_LIMIT.team - after.turn} visits left.`)
    if (m.mode === 'versus') parts.push(`The reader has ${after.left.you} left, ${name} ${after.left.her}.`)
    if (checkout)
      parts.push(
        `${nextSide === 'you' ? 'The reader' : name} can check out from ${nextLeft} with the next visit.`
      )
    saying.current = true
    setSpeaking(true)
    const heard = (): void => setSpeaking(false)
    later(heard, REMARK_WAIT_MS)
    void table
      .say(her.charId, parts.join(' '))
      .catch(() => undefined)
      .finally(() => {
        saying.current = false
        if (live.current) heard()
      })
  }

  // How the game stands, for anything said at the table.
  useEffect(() => {
    if (!her) return
    const visitNo = Math.min(s.turn + 1, VISIT_LIMIT[mode])
    play.situation(
      [
        termsLine(mode, match.target, name),
        mode === 'team'
          ? `The team has ${s.left.you} left.`
          : `The reader has ${s.left.you} left, ${name} ${s.left.her}.`,
        s.done
          ? 'The last dart has just landed.'
          : `It is visit ${visitNo} of ${VISIT_LIMIT[mode]}, ${s.side === 'you' ? "the reader's" : `${name}'s`}, dart ${s.dart} of 3.`,
        ...(play.stake ? [`Riding on it: ${play.stake}`] : [])
      ].join(' ')
    )
  }, [match])

  // Her dart, after a beat: at her best target from where the countdown stands, at her skill.
  // Read at the reader's own pace her visit waits until he has moved past what was said.
  useEffect(() => {
    if (!her || !traits || !herTurn || flight || speaking || finished.current) return
    const first = s.dart === 1
    let mine = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const go = (): void => {
      if (!mine || !live.current || finished.current) return
      const dart = herDart(matchRef.current, traits)
      if (dart) launch(dart)
    }
    const wait = (): void => {
      if (mine) timer = setTimeout(go, first ? HER_FIRST_MS : HER_NEXT_MS)
    }
    if (play.stepped && first) {
      void play
        .read()
        .catch(() => undefined)
        .then(wait)
    } else wait()
    return () => {
      mine = false
      clearTimeout(timer)
    }
    // Her darts come one per landing, which the count alone says.
  }, [herTurn, match.darts.length, flight === null, speaking])

  /** Locks the ellipse round the aim and sets the dot moving. */
  function begin(pointer: number | null): void {
    if (!canAim() || hold.current) return
    hold.current = { ellipse: aimEllipse(aim.current), time: performance.now(), pointer }
  }

  /** Lets go: the dart flies to where the dot is. Says whether a dart was thrown. */
  function release(): boolean {
    const locked = hold.current
    hold.current = null
    if (!locked || !canAim()) return false
    const m = matchRef.current
    const landing = movingDot(locked.ellipse, m.seed, m.darts.length, (performance.now() - locked.time) / 1000)
    if (m.darts.length === 0) play.started()
    launch({ side: 'you', x: landing.x, y: landing.y, aim: { x: locked.ellipse.x, y: locked.ellipse.y } })
    return true
  }

  /** A pointer on the board, in its own coordinates, read through the surface's tilt. */
  function boardPoint(event: { clientX: number; clientY: number }): Point | null {
    const svg = overlay.current
    if (!svg) return null
    const matrix = svg.getScreenCTM()
    if (!matrix) return null
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    const keep = (n: number): number => Math.max(-REACH, Math.min(REACH, n))
    return { x: keep((p.x - C) / R), y: keep((p.y - C) / R) }
  }

  // Space holds and lets go as the click does, and the arrows move the aim, unless he is typing.
  const keys = useRef({ begin, release })
  keys.current = { begin, release }
  useEffect(() => {
    const typing = (event: KeyboardEvent): boolean => {
      const target = event.target as HTMLElement | null
      return (
        typingIn(event) ||
        (target !== null && (['TEXTAREA', 'INPUT', 'BUTTON'].includes(target.tagName) || target.isContentEditable))
      )
    }
    const moves: Record<string, Point> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 }
    }
    const down = (event: KeyboardEvent): void => {
      if (typing(event)) return
      if (event.code === 'Space') {
        if (!canAim()) return
        event.preventDefault()
        event.stopImmediatePropagation()
        if (!event.repeat) keys.current.begin(null)
        return
      }
      const move = moves[event.key]
      if (!move || !canAim()) return
      event.preventDefault()
      if (hold.current) return
      const step = KEY_STEP * (event.shiftKey ? 0.32 : 1)
      const keep = (n: number): number => Math.max(-1.3, Math.min(1.3, n))
      aim.current = { x: keep(aim.current.x + move.x * step), y: keep(aim.current.y + move.y * step) }
    }
    const up = (event: KeyboardEvent): void => {
      if (event.code !== 'Space' || hold.current?.pointer !== null || !hold.current) return
      event.preventDefault()
      event.stopImmediatePropagation()
      // A throw by key is him moving on, where the text waits for him.
      if (keys.current.release()) latest.current.moved()
    }
    window.addEventListener('keydown', down, true)
    window.addEventListener('keyup', up, true)
    return () => {
      window.removeEventListener('keydown', down, true)
      window.removeEventListener('keyup', up, true)
    }
  }, [])

  const visitNo = Math.min(s.turn + 1, VISIT_LIMIT[mode])
  const prompt = s.done
    ? 'Game over'
    : herTurn
      ? `${name} is throwing`
      : flight
        ? '…'
        : `Your throw · dart ${s.dart} of 3`
  // The darts of the visit under way, as marks: thrown, and still to throw.
  const current = s.visits[s.visits.length - 1]
  const thrown = current && !current.closed ? current.darts.length : 0

  return (
    <div className="vu-darts">
      <div className="vu-darts-board">
        <canvas ref={canvas} className="vu-darts-canvas" width={SIZE} height={SIZE} aria-hidden="true" />
        <svg
          ref={overlay}
          className="vu-darts-hit"
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="application"
          aria-label="Dartboard. Move to aim, hold the click or Space, and let go when the dot is where you want the dart. The arrow keys move the aim."
          data-waiting={!s.done && (herTurn || flight !== null) ? true : undefined}
          onPointerMove={(event) => {
            if (!canAim() || hold.current) return
            const p = boardPoint(event)
            if (p) aim.current = p
          }}
          onPointerDown={(event) => {
            if (event.button !== 0 || !canAim()) return
            event.preventDefault()
            const p = boardPoint(event)
            if (p) aim.current = p
            begin(event.pointerId)
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) => {
            if (hold.current?.pointer === event.pointerId) release()
          }}
          onPointerCancel={() => {
            hold.current = null
          }}
          onLostPointerCapture={(event) => {
            if (hold.current?.pointer === event.pointerId) hold.current = null
          }}
        >
          <rect width={SIZE} height={SIZE} fill="transparent" />
        </svg>
      </div>

      <div className="vu-darts-side">
        {mode === 'house' && (
          <dl className="vu-darts-scores">
            <div data-up={!s.done || undefined}>
              <dt>You</dt>
              <dd>{s.score}</dd>
            </div>
            <div>
              <dt>House</dt>
              <dd>{match.target}</dd>
            </div>
          </dl>
        )}
        {mode === 'team' && (
          <dl className="vu-darts-scores">
            <div data-up>
              <dt>{`You & ${name}`}</dt>
              <dd>{s.left.you}</dd>
            </div>
            <div>
              <dt>Visits left</dt>
              <dd>{VISIT_LIMIT.team - s.turn}</dd>
            </div>
          </dl>
        )}
        {mode === 'versus' && (
          <dl className="vu-darts-scores">
            <div data-up={(!s.done && s.side === 'you') || undefined}>
              <dt>You</dt>
              <dd>{s.left.you}</dd>
            </div>
            <div data-up={(!s.done && s.side === 'her') || undefined}>
              <dt>{name}</dt>
              <dd>{s.left.her}</dd>
            </div>
          </dl>
        )}

        <p className="vu-darts-round">
          {s.done ? 'game over' : `visit ${visitNo} of ${VISIT_LIMIT[mode]}`}
          {mode === 'team' && !s.done && <span>{s.side === 'you' ? ' · yours' : ` · ${name}'s`}</span>}
        </p>

        <div className="vu-darts-up" data-waiting={herTurn || s.done || undefined}>
          <span className="vu-darts-prompt">{prompt}</span>
          <span className="vu-darts-marks" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <img key={i} className="vu-darts-mark" src={DART_ICON} alt="" data-thrown={i < thrown || undefined} />
            ))}
          </span>
        </div>

        <p className="vu-darts-told" data-told={lastTold !== null || undefined} aria-live="polite">
          {lastTold ?? 'Aim, hold the click or Space, and let go when the dot is on target. Arrow keys move the aim.'}
        </p>
      </div>
    </div>
  )
}
