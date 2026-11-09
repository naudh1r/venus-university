import { useEffect, useRef, type JSX } from 'react'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModOption } from '../stores/modsStore'
import { useReckoningLinkEffect } from '../stores/reckoningLinkEffect'
import '../vu_styles/UnspokenVoice.css'

/** One strong, wordless burst after the link and its scene beat have committed together. */
export function UnspokenLinkGlitch({hidden}:{hidden:boolean}):JSX.Element|null {
 const pulse=useReckoningLinkEffect(s=>s.pulse),game=useGameStore(s=>s)
 const on=useModOn('reckoning'),breakthrough=useModOn('breakthrough'),glitch=useModOption('reckoning','glitch-effects')
 const root=useRef<HTMLDivElement>(null)
 const visible=!!pulse&&!hidden&&on&&breakthrough&&glitch&&!game.replaying&&!game.createdScene&&
  pulse.playthroughId===game.playthroughId&&pulse.loads===game.loads&&pulse.id===game.exReckoning.dungeon?.id&&
  game.exReckoning.dungeon.phase==='unlocked'&&pulse.until>Date.now()
 useEffect(()=>{
  if(!pulse)return
  const clear=():void=>{if(useReckoningLinkEffect.getState().pulse===pulse)useReckoningLinkEffect.setState({pulse:null})}
  const stage=root.current?.closest<HTMLElement>('.vu-stage'),motion=matchMedia('(prefers-reduced-motion: reduce)')
  if(!visible||document.hidden||motion.matches||!stage){clear();return}
  stage.dataset.unspokenLinkGlitch=pulse.id
  const stop=():void=>{if(stage.dataset.unspokenLinkGlitch===pulse.id)delete stage.dataset.unspokenLinkGlitch;clear()}
  const timer=setTimeout(stop,Math.max(0,pulse.until-Date.now()))
  document.addEventListener('visibilitychange',stop);motion.addEventListener('change',stop)
  return()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',stop);motion.removeEventListener('change',stop);if(stage.dataset.unspokenLinkGlitch===pulse.id)delete stage.dataset.unspokenLinkGlitch}
 },[pulse,visible])
 return visible?<div key={pulse.id} ref={root} className="vu-unspoken-link-glitch" aria-hidden="true"><i/><i/><i/></div>:null
}
