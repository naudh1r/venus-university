import { gestures, quietLift, quietPress } from '@vx/modkit/renderer'
import { useState } from 'react'
import { motion } from 'motion/react'
import { abilityRank, farewellRomance, TALENT_ABILITIES } from '../../shared/talentAbilities'
import { abilityUsedThisWeek } from '../../shared/talentAbilityState'
import { fullNameOf } from '@shared/types'
import { useGameStore } from '../stores/gameStore'
import { useModOn } from '../stores/modsStore'
import { availableEchoBreakthrough, activateBreakthrough, canBreakthrough } from '../stores/breakthrough'
import { eurekaProjects, talentSceneOpen, talentGoodbyeOpen, type TalentChange } from '../stores/talentActions'
import { interject } from '../stores/gameLoop'
import { SelectField } from '../components/SelectField'

/** Purchased abilities share the skill panel's save guard and close only after an accepted action. */
export function TalentAbilityControls({skill,safe,act,onClose}:{skill:string;safe:boolean;act:(a:TalentChange)=>Promise<boolean>;onClose:()=>void}) {
  const game=useGameStore(),s=game.exTalents
  const record=game.playthroughId?{mods:[...game.playthroughMods]}:null
  const cityLocationsOn=useModOn('city-life-locations',record)
  const cityJobsOn=useModOn('city-life-jobs',record)
  const [choice,setChoice]=useState(''),[target,setTarget]=useState(''),[error,setError]=useState('')
  const rank=abilityRank(s,skill)
  if (!rank) return null
  const used=abilityUsedThisWeek(s.abilities,skill,game.semesterIndex,game.date)
  const button=(label:string,dead:boolean,run:()=>void)=><motion.button type="button" className="vu-btn vu-btn--quiet" disabled={dead} {...gestures(dead,quietLift,quietPress)} onClick={run}>{label}</motion.button>
  const present=game.cast.filter(id=>!game.departed.includes(id)&&game.characters[id]&&game.charInfo[id]?.nameKnown)
  const sceneHint=game.sceneClass!==null?'Use this in a social scene outside class.':
    game.sceneEnding||game.statusShown||game.statusModal?'Finish the scene results, then start another social scene.':
    game.busy||game.streaming||game.waitingForLine?'Wait for the current reply to finish generating.':
    game.pendingLines.length?'Finish reading the current reply first.':
    !talentGoodbyeOpen(game)?'Wait until the scene lets you reply.':
    !safe?'Wait until the game has finished saving or processing messages.':null
  const speak=(action:string):boolean=>{
    setError('')
    try { if(!interject(action))throw Error('Wait until you can reply in the scene.');onClose();return true }
    catch(e){setError(e instanceof Error?e.message:'The action could not start.');return false}
  }
  let content
  if(skill===TALENT_ABILITIES.eureka){
    const projects=eurekaProjects(game),p=projects.find(p=>p.code===choice)??projects[0],armed=s.abilities.eureka
    content=<><p>{used?'Already used this week. Available again next week.':armed?.term===game.semesterIndex?`Ready for ${game.classes[armed.code]?.name??armed.code}. Your next completed session gives triple progress and uses Eureka for this week.`:'Choose a project for your next burst of inspiration. That session gives triple progress instead of your other project bonuses.'}</p>
      {projects.length>0&&<SelectField id="talent-eureka-project" label="Project" value={p?.code??''} disabled={!safe||used} onChange={setChoice} options={projects.map(p=>({value:p.code,label:`${p.name} · ${p.exam}`}))}/>}
      {!projects.length&&<p>You have no unfinished assigned projects right now.</p>}
      {button('Use on this project',!safe||used||!p,()=>{if(p)void act({ability:'eureka',code:p.code,exam:p.exam})})}
      {armed&&button('Clear project choice',!safe,()=>void act({ability:'cancel-eureka'}))}</>
  }else if(skill===TALENT_ABILITIES.farewell){
    const ids=present.filter(id=>farewellRomance(game.charInfo[id])),id=ids.includes(choice)?choice:ids[0]
    const ready=safe&&!used&&!!id&&talentGoodbyeOpen(game)&&game.sceneClass===null
    const goodbye=async()=>{
      if(!id||!await act({ability:'farewell',charId:id}))return
      const f=useGameStore.getState().exTalents.abilities.farewell
      if(f&&!speak(f.action))await act({ability:'cancel-farewell'})
    }
    content=<><p>{used?'Already used this week. Available again next week.':'Finish the current reply, then say goodbye to a partner you have kissed or begun a relationship with. A warm ending creates Anticipation for your next meeting. If it goes poorly, you keep this week\'s use.'}</p>
      {ids.length>0&&<SelectField id="talent-goodbye-partner" label="Partner" value={id} disabled={!safe} onChange={setChoice} options={ids.map(id=>({value:id,label:fullNameOf(game.characters[id])}))}/>}
      {!used&&(!ids.length?<p>You need a partner here whom you have kissed or begun a relationship with.</p>:sceneHint&&<p>{sceneHint}</p>)}
      {button('Say a graceful goodbye',!ready,()=>void goodbye())}
      {!!Object.keys(s.abilities.anticipation).length&&<p>Anticipation: {Object.keys(s.abilities.anticipation).filter(id=>game.characters[id]&&game.charInfo[id]?.nameKnown).map(id=>fullNameOf(game.characters[id])).join(', ')||'A future meeting'}.</p>}</>
  }else if(skill===TALENT_ABILITIES.silverLining){
    const id=present.includes(choice)?choice:present[0]
    const ready=safe&&!used&&!!id&&talentGoodbyeOpen(game)&&game.sceneClass===null
    const recover=async()=>{
      if(!id||!await act({ability:'silver-lining',charId:id}))return
      const p=useGameStore.getState().exTalents.abilities.silverLining
      if(p&&!speak(p.action))await act({ability:'cancel-silver-lining'})
    }
    content=<><p>{used?'Already used this week. Available again next week.':'Use when a social exchange turns awkward or tense. Choose someone here, then use warmth and wit to find a favorable way forward. The generated reply uses your weekly chance; a generation error does not. It cannot undo past events or override a refusal.'}</p>
      {present.length>0&&<SelectField id="talent-silver-lining-partner" label="Turn things around with" disabled={!safe||used} value={id} onChange={setChoice} options={present.map(id=>({value:id,label:fullNameOf(game.characters[id])}))}/>}
      {!present.length&&<p>Meet someone in a social scene to use Silver Lining.</p>}
      {!used&&present.length>0&&sceneHint&&<p>{sceneHint}</p>}
      {button('Turn things around',!ready,()=>void recover())}</>
  }else if(skill===TALENT_ABILITIES.dancer){
    content=<><p>Your rank {rank} dancing skill applies whenever you dance. Describe your moves in the usual reply box, or start here if the setting suits it. Use as often as you like.</p>
      {cityLocationsOn&&cityJobsOn&&<p>Dancer III also qualifies you for Dance Instructor at the Dance Studio, with Good Body and Good Heart. Apply through Jobs. Visiting the studio needs no rank.</p>}
      {button('Start dancing',!safe||!talentSceneOpen(game),()=>speak('I take the opportunity to dance, using my practiced timing and footwork. If there is a willing partner, I invite them to join me without pressuring them.'))}</>
  }else if(skill===TALENT_ABILITIES.value){
    content=<p>Open BunnyShop and choose a person under Eye for Value. Your best affordable gift is highlighted. Select Find to jump to its shop and card. Uses her actual gift tastes, avoids repeats, and works before your first gift.</p>
  }else if(skill===TALENT_ABILITIES.borrowed){
    const sources=present.filter(id=>!!availableEchoBreakthrough(game,id)),source=sources.includes(choice)?choice:sources[0]
    const id=present.includes(target)?target:present[0],ability=source?availableEchoBreakthrough(game,source):null
    const ready=safe&&!!ability&&!!id&&canBreakthrough(game,id,ability.aspect,source)
    content=<><p>{used?'Already used this week. Available again next week.':'Choose a trusted companion to borrow from, then someone to use the ability with. Both must be here. Echo abilities must be enabled; the spirit cost comes from your target\'s meter.'}</p>
      {sources.length>0&&<SelectField id="talent-borrow-source" label="Borrow from" disabled={!safe} value={source} onChange={setChoice} options={sources.map(id=>({value:id,label:fullNameOf(game.characters[id])}))}/>}
      {!!ability&&<><p><strong>{ability.name}</strong> · {ability.cost} spirit<br/>{ability.summary}</p><SelectField id="talent-borrow-target" label="Use with" disabled={!safe} value={id} onChange={setTarget} options={present.map(id=>({value:id,label:`${fullNameOf(game.characters[id])} · ${game.exBreakthrough.meters[id]??0} spirit`}))}/></>}
      {!sources.length&&!used&&<p>No trusted companion with an available Echo ability is here right now.</p>}
      {button('Use Borrowed Voice',!ready,()=>{if(!ability||!source||!id)return;try{activateBreakthrough(id,ability.action,interject,ability.aspect,source);onClose()}catch(e){setError(e instanceof Error?e.message:'Could not use this ability.')}})}</>
  }else return null
  return <section className="vu-talent-actions" aria-label="Ability controls">{content}{error&&<p role="alert">{error}</p>}</section>
}
