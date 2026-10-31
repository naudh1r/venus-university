import { gestures, lift, press, quietLift, quietPress } from '@vx/modkit/renderer'
import { useEffect, useState, type JSX } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { BREAKTHROUGH_MOD } from '../../shared/breakthrough'
import { echoBreakthroughAbility, ECHO_BREAKTHROUGH_OPTION } from '@shared/echoBreakthrough'
import { aspectOf } from '@shared/echo'
import { optionOn } from '@vx/modkit/shared'
import { fullNameOf } from '@vx/modkit/shared'
import { availableEchoBreakthrough, activateBreakthrough, breakthroughCast, canBreakthrough } from '../stores/breakthrough'
import { interject } from '../stores/gameLoop'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModsStore } from '../stores/modsStore'
import { BREAKTHROUGH_SECONDS, breakthroughBannerMotion, breakthroughHaloMotion } from './BreakthroughMotion'
import '../vu_styles/Breakthrough.css'
import { ReckoningEntry } from './ReckoningModal'

export function BreakthroughPanel({ hidden, blocked, onReckoning }: { hidden: boolean; blocked: boolean; onReckoning?:(id:string)=>void }): JSX.Element | null {
  const game = useGameStore(s => s), on = useModOn(BREAKTHROUGH_MOD)
  const echoOn=useModOn('echo'),echoAbilities=useModsStore(s=>optionOn(s.switches,'echo',ECHO_BREAKTHROUGH_OPTION))
  const talentsOn=useModOn('campus-talents')
  const available=echoOn&&echoAbilities?availableEchoBreakthrough(game):null
  const [mode,setMode]=useState<'echo'|'normal'>('echo')
  const ability=mode==='echo'?available:null
  const [selected,setSelected] = useState(''), [expanded,setExpanded] = useState(false)
  const [draft,setDraft] = useState(''), [error,setError] = useState('')
  const ids = breakthroughCast(game), id = ids.includes(selected) ? selected : ids[0]
  useEffect(() => { setExpanded(false); setDraft(''); setError(''); setSelected('') }, [game.playthroughId,game.loads,game.date,game.time])
  if (!on || hidden || !id || game.exReckoning.dungeon&&game.exReckoning.dungeon.phase!=='unlocked') return null
  const amount = game.exBreakthrough.meters[id] ?? 0, cost=ability?.cost??100
  const ready=amount>=cost, full=amount>=100
  const canUse = !blocked && canBreakthrough(game,id,ability?.aspect)
  const activate = (): void => {
    setError('')
    try { activateBreakthrough(id,ability?.action??draft.trim(),interject,ability?.aspect); setDraft(''); setExpanded(false) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not activate Breakthrough.') }
  }
  return <aside className="vu-breakthrough vu-paper" data-ready={full} aria-label="Breakthrough spirit"
    onKeyDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()} onWheel={e => e.stopPropagation()}>
    <motion.button type="button" className="vu-breakthrough-heading" disabled={blocked}
      aria-expanded={expanded} {...gestures(blocked,quietLift,quietPress)} onClick={() => setExpanded(v => !v)}>
      <span>✦ Breakthrough</span><small>{full?'READY':ready?'ECHO READY':`${amount} / 100`}</small>
    </motion.button>
    <select aria-label="Breakthrough character" value={id} disabled={blocked || !!game.exBreakthrough.pending}
      onChange={e => {setSelected(e.target.value);setDraft('');setError('')}}>
      {ids.map(id => <option key={id} value={id}>{game.charInfo[id]?.nameKnown ? fullNameOf(game.characters[id]) : 'Unknown character'}</option>)}
    </select>
    <div className="vu-breakthrough-track" role="progressbar" aria-label="Spirit" aria-valuemin={0} aria-valuemax={100} aria-valuenow={amount}>
      <span style={{width:`${amount}%`}} />
    </div>
    {expanded && <div className="vu-breakthrough-detail">
      <p>Liked +10 · Loved +20 · Hated −15 · Disliked unchanged. Spirit settles after the scene, up to +20 per character per time slot before skill bonuses.</p>
      {talentsOn&&<p>Campus Talents can increase positive spirit gains and reduce Echo prices. The price shown includes your skills; the meter still caps at 100.</p>}
      {available&&<label>Breakthrough ability<select aria-label="Breakthrough ability" value={mode} disabled={blocked||!!game.exBreakthrough.pending} onChange={e=>{setMode(e.target.value as 'echo'|'normal');setError('')}}><option value="echo">{available.name} · {available.cost} spirit</option><option value="normal">Normal Breakthrough · 100 spirit</option></select></label>}
      {ability&&<section className="vu-echo-breakthrough" aria-label="Echo ability"><small>{aspectOf(ability.aspect).name} · Your Echo</small><strong>{ability.name}</strong><p>{ability.summary}</p><small>{ability.strength} influence · {cost} spirit</small><small>{ability.scope} · One exchange</small></section>}
      {ready && !ability && <label>What do you do, and what do you hope changes?
        <textarea value={draft} maxLength={1000} rows={4} disabled={blocked || !!game.exBreakthrough.pending}
          onChange={e => setDraft(e.target.value)} placeholder="I open up honestly and try to rebuild our trust…" />
      </label>}
      {!ready && <p>{ability?`Need ${cost-amount} more spirit to use ${ability.name} (${amount} / ${cost}).`:'At 100 spirit, turn a meaningful moment into a Breakthrough.'}</p>}
      <p>{ability?`The ability shapes the next exchange; it gives no automatic relationship points. Costs ${cost} spirit; unspent spirit stays in the bar.`:'A strong positive opportunity, grounded in their personality and the situation. Spending it resets this character’s bar to 0.'}</p>
      {ready && <motion.button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={!canUse || !ability&&!draft.trim()}
        {...gestures(!canUse || !ability&&!draft.trim(),lift,press)} onClick={activate}>{ability?`Use ${ability.name}`:'Unleash'} · {cost} spirit</motion.button>}
      {ready && !canUse && <p>Available whenever the scene lets you reply to this character.</p>}
      <ReckoningEntry charId={id} blocked={blocked} onOpen={onReckoning}/>
      {error && <p role="alert">{error}</p>}
    </div>}
  </aside>
}

