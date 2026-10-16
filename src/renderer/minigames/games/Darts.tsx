import { useEffect, useRef, useState, type JSX } from 'react'
import { motion } from 'motion/react'
import { gestures, lift, press, useAway, useReducedMotion, useEffectsGain, type GamePlay, type TableExpression } from '../kit'
import { newMatch, summary, throwDart, planPartnerTurn, applyPlannedThrow, scoreHit, aimEllipse, movingDot, traitsFor, lastTurn, type Match, type Point, type Ellipse, type Flight, type Impact, type PlannedThrow } from '@shared/minigameRules/darts'
import { Board } from './dartsBoard'
import { DartsAudio } from './dartsAudio'
import '../../vu_styles/Darts.css'

type Phase = 'player' | 'preparing' | 'handover' | 'partner' | 'my-turn' | 'finished'
type Line = { text: string; expression: TableExpression }
type Script = { intro: Line; outro: Line; reactions: Record<number, Line> }
const EXPRESSIONS: readonly TableExpression[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'embarrassed', 'aroused']
const dartIcon = new URL('../../../assets/darts/dart-hud-side.png', import.meta.url).href

/** Facts carried to the narrator on completion or on walking away. */
function accountOf(match: Match, name: string): string[] {
  const s = summary(match)
  return [
    `The reader and ${name} are teammates against the house. Starting countdown ${match.target}, five alternating visits.`,
    ...(s.visits ?? []).map(v => `${v.actor === 'you' ? 'The reader' : name}, visit ${v.turn + 1}: ${v.darts.map(d => scoreHit(d.x, d.y).label).join(', ')}; ${v.points} credited${v.bust ? ', bust restored the visit opening score' : ''}; ${v.balance} remaining.`),
    `Credited ${s.total}: reader ${s.you}, partner ${s.partner}. Remaining ${s.balance}. ${!s.done ? 'Unfinished: nobody has won.' : s.outcome === 'win' ? 'Both beat the house by reaching exactly zero.' : 'Both lost to the house after five visits with points remaining.'}`
  ]
}

/** The fallback reacts to the same fixed results the model is given. */
function fallbackScript(match: Match, plan: PlannedThrow[]): Script {
  return {
    intro: { text: `You got ${lastTurn(match)?.points ?? 0}. We've got ${summary(match).balance} left. My turn.`, expression: 'neutral' },
    reactions: Object.fromEntries(plan.map(item => [item.throwId, {
      text: item.bust ? 'Too much. That visit is gone.' : item.hit.kind === 'miss' ? 'Missed it. Come on, focus.' : item.hit.points >= 40 ? 'There we go!' : 'Every point helps.',
      expression: item.bust || item.hit.kind === 'miss' ? 'sad' : item.hit.points >= 40 ? 'happy' : 'neutral'
    }])),
    outro: { text: `${plan.at(-1)?.balanceAfter ?? summary(match).balance} left. Back to you.`, expression: 'neutral' }
  }
}

