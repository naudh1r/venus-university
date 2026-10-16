import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  BOPPED,
  DUCKED,
  HAND_MS,
  HOLES,
  emptyTally,
  endLine,
  halfwayLine,
  herGame,
  leaderOf,
  makePattern,
  multiplierOf,
  outcomeOf,
  paceName,
  paceOf,
  readerSwing,
  secondsOf,
  soloAccount,
  soloSummary,
  standingAccount,
  startLine,
  tallied,
  versusAccount,
  versusSummary,
  type Kind,
  type Rival,
  type Swing,
  type Tally
} from '@shared/minigameRules/whackABun'
import {
  BunnyMark,
  gestures,
  lift,
  pointIn,
  press,
  remarkBudget,
  typingIn,
  useAway,
  useOnTable,
  useReducedMotion,
  useWindowKeydown
} from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/WhackABun.css'

/**
 * The keys for the nine holes, by where they are on the keyboard and not by what they type: the
 * number pad whatever NumLock says, the number row, and the block of nine letter keys at the left,
 * which is Q W E, A S D, Z X C on one layout and something else on another.
 */
const KEYS: Readonly<Record<string, number>> = {
  Numpad7: 0, Numpad8: 1, Numpad9: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5, Numpad1: 6, Numpad2: 7, Numpad3: 8,
  Digit7: 0, Digit8: 1, Digit9: 2, Digit4: 3, Digit5: 4, Digit6: 5, Digit1: 6, Digit2: 7, Digit3: 8,
  KeyQ: 0, KeyW: 1, KeyE: 2, KeyA: 3, KeyS: 4, KeyD: 5, KeyZ: 6, KeyX: 7, KeyC: 8
}
/** What is printed by each hole: its place on the number pad, which reads the same on any keyboard. */
const KEY_HINTS = ['7', '8', '9', '4', '5', '6', '1', '2', '3']

/** How many times in a round anything is said, by how talkative the girls are to be: the whole table's. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const
/** The least between two remarks, so a round's worth is not spent in its first seconds, in ms. */
const REMARK_GAP_MS = 5000
/** Nothing is said this close to the buzzer: the scene's own reply answers the result, in ms. */
const QUIET_END_MS = 3500
/** The runs worth a word as they are reached, and the ones more that the talkative remark on. */
const RUNS_TOLD = [10, 20]
const RUNS_TOLD_LOTS = [5, 10, 20]
/** From this share of the round a change of leader is a late one. */
const LATE_FROM = 0.65

/** The count-in before the first bunny, in ms. */
const COUNT_IN_MS = 3000
/** The most one frame moves the clock on, in ms: a stall is not played through. */
const FRAME_CAP_MS = 50
/**
 * How long the final scores stand before the table is cleared, where the box does not tell the
 * buzzer: they are read off the cards, and want a moment, in ms.
 */
const FINAL_MS = 1500
/** How long what a swing came to is shown over its hole, in ms. */
const FLASH_MS = 450

/** A click or a key within this long of the window coming back is the one that brought it back, in ms. */
const RETURN_MS = 250

/**
 * The board as it is drawn, in the SVG's own units. A hole's art, about the middle of its group,
 * runs from 55 above (a carrot's leaves; what a swing came to is written just under that) to 50
 * below (the key printed under the lip), 105 in all, and 39 either side. So the holes are 100
 * apart across and 114 down, the first row's middle 65 from the top and 60 kept under the last:
 * 10 clear above and below, and 9 between one row's key and the next row's leaves.
 */
const CELL = 100
const ROW = 114
const HEAD = 65
const BOARD_H = HEAD + ROW * 2 + 60
/** How near the middle of a hole a click has to be. */
const REACH = 46

const WORD: Readonly<Record<Swing, string>> = {
  hit: 'Bop!',
  gold: 'Golden!',
  decoy: 'Carrot',
  miss: 'Got away',
  slipped: 'Gold got away',
  stray: 'Empty hole'
}

/** What the screen shows of one cabinet: the count, and the last thing that happened at it. */
interface Seat {
  tally: Tally
  last: Swing | null
  /** How many things have happened: what the last one's pop is keyed on. */
  count: number
}

const freshSeat = (): Seat => ({ tally: emptyTally(), last: null, count: 0 })

/** What is written over a hole: what a swing came to, or that the mallet was not back for it. */
type Tone = Swing | 'resting'

/** One hole of the reader's board as it is drawn. */
interface Hole {
  /** What is in it, or was last: kept while it ducks. */
  kind: Kind
  up: boolean
  /** What the last swing here came to, while it is shown. */
  flash: string
  tone: Tone | null
}

