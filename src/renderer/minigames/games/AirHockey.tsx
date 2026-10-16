import { useEffect, useRef, useState, type JSX } from 'react'
import {
  GOALS_TO_WIN,
  GOAL_W,
  MALLET_R,
  PUCK_R,
  STEP,
  TABLE_H,
  TABLE_W,
  advance,
  freshMind,
  freshTable,
  goalCue,
  goalLine,
  homeOf,
  matchAccount,
  matchAccountSoFar,
  matchOver,
  matchSituation,
  matchSummary,
  scoreOf,
  stalled,
  sunk,
  swingAt,
  type Point,
  type Side
} from '@shared/minigameRules/airHockey'
import { pointIn, useAway, type GamePlay } from '../kit'
import '../../vu_styles/AirHockey.css'

/** A count of goals as the narration says it. */
const NUMBER: Record<number, string> = {
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine'
}

/** How many times in a match she says something about a goal, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 8 } as const

/** How long the table stands still after a goal before the puck is served. */
const GOAL_PAUSE_MS = 1100
/** The longest the serve waits on something she is saying. */
const REMARK_WAIT_MS = 6000
/** The most time one frame may ask the table to make up, after a stall. */
const MAX_FRAME_S = 0.1
/** How long the table is held once he is back at it, counted down from this many. */
const RESUME_MS = 2400
const RESUME_COUNT = 3
/**
 * At the reader's own pace with the goals kept off the box, how long the last goal and the result
 * stand before the match is handed over: there is no line for him to step past, so nothing else
 * holds the table open.
 */
const STEPPED_END_MS = 1800

/**
 * Air hockey: one table seen from above, the reader's end at the bottom and hers at the top. His
 * mallet follows the pointer inside his half; hers is the rules' own, at her skill. The table
 * runs in real time, a fixed step at a time, and stops for a beat at each goal, when the puck is
 * served to whoever let it in. It stops too for as long as he is looking elsewhere, and counts
 * him back in before the puck moves again. The table shows the play, the score, who scored the
 * last goal and who took the match; the scene's dialogue box has them only with the play-by-play on.
 */