/** A full-stage board using the framework's NPCs, native dialogue, AI bridge and result flow. */
export function Darts({ play }: { play: GamePlay }): JSX.Element {
  const partner = play.opponents[0]
  const [match, setMatch] = useState<Match>(() => ({
    ...newMatch({ id: crypto.randomUUID(), seed: crypto.getRandomValues(new Uint32Array(1))[0], mode: [301, 501, 701][(play.options['darts-start'] ?? 2) - 1] }),
    partnerTraits: traitsFor(partner?.skill ?? 3, partner?.charId ?? 'partner')
  }))
  const [phase, setPhase] = useState<Phase>('player')
  const [busy, setBusy] = useState(false)
  const [flight, setFlight] = useState<Flight | null>(null)
  const [impact, setImpact] = useState<Impact | null>(null)
  const [guide, setGuide] = useState(false)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState('Your turn')
  const [displayedScore, setDisplayedScore] = useState(match.target)
  const canvas = useRef<HTMLCanvasElement>(null), board = useRef<Board | null>(null), guideCanvas = useRef<HTMLCanvasElement>(null)
  const aim = useRef<Point>({ x: 0, y: -.6 })
  const hold = useRef<{ ellipse: Ellipse; time: number; pointer: number | null } | null>(null)
  const pending = useRef<{ plan: PlannedThrow[]; script: Script; spoken: Set<number> } | null>(null)
  const alive = useRef(true), generation = useRef(0), locked = useRef(false), finished = useRef(false)
  const timers = useRef(new Map<ReturnType<typeof setTimeout>, () => void>())
  const sound = useRef<DartsAudio | null>(null)
  const away = useAway(), reduced = useReducedMotion() ?? false, effectsGain = useEffectsGain()
  const latest = useRef({ play, match, phase, flight, impact, guide, away, reduced })
  latest.current = { play, match, phase, flight, impact, guide, away, reduced }

  /** Publish the ledger before any animation or request can yield. */
  function publish(next: Match): void {
    latest.current.match = next
    setMatch(next)
    const s = summary(next), p = latest.current.play
    p.situation(`Cooperative darts: the reader and ${partner.name} are teammates. ${s.balance} of ${next.target} left, visit ${Math.min(5, s.turn! + 1)} of five; ${s.actor === 'you' ? 'the reader' : partner.name} throws. Partner traits: accuracy ${next.partnerTraits.accuracy}, consistency ${next.partnerTraits.consistency}, composure ${next.partnerTraits.composure}.`)
    p.progress(accountOf(next, partner.name))
  }

  /** A pause resolves false when the sitting is closed. */
  function pause(ms: number, token: number): Promise<boolean> {
    if (!alive.current || token !== generation.current) return Promise.resolve(false)
    return new Promise(resolve => {
      const timer = setTimeout(() => { timers.current.delete(timer); resolve(alive.current && token === generation.current) }, ms)
      timers.current.set(timer, () => resolve(false))
    })
  }

  /** Automatic throws wait while the player is looking elsewhere. */
  async function present(token: number): Promise<boolean> {
    while (latest.current.away) if (!(await pause(150, token))) return false
    return alive.current && token === generation.current
  }

  /** Cached words and their expression use the native scene's pacing, including overflow. */
  async function speak(line: Line, token: number): Promise<boolean> {
    if (!alive.current || token !== generation.current || !line.text) return false
    await latest.current.play.speak(partner.charId, line.text, line.expression)
    if (!alive.current || token !== generation.current) return false
    await latest.current.play.read()
    return alive.current && token === generation.current
  }

  /** The final character reaction belongs to the framework's result continuation. */
  async function finish(next: Match, token: number): Promise<void> {
    if (finished.current || !alive.current || token !== generation.current) return
    finished.current = true
    setPhase('finished')
    const s = summary(next), won = s.outcome === 'win'
    setStatus(won ? 'House beaten. Together.' : `${s.balance} left. The house wins.`)
    sound.current?.play(won ? 'win' : 'loss')
    if (!(await pause(reduced ? 200 : 700, token))) return
    latest.current.play.finish({ outcome: won ? 'won' : 'lost',
      summary: won ? `You and ${partner.name} beat the house at darts, checking out ${next.target} together in ${s.completedTurns} visits.` : `You and ${partner.name} lose to the house at darts, leaving ${s.balance} from a ${next.target} start after five visits.`,
      account: accountOf(next, partner.name) })
  }

  /** Plan the NPC visit once, then ask only for dialogue and expressions keyed to those hits. */
  async function prepare(next: Match, token: number): Promise<void> {
    const plan = planPartnerTurn(next), script = fallbackScript(next, plan)
    publish({ ...next, partnerPlan: { start: next.throws.length, seed: next.seed, strategy: next.strategy, items: plan } })
    const chat = latest.current.play.chattiness
    const noteworthy = plan.find(i => !i.outcome && (i.bust || i.hit.kind === 'miss' || i.hit.points >= 40)) ?? plan.find(i => !i.outcome)
    const spoken = new Set(chat === 'lots' ? plan.filter(i => !i.outcome).map(i => i.throwId) : chat === 'some' && noteworthy ? [noteworthy.throwId] : [])
    pending.current = { plan, script, spoken }
    setPhase('preparing'); setStatus(chat === 'quiet' ? 'Partner ready' : `${partner.name} is thinking…`)
    if (chat !== 'quiet') {
      const fields: Record<string, 'text' | readonly string[]> = { intro: 'text', introExpression: EXPRESSIONS }
      for (const item of plan) if (spoken.has(item.throwId)) { fields[`dart${item.throwId}Line`] = 'text'; fields[`dart${item.throwId}Expression`] = EXPRESSIONS }
      if (chat === 'lots' && !plan.at(-1)?.outcome) { fields.outro = 'text'; fields.outroExpression = EXPRESSIONS }
      const got = await latest.current.play.round({ fields, brief: [
        `Write one cached, natural in-character reaction script for ${partner.name}, the reader's cooperative darts teammate. Continue the relationship and mood of the current scene: this is companion banter, not sports commentary. The engine already decided every landing below. Never choose, alter, or reveal a future landing early.`,
        `The reader just scored ${lastTurn(next)?.points ?? 0}; currentScore ${summary(next).total}, remainingBefore ${summary(next).balance}.`,
        ...plan.map(i => `Dart ${i.throwId}: ${i.hit.label}, ${i.hit.points} raw points, remainingBefore ${i.balanceBefore}, remainingAfter ${i.balanceAfter}, bust ${i.bust}, outcome ${i.outcome ?? 'unfinished'}.`),
        'Use the score facts to understand the moment, but do not mechanically report numbers, hit labels, or the remaining score already visible on screen. Mention a number only when it sounds natural and adds something.',
        'Vary the beats across the script. Depending on her personality, relationship and the current scene, she may tease, encourage, flirt, boast, joke, show nerves, recover confidence, talk light strategy, or react physically/emotionally. Do not force every kind of banter and do not invent shared history.',
        'intro happens before her visit: respond naturally to the reader’s performance and take the handover. Each dartNLine reacts AFTER that exact dart lands, without knowledge of any later dart. outro passes the turn back naturally; mentioning the final balance is optional. No match-ending reaction; the scene handles it.',
        'Avoid announcer language, repeated sentence structures, and generic lines that could belong to any character. Keep continuity with the supplied character sheet, relationship, recent dialogue and scene tone.',
        'Each spoken line: at most 25 words and 200 characters. Each Expression field describes the same line. Only use aroused if the actual scene independently warrants it; scoring well is not a reason.'
      ].join('\n') })
      if (!alive.current || token !== generation.current) return
      if (got) {
        const read = (key: string, fallback: Line): Line => {
          const text = got[key]?.trim(), expression = got[`${key.replace(/Line$/, '')}Expression`] as TableExpression
          return text && text.length <= 200 && EXPRESSIONS.includes(expression) ? { text, expression } : fallback
        }
        script.intro = read('intro', script.intro); script.outro = read('outro', script.outro)
        for (const item of plan) if (spoken.has(item.throwId)) script.reactions[item.throwId] = read(`dart${item.throwId}Line`, script.reactions[item.throwId])
      }
      if (!(await speak(script.intro, token))) return
    }
    if (!alive.current || token !== generation.current) return
    setStatus(`${partner.name} is ready`); setPhase('handover')
  }

  /** Flight, immediate score/LED impact, then a short delay before any dialogue. */
  async function land(target: Point, token: number, item?: PlannedThrow): Promise<Match | null> {
    if (!(await present(token))) return null
    const next = item ? applyPlannedThrow(latest.current.match, item) : throwDart(latest.current.match, target, 0)
    const dart = next.throws.at(-1)!
    publish(next)
    const duration = latest.current.reduced ? 100 : 430, f = { dart, duration, time: performance.now() }
    latest.current.flight = f; setFlight(f); sound.current?.play('throw')
    if (!(await pause(duration, token))) return null
    const hit = { dart, time: performance.now() }, scored = scoreHit(dart.x, dart.y)
    latest.current.flight = null; latest.current.impact = hit; setFlight(null); setImpact(hit)
    setStatus(`${scored.label} · ${scored.points}${lastTurn(next)?.bust ? ' · BUST' : ''}`); sound.current?.play(scored.kind)
    if (!(await pause(dart.actor === 'partner' ? 350 : reduced ? 180 : 650, token))) return null
    if (summary(next).done) { await finish(next, token); return next }
    if (latest.current.play.playByPlay) {
      await latest.current.play.narrate(`${dart.actor === 'you' ? 'You hit' : `${partner.name} hits`} ${scored.label}: ${scored.points}.${lastTurn(next)?.bust ? ' Bust: the visit is cancelled.' : ''} ${summary(next).balance} remaining.`)
      if (!alive.current || token !== generation.current) return null
      await latest.current.play.read()
    }
    return alive.current && token === generation.current ? next : null
  }

  /** Serialize releases and visits; an uncertain ledger is never rerolled after a failure. */
  async function run(work: (token: number) => Promise<void>): Promise<void> {
    if (locked.current || finished.current || !alive.current) return
    locked.current = true; setBusy(true)
    const token = generation.current
    try { await work(token) }
    catch (error) { if (alive.current && token === generation.current) { setStatus(error instanceof Error ? error.message : 'The game was interrupted. Use Walk away to return to the scene.'); setPhase('finished') } }
    finally { if (alive.current && token === generation.current) { locked.current = false; setBusy(false) } }
  }

  /** Release exactly at the moving dot, using board-normalized coordinates. */
  function release(): void {
    const held = hold.current; hold.current = null
    const state = latest.current
    if (!held || locked.current || state.phase !== 'player' || state.away || state.guide) return
    const target = movingDot(held.ellipse, state.match.seed, state.match.throws.length, (performance.now() - held.time) / 1000)
    state.play.moved(); state.play.started()
    void run(async token => { const next = await land(target, token); if (next && !summary(next).done && summary(next).actor === 'partner') await prepare(next, token) })
  }

  /** The ellipse exists only while the player's throw control is held. */
  function begin(pointer: number | null): void {
    const s = latest.current
    if (locked.current || s.phase !== 'player' || hold.current || s.away || s.guide) return
    hold.current = { ellipse: aimEllipse(aim.current, s.match.level), time: performance.now(), pointer }
    void sound.current?.unlock()
  }

  /** Every NPC throw comes from the cached visit, and waits for its own dialogue before the next. */
  function partnerTurn(): void {
    if (phase !== 'handover' || !pending.current) return
    latest.current.play.moved()
    void run(async token => {
      setPhase('partner')
      const { plan, script, spoken } = pending.current!
      for (const item of plan) {
        if (!(await present(token)) || !(await pause(reduced ? 150 : 550, token))) return
        const next = await land(item.target, token, item)
        if (!next || summary(next).done) return
        if (spoken.has(item.throwId) && !(await speak(script.reactions[item.throwId], token))) return
      }
      if (latest.current.play.chattiness === 'lots' && !(await speak(script.outro, token))) return
      if (!alive.current || token !== generation.current) return
      setStatus(`${summary(latest.current.match).balance} left · your turn next`); setPhase('my-turn')
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
  useEffect(() => { sound.current?.setVolume(muted ? 0 : .55 * effectsGain) }, [muted, effectsGain])
  useEffect(() => {
    const b = new Board(canvas.current!); board.current = b
    let frame = 0
    const paint = (time: number): void => {
      const s = latest.current, active = s.phase === 'player' && !locked.current && !s.guide && !s.away && !finished.current
      if (!active) hold.current = null
      const held = hold.current
      b.draw({ darts: s.flight ? s.match.throws.slice(0, -1) : s.match.throws, aim: active ? held?.ellipse ?? aim.current : null, ellipse: active ? held?.ellipse : null, dot: active && held ? movingDot(held.ellipse, s.match.seed, s.match.throws.length, (time - held.time) / 1000) : null, flight: s.flight, impact: s.impact, reduced: s.reduced }, time)
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)
    return () => { cancelAnimationFrame(frame); b.dispose(); board.current = null }
  }, [])
  const visible = flight ? { ...match, throws: match.throws.slice(0, -1) } : match
  const visibleScore = summary(visible).balance ?? match.target
  const shownVisit = summary(visible).visits?.at(-1)
  useEffect(() => {
    const from = displayedScore, began = performance.now()
    let frame = 0
    const paint = (): void => { const t = reduced ? 1 : Math.min(1, (performance.now() - began) / 300); setDisplayedScore(Math.round(from + (visibleScore - from) * (1 - (1 - t) ** 3))); if (t < 1) frame = requestAnimationFrame(paint) }
    frame = requestAnimationFrame(paint)
    return () => cancelAnimationFrame(frame)
  }, [visibleScore, reduced])
  useEffect(() => {
    if (!guide) return
    hold.current = null
    const context = guideCanvas.current!.getContext('2d')!
    context.clearRect(0, 0, 1400, 1400); context.save(); context.scale(2, 2); board.current?.paintScoreGuide(context); context.restore()
  }, [guide])

  if (!partner) return <p className="vu-empty">Darts needs one teammate in the scene.</p>
  const s = summary(match)
  return <div className="vu-darts" data-guide={guide || undefined} data-finished={phase === 'finished' || undefined}>
    <div className="vu-darts-stage">
      <canvas ref={canvas} width={1000} height={1000} tabIndex={0} role="application" aria-label="Dartboard. Move to aim, hold left click or Space, release at the moving dot. Arrow keys move aim."
        onPointerMove={e => { if (!hold.current && !locked.current) aim.current = board.current!.point(e) }}
        onPointerDown={e => { if (e.button !== 0) return; e.preventDefault(); e.currentTarget.focus(); aim.current = board.current!.point(e); begin(e.pointerId); if (hold.current) e.currentTarget.setPointerCapture(e.pointerId) }}
        onPointerUp={e => { if (hold.current?.pointer === e.pointerId) release() }} onBlur={() => { hold.current = null }} onPointerCancel={() => { hold.current = null }} onLostPointerCapture={() => { hold.current = null }}
        onKeyDown={e => {
          if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) begin(null); return }
          const delta: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
          const d = delta[e.key]; if (!d) return; e.preventDefault()
          if (latest.current.phase === 'player' && !hold.current && !locked.current) aim.current = { x: Math.max(-1.3, Math.min(1.3, aim.current.x + d.x * (e.shiftKey ? .008 : .025))), y: Math.max(-1.3, Math.min(1.3, aim.current.y + d.y * (e.shiftKey ? .008 : .025))) }
        }} onKeyUp={e => { if (e.code === 'Space' && hold.current?.pointer === null) { e.preventDefault(); release() } }} />
      {guide && <div className="vu-darts-guide" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setGuide(false) } }}><canvas ref={guideCanvas} width={1400} height={1400} aria-label="Single, double, triple; outer bull 25, inner bull 50." /><motion.button autoFocus type="button" className="vu-btn vu-btn--primary vu-paper vu-btn--panel" {...gestures(false, lift, press)} onClick={() => setGuide(false)}>Back to the board</motion.button></div>}
      {phase === 'finished' && s.outcome === 'win' && <motion.div className="vu-darts-celebration" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><span>HOUSE BEATEN</span><strong>Together.</strong></motion.div>}
    </div>
    <aside className="vu-darts-score" aria-label="Match score">
      <div className="vu-darts-scorehead">{phase === 'finished' ? 'MATCH COMPLETE' : ['preparing', 'handover', 'partner'].includes(phase) ? `${partner.name.toUpperCase()}’S TURN` : 'YOUR TURN'}</div>
      <span className="vu-darts-label">REMAINING</span><strong className="vu-darts-balance" aria-live="polite">{displayedScore}</strong>
      <div className="vu-darts-start">START {match.target}<span>VISIT {Math.min(5, (s.turn ?? 0) + 1)} / 5</span></div>
      <ol className="vu-darts-results" aria-label="Darts in the current visit">{[0, 1, 2].map(index => { const dart = shownVisit?.darts[index], hit = dart && scoreHit(dart.x, dart.y); return <li key={index}><span>{index + 1}</span>{hit ? <><span>{hit.label}</span><strong>{hit.points}</strong></> : <img src={dartIcon} alt="Dart remaining" />}</li> })}</ol>
      <div className="vu-darts-contributions"><span>YOU <strong>{summary(visible).you}</strong></span><span>{partner.name} <strong>{summary(visible).partner}</strong></span></div>
      <p className="vu-darts-status" aria-live="polite">{status}</p>
      <div className="vu-darts-controls">
        {['handover', 'my-turn'].includes(phase) && <motion.button type="button" disabled={busy} className="vu-btn vu-btn--primary vu-paper vu-btn--panel" {...gestures(busy, lift, press)} onClick={() => { if (busy) return; if (phase === 'handover') partnerTurn(); else { latest.current.play.moved(); setPhase('player'); setStatus('Your turn'); pending.current = null } }}>{phase === 'handover' ? 'Change turn' : 'My turn'}</motion.button>}
        <motion.button type="button" disabled={busy} className="vu-btn vu-btn--outline vu-paper vu-btn--panel" {...gestures(busy, lift, press)} onClick={() => setGuide(value => !value)}>Score guide</motion.button>
        <motion.button type="button" className="vu-pill" {...gestures(false, lift, press)} onClick={() => setMuted(!muted)}>{muted ? 'Sound off' : 'Sound on'}</motion.button>
      </div>
      {phase === 'finished' && <p className="vu-darts-ending">{s.done ? s.outcome === 'win' ? 'House beaten. Together.' : 'Next time, together.' : 'The game was interrupted. Use Walk away to return to the scene.'}</p>}
    </aside>
  </div>
}