const emptyHoles = (): Hole[] => Array.from({ length: HOLES }, () => ({ kind: 'bun', up: false, flash: '', tone: null }))

/** The round as it is being played: read and written by the frame loop, never rendered from. */
interface Live {
  /** How far into the round it is, in ms; below nothing through the count-in. */
  at: number
  /** `performance.now()` at the last frame. */
  lastNow: number
  begun: boolean
  over: boolean
  /** Each thing in the pattern, dealt with at the reader's cabinet or not yet. */
  done: boolean[]
  /** The cabinets, the reader's first. */
  seats: Seat[]
  /** How far through her moves each girl is. */
  herFrom: number[]
  /** What each hole last held, and what is shown over it until when. */
  kinds: Kind[]
  flash: { text: string; tone: Tone; until: number }[]
  /** When the reader's mallet is back from his last swing, in ms into the round. */
  freeAt: number
  /** The last quarter of the round the scene was told the standing at. */
  quarter: number
  /** What was last drawn, as one string: the board is set again only when it changes. */
  drawn: string
  halfway: number[] | null
  /** Who was alone on top after the last thing that scored. */
  leader: number
  speaking: boolean
  lastRemarkAt: number
  /** How many remarks each girl has made. */
  spoken: number[]
}

/** A bunny, a golden one with its crown, or a carrot, drawn about the middle of its hole. */
function Critter({ kind }: { kind: Kind }): JSX.Element {
  if (kind === 'decoy') {
    return (
      <g className="vu-whack-carrot">
        <path className="vu-whack-leaf" d="M-2 -20 Q-20 -30 -24 -46 Q-8 -40 -2 -20 Z M0 -20 Q-6 -40 0 -54 Q6 -40 0 -20 Z M2 -20 Q20 -30 24 -46 Q8 -40 2 -20 Z" />
        <path className="vu-whack-root" d="M-17 -16 Q0 -27 17 -16 L5 40 Q0 45 -5 40 Z" />
        <path className="vu-whack-rib" d="M-12 -4 H-2 M4 8 H12 M-8 18 H0" />
      </g>
    )
  }
  return (
    <g className={`vu-whack-bun${kind === 'gold' ? ' vu-whack-bun--gold' : ''}`}>
      <ellipse className="vu-whack-fur" cx="-11" cy="-30" rx="7" ry="18" />
      <ellipse className="vu-whack-fur" cx="11" cy="-30" rx="7" ry="18" />
      <path className="vu-whack-fur" d="M-22 44 V2 A22 22 0 0 1 22 2 V44 Z" />
      <circle className="vu-whack-eye" cx="-8" cy="-1" r="2.6" />
      <circle className="vu-whack-eye" cx="8" cy="-1" r="2.6" />
      <path className="vu-whack-nose" d="M-3 6 H3 L0 10 Z" />
      {kind === 'gold' && (
        <>
          <path className="vu-whack-crown" d="M-12 -14 V-28 L-6 -21 L0 -31 L6 -21 L12 -28 V-14 Z" />
          <path className="vu-whack-spark" d="M30 -30 l2.5 6 l6 2.5 l-6 2.5 l-2.5 6 l-2.5 -6 l-6 -2.5 l6 -2.5 Z M-32 -12 l1.8 4.2 l4.2 1.8 l-4.2 1.8 l-1.8 4.2 l-1.8 -4.2 l-4.2 -1.8 l4.2 -1.8 Z" />
        </>
      )}
    </g>
  )
}

/** One cabinet's count: whose it is, the score, the run and what it is worth, the last thing that happened. */
function Card({ who, seat, first }: { who: string; seat: Seat; first: boolean }): JSX.Element {
  const { tally } = seat
  const times = multiplierOf(tally.streak)
  return (
    <div className="vu-whack-card" data-first={first || undefined}>
      <span className="vu-whack-who" title={who}>
        {who}
      </span>
      <span className="vu-whack-lead">{first ? '1st' : ' '}</span>
      <span className="vu-whack-score">{tally.score}</span>
      <span className="vu-whack-run">
        {tally.streak > 1 ? `${tally.streak} in a row` : ' '}
        {times > 1 ? ` · ×${times}` : ''}
      </span>
      {/* Keyed on the count, so each thing lands as a new one. */}
      <motion.span
        key={seat.count}
        className="vu-whack-last"
        data-swing={seat.last ?? undefined}
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        transition={{ duration: 0.14, ease: 'easeOut' }}
      >
        {seat.last ? WORD[seat.last] : ' '}
      </motion.span>
    </div>
  )
}

