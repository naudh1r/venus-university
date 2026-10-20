import { useEffect, useRef, useState, type JSX } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { gestures, lift, press, useAway, useReducedMotion, useEffectsGain, type GamePlay, type Opponent, type TableExpression } from '../kit'
import { aimEllipse, movingDot, scoreHit, traitsFor, newExtraMatch, extraSummary, extraThrow, planExtraVisit, applyExtraPlan, extraSituation, extraTargetLabel, extraDescription, EXTRA_MODE_TITLES, type Ellipse, type Flight, type Impact, type Point, type ExtraDartsMode, type ExtraDartsMatch, type ExtraPlanItem } from '@shared/minigameRules/darts'
import { Board } from './dartsBoard'
import { DartsAudio } from './dartsAudio'
import { DartsControlGuide } from './DartsHelp'
import '../../vu_styles/Darts.css'

type Phase = 'player' | 'preparing' | 'handover' | 'partners' | 'my-turn' | 'finished'
type Line = { text: string; expression: TableExpression }
type VisitScript = { seat: Opponent; intro: Line; outro: Line; reactions: Record<number, Line>; spoken: Set<number>; plan: ExtraPlanItem[] }
const EXPRESSIONS: readonly TableExpression[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'embarrassed', 'aroused']
const dartIcon = new URL('../../../assets/darts/dart-hud-side.png', import.meta.url).href

function accountOf(session: ExtraDartsMatch): string[] {
  const state = extraSummary(session)
  return [EXTRA_MODE_TITLES[session.mode], extraDescription(session), ...state.visits.map(v => `${session.seats.find(s => s.id === v.seatId)?.name}, round ${v.round + 1}: ${v.darts.map(d => scoreHit(d.x,d.y).label).join(', ')}; visit total ${v.total}${v.bust ? ', bust' : ''}${v.success ? ', target completed' : ''}.`), extraSituation(session), state.done ? `Match complete. ${state.winnerIds.map(id => session.seats.find(s => s.id === id)?.name).join(' and ')} ${state.outcome === 'draw' ? 'share first place' : 'win'}.` : 'Match unfinished.']
}

function fallback(session: ExtraDartsMatch, seat: Opponent, plan: ExtraPlanItem[]): VisitScript {
  return {
    seat, plan, spoken: new Set(),
    intro: { text: 'All right. Let me take this one.', expression: 'neutral' },
    reactions: Object.fromEntries(plan.map((item) => [item.throwId, {
      text: item.bust ? 'Too much. I need to reset.' : session.mode === 'precision' ? item.success ? 'Right on target!' : 'Missed the target.' : item.hit.kind === 'miss' ? 'That got away from me.' : item.hit.points >= 40 ? 'There we go!' : 'I can work with that.',
      expression: item.bust || item.hit.kind === 'miss' || session.mode === 'precision' && !item.success ? 'sad' : item.success || item.hit.points >= 40 ? 'happy' : 'neutral'
    }])),
    outro: { text: 'Your turn. Show me what you have.', expression: 'neutral' }
  }
}

