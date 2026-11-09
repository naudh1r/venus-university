import { FallingGlass } from '../components/FallingGlass'
import { useReflectionPortrait } from '../components/ReflectionPortrait'
import { moveLegacyReckoningToDungeon } from '../stores/reckoning'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { createPortal } from 'react-dom'
import { dynamicFor, type GrowthTag } from '@shared/characterDynamics'
import { RECKONING_MOD } from '../../shared/reckoning'
import { fullNameOf } from '@vx/modkit/shared'
import { useModalShell } from '@vx/modkit/renderer'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModOption } from '@vx/modkit/renderer'
import { useAudioStore } from '../stores/audioStore'
import { spriteUrl, useSpriteVersion } from '../stores/characterStore'
import { answerReckoning, cancelReckoningRequest, canResumeReckoning, canStartReckoning, canUnlockReckoning, unlockReckoningDungeon, startReckoning, canContinueReckoning, watchReckoningPreparation } from '../stores/reckoning'
import { submitReckoningAftermath } from '../stores/gameLoop'
import { unspokenNightAvailable } from '../stores/reckoningCalendar'
import { resolveEchoStage } from '@shared/echoStage'
import { StagedEcho } from './EchoPanel'
import '../vu_styles/Reckoning.css'

/** A queued closing beat starts only in a later ordinary scene with the real girl. */
export function ReckoningContinuation({blocked}:{blocked:boolean}):null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD)
  useEffect(()=>{if(!blocked&&on&&canContinueReckoning(game))void submitReckoningAftermath()},[blocked,on,game])
  return null
}

export function ReckoningPreparation():null {
  useEffect(()=>watchReckoningPreparation(),[])
  return null
}

export function ReckoningEntry({charId,blocked,onOpen}:{charId:string;blocked:boolean;onOpen?:(id:string)=>void}):JSX.Element|null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD)
  const [launching,setLaunching]=useState(false),[launchError,setLaunchError]=useState('')
  if(!on||!onOpen)return null
  const earned=dynamicFor(game.exCharacterDynamics,charId).growth,dungeon=game.exReckoning.dungeon
  const invoke=async():Promise<void>=>{
    if(launching)return
    setLaunching(true);setLaunchError('')
    try{if(game.exReckoning.active&&!dungeon)await moveLegacyReckoningToDungeon();else await unlockReckoningDungeon(charId)}catch(error){setLaunchError(error instanceof Error?error.message:'The connection could not be saved.')}
    finally{setLaunching(false)}
  }
  return <section className="vu-reckoning-entry"><strong>Breaking Through the Silence</strong>
    <p>{earned?`Earned growth · ${earned.name}`:dungeon?`Your mind is linked with ${dungeon.context.name}. Her unspoken thoughts sometimes reach you. Finish this scene, then follow her voice from the map at night. Only one connection can be open at a time.`:`Listen beneath her words to open a private connection. At night, meditate and follow her voice into The Unspoken.`}</p>
    {game.exReckoning.active&&!dungeon?<button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={blocked||launching||game.time!==1} onClick={()=>void invoke()}>Continue in The Unspoken · night</button>:
      !earned&&!dungeon&&<button type="button" className="vu-btn vu-btn--outline vu-paper" disabled={blocked||launching||!canUnlockReckoning(game,charId)} onClick={()=>void invoke()}>{launching?'Listening…':'Listen beneath her words · 100 spirit'}</button>}
    {launchError&&<p role="alert">{launchError}</p>}
    {!earned&&!dungeon&&!game.exReckoning.active&&!unspokenNightAvailable(game,true)&&<p>There is no playable night left after this scene. Start a connection earlier in the semester.</p>}
  </section>
}

export const RECKONING_CRACKS=['M0 90 180 170 310 120 470 270 510 430 720 520 1000 450 M310 120 345 0 M470 270 240 450 0 420',
  'M1000 100 810 230 620 190 510 430 390 590 320 800 M810 230 850 400 1000 610 M620 190 520 0',
  'M0 690 240 450 510 430 720 520 800 800 M240 450 100 230 0 200 M720 520 820 650 1000 700']