export function BreakthroughFlourish(): JSX.Element | null {
  const flash = useGameStore(s => s.breakthroughFlash), playthrough = useGameStore(s => s.playthroughId)
  const reduced = useReducedMotion()
  useEffect(() => {
    if (!flash) return
    const timer = setTimeout(() => {
      if (useGameStore.getState().breakthroughFlash?.id === flash.id) useGameStore.setState({breakthroughFlash:null})
    },BREAKTHROUGH_SECONDS * 1000)
    return () => clearTimeout(timer)
  },[flash])
  if (!flash || flash.playthroughId !== playthrough) return null
  const ability=echoBreakthroughAbility(flash.echoAspect)
  return <div key={flash.id} className="vu-breakthrough-flourish" role="status" aria-live="polite" data-reduced={reduced || undefined}>
    {!reduced && <motion.div className="vu-breakthrough-halo" aria-hidden="true" animate={breakthroughHaloMotion}/>}
    <motion.div className="vu-breakthrough-banner" data-echo={!!ability||undefined} animate={reduced ? undefined : breakthroughBannerMotion}>
      <div className="vu-breakthrough-ornament" aria-hidden="true">✧ ── ✦ ── ✧</div><small>{flash.name}</small>
      <strong>{ability?.name||'Breakthrough'}</strong><span>{ability?`${aspectOf(ability.aspect).name} · Echo Breakthrough`:'Make this moment matter.'}</span>
      <div className="vu-breakthrough-ornament" aria-hidden="true">✦</div>
    </motion.div>
  </div>
}