/**
 * Whack-a-Bun: a cabinet of nine holes, bunnies coming up to be bopped with a click or a key
 * before they duck, a golden one now and then for triple and a carrot now and then that is not
 * to be hit. Alone it is played for a score; with girls each has a cabinet of her own beside the
 * reader's, the same pattern on all of them at the same time, each girl's hands the rules' own at
 * her skill and stepped by the round's one clock. Nothing waits on anything said: the box hears
 * how it starts, how it stands halfway and that it has ended, and a girl has a word at the few
 * moments worth one. The clock stops, and the board is covered, while the window is away.
 */
export function WhackABun({ play }: { play: GamePlay }): JSX.Element {
  const girls = play.opponents
  const names = girls.map((girl) => girl.name)
  const seconds = secondsOf(play.options.seconds)
  const pace = paceOf(play.options.pace)
  // The pattern is cut once, as the mallets are picked up, and each girl's round of it with it.
  const [pattern] = useState(() => makePattern(`${Date.now()}:${Math.random()}`, pace, seconds))
  const [herMoves] = useState(() => girls.map((girl) => herGame(pattern, girl.skill)))
  const [budget] = useState(() => remarkBudget(play.chattiness, REMARKS))
  const [phase, setPhase] = useState<'ready' | 'count' | 'playing' | 'over'>('ready')
  const [count, setCount] = useState(0)
  const [left, setLeft] = useState(seconds)
  const [seats, setSeats] = useState<Seat[]>(() => [freshSeat(), ...girls.map(freshSeat)])
  const [holes, setHoles] = useState<Hole[]>(emptyHoles)

  const live = useRef<Live>({
    at: -COUNT_IN_MS,
    lastNow: 0,
    begun: false,
    over: false,
    done: [],
    seats: [freshSeat(), ...girls.map(freshSeat)],
    herFrom: girls.map(() => 0),
    kinds: Array<Kind>(HOLES).fill('bun'),
    flash: Array.from({ length: HOLES }, () => ({ text: '', tone: 'hit' as Tone, until: -Infinity })),
    freeAt: 0,
    quarter: 0,
    drawn: '',
    halfway: null,
    leader: -1,
    speaking: false,
    lastRemarkAt: -Infinity,
    spoken: girls.map(() => 0)
  })
  const onTable = useOnTable()
  const away = useAway()
  const gone = useRef(away)
  // When the window last came back, by `performance.now()`: what brought it back is not a swing.
  const backAt = useRef(-Infinity)
  if (gone.current && !away) backAt.current = performance.now()
  gone.current = away
  const still = useReducedMotion()
  const held = useRef(play)
  held.current = play
  // The terms are said once, whatever is mounted twice.
  const opened = useRef(false)
  const bar = useRef<HTMLSpanElement>(null)

  const { pops, lengthMs } = pattern
  const running = phase === 'count' || phase === 'playing'

  const scores = (): number[] => live.current.seats.map((seat) => seat.tally.score)
  const who = (place: number): string => (place === 0 ? 'The reader' : names[place - 1])
  const rivals = (): Rival[] => girls.map((girl, seat) => ({ name: girl.name, tally: live.current.seats[seat + 1].tally }))

  /** How the round stands, for anything said at the cabinets. */
  function standing(): string {
    const game = live.current
    const secondsLeft = Math.max(0, Math.ceil((lengthMs - game.at) / 1000))
    return [
      `The game is Whack-a-Bun at the arcade: the reader and ${names.join(', ')} have a cabinet each, side by side, bopping the same bunnies as they pop up, ${seconds} seconds at a ${paceName(pace)} pace, all of them too busy to say much. Golden bunnies are worth triple and carrots cost points if hit.`,
      game.over
        ? 'The buzzer has just gone.'
        : game.at < 0
          ? 'The cabinets are counting them in.'
          : `There are ${secondsLeft} seconds left.`,
      `The score is the reader ${game.seats[0].tally.score}, ${girls.map((girl, seat) => `${girl.name} ${game.seats[seat + 1].tally.score}`).join(', ')}.`,
      ...(held.current.stake ? [`Riding on it: ${held.current.stake}`] : [])
    ].join(' ')
  }

  /**
   * Has one girl say something about what just happened, and never holds the round for it: one
   * line on its way at a time, a few a round between all of them, none near the buzzer. A remark
   * not made spends nothing. Of the reader's doings the girl who has said least speaks. Another
   * is asked for only once this one has truly come or been given up, however long that takes.
   */
  function remark(place: number, cue: string): void {
    const game = live.current
    if (girls.length === 0 || game.over || game.speaking || !onTable()) return
    if (game.at > lengthMs - QUIET_END_MS || game.at - game.lastRemarkAt < REMARK_GAP_MS) return
    if (!budget.take()) return
    const seat =
      place > 0
        ? place - 1
        : girls.map((_, index) => index).sort((a, b) => game.spoken[a] - game.spoken[b] || a - b)[0]
    game.speaking = true
    game.lastRemarkAt = game.at
    game.spoken[seat]++
    held.current.situation(standing())
    const charId = girls[seat].charId
    void Promise.resolve()
      .then(() => held.current.say(charId, cue))
      .catch(() => undefined)
      .then(() => {
        game.speaking = false
      })
  }

  /** One thing happening at one cabinet: counted, and remarked on where it is worth it. */
  function land(place: number, swing: Swing): number {
    const game = live.current
    const before = game.seats[place]
    const tally = tallied(before.tally, swing)
    game.seats[place] = { tally, last: swing, count: before.count + 1 }
    if (girls.length === 0) return tally.score - before.tally.score

    const told = held.current.chattiness === 'lots' ? RUNS_TOLD_LOTS : RUNS_TOLD
    const leader = leaderOf(scores())
    const was = game.leader
    if (leader >= 0) game.leader = leader
    if (leader >= 0 && was >= 0 && leader !== was && game.at >= lengthMs * LATE_FROM) {
      const name = (place: number): string => (place === 0 ? 'the reader' : names[place - 1])
      remark(leader || was, `Late in the round ${name(leader)} has just gone past ${name(was)} into the lead, ${game.seats[leader].tally.score} points to ${game.seats[was].tally.score}.`)
    } else if (swing === 'gold') {
      remark(place, `${who(place)} just bopped a golden bunny before it ducked: triple points.`)
    } else if (swing === 'decoy') {
      remark(place, `${who(place)} just whacked a carrot by mistake${before.tally.streak >= 5 ? `, losing points and a run of ${before.tally.streak} hits` : ' and lost points for it'}.`)
    } else if (swing === 'hit' && told.includes(tally.streak)) {
      remark(place, `${who(place)} has just bopped ${tally.streak} in a row without a slip.`)
    }
    return tally.score - before.tally.score
  }

  /** The board as it should be drawn at `at`, set only where it differs from what is. */
  function draw(at: number): void {
    const game = live.current
    const up = Array<boolean>(HOLES).fill(false)
    pops.forEach((pop, index) => {
      if (pop.at > at || at > pop.at + pop.upMs || game.done[index]) return
      up[pop.hole] = true
      game.kinds[pop.hole] = pop.kind
    })
    const next = up.map((isUp, hole) => {
      const flash = game.flash[hole]
      const shown = flash.until > at
      return { kind: game.kinds[hole], up: isUp, flash: shown ? flash.text : '', tone: shown ? flash.tone : null }
    })
    const key = next.map((hole) => `${hole.kind}${hole.up ? 1 : 0}${hole.flash}`).join('|')
    if (key === game.drawn) return
    game.drawn = key
    setHoles(next)
  }

  /** The count-in begins: the round is on from here. */
  function begin(): void {
    const game = live.current
    if (game.begun || game.over || !onTable()) return
    game.begun = true
    game.at = -COUNT_IN_MS
    game.lastNow = performance.now()
    held.current.started()
    if (girls.length === 0) held.current.narrate(startLine(pattern, names))
    else held.current.situation(standing())
    held.current.progress(standingAccount(pattern, game.at, game.seats[0].tally, rivals()))
    setCount(Math.ceil(COUNT_IN_MS / 1000))
    setPhase('count')
  }

  /**
   * The mallet down on a hole: a bop, a carrot, an empty hole, or nothing at all a moment late.
   * It is then away for a moment, as the girls' are, and a swing before it is back is none: the
   * hole says so, unless it is still saying what the last swing came to.
   */
  function swing(hole: number): void {
    const game = live.current
    if (game.over || !game.begun || game.at < 0 || gone.current || !onTable()) return
    if (performance.now() - backAt.current < RETURN_MS) return
    const found = readerSwing(pops, game.done, hole, game.at, game.freeAt)
    if (found === 'resting') {
      if (game.flash[hole].until > game.at) return
      game.flash[hole] = { text: 'wait', tone: 'resting', until: game.freeAt }
      draw(game.at)
      return
    }
    game.freeAt = game.at + HAND_MS
    if (found === 'late') return
    const what = found === 'stray' ? 'stray' : BOPPED[pops[found].kind]
    if (found !== 'stray') game.done[found] = true
    const gained = land(0, what)
    game.flash[hole] = {
      text: gained > 0 ? `+${gained}` : gained < 0 ? `−${-gained}` : what === 'stray' ? 'miss' : '−0',
      tone: what,
      until: game.at + FLASH_MS
    }
    setSeats([...game.seats])
    draw(game.at)
  }

  // With company the round is agreed as the table opens, and the terms are said.
  useEffect(() => {
    if (opened.current) return
    opened.current = true
    if (girls.length > 0) {
      play.narrate(startLine(pattern, names))
      play.situation(standing())
    }
    // Once, as the table opens.
  }, [])

  useWindowKeydown((event) => {
    // A key typed to her is a character, never a swing.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const hole = KEYS[event.code]
    if (hole === undefined) return
    event.preventDefault()
    // A key held down is one swing.
    if (event.repeat) return
    if (live.current.begun) swing(hole)
    else begin()
  })

  // The round itself: every frame moves the one clock on and brings every cabinet up to it.
  useEffect(() => {
    if (!running) return
    const game = live.current
    let frame = 0
    game.lastNow = performance.now()

    const end = (): void => {
      game.over = true
      const mine = game.seats[0].tally
      setSeats([...game.seats])
      setHoles(emptyHoles())
      setLeft(0)
      setPhase('over')
      held.current.narrate(endLine())
      if (girls.length > 0) held.current.situation(standing())
      const result =
        girls.length === 0
          ? {
              outcome: 'played' as const,
              summary: soloSummary(pattern, mine),
              account: soloAccount(pattern, mine)
            }
          : {
              outcome: outcomeOf(scores()),
              summary: versusSummary(mine, rivals()),
              account: versusAccount(pattern, mine, rivals(), game.halfway ?? scores())
            }
      // Told on the box, the buzzer has its time there; otherwise the scores stand a moment.
      if (held.current.playByPlay) {
        held.current.finish(result)
        return
      }
      held.current.progress(result.account)
      setTimeout(() => {
        if (onTable()) held.current.finish(result)
      }, FINAL_MS)
    }

    const loop = (now: number): void => {
      if (!onTable() || game.over) return
      const passed = Math.min(FRAME_CAP_MS, Math.max(0, now - game.lastNow))
      game.lastNow = now
      // Away, the clock stands, and so does everything read off it.
      if (gone.current) {
        frame = requestAnimationFrame(loop)
        return
      }
      game.at += passed
      const at = game.at
      if (at < 0) {
        setCount(Math.ceil(-at / 1000))
        frame = requestAnimationFrame(loop)
        return
      }
      setPhase('playing')
      let moved = false

      // Each girl's moves, as the clock reaches them.
      herMoves.forEach((moves, seat) => {
        while (game.herFrom[seat] < moves.length && moves[game.herFrom[seat]].at <= at) {
          land(seat + 1, moves[game.herFrom[seat]].swing)
          game.herFrom[seat]++
          moved = true
        }
      })
      // What has ducked at the reader's cabinet without being bopped.
      pops.forEach((pop, index) => {
        if (game.done[index] || at <= pop.at + pop.upMs) return
        game.done[index] = true
        const ducked = DUCKED[pop.kind]
        if (!ducked) return
        land(0, ducked)
        moved = true
      })

      if (!game.halfway && at >= lengthMs / 2) {
        game.halfway = scores()
        held.current.narrate(halfwayLine(game.seats[0].tally, rivals()))
        if (girls.length > 0) held.current.situation(standing())
      }
      // At each quarter the scene is told how it stands, for a round walked away from.
      const quarter = Math.min(3, Math.floor((at * 4) / lengthMs))
      if (quarter > game.quarter) {
        game.quarter = quarter
        held.current.progress(standingAccount(pattern, at, game.seats[0].tally, rivals()))
      }

      if (at >= lengthMs) {
        end()
        return
      }
      if (moved) setSeats([...game.seats])
      setLeft(Math.ceil((lengthMs - at) / 1000))
      if (bar.current) bar.current.style.transform = `scaleX(${(1 - at / lengthMs).toFixed(4)})`
      draw(at)
      frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
    // The loop starts with the count-in and runs to the buzzer off the clock.
  }, [running])

  const over = phase === 'over'
  const covered = away && running
  const first = phase === 'ready' || girls.length === 0 ? -1 : leaderOf(seats.map((seat) => seat.tally.score))

  return (
    <div className="vu-whack" data-phase={phase} data-still={still || undefined}>
      <div className="vu-whack-cabinet">
        <svg
          className="vu-whack-board"
          viewBox={`0 0 ${CELL * 3} ${BOARD_H}`}
          role="img"
          aria-label="Your cabinet: nine holes, three rows of three"
          onPointerDown={(event) => {
            if (event.button !== 0) return
            const point = pointIn(event.currentTarget, event)
            if (!point) return
            const column = Math.floor(point.x / CELL)
            const row = Math.round((point.y - HEAD) / ROW)
            if (column < 0 || column > 2 || row < 0 || row > 2) return
            // A click between two holes is a click on neither.
            if (Math.hypot(point.x - (column + 0.5) * CELL, point.y - (HEAD + row * ROW)) > REACH) return
            event.preventDefault()
            swing(row * 3 + column)
          }}
        >
          <defs>
            {/* What is above a hole's rim, and the front half of the hole itself: all a bunny shows through. */}
            <clipPath id="vu-whack-rim">
              <path d="M-48 -60 H48 V26 H36 A36 12 0 0 1 -36 26 H-48 Z" />
            </clipPath>
          </defs>
          {holes.map((hole, index) => (
            <g key={index} transform={`translate(${(index % 3) * CELL + CELL / 2} ${HEAD + Math.floor(index / 3) * ROW})`}>
              <ellipse className="vu-whack-hole" cx="0" cy="26" rx="36" ry="12" />
              <g clipPath="url(#vu-whack-rim)">
                <g className="vu-whack-critter" data-up={(hole.up && !covered) || undefined}>
                  <Critter kind={hole.kind} />
                </g>
              </g>
              <path className="vu-whack-lip" d="M-36 26 A36 12 0 0 0 36 26" />
              <text className="vu-whack-key" x="0" y="48">
                {KEY_HINTS[index]}
              </text>
              {hole.flash && !covered && (
                <text className="vu-whack-flash" data-swing={hole.tone ?? undefined} x="0" y="-38">
                  {hole.flash}
                </text>
              )}
            </g>
          ))}
        </svg>

        {phase === 'ready' && (
          <div className="vu-whack-over">
            <span className="vu-whack-mark" aria-hidden="true">
              <BunnyMark />
            </span>
            <p className="vu-whack-how">
              Bop each bunny before it ducks: click it, or press its hole on the number pad, or on
              the block of nine letter keys at the left of the keyboard. A crowned golden one is
              worth triple. Leave the carrots alone, and the empty holes.
            </p>
            <p className="vu-whack-terms">
              {seconds} seconds · {paceName(pace)}
            </p>
            <motion.button
              type="button"
              className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
              {...gestures(false, lift, press)}
              onClick={begin}
            >
              Pick up the mallet
            </motion.button>
          </div>
        )}
        {phase === 'count' && !covered && (
          <div className="vu-whack-over vu-whack-over--clear" role="status">
            <span key={count} className="vu-whack-count">
              {count}
            </span>
          </div>
        )}
        {covered && (
          <div className="vu-whack-over" role="status">
            <p className="vu-whack-paused">Paused</p>
            <p className="vu-whack-how">The clock waits while the window is away.</p>
          </div>
        )}
        {over && (
          <div className="vu-whack-over vu-whack-over--clear" role="status">
            <span className="vu-whack-count">Time!</span>
          </div>
        )}
      </div>

      <div className="vu-whack-side">
        <div className="vu-whack-clock">
          <span className="vu-whack-left">
            {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
          </span>
          <span className="vu-whack-track" role="progressbar" aria-label="Time left" aria-valuemin={0} aria-valuemax={seconds} aria-valuenow={left}>
            <span ref={bar} className="vu-whack-bar" style={over ? { transform: 'scaleX(0)' } : undefined} />
          </span>
        </div>
        <div className="vu-whack-cards" data-many={girls.length > 1 || undefined}>
          {seats.map((seat, place) => (
            <Card key={place} who={place === 0 ? 'You' : names[place - 1]} seat={seat} first={first === place} />
          ))}
        </div>
        <p className="vu-whack-legend">bunny 10 · golden ×3 · carrot −20 · empty hole −5 · 5 in a row ×1.5 · 10 in a row ×2</p>
      </div>
    </div>
  )
}
