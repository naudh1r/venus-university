import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { TALENTS, TALENT_TREES, talentBalance, talentRank, talentEffect, talentPrerequisitesMet, spentTalents, type TalentTree } from '../../shared/campusTalents'
import { MODS, modOn } from '@shared/mods'
import { readBondFraction } from '../../shared/talentBondPoints'
import { PERSONAL_GROWTH } from '../../shared/talentTrading'
import { STAT_LABELS } from '@shared/playerStats'
import { TalentTrainingControls } from './TalentTrainingControls'
import { formatMoney } from '@shared/money'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModsStore } from '../stores/modsStore'
import { manualSaveOffer, writeTalentChange } from '../stores/loop/saves'
import { ensureTalents } from '../modEntries/campus-talents'
import { gestures, lift, press, quietLift, quietPress, rowLift, rowPress, toggleLift, veilIn, panelUnderTab, useModalShell, TitleTab } from '@vx/modkit/renderer'
import { CharmIcon, TalentIcon } from './TalentIcon'
import { TalentArtwork } from './TalentArtwork'
import { BodyIcon, BrainIcon, EchoIcon, HeartIcon, ShopIcon } from './screenIcons'
import { TalentAbilityControls } from './TalentAbilityControls'
import type { TalentChange } from '../stores/talentActions'
import { cardLift, chipPress } from './motion'
import type { ScreenTheme } from '@vx/modkit/renderer'
import '../vu_styles/Talents.css'

const TREE_MARKS = {body:BodyIcon, brain:BrainIcon, charm:CharmIcon, heart:HeartIcon, money:ShopIcon, echoes:EchoIcon}
const TREE_TABS = [
  ...TALENT_TREES.filter(t=>t.id!=='charm'&&t.id!=='echoes'),
  ...TALENT_TREES.filter(t=>t.id==='charm'),
  ...TALENT_TREES.filter(t=>t.id==='echoes')
]