export function DartsExtra({ play }: { play: GamePlay }): JSX.Element {
  const opponents = play.opponents.slice(0, 2)
  const mode = ({ 3: 'girls-team', 4: 'leader', 5: 'precision', 6: 'exact' } as const)[play.options['darts-mode'] as 3 | 4 | 5 | 6] as ExtraDartsMode
  const [session, setSession] = useState<ExtraDartsMatch>(() => newExtraMatch({
    id: crypto.randomUUID(), seed: crypto.getRandomValues(new Uint32Array(1))[0], mode,
    target: [301, 501, 701][(play.options['darts-start'] ?? 2) - 1], long: play.options['darts-leader-length'] === 2,
    seats: [{ id: 'reader', name: 'You', kind: 'reader' }, ...opponents.map(girl => ({ id: girl.charId, name: girl.name, kind: 'npc' as const, skill: girl.skill, traits: traitsFor(girl.skill, girl.charId, girl.biases) }))]
  }))
  const [phase, setPhase] = useState<Phase>(() => extraSummary(session).currentSeatId === 'reader' ? 'player' : 'preparing')
  const [busy, setBusy] = useState(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [boardVisit, setBoardVisit] = useState(0)
  const [guide, setGuide] = useState<false | 'score' | 'control'>(false)
  const [modeInfo, setModeInfo] = useState(false)
  const [status, setStatus] = useState('Your turn')
  const [displayedScore, setDisplayedScore] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null), board = useRef<Board | null>(null), guideCanvas = useRef<HTMLCanvasElement>(null)
  const aim = useRef<Point>({ x: 0, y: -.6 })
  const hold = useRef<{ ellipse: Ellipse; time: number; pointer: number } | null>(null)
  const pending = useRef<VisitScript[] | null>(null)
  const alive = useRef(true), generation = useRef(0), locked = useRef(false), finished = useRef(false)
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>())
  const sound = useRef<DartsAudio | null>(null)
  const away = useAway(), reduced = useReducedMotion() ?? false, effectsGain = useEffectsGain()
  const latest = useRef({ play, session, phase, flight, impact, guide, modeInfo, away, reduced, boardVisit })
  latest.current = { play, session, phase, flight, impact, guide, modeInfo, away, reduced, boardVisit }

  /** Collect the previous visit's darts only when the next player takes the board. */
  function collectDarts(visit: number): void {
    latest.current.boardVisit = visit
    latest.current.impact = null
    setBoardVisit(visit)
    setImpact(null)
  }

  const seatName = (from: ExtraDartsMatch, id: string): string => from.seats.find((seat) => seat.id === id)?.name ?? id

  function publish(next: ExtraDartsMatch): void {
    latest.current.session = next; setSession(next)
    const state = extraSummary(next)
    latest.current.play.situation(`${EXTRA_MODE_TITLES[next.mode]}. ${extraSituation(next)} ${state.done ? 'The match is complete.' : `${seatName(next, state.currentSeatId)} throws next.`}`)
    latest.current.play.progress(accountOf(next))
  }

  function pause(ms: number, token: number): Promise<boolean> {
    if (!alive.current || token !== generation.current) return Promise.resolve(false)
    return new Promise((resolve) => {
      const timer = setTimeout(() => { timers.current.delete(timer); resolve(alive.current && token === generation.current) }, ms)
      timers.current.set(timer, () => resolve(false))
    })
  }

  async function present(token: number): Promise<boolean> {
    while (latest.current.away) if (!(await pause(150, token))) return false
    return alive.current && token === generation.current
  }

  async function speak(seat: Opponent, line: Line, token: number): Promise<boolean> {
    if (!alive.current || token !== generation.current || !line.text) return false
    await latest.current.play.speak(seat.charId, line.text, line.expression)
    if (!alive.current || token !== generation.current) return false
    await latest.current.play.read()
    return alive.current && token === generation.current
  }

  async function finish(next: ExtraDartsMatch, token: number): Promise<void> {
    if (finished.current || !alive.current || token !== generation.current) return
    finished.current = true; setPhase('finished')
    const state = extraSummary(next), won = state.outcome === 'won'
    const winners = state.winnerIds.map(id => seatName(next, id)).join(' and ')
    const summary = `${EXTRA_MODE_TITLES[next.mode]}: ${winners} ${state.outcome === 'draw' ? 'share first place' : 'win'}. ${extraSituation(next)}`
    setStatus(summary)
    sound.current?.play(won ? 'win' : state.outcome === 'draw' ? 'impact' : 'loss')
    if (!(await pause(reduced ? 200 : 700, token))) return
    latest.current.play.finish({ outcome: state.outcome ?? 'draw', summary, account: accountOf(next) })
  }

  async function prepare(next: ExtraDartsMatch, token: number): Promise<void> {
    let preview = next
    const scripts: VisitScript[] = []
    while (!extraSummary(preview).done && extraSummary(preview).currentSeatId !== 'reader') {
      const seatId = extraSummary(preview).currentSeatId
      const seat = opponents.find((girl) => girl.charId === seatId)
      if (!seat) throw Error('Darts speaker is missing')
      const plan = planExtraVisit(preview), script = fallback(preview, seat, plan)
      const noteworthy = plan.find((item) => !item.outcome && (item.bust || item.success || item.hit.kind === 'miss' || item.hit.points >= 40)) ?? plan.find((item) => !item.outcome)
      script.spoken = new Set(play.chattiness === 'lots' ? plan.filter((item) => !item.outcome).map((item) => item.throwId) : play.chattiness === 'some' && noteworthy ? [noteworthy.throwId] : [])
      scripts.push(script)
      for (const item of plan) preview = applyExtraPlan(preview, item)
    }
    pending.current = scripts
    setPhase('preparing'); setStatus(play.chattiness === 'quiet' ? 'Partners ready' : 'Preparing next turn…')
    if (play.chattiness !== 'quiet' && scripts.length) {
      const fields: Record<string, 'text' | readonly string[]> = {}, facts: string[] = []
      for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index], prefix = `p${index + 1}`
        fields[`${prefix}Intro`] = 'text'; fields[`${prefix}IntroExpression`] = EXPRESSIONS
        for (const item of script.plan) if (script.spoken.has(item.throwId)) { fields[`${prefix}Dart${item.throwId}Line`] = 'text'; fields[`${prefix}Dart${item.throwId}Expression`] = EXPRESSIONS }
        if (play.chattiness === 'lots' && !script.plan.at(-1)?.outcome) { fields[`${prefix}Outro`] = 'text'; fields[`${prefix}OutroExpression`] = EXPRESSIONS }
        facts.push(`${prefix} speaker is ${script.seat.name} (${script.seat.charId}).`, ...script.plan.map((item) => `${prefix} dart ${item.throwId}: ${item.hit.label}, ${item.hit.points} points, remaining ${item.before} -> ${item.after}, bust ${item.bust}, outcome ${item.outcome ?? 'unfinished'}.`))
      }
      const before = extraSummary(next)
      const got = await latest.current.play.round({ fields, brief: [
        `Write one chronological, cached companion script for ${scripts.map((script) => script.seat.name).join(' and ')} playing darts with the reader. This is character banter, not sports commentary.`,
        `Rules: ${extraDescription(next)}. Mode ${next.mode}; current situation: ${extraSituation(next)}; reader's most recent visit total ${[...before.visits].reverse().find(v => v.seatId === 'reader')?.total ?? 0}. Engine results below are final. Never alter a landing or reveal a later result early.`,
        before.visits.some(v => v.seatId === 'reader') ? 'The reader has already played; react only to the recorded visit.' : 'The reader has not thrown yet. Do not imply a previous reader visit.',
        ...facts,
        'Both girls team up only in Girls Team; otherwise they compete individually. Never refer to them as sharing a score in an individual mode.',
        'Each pNIntro occurs immediately before that named speaker begins. Each Dart line occurs only after its exact landing. Each Outro passes naturally to the next person.',
        'Use scores only to understand the moment. Do not mechanically repeat numbers or hit labels already on screen. Vary teasing, encouragement, rivalry, flirting, jokes, nerves, confidence or light strategy according to personality, relationships and current scene. Do not force a beat or invent shared history.',
        'Keep each speaker distinct and never put one character’s words or expression on another. At most 25 words and 200 characters per line. Only use aroused when the surrounding scene independently warrants it.'
      ].join('\n') })
      if (!alive.current || token !== generation.current) return
      if (got) for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index], prefix = `p${index + 1}`
        const read = (key: string, fallbackLine: Line): Line => {
          const text = got[key]?.trim(), expression = got[`${key.replace(/Line$/, '')}Expression`] as TableExpression
          return text && text.length <= 200 && EXPRESSIONS.includes(expression) ? { text, expression } : fallbackLine
        }
        script.intro = read(`${prefix}Intro`, script.intro); script.outro = read(`${prefix}Outro`, script.outro)
        for (const item of script.plan) if (script.spoken.has(item.throwId)) script.reactions[item.throwId] = read(`${prefix}Dart${item.throwId}Line`, script.reactions[item.throwId])
      }
      if (!(await speak(scripts[0].seat, scripts[0].intro, token))) return
    }
    if (!alive.current || token !== generation.current) return
    setStatus(`${scripts[0]?.seat.name ?? 'Partners'} ready`); setPhase('handover')
  }

  async function land(targetPoint: Point, token: number, item?: ExtraPlanItem): Promise<ExtraDartsMatch | null> {
    if (!(await present(token))) return null
    const beforeGame = latest.current.session, beforeState = extraSummary(beforeGame)
    const beforeVisit = beforeState.visits.find(v => v.index === beforeState.visit)
    const next = item ? applyExtraPlan(beforeGame, item) : extraThrow(beforeGame, targetPoint, 0)
    const dart = next.throws.at(-1)!
    publish(next)
    const duration = latest.current.reduced ? 100 : 430, currentFlight: Flight = { dart, duration, time: performance.now() }
    latest.current.flight = currentFlight; setFlight(currentFlight); sound.current?.play('throw')
    if (!(await pause(duration, token))) return null
    const currentImpact: Impact = { dart, time: performance.now() }, scored = scoreHit(dart.x, dart.y)
    latest.current.flight = null; latest.current.impact = currentImpact; setFlight(null); setImpact(currentImpact)
    const bust = item ? item.bust : next.mode === 'exact' ? scored.points > (beforeVisit?.remaining ?? beforeGame.exactTargets[beforeState.round]) : extraSummary(next).visits.at(-1)?.bust
    setStatus(`${scored.label} · ${scored.points}${bust ? ' · BUST' : ''}`); sound.current?.play(scored.kind)
    if (!(await pause(dart.actor === 'partner' ? 350 : reduced ? 180 : 650, token))) return null
    if (extraSummary(next).done) { await finish(next, token); return next }
    if (latest.current.play.playByPlay) {
      await latest.current.play.narrate(`${seatName(next, dart.seatId)} hits ${scored.label}: ${scored.points}.${bust ? next.mode === 'exact' ? ' Bust: the accumulated total resets to zero; used darts stay used.' : ' Bust: the visit is cancelled.' : ''}`)
      if (!alive.current || token !== generation.current) return null
      await latest.current.play.read()
    }
    return alive.current && token === generation.current ? next : null
  }

  async function run(work: (token: number) => Promise<void>): Promise<void> {
    if (locked.current || finished.current || !alive.current) return
    locked.current = true; setBusy(true)
    const token = generation.current
    try { await work(token) }
    catch (error) { if (alive.current && token === generation.current) { setStatus(error instanceof Error ? error.message : 'The game was interrupted. Use Walk away to return to the scene.'); setPhase('finished') } }
    finally { if (alive.current && token === generation.current) { locked.current = false; setBusy(false) } }
  }

  function release(): void {
    const held = hold.current; hold.current = null
    const state = latest.current
    if (!held || locked.current || state.phase !== 'player' || state.away || state.guide || state.modeInfo) return
    const targetPoint = movingDot(held.ellipse, state.session.seed, state.session.throws.length, (performance.now() - held.time) / 1000)
    state.play.moved(); state.play.started()
    void run(async (token) => {
      const next = await land(targetPoint, token)
      if (next && !extraSummary(next).done) {
        const after = extraSummary(next)
        if (after.currentSeatId !== 'reader') await prepare(next, token)
        else if (after.visit !== latest.current.boardVisit) {
          setStatus('Visit complete. Take your next three darts.')
          setPhase('my-turn')
        }
      }
    })
  }

  function begin(pointer: number): void {
    const state = latest.current
    if (locked.current || state.phase !== 'player' || hold.current || state.away || state.guide || state.modeInfo) return
    hold.current = { ellipse: aimEllipse(aim.current, 'club'), time: performance.now(), pointer }
    void sound.current?.unlock()
  }

  function partnersTurn(): void {
    if (phase !== 'handover' || !pending.current) return
    setModeInfo(false)
    latest.current.play.moved()
    void run(async (token) => {
      collectDarts(extraSummary(latest.current.session).visit)
      setPhase('partners')
      const scripts = pending.current!
      let silentImpact: number | null = null
      for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index]
        if (index > 0) {
          if (!(await pause(reduced ? 180 : 700, token))) return
          collectDarts(script.plan[0].dart.visit)
          if (latest.current.play.chattiness !== 'quiet' && !(await speak(script.seat, script.intro, token))) return
        }
        for (const item of script.plan) {
          if (!(await present(token))) return
          const usualDelay = reduced ? 150 : 550
          // Measure from impact, including time already spent showing the score/LED.
          const delay = silentImpact === null ? usualDelay : Math.max(usualDelay, 1500 - (performance.now() - silentImpact))
          if (!(await pause(delay, token))) return
          const next = await land(item.target, token, item)
          if (!next || extraSummary(next).done) return
          const hasReaction = script.spoken.has(item.throwId)
          if (hasReaction && !(await speak(script.seat, script.reactions[item.throwId], token))) return
          silentImpact = latest.current.play.chattiness !== 'lots' && !hasReaction && !latest.current.play.playByPlay
            ? latest.current.impact!.time : null
        }
        if (latest.current.play.chattiness === 'lots' && !(await speak(script.seat, script.outro, token))) return
      }
      if (!alive.current || token !== generation.current) return
      setStatus('Your turn next'); setPhase('my-turn')
    })
  }

  useEffect(() => {
    alive.current = true
    const audio = new DartsAudio(.55); sound.current = audio
    const cancel = (): void => { hold.current = null }
    window.addEventListener('blur', cancel); document.addEventListener('visibilitychange', cancel)
    return () => {
      alive.current = false; generation.current++; hold.current = null
      for (const [timer, cancelTimer] of timers.current) { clearTimeout(timer); cancelTimer() }
      timers.current.clear(); audio.dispose()
      window.removeEventListener('blur', cancel); document.removeEventListener('visibilitychange', cancel)
    }
  }, [])
  useEffect(() => { sound.current?.setVolume(.55 * effectsGain) }, [effectsGain])
  useEffect(() => {
    const dartboard = new Board(canvas.current!); board.current = dartboard
    let frame = 0
    let previous: readonly unknown[] = []
    const paint = (time: number): void => {
      frame = requestAnimationFrame(paint)
      const state = latest.current, active = state.phase === 'player' && !locked.current && !state.guide && !state.modeInfo && !state.away && !finished.current
      if (!active) hold.current = null
      const held = hold.current
      // Keep animation timing intact, but do no canvas work behind a guide/away screen.
      if (state.away || state.guide || document.hidden) { previous = []; return }
      const visual = [state.session, state.boardVisit, active, held, state.flight, state.impact, state.reduced, aim.current.x, aim.current.y, dartboard.revision]
      const animating = !!held || !!state.flight || !!state.impact && time - state.impact.time < 1200
      if (!animating && visual.every((value, index) => value === previous[index])) return
      previous = visual
      const landed = state.flight ? state.session.throws.slice(0, -1) : state.session.throws
      const currentDarts = landed.filter((dart) => dart.visit === state.boardVisit)
      const aimingOrFlying = !!held || !!state.flight
      dartboard.draw({ darts: aimingOrFlying ? [] : currentDarts.slice(-1), silhouettes: aimingOrFlying ? currentDarts : currentDarts.slice(0, -1), aim: active ? held?.ellipse ?? aim.current : null, ellipse: active ? held?.ellipse : null, dot: active && held ? movingDot(held.ellipse, state.session.seed, state.session.throws.length, (time - held.time) / 1000) : null, flight: state.flight, impact: state.impact, reduced: state.reduced }, time)
    }
    frame = requestAnimationFrame(paint)
    return () => { cancelAnimationFrame(frame); dartboard.dispose(); board.current = null }
  }, [])

  const visible = flight ? { ...session, throws: session.throws.slice(0, -1) } : session
  const state = extraSummary(visible)
  const shownVisit = state.visits.find(v => v.index === boardVisit)
  const visibleScore = mode === 'girls-team' ? state.currentSeatId === 'reader' ? state.balances.reader : state.girlsBalance
    : mode === 'exact' ? state.visits.find(v => v.index === state.visit)?.remaining ?? visible.exactTargets[state.round]
    : mode === 'leader' ? state.leaderScore ?? shownVisit?.total ?? 0 : state.points[state.currentSeatId]
  useEffect(() => {
    const from = displayedScore, began = performance.now()
    let frame = 0
    const paint = (): void => { const t = reduced ? 1 : Math.min(1, (performance.now() - began) / 300); setDisplayedScore(Math.round(from + (visibleScore - from) * (1 - (1 - t) ** 3))); if (t < 1) frame = requestAnimationFrame(paint) }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [visibleScore, reduced])
  useEffect(() => {
    if (guide !== 'score') return
    hold.current = null
    const context = guideCanvas.current!.getContext('2d')!
    context.clearRect(0, 0, 1400, 1400); context.save(); context.scale(2, 2); board.current?.paintScoreGuide(context); context.restore()
  }, [guide])

  const live = extraSummary(session), activeName = live.done ? '' : seatName(session, live.currentSeatId)
  const modeTitle = EXTRA_MODE_TITLES[session.mode]
  const modeDescription = extraDescription(session)
  useEffect(() => {
    if (extraSummary(latest.current.session).currentSeatId === 'reader') return
    const timer = setTimeout(() => { void run(token => prepare(latest.current.session, token)) }, 0)
    return () => clearTimeout(timer)
  }, [])
  return <div className="vu-darts" data-info={modeInfo || undefined} data-guide={guide || undefined} data-finished={phase === 'finished' || undefined}>
    <button type="button" className="vu-darts-mode" disabled={busy} aria-label={`About ${modeTitle}`} aria-expanded={modeInfo} aria-controls="darts-mode-info" onClick={() => { hold.current = null; setGuide(false); setModeInfo(!modeInfo) }}><span className="vu-darts-mode-caption">Game mode</span><span className="vu-darts-mode-title">{modeTitle}</span><span className="vu-darts-mode-arrow" aria-hidden="true" /></button>
      {modeInfo && <section id="darts-mode-info" className="vu-darts-mode-info" aria-label={`${modeTitle} rules`} onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setModeInfo(false) } }}>
        <h2>Mode rules</h2>
        <p>{modeDescription}</p>
        <button autoFocus type="button" className="vu-btn vu-btn--primary vu-paper vu-btn--panel" onClick={() => setModeInfo(false)}>Close info</button>
      </section>}
    <div className="vu-darts-stage">
      <canvas ref={canvas} width={1000} height={1000} tabIndex={0} role="application" aria-label="Dartboard. Move the mouse to aim, hold left click, and release at the moving dot."
        onPointerMove={(event) => { if (!hold.current && !locked.current) aim.current = board.current!.point(event) }}
        onPointerDown={(event) => { if (event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); aim.current = board.current!.point(event); begin(event.pointerId); if (hold.current) event.currentTarget.setPointerCapture(event.pointerId) }}
        onPointerUp={(event) => { if (hold.current?.pointer === event.pointerId) release() }} onBlur={() => { hold.current = null }} onPointerCancel={() => { hold.current = null }} onLostPointerCapture={() => { hold.current = null }}
      />
      <AnimatePresence>{guide && <motion.div key={guide} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .18 }} className="vu-darts-guide" onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); setGuide(false) } }}><h2 className="vu-darts-guide-title">{guide === 'score' ? 'SECTOR 20' : 'Control'}</h2><div className="vu-darts-guide-content">{guide === 'score' ? <canvas ref={guideCanvas} width={1400} height={1400} aria-label="Single, double, triple; outer bull 25, inner bull 50." /> : <DartsControlGuide />}</div><motion.button autoFocus type="button" className="vu-btn vu-btn--primary vu-paper vu-btn--panel" {...gestures(false, lift, press)} onClick={() => setGuide(false)}>Back to the board</motion.button></motion.div>}</AnimatePresence>
      {phase === 'finished' && live.outcome === 'won' && <motion.div className="vu-darts-celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span>{'MATCH WON'}</span><strong>{'Well played.'}</strong></motion.div>}
    </div>
    <aside className="vu-darts-score vu-darts-score--extra" aria-label="Match score">
      <div className="vu-darts-scorehead">{phase === 'finished' ? 'MATCH COMPLETE' : live.currentSeatId === 'reader' ? 'YOUR TURN' : `${activeName.toUpperCase()}’S TURN`}</div>
      <div className="vu-darts-target" aria-label="Current target">{mode === 'leader' ? state.leaderScore === null ? 'SET THE TARGET' : `MATCH OR BEAT ${state.leaderScore}` : extraTargetLabel(visible, state.round)}</div>
      <span className="vu-darts-label">{mode === 'girls-team' ? state.currentSeatId === 'reader' ? 'YOUR REMAINING' : 'GIRLS REMAINING' : mode === 'exact' ? 'POINTS LEFT THIS TARGET' : mode === 'leader' ? 'LEADER TARGET / OPENING TOTAL' : 'CURRENT PLAYER POINTS'}</span><strong className="vu-darts-balance" aria-live="polite">{displayedScore}</strong>
      <div className="vu-darts-start"><span>{mode === 'leader' ? `${seatName(visible, state.leaderId)} LEADS` : mode === 'exact' ? `${Math.max(0, 4 - state.dart)} DARTS LEFT` : '3 DARTS PER VISIT'}</span><span>ROUND {state.round + 1} / {session.rounds}</span></div>
      <ol className="vu-darts-results" aria-label="Darts in the current visit">{[0, 1, 2].map((index) => { const dart = shownVisit?.darts[index], hit = dart && scoreHit(dart.x, dart.y); return <li key={index}><span>{index + 1}</span>{hit ? <><span>{hit.label}</span><strong>{hit.points}</strong></> : <img src={dartIcon} alt="Dart remaining" />}</li> })}</ol>
      <div className="vu-darts-contributions">{mode === 'girls-team' ? <><span>YOU <strong>{state.balances.reader}</strong></span><span>GIRLS TEAM <strong>{state.girlsBalance}</strong></span></> : session.seats.map(seat => <span key={seat.id}>{seat.name.toUpperCase()} <strong>{state.points[seat.id]}</strong></span>)}</div>
      <p className="vu-darts-status" aria-live="polite">{status === 'Your turn' ? '' : status}</p>
      <div className="vu-darts-controls">
        {['handover', 'my-turn'].includes(phase) && <motion.button type="button" disabled={busy} className="vu-darts-turn vu-btn vu-btn--primary vu-paper vu-btn--panel" {...gestures(busy, lift, press)} onClick={() => { if (busy) return; setGuide(false); if (phase === 'handover') partnersTurn(); else { setModeInfo(false); latest.current.play.moved(); collectDarts(extraSummary(latest.current.session).visit); setPhase('player'); setStatus('Your turn'); pending.current = null } }}>{phase === 'handover' ? 'Change turn' : opponents.length ? 'My turn' : 'Next round'}</motion.button>}
        <motion.button type="button" disabled={busy} className="vu-btn vu-btn--outline vu-paper vu-btn--panel" {...gestures(busy, lift, press)} onClick={() => { setModeInfo(false); setGuide(value => value === 'score' ? false : 'score') }}>Score Guide</motion.button>
        <motion.button type="button" disabled={busy} className="vu-btn vu-btn--outline vu-paper vu-btn--panel" {...gestures(busy, lift, press)} onClick={() => { hold.current = null; setModeInfo(false); setGuide(value => value === 'control' ? false : 'control') }}>Control</motion.button>
      </div>
      {phase === 'finished' && <p className="vu-darts-ending">{live.outcome === 'won' ? 'You won.' : live.outcome === 'draw' ? 'A hard-fought draw.' : 'Next time.'}</p>}
    </aside>
  </div>
}