export function AirHockey({ play }: { play: GamePlay }): JSX.Element {
  const her = play.opponents[0]
  const toWin = play.options.goals ?? GOALS_TO_WIN
  const [goals, setGoals] = useState<Side[]>([])
  // Between a goal and the serve.
  const [waiting, setWaiting] = useState(false)
  // He is looking elsewhere: the table stands as it is. Back, he is counted in from `count`.
  const away = useAway()
  const awayNow = useRef(away)
  awayNow.current = away
  const [count, setCount] = useState<number | null>(null)

  // The framework's side of the game as it is now, for a loop that outlives any one render.
  const latest = useRef(play)
  latest.current = play

  const field = useRef<SVGSVGElement>(null)
  const puckMark = useRef<SVGCircleElement>(null)
  const readerMark = useRef<SVGGElement>(null)
  const herMark = useRef<SVGGElement>(null)

  const { mine, hers } = scoreOf(goals)
  const over = matchOver(goals, toWin)
  // Who put the last one in, and who took the match: on the table, where the box no longer says it.
  const herName = her?.name ?? 'she'
  const lastBy = goals[goals.length - 1]
  const scoredNote = lastBy === 'her' ? `${herName} scores` : 'you score'
  const endNote = mine > hers ? 'you win' : `${herName} wins`

  // The match is on from the moment she takes her end, and the serve is said.
  const opened = useRef(false)
  useEffect(() => {
    // Said the once, however many times the table is mounted.
    if (opened.current) return
    opened.current = true
    if (her)
      play.narrate(
        `${her.name} takes the far end of the table and the puck drops on your side. First to ${NUMBER[toWin] ?? toWin}.`
      )
    // Once, as the table opens.
  }, [])

  // How the match stands, for anything said at the table.
  useEffect(() => {
    if (her) play.situation(matchSituation(her.name, goals, toWin, play.stake))
  })

  // The table itself: the pointer, the clock and the play, from the first frame to the last goal
  // or to the table being cleared from under it.
  useEffect(() => {
    if (!her) return
    let table = freshTable('reader')
    let mind = freshMind()
    const scored: Side[] = []
    let hand: Point = homeOf('reader')
    let remarks = 0
    let frame = 0
    let last = performance.now()
    let owed = 0
    // The table stands still until this time, and for as long as she is speaking.
    let stillUntil = 0
    let speaking = false
    // Which of her remarks the table is standing still for, and the clock that lets it go.
    let remarked = 0
    let hold: ReturnType<typeof setTimeout> | undefined
    let serveTo: Side | null = null
    let ended = false
    let gone = false
    // He was away at the last frame; back, the table is held until `resumeAt`, `shown` on it.
    let wasAway = false
    let resumeAt = 0
    let shown = 0

    const follow = (event: PointerEvent): void => {
      const svg = field.current
      if (!svg) return
      // Through the drawing's own mapping, so the stage's scale and the surface's lean are both
      // undone exactly. A drawing with no size has no mapping, and the hand stays where it was.
      const at = pointIn(svg, event)
      if (at && Number.isFinite(at.x) && Number.isFinite(at.y)) hand = at
    }
    // A finger put down on the table keeps the mallet wherever it then goes.
    const keep = (event: PointerEvent): void => {
      try {
        field.current?.setPointerCapture(event.pointerId)
      } catch {
        // A pointer already gone has nothing to keep.
      }
    }

    const place = (mark: SVGElement | null, at: Point): void => {
      mark?.setAttribute('transform', `translate(${at.x.toFixed(2)} ${at.y.toFixed(2)})`)
    }
    const draw = (): void => {
      place(puckMark.current, table.puck)
      place(readerMark.current, table.reader)
      place(herMark.current, table.her)
    }

    /**
     * Has her say something about the goal just scored, where it turned the match: she takes
     * the lead, falls well behind, pulls level or is a goal from the end. A few times a match at
     * most, and never on the last goal, which the scene's own reply answers.
     */
    const remark = (): void => {
      const now = latest.current
      if (remarks >= REMARKS[now.chattiness]) return
      const swing = swingAt(her.name, scored, toWin)
      // Talkative, she has a word for an ordinary goal too.
      if (!swing && now.chattiness !== 'lots') return
      remarks++
      speaking = true
      const mine = ++remarked
      // Only the remark the table is waiting on may let it go: a late one changes nothing.
      const done = (): void => {
        if (mine !== remarked) return
        clearTimeout(hold)
        speaking = false
      }
      clearTimeout(hold)
      hold = setTimeout(done, REMARK_WAIT_MS)
      void now
        .say(her.charId, swing ? swing.cue : goalCue(her.name, scored, toWin))
        .then(done, done)
    }

    const goal = (by: Side, at: number): void => {
      scored.push(by)
      setGoals([...scored])
      latest.current.narrate(goalLine(her.name, scored))
      if (matchOver(scored, toWin)) {
        ended = true
        const count = scoreOf(scored)
        const result = (): void => {
          if (gone) return
          latest.current.finish({
            outcome: count.mine > count.hers ? 'won' : 'lost',
            summary: matchSummary(her.name, scored),
            account: matchAccount(her.name, scored, toWin)
          })
        }
        if (latest.current.stepped && !latest.current.playByPlay) {
          latest.current.progress(matchAccountSoFar(her.name, scored, toWin))
          hold = setTimeout(result, STEPPED_END_MS)
        } else result()
        return
      }
      latest.current.progress(matchAccountSoFar(her.name, scored, toWin))
      remark()
      serveTo = by === 'her' ? 'reader' : 'her'
      stillUntil = at + GOAL_PAUSE_MS
      setWaiting(true)
    }

    // The serve: the puck with `to`, her mallet back at her end, his where it was.
    const serve = (to: Side): void => {
      const reader = table.reader
      table = freshTable(to)
      table.reader = reader
      mind = freshMind()
      owed = 0
    }

    const tick = (at: number): void => {
      if (gone || ended) return
      frame = requestAnimationFrame(tick)
      const passed = Math.max(0, Math.min((at - last) / 1000, MAX_FRAME_S))
      last = at
      // Looking elsewhere, nothing moves: not the puck, not her mallet, not his.
      if (awayNow.current) {
        wasAway = true
        return
      }
      if (wasAway) {
        wasAway = false
        resumeAt = at + RESUME_MS
        owed = 0
      }
      if (resumeAt) {
        if (at < resumeAt) {
          const left = Math.ceil(((resumeAt - at) / RESUME_MS) * RESUME_COUNT)
          if (left !== shown) {
            shown = left
            setCount(left)
          }
          return
        }
        resumeAt = 0
        shown = 0
        setCount(null)
      }
      if (at < stillUntil || speaking) return
      if (serveTo) {
        serve(serveTo)
        serveTo = null
        setWaiting(false)
        draw()
        return
      }
      owed += passed
      while (owed >= STEP) {
        owed -= STEP
        const by = advance(table, mind, hand, her.skill)
        if (by) {
          draw()
          goal(by, at)
          return
        }
        // A puck come to rest in a mouth is a goal, as if it had gone through.
        const resting = sunk(table, mind)
        if (resting) {
          draw()
          goal(resting, at)
          return
        }
        // A puck nobody is going to play is served again, to whoever's half it lies in.
        const lying = stalled(table, mind)
        if (lying) serve(lying)
      }
      draw()
    }

    draw()
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerdown', follow)
    const surface = field.current
    surface?.addEventListener('pointerdown', keep)
    frame = requestAnimationFrame(tick)
    return () => {
      gone = true
      cancelAnimationFrame(frame)
      clearTimeout(hold)
      surface?.removeEventListener('pointerdown', keep)
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerdown', follow)
    }
    // One table for the life of the component: what it reads of the framework it reads as it goes.
  }, [])

  const mouth = (TABLE_W - GOAL_W) / 2
  const held = !over && (away || count !== null)

  return (
    <div className="vu-airhockey">
      <div className="vu-airhockey-side">
        <p className="vu-airhockey-score">
          <span className="vu-airhockey-who">{her?.name ?? 'her'}</span>
          <span className="vu-airhockey-goals">{hers}</span>
        </p>
        <p className="vu-airhockey-score vu-airhockey-score--mine">
          <span className="vu-airhockey-goals">{mine}</span>
          <span className="vu-airhockey-who">you</span>
        </p>
      </div>

      <div className={`vu-airhockey-table${held ? ' vu-airhockey-table--held' : ''}`}>
        <svg
          ref={field}
          className="vu-airhockey-field"
          viewBox={`0 0 ${TABLE_W} ${TABLE_H}`}
          role="img"
          aria-label={`Air hockey table. You ${mine}, ${her?.name ?? 'her'} ${hers}.`}
        >
          <line
            className="vu-airhockey-line"
            x1={0}
            y1={TABLE_H / 2}
            x2={TABLE_W}
            y2={TABLE_H / 2}
          />
          <circle className="vu-airhockey-line" cx={TABLE_W / 2} cy={TABLE_H / 2} r={38} />
          <path
            className="vu-airhockey-line"
            d={`M ${mouth} 0 A ${GOAL_W / 2} ${GOAL_W / 2} 0 0 0 ${mouth + GOAL_W} 0`}
          />
          <path
            className="vu-airhockey-line"
            d={`M ${mouth} ${TABLE_H} A ${GOAL_W / 2} ${GOAL_W / 2} 0 0 1 ${mouth + GOAL_W} ${TABLE_H}`}
          />
          {/* The goal mouths: the gap in each end wall. */}
          <rect className="vu-airhockey-mouth" x={mouth} y={0} width={GOAL_W} height={5} />
          <rect
            className="vu-airhockey-mouth"
            x={mouth}
            y={TABLE_H - 5}
            width={GOAL_W}
            height={5}
          />

          <g ref={herMark} className="vu-airhockey-mallet vu-airhockey-mallet--hers">
            <circle r={MALLET_R - 1.5} />
            <circle className="vu-airhockey-knob" r={MALLET_R * 0.42} />
          </g>
          <g ref={readerMark} className="vu-airhockey-mallet">
            <circle r={MALLET_R - 1.5} />
            <circle className="vu-airhockey-knob" r={MALLET_R * 0.42} />
          </g>
          <circle ref={puckMark} className="vu-airhockey-puck" r={PUCK_R - 1} />
        </svg>
        {held && (
          <p className="vu-airhockey-held" role="status">
            {away ? 'Paused' : count}
          </p>
        )}
      </div>

      <div className="vu-airhockey-side vu-airhockey-side--notes">
        <p className="vu-airhockey-note">first to {toWin}</p>
        <p className="vu-airhockey-note vu-airhockey-note--state">
          {over
            ? endNote
            : away
              ? 'paused'
              : count
                ? 'get ready'
                : waiting
                  ? scoredNote
                  : 'in play'}
        </p>
        <p className="vu-airhockey-note">your mallet follows the pointer</p>
      </div>
    </div>
  )
}
