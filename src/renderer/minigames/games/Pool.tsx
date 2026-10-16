import { useEffect, useRef, useState, type JSX } from 'react'
import {
  BALL_R,
  MAX_STEPS,
  POCKETS,
  STEP,
  TABLE_H,
  TABLE_W,
  aimGuide,
  ballsLeft,
  canBreakFrom,
  canPlace,
  cloneBalls,
  freshLog,
  freshRack,
  groupOf,
  herShot,
  matchAccount,
  matchProgress,
  matchSituation,
  matchSummary,
  otherSide,
  placeCue,
  racksWon,
  resolveShot,
  shotCue,
  shotLine,
  soloAccount,
  soloProgress,
  soloSummary,
  stepBalls,
  strike,
  type Group,
  type HerShot,
  type Point,
  type Rack,
  type RackRecord,
  type ShotRecord,
  type Side
} from '@shared/minigameRules/pool'
import { useAway, type GamePlay, type PlayResult } from '../kit'
import '../../vu_styles/Pool.css'

/** How many times in a match she says something about a shot, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 8 } as const
/** Talkative, she has a word for an ordinary shot too, but not for every one: this many go by between. */
const ORDINARY_EVERY = 3

/** The longest the table waits on something she is saying. */
const REMARK_WAIT_MS = 3000
/** The beat after the balls stop before the next turn is taken up. */
const TURN_PAUSE_MS = 450
/** How long she looks the table over, and how long her line of aim shows before she plays. */
const HER_PAUSE_MS = 900
const HER_AIM_MS = 750
/** The beat between one rack and the next. */
const RACK_PAUSE_MS = 1800
/**
 * How long the last shot stands told under the table before the result is handed over, read at
 * the reader's own pace with the shots kept off the box: nothing there is left for him to step
 * past, so the table would otherwise clear at once.
 */
const END_HOLD_MS = 2200
/** The most time one frame may ask the table to make up, after a stall. */
const MAX_FRAME_S = 0.1
/** How long the power takes to climb from nothing to full; held longer, it comes back down. */
const CHARGE_S = 1.1
/** A press let go under this much power is no shot at all. */
const LEAST_POWER = 0.05
/** The wood round the cloth, in the table's units. */
const RAIL = 26

type Phase = 'aim' | 'charging' | 'place' | 'rolling' | 'settled' | 'her' | 'her-aim' | 'between' | 'over'

/** What is shown round the table, as it stands between frames. */
interface Hud {
  phase: Phase
  turn: Side
  groups: Record<Side, Group | null>
  left: Record<Side, number[]>
  won: Record<Side, number>
  shots: number
  fouls: number
  winner: Side | null
  /** The next shot is the break: the cue ball may still be moved behind the head string. */
  breaking: boolean
}

/**
 * A ball drawn about its own centre: the cue ball plain, a solid filled, a stripe banded, the eight
 * dark. On the table a ball carries no number, which nobody could read at its size and which only
 * hid the colour: a solid is a disc of colour and a stripe an ivory ball with a band across its middle.
 * In the trays over the table, where they are counted off, each keeps its number.
 */
function BallMark({ id, r, numbered = true }: { id: number; r: number; numbered?: boolean }): JSX.Element {
  const group = groupOf(id)
  const half = r * 0.5
  const wide = Math.sqrt(r * r - half * half)
  return (
    <>
      <circle
        className={
          id === 0
            ? 'vu-pool-ball vu-pool-ball--cue'
            : id === 8
              ? 'vu-pool-ball vu-pool-ball--eight'
              : group === 'solids'
                ? 'vu-pool-ball vu-pool-ball--solid'
                : 'vu-pool-ball vu-pool-ball--stripe'
        }
        r={r}
      />
      {group === 'stripes' && (
        <path
          className="vu-pool-band"
          d={`M ${-wide} ${-half} L ${wide} ${-half} A ${r} ${r} 0 0 1 ${wide} ${half} L ${-wide} ${half} A ${r} ${r} 0 0 1 ${-wide} ${-half} Z`}
        />
      )}
      {id !== 0 && numbered && (
        <>
          <circle className="vu-pool-disc" r={r * 0.42} />
          <text className="vu-pool-number" fontSize={r * 0.66} dy="0.36em">
            {id}
          </text>
        </>
      )}
    </>
  )
}

