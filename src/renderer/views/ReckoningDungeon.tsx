import { GLASS_SHARDS } from '../components/FallingGlass'
import { useReflectionPortrait, useReflectionStage } from '../components/ReflectionPortrait'
import { reflectionStageTransform } from '@shared/reflectionPortrait'
import { useEffect,useState,type CSSProperties,type JSX } from 'react'
import { createPortal } from 'react-dom'
import { THE_UNSPOKEN,RECKONING_DUNGEONS,DUNGEON_WARN_REPLIES,DUNGEON_MAX_REPLIES } from '../../shared/reckoningDungeons'
import { aspectOf } from '@shared/echo'
import { ECHO_BREAKTHROUGH_ABILITIES } from '@shared/echoBreakthrough'
import { useGameStore } from '../stores/gameStore'
import { useModOn,useModOption } from '@vx/modkit/renderer'
import { spriteUrl,useSpriteVersion } from '../stores/characterStore'
import { useAudioStore } from '../stores/audioStore'
import { dungeonOutcomeText,dungeonVisible,dungeonVisitAllowed,dungeonEntryAllowed,enterReckoningDungeon,leaveReckoningDungeon,talkInReckoningDungeon,openDungeonConversation,useDungeonInsight,useDungeonRequest } from '../stores/reckoningDungeon'
import { useModalShell } from '@vx/modkit/renderer'
import { EchoAura } from './EchoPanel'
import { UnspokenVoice } from './UnspokenVoice'
import { ReckoningModal,RECKONING_CRACKS } from './ReckoningModal'
import { reckoningPreparationStatus,retryReckoningPreparation,useReckoningPreparation } from '../stores/reckoning'
import '../vu_styles/ReckoningDungeon.css'

export function ReckoningDungeonMapPin({onEnter,canTravel}:{onEnter:()=>void;canTravel:boolean}):JSX.Element|null {
 const game=useGameStore(s=>s),on=useModOn('reckoning'),d=game.exReckoning.dungeon,busy=useDungeonRequest(s=>s.busy)
 const [error,setError]=useState('')
 if(!on||!d||d.phase!=='unlocked')return null
 const place=RECKONING_DUNGEONS[d.aspect]
 const enter=async():Promise<void>=>{try{setError('');await enterReckoningDungeon();onEnter()}catch(e){setError(e instanceof Error?e.message:'Could not enter.')}}
 return <div className="vu-dungeon-pin" role="region" aria-label="The Unspoken entrance">
  <span aria-hidden="true">◇</span><section><small>{aspectOf(d.aspect).name} · {place.name}</small><strong>{THE_UNSPOKEN.name}</strong><p>{THE_UNSPOKEN.landmark} · {d.context.name} · Follow her voice inward</p></section><div className="vu-dungeon-map-action">
  <button className="vu-btn vu-btn--primary vu-paper" type="button" disabled={busy||!canTravel||!dungeonEntryAllowed(game)} onClick={()=>void enter()}>{busy?'Entering…':game.time!==1?'Follow after dark':d.needsSpirit&&(game.exBreakthrough.meters[d.charId]??0)<100?'Needs 100 spirit':!canTravel||!dungeonEntryAllowed(game)?'Finish the current scene':d.needsSpirit?'Follow her voice · 100 spirit':'Follow her voice'}</button>
  {error&&<p role="alert">{error}</p>}</div>
 </div>
}