export function TalentPanel({theme,onClose}:{theme:ScreenTheme;onClose:()=>void}) {
  const game=useGameStore(), s=game.exTalents
  const enabled=useModOn('campus-talents'), switches=useModsStore(s=>s.switches)
  const [tree,setTree]=useState<TalentTree>('money'), [selected,setSelected]=useState('wages')
  const [amount,setAmount]=useState('100'), [pending,setPending]=useState(false), [message,setMessage]=useState(''), [error,setError]=useState('')
  const contentRef=useRef<HTMLDivElement>(null)
  const writing=useRef(false), owner=useRef({id:game.playthroughId,loads:game.loads})
  const {host,overlayProps}=useModalShell(()=>{if(!writing.current)onClose()})
  useEffect(()=>{ensureTalents()},[])
  const same=owner.current.id===game.playthroughId&&owner.current.loads===game.loads
  const safe=enabled&&same&&manualSaveOffer()==='open'&&!pending&&!game.sceneEnding&&!game.statusShown
  const balance=talentBalance(s), def=TALENTS.find(d=>d.id===selected)!, rank=talentRank(s,selected), cost=def.costs[rank]
  const bondProgress=(readBondFraction(s.bpFraction)??0)*100
  useEffect(()=>{contentRef.current?.scrollTo({top:0})},[selected,rank])
  const missing=(d:typeof def):string=>{
    const dependency=d.requires?.find(id=>!modOn(switches,id))
    if(dependency)return `Requires ${MODS.find(m=>m.id===dependency)?.name??dependency}`
    const parent=d.prerequisites?.find(p=>talentRank(s,p.id)<p.rank)
    if(parent)return `Requires ${TALENTS.find(x=>x.id===parent.id)!.name} rank ${parent.rank}`
    return talentPrerequisitesMet(s,d)?'':d.capstone?'Max one second-row skill':'Learn one required skill first'
  }
  const skills=TALENTS.filter(d=>d.tree===tree&&!d.shared), capstone=skills.find(d=>d.capstone)
  const branches=skills.filter(d=>!d.capstone), chains=[...new Set(branches.map(d=>d.chain))]
  const renderSkill=(d:typeof def)=>{
    const n=talentRank(s,d.id), price=d.costs[n], reason=missing(d)
    return <motion.button key={d.id} type="button" className={`vu-talents-node${d.capstone?' vu-paper':''}`} data-selected={selected===d.id} data-learned={n>0} aria-pressed={selected===d.id} onClick={()=>{setSelected(d.id);setMessage('');setError('')}} {...gestures(false,d.capstone?cardLift:rowLift,d.capstone?chipPress:rowPress)}>
      <TalentArtwork skill={d.id}/>
      <span className="vu-talents-node-title">{d.name}</span><span className="vu-talents-ranks" aria-label={`Rank ${n} of ${d.costs.length}`}>{d.costs.map((_,i)=><i key={i} data-filled={i<n}/>)}</span>
      <span className="vu-talents-node-price">{price===undefined?'Mastered':reason||`${price} BP · Rank ${n+1}`}</span>
    </motion.button>
  }
  const bank=talentEffect(s,'savingsAccess')>0, transferReady=safe&&bank&&Number.isFinite(Number(amount))&&Number(amount)>0
  const dead=!safe||cost===undefined||balance<cost||!!missing(def)
  async function act(action:TalentChange): Promise<boolean> {
    if (!safe||writing.current) return false
    writing.current=true;setPending(true);setError('');setMessage('')
    try {
      await writeTalentChange(action)
      setMessage('skill' in action?'Skill learned and saved.':'transfer' in action?'Savings transfer saved.':'train' in action?`${STAT_LABELS[action.train]} increased and saved.`:action.ability==='eureka'?'Project chosen. Your next session gets triple progress.':action.ability==='cancel-eureka'?'Project choice cleared. Your weekly use is still available.':action.ability==='farewell'?'Goodbye selected.':action.ability==='silver-lining'?'Silver Lining selected.':action.ability==='cancel-silver-lining'?'Silver Lining cancelled. Your weekly use is still available.':'Goodbye cancelled.')
      return true
    } catch(e) {setError(e instanceof Error?e.message:'Could not save this change.');return false}
    finally {writing.current=false;setPending(false)}
  }
  if (!host) return null
  return createPortal(<motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...overlayProps}>
    <motion.section className="vu-talents vu-paper" role="dialog" aria-modal="true" aria-label="Skill trees" aria-busy={pending} variants={panelUnderTab}>
      <TitleTab>Campus Talents</TitleTab>
      <div className="vu-talents-header"><div><h2>Grow your talents</h2><p>Spend Bond Points on skills.</p></div><div className="vu-talents-shared">{TALENTS.filter(d=>d.shared).map(d=><motion.button key={d.id} type="button" className="vu-pill" aria-pressed={selected===d.id} {...gestures(false,quietLift,quietPress)} onClick={()=>{setSelected(d.id);setError('');setMessage('')}}><TalentArtwork skill={d.id}/>{d.name}</motion.button>)}</div><div className="vu-talents-wallet"><TalentIcon/>
        <div className="vu-talents-bp-amount"><strong data-testid="bond-balance">{balance}</strong>
          <span className="vu-talents-bp-wheel" role="progressbar" aria-label="Progress toward your next Bond Point" aria-valuemin={0} aria-valuemax={100} aria-valuenow={bondProgress} title="Progress toward your next Bond Point">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" aria-hidden="true">
              <circle className="vu-talents-bp-track" cx="12" cy="12" r="9"/>
              <circle className="vu-talents-bp-fill" cx="12" cy="12" r="9" pathLength="100" strokeDasharray={`${bondProgress} 100`} transform="rotate(-90 12 12)"/>
            </svg>
          </span>
        </div><span>Bond Points</span></div></div>
      <div className="vu-talents-nav">
        <div className="vu-talents-tabs vu-palette" role="tablist" aria-label="Skill tree">
          {TREE_TABS.filter(t=>TALENTS.some(d=>d.tree===t.id&&!d.shared)).map(t=>{
            const Mark=TREE_MARKS[t.id as keyof typeof TREE_MARKS]??TalentIcon
            return <motion.button key={t.id} type="button" role="tab" aria-selected={tree===t.id} className={`vu-palette-btn${tree===t.id?' vu-palette-btn--on':''}`} {...gestures(false,toggleLift,quietPress)} onClick={()=>{setTree(t.id);setSelected(TALENTS.find(d=>d.tree===t.id&&!d.shared)!.id);setError('');setMessage('')}}><Mark/>{t.name}</motion.button>
          })}
        </div>
        <span className="vu-talents-ledger">{s.seed} starting · {s.earned-s.seed} earned<br/>{spentTalents(s)} spent</span>
      </div>
      <p className="vu-talents-explain" data-testid="bond-rate">Earn BP from new liked or loved memories. Lower average Brain, Body and Heart earn more BP; higher stats earn less.<br/>The wheel fills toward your next Bond Point. Progress carries over, including when you spend BP.</p>
      <div className="vu-talents-content" role="tabpanel" aria-label={`${TALENT_TREES.find(t=>t.id===tree)?.name} skills`}>
        <div className="vu-talents-tree">
          <div className="vu-talents-branches" style={{gridTemplateColumns:`repeat(${chains.length},minmax(0,1fr))`}}>
            {chains.map(chain=><div className="vu-talents-chain" key={chain}><h3>{chain}</h3>{branches.filter(d=>d.chain===chain).map(renderSkill)}</div>)}
          </div>
          {capstone&&<>
            <div className="vu-talents-join" aria-hidden="true">
              {chains.map((chain,i)=>{
                const side=i<(chains.length-1)/2?'left':i>(chains.length-1)/2?'right':'center'
                const offset=`calc((100% + 16px) * ${(Math.min(i,chains.length-1-i)+.5)/chains.length} - 8px)`
                const ready=capstone.prerequisitesAny?.some(p=>branches.some(d=>d.id===p.id&&d.chain===chain)&&talentRank(s,p.id)>=p.rank)
                return <i key={chain} data-side={side} data-ready={ready} style={side==='center'?undefined:{[side]:offset}}/>
              })}
              <b data-ready={talentPrerequisitesMet(s,capstone)}/>
            </div>
            <div className="vu-talents-capstone">{renderSkill(capstone)}</div>
          </>}
        </div>
        <aside className="vu-talents-detail-wrap" aria-label="Selected skill"><div ref={contentRef} className="vu-talents-details">
          <div className="vu-talents-detail-heading"><TalentArtwork skill={def.id}/><div><span className="vu-talents-detail-label">{def.capstone?'Special ability':`${def.chain} · Skill`}</span>
          <h2>{def.name}</h2></div></div><p className="vu-talents-detail-copy">{def.id===PERSONAL_GROWTH&&rank?'Spend BP on a chosen stat: 10 BP to recover recorded break losses; otherwise 25 BP below 60 or 40 BP from 60 to 100.':def.description}</p>
          {def.id===PERSONAL_GROWTH&&<TalentTrainingControls safe={safe} act={act}/>}
          {!!def.prerequisitesAny?.length&&!(def.shared&&rank)&&<div className="vu-talents-unlock"><strong>{def.capstone||def.shared?'Fully upgrade any one second-row skill:':'Learn any one of these skills:'}</strong><ul>{def.prerequisitesAny.map(p=><li key={p.id} data-ready={talentRank(s,p.id)>=p.rank}>{TALENTS.find(d=>d.id===p.id)!.name} <span>{Math.min(talentRank(s,p.id),p.rank)}/{p.rank}</span></li>)}</ul></div>}
          <TalentAbilityControls key={selected} skill={selected} safe={safe} act={act} onClose={onClose}/>
        {(def.id==='reserve'||def.id==='interest')&&<div className="vu-talents-savings"><div><strong>Savings</strong><span>Wallet {formatMoney(game.money)} · Savings <b data-testid="savings-balance">{formatMoney(s.reserve)}</b></span><small>{bank?`${def.id==='interest'?`Interest earned: ${formatMoney(s.interestEarned)}. `:''}Savings stay separate from your wallet and debt limit.`:'Learn Rainy Day Fund to open your savings pocket.'}</small></div>
          <label className="vu-field"><span className="vu-field-label">Amount</span><input className="vu-input" aria-label="Savings amount" type="number" min="0.01" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} disabled={!safe||!bank}/></label>
          <motion.button type="button" className="vu-pill" disabled={!transferReady} {...gestures(!transferReady,quietLift,quietPress)} onClick={()=>void act({transfer:Number(amount)})}>Deposit</motion.button>
          <motion.button type="button" className="vu-pill" disabled={!transferReady} {...gestures(!transferReady,quietLift,quietPress)} onClick={()=>void act({transfer:-Number(amount)})}>Withdraw</motion.button>
        </div>}
        {!!def.requires?.length&&<p className="vu-talents-integration">Requires {def.requires.map(id=>MODS.find(m=>m.id===id)?.name??id).join(' and ')} to be enabled.</p>}
        {def.notes?.map(note=><p key={note} className="vu-talents-integration">{note}</p>)}
        </div><div className="vu-scroll-fade"/></aside>
      </div>
      <div className="vu-talents-footer"><div className="vu-talents-current"><span>Selected talent{rank?` · Rank ${rank}`:''}</span><strong>{def.name}</strong></div>
        <div className="vu-foot-stack"><p aria-live="polite" className={`vu-form-status${error?' vu-talents-error':''}`}>{error||message||(!safe?'Finish the current reply or conversation before making changes.':cost===undefined?'All ranks learned.':missing(def)||(balance<cost?`Need ${cost-balance} more Bond Points.`:`Next rank costs ${cost} Bond Points.`))}</p>
        <div className="vu-foot">
        <motion.button type="button" className="vu-btn vu-btn--quiet vu-btn--panel" disabled={pending} {...gestures(pending,quietLift,quietPress)} onClick={onClose}>Close</motion.button>
        <motion.button type="button" className="vu-btn vu-btn--primary vu-btn--panel vu-paper" disabled={dead} {...gestures(dead,lift,press)} onClick={()=>void act({skill:selected})}>{pending?'Saving…':cost===undefined?'Mastered':`Learn · ${cost} BP`}</motion.button>
        </div></div>
      </div>
    </motion.section>
  </motion.div>,host)
}
