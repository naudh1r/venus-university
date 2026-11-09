import { useEffect, useRef, useState, type JSX } from 'react'
import { unspokenWhispers } from '@shared/unspokenVoice'
import { useGameStore } from '../stores/gameStore'
import { useModOn, useModOption } from '../stores/modsStore'
import { preparedReckoningThoughts, useReckoningPreparation } from '../stores/reckoning'
import '../vu_styles/UnspokenVoice.css'

import { UnspokenWhisper, type Whisper } from '../components/UnspokenWhisper'

/** Presentation only: no request, speech audio, transcript, summary or save write. */
export function UnspokenVoice({hidden,surface='scene'}:{hidden:boolean;surface?:'scene'|'dungeon'}):JSX.Element|null {
 const game=useGameStore(s=>s),on=useModOn('reckoning'),breakthrough=useModOn('breakthrough')
 const glitch=useModOption('reckoning','glitch-effects')
 useReckoningPreparation(s=>s.revision)
 const d=game.exReckoning.dungeon
 const inside=surface==='dungeon'
 const linkedHere=!!d&&game.cast.includes(d.charId)&&!game.departed.includes(d.charId)
 const distant=!inside&&!linkedHere
 const key=`${game.playthroughId}:${game.loads}:${d?.id}:${surface}:${distant?'distant':'nearby'}`
 const choices=JSON.stringify(d?unspokenWhispers(d,preparedReckoningThoughts(d.charId)):[])
 const eligible=!hidden&&on&&breakthrough&&!!d&&!game.exReckoning.active&&!game.replaying&&!game.createdScene&&
  (inside?d.phase==='inside':d.phase==='unlocked'&&!game.reread&&!game.busy&&!game.turnError&&game.awaitingInput)
 const [whisper,setWhisper]=useState<Whisper|null>(null)
 const cadence=useRef({key:'',nextAt:0,index:-1,serial:0,x:.5,y:.5})
 const firstIndex=d?.voice?.index??0
 const priority=inside?d?.whispers?.[0]??'':''
 const lastPriority=useRef({key:'',text:''})

 useEffect(()=>{
  const words=JSON.parse(choices) as string[]
  if(cadence.current.key!==key)cadence.current={key,nextAt:Date.now()+(distant?120000:1600),index:firstIndex-1,serial:0,x:.5,y:.5}
  setWhisper(null)
  if(!eligible||!words.length)return
  if(priority&&(lastPriority.current.key!==key||lastPriority.current.text!==priority)){
   // A just-saved Talk response leads the next appearance, then joins the normal rotation.
   cadence.current.index=words.indexOf(priority)-1;cadence.current.nextAt=Date.now()
   lastPriority.current={key,text:priority}
  }
  let next:ReturnType<typeof setTimeout>|undefined,fade:ReturnType<typeof setTimeout>|undefined
  function clear():void {clearTimeout(next);clearTimeout(fade);setWhisper(null)}
  function schedule():void {
   if(document.hidden)return
   next=setTimeout(show,Math.max(800,cadence.current.nextAt-Date.now()))
  }
  function show():void {
   if(document.hidden)return
   const state=cadence.current
   state.index=(state.index+1)%words.length
   let x=.06+Math.random()*.88,y=.06+Math.random()*.88
   // Avoid two consecutive whispers landing almost on top of each other.
   if(Math.hypot(x-state.x,y-state.y)<.28){x=state.x<.5?.88:.12;y=state.y<.5?.86:.14}
   state.x=x;state.y=y
   const text=words[state.index],duration=Math.max(4800,Math.min(9000,text.length*30))
   setWhisper({id:++state.serial,words:text,x,y,duration})
   state.nextAt=Date.now()+(inside?10000:distant?120000:50000+Math.random()*25000)
   fade=setTimeout(()=>setWhisper(null),duration)
   schedule()
  }
  function visibility():void {clear();if(!document.hidden)schedule()}
  document.addEventListener('visibilitychange',visibility)
  schedule()
  return()=>{clearTimeout(next);clearTimeout(fade);document.removeEventListener('visibilitychange',visibility)}
 },[eligible,key,choices,firstIndex,inside,distant,priority])

 if(!eligible||!whisper)return null
 return <UnspokenWhisper key={whisper.id} whisper={whisper} glitch={glitch}/>
}