/** The balls a side has still to pot, in a row. */
function Tray({ ids }: { ids: readonly number[] }): JSX.Element {
  return (
    <svg className="vu-pool-tray" viewBox="0 0 154 22" aria-hidden="true">
      {ids.map((id, i) => (
        <g key={id} transform={`translate(${11 + i * 22} 11)`}>
          <BallMark id={id} r={9.5} />
        </g>
      ))}
    </svg>
  )
}

const hudOf = (rack: Rack, phase: Phase, racks: readonly RackRecord[], shots: readonly ShotRecord[]): Hud => ({
  phase,
  turn: rack.turn,
  groups: rack.groups,
  left: { reader: ballsLeft(rack, 'reader'), her: ballsLeft(rack, 'her') },
  won: racksWon(racks),
  shots: shots.length,
  fouls: shots.filter((shot) => shot.foul).length,
  winner: rack.winner,
  breaking: rack.breaking
})

/**
 * Pool: an eight-ball table seen from above. The reader aims with the pointer, a line and a
 * ghost ball showing where the cue ball will first land, holds the button down to bring the
 * power up and lets go to play; with the cue ball in hand a click puts it down, and before a break
 * a click behind the head string moves it there. Her shots are the
 * rules' own, at her skill, shown for a beat before they are played. The table runs a fixed step
 * at a time. Every shot is told in the line under the table, which stays until the next; the
 * dialogue box tells it too only where play-by-play is on.
 */