interface DungeonOptions {
 onOptions: () => void
 covered: boolean
}
export function ReckoningDungeonView(props: DungeonOptions):JSX.Element|null {
 const visible=useGameStore(dungeonVisible)
 return visible?<DungeonVisit {...props}/>:null
}
function DungeonVisit({onOptions,covered}: DungeonOptions):JSX.Element|null {
 const game=useGameStore(s=>s),d=game.exReckoning.dungeon,busy=useDungeonRequest(s=>s.busy),on=useModOn('reckoning')
 const glitches=useModOption('reckoning','glitch-effects')
 const echoOn=useModOn('echo')
 useReckoningPreparation(s=>s.revision)
 const [reply,setReply]=useState(''),[error,setError]=useState(''),[reflection,setReflection]=useState(false),[shattered,setShattered]=useState(false)
 const [panel,setPanel]=useState<'choices'|'talk'|'insight'>('choices')
 const id=d?.charId??'',version=useSpriteVersion(id),reflectionArt=useReflectionPortrait(id)
 const stage=useReflectionStage(id),placement={transform:reflectionStageTransform(stage),transformOrigin:'50% 100%'}
 const act=async(action:()=>Promise<void>):Promise<void>=>{try{setError('');await action();setReply('')}catch(e){setError(e instanceof Error?e.message:'The encounter could not be saved.')}}
 const close=():void=>{if(!busy&&!reflection)void act(leaveReckoningDungeon)}
 // Escape opens the normal menu without leaving the location or losing the current draft.
 const openOptions=():void=>{if(!busy&&!covered)onOptions()}
 const {host,overlayProps}=useModalShell(openOptions,'none')
 const visible=dungeonVisible(game)
 useEffect(()=>{useAudioStore.getState().setDungeonActive(visible);return()=>useAudioStore.getState().setDungeonActive(false)},[visible])
 useEffect(()=>{setReply('');setError('');setReflection(false);setShattered(false);setPanel('choices')},[d?.id,game.loads])
 useEffect(()=>{if(d?.outcome==='victory'&&!reflection&&!shattered){const timer=setTimeout(()=>setShattered(true),2250);return()=>clearTimeout(timer)}return undefined},[d?.outcome,reflection,shattered])
 if(!host||!visible||!d)return null
 const place=RECKONING_DUNGEONS[d.aspect],farewell=d.phase==='farewell',victory=d.outcome==='victory',warn=d.replies>=DUNGEON_WARN_REPLIES&&!farewell&&!game.exReckoning.active
 const enabled=on&&dungeonVisitAllowed(game)
 const prep=reckoningPreparationStatus(game,id),preparing=!game.exReckoning.active&&(prep.status==='queued'||prep.status==='preparing')
 const portrait=spriteUrl(id,'neutral',version),altered=reflectionArt||portrait
 const glitching=glitches&&!farewell&&!busy&&!reflection&&!error&&!covered,cleared=victory?3:game.exReckoning.active?.answers.length??0
 const active=!!game.exReckoning.active,abilityAspect=d.insight?.aspect??game.exEcho.player?.aspect,ability=abilityAspect?ECHO_BREAKTHROUGH_ABILITIES[abilityAspect]:null
 const spoken=d.lines.filter(l=>l.who==='reflection').at(-1)?.text
 const openTalk=():void=>{setPanel('talk');void act(openDungeonConversation)}
 const openInsight=():void=>{setPanel('insight');if(!d.insight)void act(useDungeonInsight)}
 return <>{createPortal(<div className="vu-dungeon" data-theme="night" data-phase={d.phase} data-glitching={glitching||undefined} role="dialog" aria-modal="true" aria-label={THE_UNSPOKEN.name} {...overlayProps} onClick={()=>{}} inert={overlayProps.inert||covered||reflection} aria-hidden={covered||reflection||undefined}>
  <img className="vu-dungeon-background" src={`./echo-dungeons/${d.aspect}.webp`} alt=""/>
  <div className="vu-dungeon-shade"/>
  {!farewell&&!reflection&&<div className="vu-dungeon-echo" aria-hidden="true"><EchoAura charId={id}/></div>}
  {glitching&&<div className="vu-reckoning-interference" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>}
  <svg className="vu-reckoning-glass vu-dungeon-cracks" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">{RECKONING_CRACKS.slice(0,cleared).map((d,i)=><g key={i}><path d={d}/><path className="vu-reckoning-glint" d={d}/></g>)}</svg>
  <header><small>{aspectOf(d.aspect).name} · {place.name}</small><h1>{THE_UNSPOKEN.name}</h1><p>{farewell?'The encounter is over.':`${d.context.name} · Unheard Soul`}</p></header>
  <button type="button" className="vu-btn vu-btn--outline vu-paper vu-dungeon-options" disabled={busy} onClick={openOptions}>Options</button>
  <div className="vu-reflection-scene-anchor" style={{'--reflection-height':game.characters[id]?.height??1} as CSSProperties}>
  {victory&&!reflection&&!shattered?<div className="vu-dungeon-fragments" style={{...placement,'--reflection-filter':reflectionArt?'none':'invert(1) hue-rotate(190deg) saturate(.7)'} as CSSProperties} aria-hidden="true"><img className="vu-dungeon-fragment-base" src={altered} alt=""/>{GLASS_SHARDS.map((shard,i)=><img key={i} src={altered} alt="" style={{...shard.style,clipPath:shard.clip}}/>)}</div>:
   !farewell&&<img className={`vu-dungeon-character${reflectionArt?'':' vu-dungeon-altered'}`} style={placement} src={altered} alt={`Unheard Soul of ${d.context.name}`}/>}
  </div>
  {!reflection&&<section className={`vu-dungeon-dialogue${!farewell&&!active&&panel==='choices'?' vu-dungeon-choice-deck':''}`} data-hover-glitch={glitches||undefined}>
   {!on&&<p>Re-enable Breaking Through the Silence to continue this saved visit.</p>}
   {error&&<p role="alert">{error}</p>}
   {farewell?<><div className="vu-dungeon-lines"><p>{dungeonOutcomeText(d)}</p></div><div className="vu-dungeon-actions"><small>Private encounter · no conversation saved</small><button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={busy} onClick={close}>Open your eyes</button></div></>:
    active?<><p>Your questions are paused. Talk and your aspect hint are no longer available for this attempt.</p><div className="vu-dungeon-actions"><button className="vu-btn vu-btn--primary vu-paper" disabled={busy||!enabled} onClick={()=>setReflection(true)}>Resume the questions</button><button className="vu-btn vu-btn--outline vu-paper" disabled={busy} onClick={close}>Open your eyes</button></div></>:
    panel==='choices'?<>
     <div className="vu-dungeon-choice-heading"><strong>What will you do?</strong><small>Listen beneath her words.</small></div>
     {warn&&<p className="vu-dungeon-warning" role="alert">Her patience is gone. One more reply will end this attempt.</p>}
     <div className="vu-dungeon-choices">
      <button className="vu-btn vu-paper vu-dungeon-choice" disabled={busy||!enabled} onClick={openTalk}><ChoiceIcon kind="talk"/><span><b>Talk</b><small>{Math.max(0,DUNGEON_MAX_REPLIES-1-d.replies)} replies remaining · listen for a clue</small></span></button>
      <button className="vu-btn vu-paper vu-dungeon-choice vu-dungeon-choice--primary" disabled={busy||!enabled||preparing} onClick={()=>prep.status==='error'?retryReckoningPreparation(id):setReflection(true)}><ChoiceIcon kind="silence"/><span><b>{preparing?'Listening for her thoughts…':prep.status==='error'?'Retry preparing questions':'Break through the silence'}</b><small>No going back · Talk and your hint end here</small></span></button>
      <button className="vu-btn vu-paper vu-dungeon-choice" disabled={busy||!enabled||!d.insight&&(!echoOn||!ability)} onClick={openInsight}><ChoiceIcon kind="aspect"/><span><b>{ability?.name??'Your aspect'}</b><small>{d.insight?'Hint used · read it again':!echoOn||!ability?'Requires your Echo':'Your aspect · one hint for this connection'}</small></span></button>
      <button className="vu-btn vu-paper vu-dungeon-choice vu-dungeon-choice--exit" disabled={busy} onClick={close}><ChoiceIcon kind="leave"/><span><b>Open your eyes</b><small>Return to the world</small></span></button>
     </div>
    </>:panel==='talk'?<>
     <div className="vu-dungeon-talk-heading"><strong>{d.context.name} · Unheard Soul</strong><small>{Math.max(0,3-d.replies)} replies remaining</small></div>
     {warn&&<p className="vu-dungeon-warning" role="alert">One more reply will end this attempt. Return to the choices to begin the questions.</p>}
     <div className="vu-dungeon-lines" aria-live="polite"><p>{spoken??(busy?'She turns toward you…':'Let her speak first.')}</p></div>
     {spoken?<form onSubmit={e=>{e.preventDefault();void act(()=>talkInReckoningDungeon(reply))}}><label htmlFor="dungeon-reply">Your reply</label><div><textarea id="dungeon-reply" value={reply} onChange={e=>setReply(e.target.value)} maxLength={1500} rows={2} disabled={busy||!enabled}/><button className="vu-btn vu-btn--primary vu-paper" disabled={busy||!enabled||!reply.trim()} type="submit">{busy?'Listening…':'Reply'}</button></div></form>:!busy&&<button className="vu-btn vu-btn--outline vu-paper" disabled={!enabled} onClick={openTalk}>Let her speak</button>}
     <div className="vu-dungeon-actions"><button className="vu-btn vu-btn--outline vu-paper" disabled={busy} onClick={()=>{setPanel('choices');setError('')}}>Back to choices</button><small>Listen for the fear behind her words.</small></div>
    </>:<>
     <div className="vu-dungeon-talk-heading"><strong>{ability?.name??'Your aspect'}</strong><small>{abilityAspect?aspectOf(abilityAspect).name:''} · one hint</small></div>
     <div className="vu-dungeon-lines" aria-live="polite"><p>{d.insight?.text??(busy?'Your Echo stirs. A different perspective begins to take shape…':'The hint has not been used.')}</p></div>
     <div className="vu-dungeon-actions"><button className="vu-btn vu-btn--outline vu-paper" disabled={busy} onClick={()=>{setPanel('choices');setError('')}}>Back to choices</button>{!d.insight&&!busy&&<button className="vu-btn vu-btn--primary vu-paper" disabled={!enabled||!echoOn||!ability} onClick={openInsight}>Try the hint again</button>}</div>
    </>}
  </section>}
  <UnspokenVoice surface="dungeon" hidden={covered||reflection||busy||!!error||panel==='insight'}/>
 </div>,host)}{reflection&&<ReckoningModal charId={id} onClose={()=>setReflection(false)} onOptions={onOptions} covered={covered}/>}</>
}
function ChoiceIcon({kind}:{kind:'talk'|'silence'|'aspect'|'leave'}):JSX.Element {
 return <svg viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{kind==='talk'?<><path d="M4 5h20v14H12l-6 5v-5H4z"/><path d="M9 10h10M9 14h7"/></>:kind==='silence'?<path d="m14 2 2.5 9.5L26 14l-9.5 2.5L14 26l-2.5-9.5L2 14l9.5-2.5z"/>:kind==='aspect'?<path d="M14 2 25 14 14 26 3 14zM14 7v6l4 3M9 18l3-3"/>:<><path d="M2 14s4-7 12-7 12 7 12 7-4 7-12 7S2 14 2 14z"/><circle cx="14" cy="14" r="3.5"/></>}</svg>
}
