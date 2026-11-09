import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import {
  LANES,
  difficultyOf,
  emptyTally,
  gradeOf,
  halfwayLine,
  herDance,
  judge,
  makeChart,
  missed,
  noteToHit,
  points,
  scoreShare,
  soloAccount,
  soloSummary,
  startLine,
  tallied,
  versusAccount,
  versusSummary,
  type Judgement,
  type Lane,
  type Tally
} from '@shared/minigameRules/paradiso'
import { typingIn, useWindowKeydown } from '../kit'
import { gestures, lift, press } from '../kit'
import type { GamePlay } from '../kit'
import '../../vu_styles/Paradiso.css'

/** The keys that step on each pad: the arrows, and a row for two hands. */
const KEYS: Readonly<Record<string, Lane>> = {
  ArrowLeft: 0,
  ArrowDown: 1,
  ArrowUp: 2,
  ArrowRight: 3,
  d: 0,
  f: 1,
  j: 2,
  k: 3
}

/** How many times in a song she says something, by how talkative she is to be. */
const REMARKS = { quiet: 0, some: 3, lots: 6 } as const

/** The combos worth a word as they are reached, and how long a run has to be for its end to be. */
const COMBOS_TOLD = [30, 60, 100]
const BREAK_TOLD = 20

/** Where the song's last stretch begins, as a share of it. */
const FINAL_STRETCH = 0.8

/** The lanes' height and where the targets stand in them, in stage units: Paradiso.css's own. */
const FIELD_HEIGHT = 340
const TARGET_TOP = 14
/** How long a note that went by unstepped is still drawn, drifting on past its target, in ms. */
const PAST_MS = 260
/** How long a pad stays lit after it is stepped on, in ms. */
const LIT_MS = 110
/** How far ahead of the song the beat's ticks are handed to the audio clock, in ms. */
const TICK_AHEAD_MS = 160
/** The most of the sound card's own delay a tick is sent early by, in ms. */
const LATENCY_CAP_MS = 80

const WORD: Readonly<Record<Judgement, string>> = {
  perfect: 'Perfect',
  great: 'Great',
  good: 'Good',
  miss: 'Miss'
}

/** What the screen shows of one dancer: the count, and the last step's judgement. */
interface Side {
  tally: Tally
  last: Judgement | null
  /** How many steps have been judged: what the judgement's pop is keyed on. */
  steps: number
}

const freshSide = (): Side => ({ tally: emptyTally(), last: null, steps: 0 })

/** The song as it is being danced: read and written by the frame loop, never rendered from. */
interface Live {
  /**
   * `performance.now()` at the song's first moment, or -1 before it. Moved on by every pause,
   * so the clock less this is always how far into the song it is.
   */
  startedAt: number
  /** `performance.now()` when the song was stopped for a window that went away, or -1 while it runs. */
  pausedAt: number
  over: boolean
  /** The reader's judgement of each note, by its place in the chart. */
  judged: (Judgement | undefined)[]
  mine: Side
  hers: Side
  /** The first note not yet swept for a miss, and the first she has not yet stepped on. */
  sweepFrom: number
  herFrom: number
  /** The notes on screen: from, and up to but not including. */
  shownFrom: number
  shownTo: number
  halfway: boolean
  finalStretch: boolean
  /** The reader's score less hers at the halfway mark. */
  halfwayGap: number
  remarks: number
  speaking: boolean
  /** The next beat to be given its tick. */
  nextBeat: number
  /** When each pad was last stepped on, in song time. */
  pressed: number[]
}

function Arrow(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 21.5 12H16v9.5H8V12H2.5Z" />
    </svg>
  )
}