export function ReckoningModal({charId,onClose,onOptions,covered=false}:{charId:string;onClose:()=>void;onOptions?:()=>void;covered?:boolean}):JSX.Element|null {
  const game=useGameStore(s=>s),on=useModOn(RECKONING_MOD),breakthroughOn=useModOn('breakthrough')
  const echoOn=useModOn('echo'),playerEcho=echoOn?game.exEcho.player:null
  const girlEcho=echoOn?game.exEcho.girls[charId]:null
  const glitchEffects=useModOption(RECKONING_MOD,'glitch-effects')
  const character=game.characters[charId],session=game.exReckoning.active?.charId===charId?game.exReckoning.active:null
  const [reply,setReply]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [terminal,setTerminal]=useState<{failed?:boolean;tag?:GrowthTag;feedback:string;reaction:string}|null>(null)
  const [resolved,setResolved]=useState<{round:number;feedback:string;reaction:string}|null>(null)
  const reflectionArt=useReflectionPortrait(charId)
  const version=useSpriteVersion(charId),[failedPortrait,setFailedPortrait]=useState<string|null>(null)
  const restored=!!terminal?.tag
  const portraitSrc=restored?spriteUrl(charId,'neutral',version):reflectionArt||spriteUrl(charId,'neutral',version)
  const mounted=useRef(true),opening=useRef(!!session),opened=useRef({playthroughId:game.playthroughId,loads:game.loads})
  const close=():void=>{if(cancelReckoningRequest())onClose();else setError('Finishing the save…')}
  const {host,overlayProps}=useModalShell(close,'none')
  const textArea=useRef<HTMLElement>(null)
  useLayoutEffect(()=>{
    const area=textArea.current
    if(!area)return
    let frame=0,disposed=false
    const fit=():void=>{
      // Fit the whole statement, including feedback, without shrinking below readable sizes.
      for(let step=0;step<=5;step++){
        area.style.setProperty('--reckoning-text-scale',String(1-step*.04))
        if(area.scrollHeight<=area.clientHeight+1)break
      }
    }
    const resize=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit)})
    fit();area.scrollTop=0;resize.observe(area)
    void document.fonts.ready.then(()=>{if(!disposed)fit()})
    return()=>{disposed=true;cancelAnimationFrame(frame);resize.disconnect()}
  },[host,character,session,terminal,resolved])
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;cancelReckoningRequest()}},[])
  useEffect(()=>{if(!on||!breakthroughOn||game.playthroughId!==opened.current.playthroughId||game.loads!==opened.current.loads)close()},[on,breakthroughOn,game.playthroughId,game.loads])
  useEffect(()=>{useAudioStore.getState().setReckoningActive(!!session||!!terminal,!!terminal?.tag)},[!!session,!!terminal,!!terminal?.tag])
  useEffect(()=>()=>useAudioStore.getState().setReckoningActive(false),[])
  const request=async(start:boolean):Promise<void>=>{
    if(busy||resolved)return
    setBusy(true);setError('')
    try {
      if(start)await startReckoning(charId)
      else {
        const round=(session?.answers.length??0)+1
        const result=await answerReckoning(reply)
        if(mounted.current){
          setReply('')
          if(result.failed||result.tag)setTerminal(result)
          else setResolved({round,feedback:result.feedback,reaction:result.reaction})
        }
      }
    } catch(e){if(mounted.current)setError(e instanceof Error?e.message:'The response could not be saved. Try again.')}
    finally{if(mounted.current)setBusy(false)}
  }
  useEffect(()=>{
    if(!host||!character||opening.current||session||terminal)return
    // Defer until after effect setup so StrictMode's rehearsal cannot start a paid request.
    let disposed=false
    queueMicrotask(()=>{
      if(disposed||!mounted.current||opening.current)return
      opening.current=true
      void request(true)
    })
    return()=>{disposed=true}
  },[host,character,session,terminal])
  if(!host||!character)return null
  const cleared=terminal?.tag?3:session?.answers.length??0
  const name=fullNameOf(character),active=!!session||!!terminal
  const glitching=glitchEffects&&!!session&&!terminal&&!resolved&&!busy&&!error&&!covered
  return createPortal(<div className="vu-reckoning-veil" data-glitching={glitching||undefined} data-covered={covered||undefined} {...overlayProps} inert={overlayProps.inert||covered} aria-hidden={covered||undefined}>
    {glitching&&<div className="vu-reckoning-interference" aria-hidden="true">{Array.from({length:8},(_,i)=><i key={i}/>)}</div>}
    {active&&girlEcho&&game.exEcho.visible&&!terminal&&<div className="vu-reckoning-echo vu-reckoning-echo--girl echo-reflection-stage" aria-hidden="true"><StagedEcho identity={girlEcho} placement={resolveEchoStage(playerEcho?.stage,true)} opacity={game.exEcho.opacity} player preview owner={charId}/></div>}
    {active&&playerEcho&&game.exEcho.visible&&<div className="vu-reckoning-echo echo-reflection-stage" aria-hidden="true"><StagedEcho identity={playerEcho} opacity={game.exEcho.opacity} player preview owner="player"/></div>}
    <section className="vu-reckoning" data-cleared={cleared} data-active={active} data-failed={terminal?.failed||undefined} role="dialog" aria-modal="true" aria-label={`Breaking Through the Silence with ${name}`} style={{'--reckoning-light':cleared/3} as CSSProperties}>
      <div className="vu-reckoning-portrait" data-custom={!restored&&!!reflectionArt||undefined} data-restored={restored||undefined} aria-hidden="true">{failedPortrait!==portraitSrc&&<img className="vu-reflection-stage-image" src={portraitSrc} alt="" onError={()=>setFailedPortrait(portraitSrc)}/>}</div>
      {terminal?.tag&&<div className="vu-reckoning-victory" aria-hidden="true"><div className="vu-reckoning-dawn"/><FallingGlass/></div>}
      <div className="vu-reckoning-light" aria-hidden="true"/>
      <svg className="vu-reckoning-glass" viewBox="0 0 1000 800" preserveAspectRatio="none" aria-hidden="true">{RECKONING_CRACKS.slice(0,cleared).map((d,i)=><g key={i}><path d={d}/><path className="vu-reckoning-glint" d={d}/></g>)}</svg>
      <header><div><small>{name}{!restored&&' · Unheard Soul'}</small><h1>Breaking Through the Silence</h1>{active&&playerEcho&&<p className="vu-reckoning-private">Inwardly, you call to {session?.echoName||playerEcho.name}.</p>}</div><div className="vu-reckoning-header-actions">{onOptions&&<button type="button" className="vu-reckoning-secondary" disabled={busy} onClick={onOptions}>Options</button>}<button type="button" className="vu-reckoning-close" aria-label="Close the encounter" onClick={close}>×</button></div></header>
      <ol className="vu-reckoning-rounds" aria-label="Thoughts resolved">{[0,1,2].map(i=><li key={i} data-done={i<cleared} aria-current={!terminal&&i===(resolved?cleared-1:cleared)?'step':undefined}>{i<cleared?'✦':'◇'}<span>{i+1}</span></li>)}</ol>
      <main ref={textArea} aria-live="polite" tabIndex={0} aria-label="Unspoken thought">
        {terminal?<div className="vu-reckoning-outcome"><small>{terminal.failed?'Her Unheard Soul stands':'Three fractures. A different way forward.'}</small><h2>{terminal.failed?'The voice holds its ground.':'The light gets through.'}</h2><p className="vu-reckoning-challenge">{terminal.reaction}</p><p>{terminal.feedback}</p>{terminal.tag?<div className="vu-reckoning-earned"><small>Character Dynamics · earned growth</small><h3>{terminal.tag.name}</h3><p>{terminal.tag.description}</p><p>Her personality remains her own. These old beliefs have less hold on her.</p></div>:<p>No growth tag was earned. The connection remains; rebuild 100 spirit with her before trying again.</p>}</div>:
          resolved?<div className="vu-reckoning-resolved"><small>Progress saved · {resolved.round} of 3</small><h2>Thought {resolved.round} resolved</h2><p className="vu-reckoning-challenge">“{resolved.reaction}”</p><p className="vu-reckoning-feedback">{resolved.feedback}</p><p className="vu-reckoning-note">A fracture opens. Another thought waits beyond it.</p></div>:
          session?<div className="vu-reckoning-thought" key={`${session.id}:${cleared}`}><small className="vu-reckoning-round-label">THOUGHT {cleared+1} OF 3 · {cleared} RESOLVED</small><h2>{session.thoughts[cleared].belief}</h2><p className="vu-reckoning-challenge">“{session.challenge}”</p></div>:
          <div className="vu-reckoning-loading"><h2>{error?'Her Unheard Soul is waiting.':'Her Unheard Soul takes shape…'}</h2></div>}
      </main>
      <footer>{error&&<p role="alert">{error}</p>}{busy&&<p role="status">{session?'Listening to your answer…':'Listening to her Unheard Soul…'}</p>}
        {resolved?<div className="vu-reckoning-footer-actions"><button type="button" className="vu-reckoning-secondary" onClick={close}>Pause · progress saved</button><button type="button" className="vu-reckoning-primary" autoFocus disabled={busy} onClick={()=>setResolved(null)}>Continue to thought {resolved.round+1}</button></div>:
          session&&!terminal?<form onSubmit={e=>{e.preventDefault();void request(false)}}><label htmlFor="reckoning-reply">Your answer<textarea id="reckoning-reply" value={reply} onChange={e=>setReply(e.target.value)} maxLength={1500} rows={3} disabled={busy} placeholder="I understand why it feels that way. But remember…" autoFocus/></label><div><span>{reply.length} / 1,500</span><button type="button" className="vu-reckoning-secondary" onClick={close}>{busy?'Cancel request & pause':'Pause · progress saved'}</button><button className="vu-reckoning-primary" disabled={busy||!reply.trim()||!canResumeReckoning(game,charId)} type="submit">Answer her</button></div></form>:
          <div className="vu-reckoning-footer-actions"><button type="button" className="vu-reckoning-secondary" onClick={close}>{terminal?'Return to The Unspoken':busy?'Cancel request':'Close'}</button>{!terminal&&error&&<button type="button" className="vu-reckoning-primary" disabled={busy||!canStartReckoning(game,charId)} onClick={()=>void request(true)}>Try again</button>}</div>}
      </footer>
    </section>
  </div>,host)
}