export function Pool({ play }: { play: GamePlay }): JSX.Element {
  const her = play.opponents[0]
  const race = play.options.race ?? 1
  const [hud, setHud] = useState<Hud>(() => hudOf(freshRack('reader', !her), 'aim', [], []))
  // The last shot, or the next rack called, as it is told: the line under the table until the next.
  const [lastTold, setLastTold] = useState<string | null>(null)

  // The framework's side of the game as it is now, for a loop that outlives any one render.
  const latest = useRef(play)
  latest.current = play
  // Whether he is looking elsewhere, for the same loop: nothing of hers is played unseen.
  const away = useRef(false)
  away.current = useAway()

  const field = useRef<SVGSVGElement>(null)
  const ballMarks = useRef<(SVGGElement | null)[]>([])
  const aimMark = useRef<SVGGElement>(null)
  const aimLine = useRef<SVGLineElement>(null)
  const ghostMark = useRef<SVGCircleElement>(null)
  const sendLine = useRef<SVGLineElement>(null)
  const handMark = useRef<SVGCircleElement>(null)
  const meterFill = useRef<HTMLSpanElement>(null)

  // A match with her is on as the table opens, and says so; alone nothing is said until a shot.
  const opened = useRef(false)
  useEffect(() => {
    // Said the once, however many times the table is mounted.
    if (opened.current) return
    opened.current = true
    if (her)
      play.narrate(
        `${her.name} chalks a cue while you rack the balls. Eight-ball, ${race > 1 ? 'best of three' : 'one rack'}: you break.`
      )
    // Once, as the table opens.
  }, [])

  // The table itself: the pointer, the clock and the play, from the break to the last ball or to
  // the table being cleared from under it.
  useEffect(() => {
    const solo = !her
    let rack = freshRack('reader', solo)
    let pre = cloneBalls(rack.balls)
    let log = freshLog()
    let phase: Phase = 'aim'
    const racks: RackRecord[] = []
    let shots: ShotRecord[] = []
    let breaker: Side = 'reader'
    // The shot she has chosen, from when she settles over it until it is judged.
    let plan: HerShot | null = null
    let pointer: Point = { x: TABLE_W * 0.75, y: TABLE_H / 2 }
    let chargeFrom = 0
    let power = 0
    // What happens next, and when: held back for as long as she is speaking.
    let due: { at: number; run: (at: number) => void } | null = null
    let remarks = 0
    let sinceRemark = 0
    let speaking = false
    // A line of hers asked for and not yet come back, however long ago the table stopped waiting on it.
    let saying = false
    // How many steps the shot on the table has been run for.
    let rolled = 0
    let remarked = 0
    let hold: ReturnType<typeof setTimeout> | undefined
    let frame = 0
    let last = performance.now()
    let owed = 0
    let begun = false
    // What was due was held back while he looked elsewhere.
    let held = false
    let ended = false
    let gone = false

    /** Shows the table's standing round it, and tells the framework how the match stands. */
    const sync = (): void => {
      if (gone) return
      setHud(hudOf(rack, phase, racks, shots))
      if (her) latest.current.situation(matchSituation(her.name, rack, racksWon(racks), race, latest.current.stake))
    }

    /** Tells a shot or a rack: under the table always, and in the dialogue box where play-by-play has it. */
    const told = (line: string): Promise<void> => {
      if (!gone) setLastTold(line)
      return latest.current.narrate(line)
    }

    /** Hands over the result; read at his own pace with nothing on the box, after the last shot has stood a beat. */
    const finish = (result: PlayResult): void => {
      const now = latest.current
      if (!now.stepped || now.playByPlay) {
        now.finish(result)
        return
      }
      setTimeout(() => {
        if (!gone) latest.current.finish(result)
      }, END_HOLD_MS)
    }

    const toTable = (event: PointerEvent): Point | null => {
      const svg = field.current
      if (!svg) return null
      // Through the drawing's own mapping, so the stage's scale and the surface's lean are both
      // undone exactly.
      try {
        const map = svg.getScreenCTM()?.inverse()
        if (map) {
          const at = new DOMPoint(event.clientX, event.clientY).matrixTransform(map)
          if (Number.isFinite(at.x) && Number.isFinite(at.y)) return { x: at.x, y: at.y }
        }
      } catch {
        // A drawing with no size has no mapping: its box below, or nothing.
      }
      const box = svg.getBoundingClientRect()
      if (box.width === 0 || box.height === 0) return null
      return {
        x: ((event.clientX - box.left) / box.width) * (TABLE_W + RAIL * 2) - RAIL,
        y: ((event.clientY - box.top) / box.height) * (TABLE_H + RAIL * 2) - RAIL
      }
    }

    const cue = (): Point => rack.balls[0]
    const aimAngle = (): number => Math.atan2(pointer.y - cue().y, pointer.x - cue().x)

    const show = (mark: SVGElement | null, on: boolean): void => {
      mark?.setAttribute('visibility', on ? 'visible' : 'hidden')
    }
    const draw = (): void => {
      for (const ball of rack.balls) {
        const mark = ballMarks.current[ball.id]
        if (!mark) continue
        show(mark, !ball.potted)
        if (!ball.potted) mark.setAttribute('transform', `translate(${ball.x.toFixed(2)} ${ball.y.toFixed(2)})`)
      }
      // The line of aim: the reader's while he lines up and charges, hers for the beat before she plays.
      const aiming = phase === 'aim' || phase === 'charging' || (phase === 'her-aim' && plan !== null)
      show(aimMark.current, aiming)
      if (aiming) {
        const from = cue()
        const guide = aimGuide(rack.balls, from, phase === 'her-aim' && plan ? plan.angle : aimAngle())
        const line = aimLine.current
        line?.setAttribute('x1', from.x.toFixed(2))
        line?.setAttribute('y1', from.y.toFixed(2))
        line?.setAttribute('x2', guide.ghost.x.toFixed(2))
        line?.setAttribute('y2', guide.ghost.y.toFixed(2))
        ghostMark.current?.setAttribute('cx', guide.ghost.x.toFixed(2))
        ghostMark.current?.setAttribute('cy', guide.ghost.y.toFixed(2))
        const struck = guide.hit === null ? null : rack.balls[guide.hit]
        show(sendLine.current, struck !== null && guide.send !== null)
        if (struck && guide.send) {
          const send = sendLine.current
          send?.setAttribute('x1', struck.x.toFixed(2))
          send?.setAttribute('y1', struck.y.toFixed(2))
          send?.setAttribute('x2', (struck.x + guide.send.x * 46).toFixed(2))
          send?.setAttribute('y2', (struck.y + guide.send.y * 46).toFixed(2))
        }
      }
      // The cue ball in his hand follows the pointer, faint where it cannot be put down.
      const hand = handMark.current
      show(hand, phase === 'place')
      if (phase === 'place' && hand) {
        hand.setAttribute('cx', pointer.x.toFixed(2))
        hand.setAttribute('cy', pointer.y.toFixed(2))
        hand.setAttribute('opacity', canPlace(rack.balls, pointer) ? '0.9' : '0.25')
      }
      if (meterFill.current)
        meterFill.current.style.transform = `scaleX(${phase === 'charging' ? power.toFixed(3) : 0})`
    }

    /**
     * Has her say something about the shot just judged: at the moments worth it however little
     * she talks, and now and then about an ordinary one when she talks a lot. Never about the
     * shot that ends the match, which the scene's own reply answers.
     */
    const remark = (shot: ShotRecord): void => {
      if (!her) return
      const now = latest.current
      sinceRemark++
      // One line of hers at a time: a shot that comes while one is still being written goes unremarked.
      if (saying) return
      if (remarks >= REMARKS[now.chattiness]) return
      const about = shotCue(her.name, shot)
      if (!about) return
      if (!about.notable && (now.chattiness !== 'lots' || sinceRemark < ORDINARY_EVERY)) return
      remarks++
      sinceRemark = 0
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
      saying = true
      const back = (): void => {
        saying = false
        done()
      }
      void now.say(her.charId, about.cue).then(back, back)
    }

    const shoot = (angle: number, weight: number): void => {
      if (!begun) {
        begun = true
        // Alone, the first shot is the first move; with her the opening line already was.
        if (solo) latest.current.started()
      }
      pre = cloneBalls(rack.balls)
      log = freshLog()
      strike(rack.balls, angle, weight)
      owed = 0
      rolled = 0
      phase = 'rolling'
      sync()
    }

    /** She settles over the shot she has chosen, her line of aim showing for a beat before she plays. */
    const herPlay = (at: number): void => {
      if (!her) return
      const chosen = herShot(rack, her.skill)
      plan = chosen
      if (chosen.place) placeCue(rack.balls, chosen.place)
      rack.inHand = false
      phase = 'her-aim'
      sync()
      due = { at: at + HER_AIM_MS, run: () => shoot(chosen.angle, chosen.power) }
    }

    /**
     * Whoever is on takes the table. The reader's is his at once. Hers, at his own pace, waits
     * until he has read past everything said so far, the shot before it included; `said` is a
     * turn already told of, the break of a rack just called.
     */
    const beginTurn = (at: number, said = false): void => {
      if (rack.turn === 'her' && her) {
        phase = 'her'
        sync()
        if (!latest.current.stepped) {
          due = { at: at + HER_PAUSE_MS, run: herPlay }
          return
        }
        if (said) {
          herPlay(at)
          return
        }
        // Through the clock, so that it too waits while he looks elsewhere. With the shots kept
        // off the box there may have been nothing to read, so she still looks the table over.
        const go = (): void => {
          if (gone || ended) return
          due = { at: performance.now() + (latest.current.playByPlay ? 0 : HER_PAUSE_MS), run: herPlay }
        }
        void latest.current.read().then(go, go)
        return
      }
      phase = rack.inHand ? 'place' : 'aim'
      sync()
    }

    const nextRack = (at: number): void => {
      const next = otherSide(breaker)
      const set = (then: number, said: boolean): void => {
        breaker = next
        shots = []
        rack = freshRack(breaker)
        beginTurn(then, said)
      }
      if (!her) {
        set(at, false)
        return
      }
      const called = told(`Rack ${racks.length + 1}. ${next === 'reader' ? 'You break' : `${her.name} breaks`}.`)
      if (!latest.current.stepped) {
        set(at, false)
        return
      }
      // At his own pace the rack just won stays on the table until he has read how it ended.
      const go = (): void => {
        if (gone || ended) return
        set(performance.now(), true)
      }
      void called.then(go, go)
    }

    /** The balls have stopped: the shot is judged, said, and the next thing set going. */
    const settle = (at: number): void => {
      const got = resolveShot(rack, pre, log, plan?.expected, plan?.aimError ?? null)
      plan = null
      rack = got.rack
      shots.push(got.record)
      const now = latest.current
      void told(shotLine(her?.name ?? '', got.record, solo))
      // What the scene is to know of it, should he walk away from here.
      const tell = (): void => {
        now.progress(her ? matchProgress(her.name, rack, racksWon(racks), race) : soloProgress(rack, shots))
      }

      if (rack.winner && solo) {
        ended = true
        phase = 'over'
        sync()
        finish({ outcome: 'played', summary: soloSummary(shots), account: soloAccount(shots) })
        return
      }
      if (rack.winner && her) {
        const left = (side: Side): number => (rack.groups[side] ? ballsLeft(rack, side).length : 7)
        racks.push({ breaker, shots, winner: rack.winner, left: { reader: left('reader'), her: left('her') } })
        const won = racksWon(racks)
        if (won[rack.winner] >= race) {
          ended = true
          phase = 'over'
          sync()
          finish({
            outcome: won.reader > won.her ? 'won' : 'lost',
            summary: matchSummary(her.name, racks),
            account: matchAccount(her.name, racks, race)
          })
          return
        }
        phase = 'between'
        sync()
        tell()
        remark(got.record)
        // At his own pace the next rack waits on him, not on the clock; but with the shots kept
        // off the box there is nothing of the rack's end for him to read there, so the rack just
        // won stands its beat.
        due = { at: now.stepped && now.playByPlay ? at : at + RACK_PAUSE_MS, run: nextRack }
        return
      }
      phase = 'settled'
      sync()
      tell()
      remark(got.record)
      if (now.stepped) {
        // At his own pace his turn is his at once, whatever she is saying; hers waits on a word
        // of hers, so that it is among what he reads before she plays.
        if (rack.turn === 'reader' || !her) beginTurn(at)
        else due = { at, run: beginTurn }
        return
      }
      due = { at: at + TURN_PAUSE_MS, run: beginTurn }
    }

    const follow = (event: PointerEvent): void => {
      const at = toTable(event)
      if (at) pointer = at
    }
    const press = (event: PointerEvent): void => {
      if (event.button !== 0 || ended) return
      follow(event)
      if (phase === 'place') {
        if (!canPlace(rack.balls, pointer)) return
        placeCue(rack.balls, pointer)
        rack.inHand = false
        phase = 'aim'
        sync()
        return
      }
      if (phase !== 'aim') return
      // Before a break, a click behind the head string moves the cue ball there and is no shot.
      if (rack.breaking && canBreakFrom(rack.balls, pointer)) {
        placeCue(rack.balls, pointer)
        sync()
        return
      }
      try {
        field.current?.setPointerCapture(event.pointerId)
      } catch {
        // A pointer already gone has nothing to keep.
      }
      chargeFrom = performance.now()
      power = 0
      phase = 'charging'
      sync()
    }
    const release = (): void => {
      if (phase !== 'charging') return
      if (power < LEAST_POWER) {
        phase = 'aim'
        sync()
        return
      }
      shoot(aimAngle(), power)
    }
    // A press that is taken away rather than let go is no shot.
    const drop = (): void => {
      if (phase !== 'charging') return
      phase = 'aim'
      sync()
    }

    const tick = (at: number): void => {
      if (gone) return
      const passed = Math.max(0, Math.min((at - last) / 1000, MAX_FRAME_S))
      last = at
      // While he looks elsewhere nothing of hers goes on: her shot stands where it is and
      // whatever was due waits, then is given a beat once he is back.
      const out = away.current
      if (out) held = true
      else if (held) {
        held = false
        if (due) due.at = Math.max(due.at, at + TURN_PAUSE_MS)
      }
      if (phase === 'rolling' && !(out && plan)) {
        owed += passed
        while (owed >= STEP) {
          owed -= STEP
          // A shot that has run its longest is stopped where it is, as the rules' own is.
          if (!stepBalls(rack.balls, log) || ++rolled >= MAX_STEPS) {
            for (const ball of rack.balls) {
              ball.vx = 0
              ball.vy = 0
            }
            settle(at)
            break
          }
        }
      } else if (phase === 'charging') {
        // Up to full and back down again, for as long as it is held.
        const held = (Math.max(0, performance.now() - chargeFrom) / 1000 / CHARGE_S) % 2
        power = held <= 1 ? held : 2 - held
      }
      if (due && !speaking && !ended && !out && at >= due.at) {
        const run = due.run
        due = null
        run(at)
      }
      draw()
      // The last frame shows how it ended; nothing runs after it.
      if (!ended) frame = requestAnimationFrame(tick)
    }

    sync()
    draw()
    const surface = field.current
    window.addEventListener('pointermove', follow)
    window.addEventListener('pointerup', release)
    window.addEventListener('pointercancel', drop)
    window.addEventListener('blur', drop)
    surface?.addEventListener('pointerdown', press)
    frame = requestAnimationFrame(tick)
    return () => {
      gone = true
      cancelAnimationFrame(frame)
      clearTimeout(hold)
      surface?.removeEventListener('pointerdown', press)
      window.removeEventListener('pointermove', follow)
      window.removeEventListener('pointerup', release)
      window.removeEventListener('pointercancel', drop)
      window.removeEventListener('blur', drop)
    }
    // One table for the life of the component: what it reads of the framework it reads as it goes.
  }, [])

  const name = her?.name ?? ''
  const mine = hud.turn === 'reader'
  const status =
    hud.phase === 'over'
      ? her
        ? hud.winner === 'reader'
          ? 'your match'
          : `${name}'s match`
        : 'table clear'
      : hud.phase === 'between'
        ? hud.winner === 'reader'
          ? 'your rack'
          : `${name}'s rack`
        : hud.phase === 'rolling' || hud.phase === 'settled'
          ? 'balls rolling'
          : hud.phase === 'place'
            ? 'ball in hand: click to put the cue ball down'
            : hud.phase === 'her' || hud.phase === 'her-aim'
              ? `${name} is at the table`
              : hud.phase === 'charging'
                ? 'let go to play'
                : hud.breaking
                  ? 'your break: click behind the line to move the cue ball; aim, hold for power, let go to play'
                  : 'aim with the pointer, hold for power, let go to play'
  // The last shot told stands in the line; what is for him to do joins it where it must be said.
  const line = !lastTold
    ? status
    : hud.phase === 'over' || hud.phase === 'between'
      ? `${lastTold} · ${status}`
      : hud.phase === 'place'
        ? `${lastTold} · click to put the cue ball down`
        : hud.breaking && (hud.phase === 'aim' || hud.phase === 'charging')
          ? `${lastTold} · click behind the line to move the cue ball`
          : lastTold
  // The power is wanted only while he lines up and plays; otherwise the line has the width.
  const aiming = hud.phase === 'aim' || hud.phase === 'charging'
  const groupWord = (side: Side): string =>
    hud.groups[side] ? (hud.left[side].length === 0 ? `${hud.groups[side]}: on the eight` : `${hud.groups[side]}`) : 'open table'

  return (
    <div className="vu-pool">
      <div className="vu-pool-head">
        <div className="vu-pool-side" data-turn={mine && hud.phase !== 'over' ? '' : undefined}>
          <div className="vu-pool-name">
            <p className="vu-pool-who">you</p>
            <p className="vu-pool-group" data-set={her && hud.groups.reader ? '' : undefined}>
              {her
                ? groupWord('reader')
                : `${hud.shots} ${hud.shots === 1 ? 'shot' : 'shots'} · ${hud.fouls} ${hud.fouls === 1 ? 'foul' : 'fouls'}`}
            </p>
          </div>
          {her && <Tray ids={hud.left.reader} />}
        </div>
        <div className="vu-pool-match">
          {her ? (
            <>
              <p className="vu-pool-racks">
                {hud.won.reader} – {hud.won.her}
              </p>
              <p className="vu-pool-terms">{race > 1 ? 'best of three racks' : 'one rack'}</p>
            </>
          ) : (
            <>
              <p className="vu-pool-racks">{hud.left.reader.length}</p>
              <p className="vu-pool-terms">balls to clear</p>
            </>
          )}
        </div>
        <div
          className="vu-pool-side vu-pool-side--hers"
          data-turn={her && !mine && hud.phase !== 'over' ? '' : undefined}
        >
          {her && (
            <>
              <div className="vu-pool-name">
                <p className="vu-pool-who">{name}</p>
                <p className="vu-pool-group" data-set={hud.groups.her ? '' : undefined}>
                  {groupWord('her')}
                </p>
              </div>
              <Tray ids={hud.left.her} />
            </>
          )}
        </div>
      </div>

      <div className="vu-pool-table">
        <svg
          ref={field}
          className="vu-pool-field"
          viewBox={`${-RAIL} ${-RAIL} ${TABLE_W + RAIL * 2} ${TABLE_H + RAIL * 2}`}
          data-phase={hud.phase}
          role="img"
          aria-label={her ? `Pool table. Racks: you ${hud.won.reader}, ${name} ${hud.won.her}.` : 'Pool table.'}
        >
          <rect
            className="vu-pool-rail"
            x={2 - RAIL}
            y={2 - RAIL}
            width={TABLE_W + RAIL * 2 - 4}
            height={TABLE_H + RAIL * 2 - 4}
            rx={RAIL - 2}
          />
          <rect className="vu-pool-cloth" x={0} y={0} width={TABLE_W} height={TABLE_H} rx={6} />
          <line className="vu-pool-mark" x1={TABLE_W / 4} y1={0} x2={TABLE_W / 4} y2={TABLE_H} />
          <circle className="vu-pool-spot" cx={(TABLE_W * 3) / 4} cy={TABLE_H / 2} r={2.5} />
          {POCKETS.map((pocket, i) => (
            <circle key={i} className="vu-pool-pocket" cx={pocket.x} cy={pocket.y} r={pocket.r - 5} />
          ))}

          <g ref={aimMark} className="vu-pool-aim" visibility="hidden">
            <line ref={aimLine} className="vu-pool-aimline" />
            <line ref={sendLine} className="vu-pool-sendline" />
            <circle ref={ghostMark} className="vu-pool-ghost" r={BALL_R - 1} />
          </g>

          {Array.from({ length: 16 }, (_, id) => (
            <g
              key={id}
              ref={(mark) => {
                ballMarks.current[id] = mark
              }}
            >
              <BallMark id={id} r={BALL_R - 0.75} numbered={false} />
            </g>
          ))}
          <circle ref={handMark} className="vu-pool-hand" r={BALL_R - 0.75} visibility="hidden" />
        </svg>
      </div>

      <div className="vu-pool-foot">
        <p className="vu-pool-status" data-told={lastTold ? '' : undefined} aria-live="polite">
          {line}
        </p>
        <span
          className="vu-pool-meter"
          data-live={hud.phase === 'charging' ? '' : undefined}
          data-idle={aiming ? undefined : ''}
          aria-hidden="true"
        >
          <span ref={meterFill} className="vu-pool-meterfill" />
        </span>
      </div>
    </div>
  )
}