/** A soft kick on the beat, on the audio clock; the first of each bar a little louder. */
function tick(audio: AudioContext, when: number, strong: boolean): void {
  try {
    const voice = audio.createOscillator()
    const level = audio.createGain()
    voice.type = 'sine'
    voice.frequency.setValueAtTime(strong ? 170 : 130, when)
    voice.frequency.exponentialRampToValueAtTime(48, when + 0.09)
    level.gain.setValueAtTime(0.0001, when)
    level.gain.exponentialRampToValueAtTime(strong ? 0.09 : 0.055, when + 0.006)
    level.gain.exponentialRampToValueAtTime(0.0001, when + 0.13)
    voice.connect(level).connect(audio.destination)
    voice.start(when)
    voice.stop(when + 0.15)
  } catch {
    // No sound, then: the targets still pulse on the beat.
  }
}

/** One dancer's corner of the screen: the score, the last judgement, the combo, the grade at the end. */
function Board({
  who,
  side,
  notes,
  over
}: {
  who: string
  side: Side
  notes: number
  over: boolean
}): JSX.Element {
  return (
    <div className="vu-paradiso-board">
      <span className="vu-paradiso-who">{who}</span>
      <span className="vu-paradiso-score">{points(side.tally.score)}</span>
      {over ? (
        <motion.span
          className="vu-paradiso-grade"
          initial={{ opacity: 0, scale: 1.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {gradeOf(scoreShare(side.tally.score, notes))}
        </motion.span>
      ) : (
        // Keyed on the count, so each step's judgement lands as a new one.
        <motion.span
          key={side.steps}
          className="vu-paradiso-judgement"
          data-judgement={side.last ?? undefined}
          initial={{ scale: 1.35 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.14, ease: 'easeOut' }}
        >
          {side.last ? WORD[side.last] : ' '}
        </motion.span>
      )}
      <span className="vu-paradiso-combo">
        {over ? `best combo ${side.tally.maxCombo}` : side.tally.combo > 1 ? `${side.tally.combo} combo` : ' '}
      </span>
      <span className="vu-paradiso-counts">
        {side.tally.counts.perfect} · {side.tally.counts.great} · {side.tally.counts.good} ·{' '}
        {side.tally.counts.miss}
      </span>
    </div>
  )
}

/**
 * PARADISO: one song on a dance machine. Arrows climb four lanes to a row of targets and are
 * stepped on as they arrive, with the arrow keys, D F J K, or a tap on a target. Alone it is
 * danced for a grade; against a girl she is on the second pad with the same steps at the same
 * time, landing them as her skill has it, and the higher score wins. The song runs off the
 * clock, and nothing waits on anything said: the box hears how it starts, how it stands halfway
 * and how it ends, and she has a word at the few moments worth one.
 */
export function Paradiso({ play }: { play: GamePlay }): JSX.Element {
  const her = play.opponents[0]
  const difficulty = difficultyOf(play.options.difficulty)
  // The song is cut once, as the machine is stepped up to, and her dance of it with it.
  const [chart] = useState(() => makeChart(`${Date.now()}:${Math.random()}`, difficulty))
  const [herSteps] = useState(() =>
    her ? herDance(chart.notes.length, her.skill, difficulty) : []
  )
  const [phase, setPhase] = useState<'ready' | 'dancing' | 'over'>('ready')
  const [mine, setMine] = useState<Side>(freshSide)
  const [hers, setHers] = useState<Side>(freshSide)
  const [paused, setPaused] = useState(false)

  const live = useRef<Live>({
    startedAt: -1,
    pausedAt: -1,
    over: false,
    judged: [],
    mine: freshSide(),
    hers: freshSide(),
    sweepFrom: 0,
    herFrom: 0,
    shownFrom: 0,
    shownTo: 0,
    halfway: false,
    finalStretch: false,
    halfwayGap: 0,
    remarks: 0,
    speaking: false,
    nextBeat: 0,
    pressed: [-Infinity, -Infinity, -Infinity, -Infinity]
  })
  // The table can be cleared mid-song: nothing is said or set once it has been.
  const mounted = useRef(true)
  const held = useRef(play)
  held.current = play
  const audio = useRef<AudioContext | null>(null)
  const root = useRef<HTMLDivElement>(null)
  const myNotes = useRef<(HTMLSpanElement | null)[]>([])
  const herNotes = useRef<(HTMLSpanElement | null)[]>([])
  const targets = useRef<(HTMLButtonElement | null)[]>([])

  const steps = chart.notes
  const firstStep = steps[0]?.time ?? chart.leadInMs
  const lastStep = steps[steps.length - 1]?.time ?? chart.leadInMs
  const halfwayAt = (firstStep + lastStep) / 2
  const finalAt = firstStep + (lastStep - firstStep) * FINAL_STRETCH

  /** How the song stands, for anything said at the machine. */
  function standing(at: number): string {
    if (!her) return ''
    const game = live.current
    const [a, b] = [game.mine.tally, game.hers.tally]
    const where = game.over
      ? 'The song has just ended.'
      : at < firstStep
        ? 'The machine is counting them in.'
        : at >= finalAt
          ? 'They are in the last stretch of the song.'
          : at >= halfwayAt
            ? 'They are past the halfway mark.'
            : 'They are in the first half of the song.'
    return [
      `The game is PARADISO, a dance machine: the reader and ${her.name} are side by side on its two pads, dancing the same steps at difficulty ${chart.difficulty} of 5, both too busy and too out of breath to say much.`,
      where,
      `The score is the reader ${points(a.score)}, ${her.name} ${points(b.score)}; the reader's combo is ${a.combo} with ${a.counts.miss} missed, hers ${b.combo} with ${b.counts.miss} missed.`,
      ...(held.current.stake ? [`Riding on it: ${held.current.stake}`] : [])
    ].join(' ')
  }

  /**
   * Has her say something about what just happened, and never holds the song for it. The
   * halfway mark and the last stretch have a remark kept for each; a combo takes one only from
   * what is left over, and nothing is said over a line of hers still on its way.
   */
  function remark(at: number, cue: string, kept = false): void {
    const game = live.current
    if (!her || game.over || game.speaking || !mounted.current) return
    const budget = REMARKS[held.current.chattiness]
    const owed = kept ? 0 : (game.halfway ? 0 : 1) + (game.finalStretch ? 0 : 1)
    if (game.remarks >= budget - owed) return
    game.remarks++
    game.speaking = true
    held.current.situation(standing(at))
    void held.current.say(her.charId, cue).finally(() => {
      game.speaking = false
    })
  }

  /** A combo reached or lost, where it is one worth a word. */
  function comboTold(at: number, who: string, before: number, after: number): void {
    if (after === 0 && before >= BREAK_TOLD) {
      remark(at, `${who} just missed a step and lost a combo of ${before}.`)
    } else if (COMBOS_TOLD.includes(after)) {
      remark(at, `${who} has just landed ${after} steps in a row without a miss.`)
    }
  }

  /** One of the reader's notes judged: counted, and taken off the lanes unless it went by. */
  function judgedMine(index: number, judgement: Judgement, at: number): void {
    const game = live.current
    const before = game.mine.tally.combo
    game.judged[index] = judgement
    game.mine = {
      tally: tallied(game.mine.tally, judgement),
      last: judgement,
      steps: game.mine.steps + 1
    }
    comboTold(at, 'The reader', before, game.mine.tally.combo)
  }

  function begin(): void {
    const game = live.current
    if (game.startedAt >= 0 || game.over || !mounted.current) return
    game.startedAt = performance.now()
    held.current.started()
    held.current.narrate(startLine(chart, her?.name))
    if (her) held.current.situation(standing(0))
    try {
      audio.current = new AudioContext()
    } catch {
      audio.current = null
    }
    setPhase('dancing')
  }

  /**
   * A foot down on a pad: the song's start while it waits, a step at a note once it runs.
   * `stamp` is when the key or the tap happened, where the event knows it better than now.
   */
  function step(lane: Lane, stamp?: number): void {
    const game = live.current
    if (game.over || !mounted.current) return
    if (game.startedAt < 0) {
      begin()
      return
    }
    // A stopped song takes no steps.
    if (game.pausedAt >= 0) return
    const now = performance.now()
    const when = stamp !== undefined && stamp > game.startedAt && stamp <= now ? stamp : now
    const at = when - game.startedAt
    game.pressed[lane] = at
    const index = noteToHit(steps, game.judged, lane, at)
    if (index < 0) return
    const judgement = judge(at - steps[index].time)
    if (!judgement) return
    judgedMine(index, judgement, at)
    const drawn = myNotes.current[index]
    if (drawn) drawn.style.display = 'none'
    setMine(game.mine)
  }

  useWindowKeydown((event) => {
    // A key typed to her is a character, never a step.
    if (typingIn(event) || event.ctrlKey || event.metaKey || event.altKey) return
    const lane = KEYS[event.key.length === 1 ? event.key.toLowerCase() : event.key]
    if (lane === undefined) return
    event.preventDefault()
    if (!event.repeat) step(lane, event.timeStamp)
  })

  // The song itself: every frame reads the clock and brings the screen up to it.
  useEffect(() => {
    if (phase !== 'dancing') return
    const game = live.current
    const travel = FIELD_HEIGHT - TARGET_TOP
    let frame = 0

    const place = (drawn: HTMLSpanElement | null, time: number, at: number, gone: boolean): void => {
      if (!drawn) return
      if (gone) {
        drawn.style.display = 'none'
        return
      }
      drawn.style.display = 'block'
      drawn.style.transform = `translateY(${(TARGET_TOP + ((time - at) / chart.scrollMs) * travel).toFixed(1)}px)`
      if (at > time + 140) drawn.dataset.past = ''
    }

    const end = (): void => {
      game.over = true
      const [a, b] = [game.mine.tally, game.hers.tally]
      const notes = steps.length
      // The scores are the result's to say: the framework shows its summary, once.
      if (her) held.current.situation(standing(chart.lengthMs))
      setPhase('over')
      if (!her) {
        held.current.finish({
          outcome: 'played',
          summary: soloSummary(difficulty, notes, a),
          account: soloAccount(chart, a)
        })
        return
      }
      held.current.finish({
        outcome: a.score > b.score ? 'won' : a.score < b.score ? 'lost' : 'draw',
        summary: versusSummary(her.name, a.score, b.score),
        account: versusAccount(her.name, chart, a, b, game.halfwayGap)
      })
    }

    const loop = (): void => {
      if (!mounted.current || game.over) return
      // Stopped: the clock stands, and so does everything read off it.
      if (game.pausedAt >= 0) {
        frame = requestAnimationFrame(loop)
        return
      }
      const at = performance.now() - game.startedAt
      let mineMoved = false
      let hersMoved = false

      // The reader's notes that went by unstepped.
      while (game.sweepFrom < steps.length && missed(steps[game.sweepFrom], at)) {
        if (game.judged[game.sweepFrom] === undefined) {
          judgedMine(game.sweepFrom, 'miss', at)
          mineMoved = true
        }
        game.sweepFrom++
      }
      // Her steps, each landed as its note arrives.
      while (her && game.herFrom < steps.length && steps[game.herFrom].time <= at) {
        const judgement = herSteps[game.herFrom] ?? 'miss'
        const before = game.hers.tally.combo
        game.hers = {
          tally: tallied(game.hers.tally, judgement),
          last: judgement,
          steps: game.hers.steps + 1
        }
        comboTold(at, her.name, before, game.hers.tally.combo)
        game.herFrom++
        hersMoved = true
      }

      // The notes on the lanes: whatever has climbed into view, less whatever has left it.
      let from = game.shownFrom
      while (from < steps.length && steps[from].time < at - PAST_MS) {
        place(myNotes.current[from], 0, 0, true)
        place(herNotes.current[from], 0, 0, true)
        from++
      }
      let to = Math.max(game.shownTo, from)
      while (to < steps.length && steps[to].time < at + chart.scrollMs) to++
      for (let i = from; i < to; i++) {
        const mark = game.judged[i]
        place(myNotes.current[i], steps[i].time, at, mark !== undefined && mark !== 'miss')
        if (her) place(herNotes.current[i], steps[i].time, at, i < game.herFrom && herSteps[i] !== 'miss')
      }
      game.shownFrom = from
      game.shownTo = to

      // The beat, seen on the targets and heard as a tick; and how far through the song is.
      const into = at % chart.beatMs
      root.current?.style.setProperty('--beat', Math.max(0, 1 - into / (chart.beatMs * 0.45)).toFixed(2))
      root.current?.style.setProperty('--through', Math.min(1, at / chart.lengthMs).toFixed(4))
      for (let lane = 0; lane < LANES.length; lane++) {
        const lit = at - game.pressed[lane] < LIT_MS
        const target = targets.current[lane]
        if (target && (target.dataset.lit !== undefined) !== lit) {
          if (lit) target.dataset.lit = ''
          else delete target.dataset.lit
        }
      }
      const sound = audio.current
      // Sent early by what the sound card takes to be heard, so the tick lands with the target.
      const delay = sound
        ? Math.min(LATENCY_CAP_MS, ((sound.baseLatency || 0) + (sound.outputLatency || 0)) * 1000)
        : 0
      while (sound && game.nextBeat * chart.beatMs < Math.min(at + TICK_AHEAD_MS, chart.lengthMs)) {
        const due = game.nextBeat * chart.beatMs
        if (due >= at - 30) {
          tick(sound, sound.currentTime + Math.max(0, due - at - delay) / 1000, game.nextBeat % 4 === 0)
        }
        game.nextBeat++
      }

      if (!game.halfway && at >= halfwayAt) {
        game.halfway = true
        const [a, b] = [game.mine.tally, game.hers.tally]
        game.halfwayGap = a.score - b.score
        held.current.narrate(halfwayLine(a, her ? { name: her.name, tally: b } : undefined))
        if (her) {
          held.current.situation(standing(at))
          remark(
            at,
            game.halfwayGap === 0
              ? `Halfway through the song the two of them are dead level on ${points(a.score)}.`
              : `Halfway through the song ${game.halfwayGap > 0 ? `the reader is ahead of ${her.name}` : `${her.name} is ahead of the reader`}, ${points(Math.max(a.score, b.score))} to ${points(Math.min(a.score, b.score))}.`,
            true
          )
        }
      }
      if (!game.finalStretch && at >= finalAt) {
        game.finalStretch = true
        if (her) {
          const [a, b] = [game.mine.tally, game.hers.tally]
          held.current.situation(standing(at))
          remark(
            at,
            `The song is into its last stretch, both of them breathing hard: the reader on ${points(a.score)}, ${her.name} on ${points(b.score)}.`,
            true
          )
        }
      }

      if (mineMoved) setMine(game.mine)
      if (hersMoved) setHers(game.hers)
      if (at >= chart.lengthMs) {
        end()
        return
      }
      frame = requestAnimationFrame(loop)
    }

    // A window hidden or out of focus draws no frames and hears no keys: the song stops for
    // it, sound and all, and picks up where it stood. Her steps are read off the same clock.
    const stop = (): void => {
      if (game.over || game.pausedAt >= 0) return
      game.pausedAt = performance.now()
      void audio.current?.suspend().catch(() => undefined)
      setPaused(true)
    }
    const resume = (): void => {
      if (game.over || game.pausedAt < 0) return
      if (document.hidden || !document.hasFocus()) return
      game.startedAt += performance.now() - game.pausedAt
      game.pausedAt = -1
      void audio.current?.resume().catch(() => undefined)
      setPaused(false)
    }
    const seen = (): void => (document.hidden ? stop() : resume())
    document.addEventListener('visibilitychange', seen)
    window.addEventListener('blur', stop)
    window.addEventListener('focus', resume)
    if (document.hidden || !document.hasFocus()) stop()

    frame = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('visibilitychange', seen)
      window.removeEventListener('blur', stop)
      window.removeEventListener('focus', resume)
    }
    // The song starts once and runs to its end off the clock.
  }, [phase])

  // The table cleared, at any moment: the loop stops itself, and the beat goes quiet.
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      const sound = audio.current
      audio.current = null
      if (sound) void sound.close().catch(() => undefined)
    }
  }, [])

  const over = phase === 'over'

  const lanes = (pad: 'mine' | 'hers'): JSX.Element => (
    <div className={`vu-paradiso-pad vu-paradiso-pad--${pad}`}>
      <div className="vu-paradiso-targets" inert={pad === 'hers' || over || undefined}>
        {LANES.map((name, lane) => (
          <button
            key={name}
            ref={pad === 'mine' ? (el) => void (targets.current[lane] = el) : undefined}
            type="button"
            tabIndex={-1}
            className="vu-paradiso-target"
            data-lane={name}
            aria-label={pad === 'mine' ? `Step ${name}` : undefined}
            aria-hidden={pad === 'hers' || undefined}
            onPointerDown={
              pad === 'mine'
                ? (event) => {
                    event.preventDefault()
                    step(lane as Lane, event.timeStamp)
                  }
                : undefined
            }
          >
            <Arrow />
          </button>
        ))}
      </div>
      {steps.map((note, i) => (
        <span
          key={i}
          ref={(el) => void ((pad === 'mine' ? myNotes : herNotes).current[i] = el)}
          className="vu-paradiso-note"
          data-lane={LANES[note.lane]}
          data-off={note.off || undefined}
          aria-hidden="true"
        >
          <Arrow />
        </span>
      ))}
    </div>
  )

  return (
    <div ref={root} className="vu-paradiso" data-phase={phase} data-paused={paused || undefined}>
      <div
        className="vu-paradiso-song"
        role="progressbar"
        aria-label="Song"
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="vu-paradiso-through" />
        {/* The halfway mark, where the scores are taken: lit once the song is past it. */}
        <span
          className="vu-paradiso-half"
          style={{ left: `${((halfwayAt / chart.lengthMs) * 100).toFixed(2)}%` }}
          data-passed={live.current.halfway || undefined}
        />
      </div>

      <div className="vu-paradiso-screen">
        <Board who="You" side={mine} notes={steps.length} over={over} />
        <div className="vu-paradiso-pads">
          {lanes('mine')}
          {her && lanes('hers')}
          {phase === 'ready' && (
            <div className="vu-paradiso-ready">
              <p className="vu-paradiso-how">
                Step on each arrow as it reaches the top: the arrow keys, or D F J K, or tap the
                targets.
              </p>
              <p className="vu-paradiso-level">
                difficulty {chart.difficulty} · {chart.bpm} bpm · {steps.length} steps
              </p>
              <motion.button
                type="button"
                className="vu-btn vu-btn--primary vu-paper vu-btn--panel"
                {...gestures(false, lift, press)}
                onClick={begin}
              >
                Start the song
              </motion.button>
            </div>
          )}
          {paused && !over && (
            <div className="vu-paradiso-ready" role="status">
              <p className="vu-paradiso-paused">Paused</p>
              <p className="vu-paradiso-how">The song waits while the window is away.</p>
            </div>
          )}
        </div>
        {her ? (
          <Board who={her.name} side={hers} notes={steps.length} over={over} />
        ) : (
          <span className="vu-paradiso-board" aria-hidden="true" />
        )}
      </div>
    </div>
  )
}
