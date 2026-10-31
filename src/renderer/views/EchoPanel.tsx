import { talentAffinity, talentAbilityCost } from '@shared/campusTalents'
import { optionOn } from '@vx/modkit/shared'
import { useEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { ECHO_ASPECTS, aspectOf, changePlayerEcho, echoAffinity, echoCreatureOf, editEchoCreature, editEchoSettings, editEchoStage, matchingEcho, normalizeEcho, renameEcho, withEchoArtwork, type EchoAspect, type EchoIdentity, type EchoState } from '../../shared/echo'
import { chooseSetupEchoAspect } from '../../shared/echoSetup'
import { ECHO_FLOAT_SECONDS_DEFAULT, ECHO_STAGE_DEFAULT, PLAYER_ECHO_STAGE_DEFAULT, ECHO_STAGE_LIMITS, echoStageOpacity, echoStageStyle, normalizeEchoStage, resolveEchoStage, type EchoStagePlacement } from '../../shared/echoStage'
import { spriteUrl, useSpriteVersion } from '../stores/characterStore'
import { pictureKeySet } from '@shared/settingsRules'
import { comfySourceOf } from '@shared/comfyModels'
import { suggestEchoName, suggestEchoCreature } from '../../shared/echoNaming'
import { echoBreakthroughAbility, ECHO_BREAKTHROUGH_OPTION } from '../../shared/echoBreakthrough'
import { fullNameOf, type Character } from '@vx/modkit/shared'
import { useGameStore } from '../stores/gameStore'
import { useModOn, modIsOn, useModsStore } from '../stores/modsStore'
import { useSettingsStore } from '../stores/settingsStore'
import { manualSaveOffer, writeEcho } from '../stores/loop/saves'
import { ensureEchoes } from '../stores/echoAssignments'
import { useDismissLayer } from '@vx/modkit/renderer'
import { EchoNotice } from '../components/EchoNotice'
import { EchoSwitchDialog } from '../components/EchoSwitchDialog'
import type { ScreenTheme } from '@vx/modkit/renderer'
import '../vu_styles/Echo.css'

function useTalentEchoRates() {
  const game=useGameStore(s=>s), on=useModOn('campus-talents')
  const active=on&&!!game.playthroughId&&!game.createdScene&&!game.replaying
  const percent=(kind:'matching'|'competing'|'neutral')=>Math.round(((active?talentAffinity(game.exTalents,kind):kind==='matching'?1.25:kind==='competing'?.75:1)-1)*100)
  const label=(kind:'matching'|'competing'|'neutral')=>{const n=percent(kind);return n>0?'+'+n+'%':n<0?'−'+Math.abs(n)+'%':'normal progress'}
  return {label,cost:(n:number)=>active?talentAbilityCost(game.exTalents,n):n}
}

const artCache = new Map<string,Promise<string | null>>()
/** Follow the selected option immediately, before the player commits an aspect change. */
function EchoAspectAbility({aspect}: {aspect: EchoAspect}): JSX.Element | null {
  const rates=useTalentEchoRates()
  const ability = echoBreakthroughAbility(aspect)
  if (!ability) return null
  return <section className="echo-bond" aria-label="Selected aspect ability" aria-live="polite" aria-atomic="true">
    <strong>{ability.name}</strong>
    <p>{ability.summary}</p>
    <p>{rates.cost(ability.cost)} spirit · {ability.scope} · One exchange</p>
  </section>
}
function EchoAspectMatchups({aspect}: {aspect: EchoAspect}): JSX.Element {
  const rates=useTalentEchoRates()
  const selected = aspectOf(aspect)
  return <section className="echo-bond" aria-label="Selected aspect matchups" aria-live="polite" aria-atomic="true">
    <strong>Aspect matchups</strong>
    <p>Matching: <b>{selected.name}</b> · {rates.label('matching')}</p>
    <p>Competing: <b>{aspectOf(selected.opposite).name}</b> · {rates.label('competing')}</p>
    <p>All other aspects: neutral · {rates.label('neutral')}</p>
    <p>Based on your Echo’s aspect. Applies to new positive relationship progress.</p>
  </section>
}
/** Reset before committing a render, so another owner's draft never looks like an edit. */
function useEchoDraft<T>(saved: T, scope: string): [T, (value: T) => void] {
  const key = JSON.stringify([scope, saved])
  const [draft, setDraft] = useState({key, value: saved})
  if (draft.key !== key) setDraft({key, value: saved})
  return [draft.key === key ? draft.value : saved, value => setDraft({key, value})]
}

function EchoDice({label,disabled,onClick}: {label:string;disabled:boolean;onClick:()=>void}): JSX.Element {
  return <button type="button" className="echo-dice" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="1.5"/>{[[8,8],[16,8],[12,12],[8,16],[16,16]].map(([cx,cy])=><circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="1.4" fill="currentColor"/>)}</svg>
  </button>
}
function useEchoImage(id?: string,generated=false): { src: string | null; missing: boolean; loading:boolean } {
  const [image,setImage] = useState<{id?:string;src:string|null;missing:boolean;loading:boolean}>({src:null,missing:false,loading:!!id})
  useEffect(() => {
    let live = true
    if (!id || !window.api.echo) { setImage({id,src:null,missing:!!id,loading:false}); return }
    setImage({id,src:null,missing:false,loading:true})
    const cacheKey = `${id}:${generated}`
    let read = artCache.get(cacheKey)
    if (!read) {
      read = window.api.echo.read(id,generated).then(r => r.ok ? r.data : null).catch(() => null)
      artCache.set(cacheKey,read)
      if (artCache.size > 32) artCache.delete(artCache.keys().next().value!)
    }
    void read.then(src => { if(!src&&artCache.get(cacheKey)===read)artCache.delete(cacheKey);if (live) setImage({id,src,missing:!src,loading:false}) })
    return () => { live = false }
  },[id,generated])
  return image.id === id ? image : {src:null,missing:false,loading:!!id}
}
function EchoSigil({identity}: {identity:EchoIdentity}): JSX.Element {
  const n = ECHO_ASPECTS.findIndex(a => a.id === identity.aspect)
  return <svg viewBox="0 0 320 440" fill="none" aria-hidden="true" className="echo-sigil" style={{color:aspectOf(identity.aspect).color}}>
    <ellipse cx="160" cy="210" rx="125" ry="174" stroke="currentColor" opacity=".2"/>
    <circle cx="160" cy="197" r="98" stroke="currentColor" opacity=".65"/>
    <circle cx="160" cy="197" r="83" stroke="currentColor" strokeDasharray="2 9"/>
    <g transform={`rotate(${n * 8} 160 197)`}>
      <path d="M160 84 190 167 274 197 190 227 160 310 130 227 46 197 130 167Z" stroke="currentColor" fill="currentColor" fillOpacity=".1"/>
      <path d="M160 119 218 197 160 275 102 197Z" stroke="currentColor"/>
    </g>
    <path d="M160 171 178 197 160 223 142 197Z" fill="currentColor"/>
    <path d="M101 337Q160 393 219 337M123 357Q160 404 197 357" stroke="currentColor" opacity=".6"/>
    <circle cx="160" cy="45" r="5" fill="currentColor"/>
    <text x="160" y="413" textAnchor="middle" fill="currentColor" fontSize="15" letterSpacing="6">{String(n).padStart(2,'0')}</text>
  </svg>
}
function EchoArt({identity,status=false}: {identity:EchoIdentity;status?:boolean}): JSX.Element {
  const image = useEchoImage(identity.art,identity.source!=='uploaded')
  return image.src ? <img src={image.src} alt={`${identity.name} · ${aspectOf(identity.aspect).name} Echo artwork`} /> : <><EchoSigil identity={identity}/>{status&&<span className="echo-art-status" role="status">{image.loading?'Loading saved artwork…':image.missing?'Saved artwork unavailable':'Artwork not generated yet'}</span>}</>
}
export function EchoAura({charId}: {charId:string}): JSX.Element | null {
  const state = useGameStore(s => s.exEcho), on = useModOn('echo')
  const unavailable = useGameStore(s => !!s.replaying || !!s.createdScene)
  const identity = state.girls[charId]
  if (!on || unavailable || !identity || !state.visible) return null
  return <StagedEcho identity={identity} opacity={state.opacity} owner={charId}/>
}
/** Shared preview/stage rendering keeps position, opacity and optional motion identical. */
export function StagedEcho({identity,placement=identity.stage,visible=identity.stage?.visible!==false,opacity,player=false,preview=false,owner}: {identity:EchoIdentity;placement?:EchoStagePlacement;visible?:boolean;opacity:number;player?:boolean;preview?:boolean;owner?:string}):JSX.Element | null {
  const stage=resolveEchoStage(placement,player)
  if (!visible) return null
  return <div className="echo-aura" data-echo-owner={owner} data-floating={stage.floating??player} aria-hidden="true" style={{...echoStageStyle(stage,preview),opacity:echoStageOpacity(stage,opacity,player),'--echo-float-seconds':`${stage.floatSeconds??ECHO_FLOAT_SECONDS_DEFAULT}s`,'--echo-tint':aspectOf(identity.aspect).color} as CSSProperties}>
    <div className="echo-float"><EchoArt identity={identity}/></div>
  </div>
}
function EchoPlacementControl({id,label,min,max,value,unit,disabled,onChange}:{id:string;label:string;min:number;max:number;value:number;unit:string;disabled:boolean;onChange:(value:number)=>void}):JSX.Element {
  const [text,setText]=useState(String(value))
  useEffect(()=>setText(String(value)),[value])
  return <div className="echo-placement-control"><label htmlFor={id}>{label}<span>{value}{unit}</span></label><div>
    <input id={id} aria-label={`${label} slider`} type="range" min={min} max={max} step={1} value={value} disabled={disabled} onChange={e=>{setText(e.target.value);onChange(Number(e.target.value))}}/>
    <input aria-label={label} type="number" min={min} max={max} step={1} value={text} disabled={disabled} onChange={e=>{setText(e.target.value);if(Number.isFinite(e.target.valueAsNumber))onChange(e.target.valueAsNumber)}} onBlur={()=>setText(String(value))}/>
  </div></div>
}
function EchoStagePreview({identity,charId,height,placement,opacity}: {identity:EchoIdentity;charId:string;height:number;placement:EchoStagePlacement;opacity:number}):JSX.Element {
  const version=useSpriteVersion(charId),src=spriteUrl(charId,'neutral',version)
  const [missing,setMissing]=useState(false)
  useEffect(()=>setMissing(false),[src])
  return <div className={`echo-stage-preview${charId==='player'?' echo-reflection-stage':''}`} data-player={charId==='player'} role="img" aria-label="Echo position preview" style={{'--preview-height':Math.max(.9,Math.min(1,height||1))} as CSSProperties}>
    <div className="echo-stage-guide" aria-hidden="true"/>
    <StagedEcho identity={identity} placement={placement} visible={placement.visible!==false} opacity={opacity} player={charId==='player'} preview/>
    {charId==='player'?<><span className="echo-reflection-preview-label">Question panel</span><span className="echo-reflection-preview-clock">Date &amp; time</span></>:missing?<div className="echo-stage-placeholder">Character portrait unavailable</div>:<img className="echo-stage-person" src={src} alt="" onError={()=>setMissing(true)}/>}
  </div>
}
export interface EchoSetupContext {
  id:string
  value:EchoState
  roster:readonly Character[]
  first:string
  last:string
  bio:string
  locked:readonly string[]
  onChange:(value:EchoState)=>void
  onContinue:(value:EchoState)=>Promise<void>
}
/** Optional Photos-page contribution; the stage and manager do not depend on that page. */
export function EchoGallerySection({theme}: {theme:ScreenTheme}): JSX.Element {
  return <EchoPanel hidden={false} gallery theme={theme} />
}

export function EchoPanel({hidden,gallery=false,owner,onClose,setup,theme}: {hidden:boolean;gallery?:boolean;owner?:string;onClose?:()=>void;setup?:EchoSetupContext;theme?:ScreenTheme}): JSX.Element | null {
  const storedGame = useGameStore(s => s), enabled = useModOn('echo')
  const setupRef=useRef(setup);setupRef.current=setup
  function readGame():ReturnType<typeof useGameStore.getState>{
    const base=useGameStore.getState(),draft=setupRef.current
    return draft?{...base,playthroughId:draft.id,loads:0,exEcho:draft.value,characters:Object.fromEntries(draft.roster.map(c=>[c.charId,c])),playerFirstName:draft.first,playerLastName:draft.last,bio:draft.bio}:base
  }
  const game=setup?readGame():storedGame
  const rates=useTalentEchoRates()
  const state=game.exEcho
  const [open,setOpen] = useState(!gallery), [selected,setSelected] = useState('player')
  const [pendingSwitch,setPendingSwitch] = useState<string | null>(null)
  const [section,setSection] = useState<'appearance'|'resonance'|'stage'>('appearance')
  const session = useRef({id:game.playthroughId,loads:game.loads})
  const [busy,setBusy] = useState(false), [message,setMessage] = useState(''), [error,setError] = useState('')
  const [downloading,setDownloading] = useState(false)
  const identity = selected === 'player' ? state.player : state.girls[selected]
  const creature = identity ? echoCreatureOf(identity) : {type: '', description: ''}
  const draftScope = JSON.stringify([game.playthroughId, game.loads, selected, open])
  const [opacity,setOpacity] = useEchoDraft(state.opacity, draftScope)
  const [chosenAspect,setChosenAspect] = useEchoDraft<EchoAspect>(identity?.aspect ?? 'horizonbound', draftScope)
  const [editedName,setEditedName] = useEchoDraft(identity?.name ?? '', draftScope)
  const [editedCreatureType,setEditedCreatureType] = useEchoDraft(creature.type, draftScope)
  const [editedDescription,setEditedDescription] = useEchoDraft(creature.description, draftScope)
  const [generatingId,setGeneratingId]=useState<string|null>(null)
  const localArt=useModsStore(s=>optionOn(s.switches,'echo','megaten-art'))
  const glitchEffects=useModsStore(s=>optionOn(s.switches,'reckoning','glitch-effects'))
  const abilityOption=useModsStore(s=>optionOn(s.switches,'echo',ECHO_BREAKTHROUGH_OPTION)),breakthroughOn=useModOn('breakthrough')
  const settings=useSettingsStore(s=>s.settings),imageReady=localArt||(!!settings&&pictureKeySet(settings))
  const externalComfy=!!settings&&comfySourceOf(settings)==='external'
  const autoStarting=useRef(false)
  const dialog = useRef<HTMLDialogElement>(null), live = useRef(false), request = useRef<string | null>(null)
  const batch = useRef(false)
  const cancel = (): void => { batch.current = false; if (request.current) void window.api.echo?.cancel(request.current); request.current = null }
  const close = (): void => { live.current = false; cancel(); setPendingSwitch(null); setOpen(false); onClose?.() }
  useDismissLayer(close, open)
  useEffect(() => { if (!setup && enabled && game.playthroughId) ensureEchoes() },[!!setup,enabled,game.playthroughId,game.loads])
  useEffect(() => {
    if (open && dialog.current) { live.current = true; dialog.current.showModal() }
    return () => { live.current = false; cancel(); dialog.current?.close() }
  },[open,!!game.exEcho.player])
  useEffect(() => {
    const changed=session.current.id!==game.playthroughId||session.current.loads!==game.loads
    session.current={id:game.playthroughId,loads:game.loads}
    if(!enabled||hidden||(!setup&&(changed||game.replaying||game.createdScene))){close();setSelected('player');setError('');setBusy(false)}
  },[game.playthroughId,game.loads,enabled,hidden,game.replaying,game.createdScene])
  useEffect(()=>{if(open)setSection('appearance')},[open])
  const setupAspectEditable=!!setup&&!setup.locked.includes(selected)
  const aspectPending=setupAspectEditable&&chosenAspect!==identity?.aspect
  const defaultStage=selected==='player'?PLAYER_ECHO_STAGE_DEFAULT:ECHO_STAGE_DEFAULT
  const savedStage=resolveEchoStage(identity?.stage,selected==='player')
  const [placement,setPlacement] = useEchoDraft(savedStage, draftScope)
  const stagePending=JSON.stringify(placement)!==JSON.stringify(savedStage)
  const changePlacement=(key:keyof EchoStagePlacement,value:number|boolean):void=>setPlacement(normalizeEchoStage({...placement,[key]:value}))
  const preview = useEchoImage(identity?.art,identity?.source!=='uploaded')
  const ids = Object.keys(game.characters).filter(id=>setup||game.charInfo[id]?.nameKnown)
  const galleryIds = owner ? (owner==='player'||ids.includes(owner)?[owner]:[]) : ['player',...ids]
  const label = (id:string):string => id === 'player' ? `${game.playerFirstName} ${game.playerLastName}`.trim() : setup||game.charInfo[id]?.nameKnown ? fullNameOf(game.characters[id]) : `Unmet student ${ids.indexOf(id)+1}`
  const matches = ids.filter(id => matchingEcho(state,id))
  const competitors = ids.filter(id => echoAffinity(state,id)==='competing')
  const missing = ['player',...ids].filter(id => !(id === 'player' ? state.player : state.girls[id])?.art)
  const safe = !!setup || (manualSaveOffer() === 'open' && !game.sceneEnding)
  const namePending=editedName.trim()!==(identity?.name??'')
  const creaturePending=editedCreatureType.trim()!==creature.type||editedDescription.trim()!==creature.description
  useEffect(()=>{
    if(setup||!open||!live.current||!enabled||busy||!safe||!imageReady||!state.player||state.player.art||state.playerAutoArtAttempted||autoStarting.current)return
    autoStarting.current=true
    void generate(false,true).finally(()=>{autoStarting.current=false})
  },[open,enabled,busy,safe,imageReady,state.player?.art,state.playerAutoArtAttempted])
  async function commit(next:EchoState):Promise<void> {
    const draft=setupRef.current
    if(draft){
      if(!live.current||!modIsOn('echo'))throw Error('Echo setup is no longer open.')
      const value=normalizeEcho(next)
      setupRef.current={...draft,value}
      draft.onChange(value)
      return
    }
    const previous = useGameStore.getState().exEcho
    await writeEcho(next,previous,() => live.current)
  }
  async function apply(next:EchoState):Promise<boolean> {
    setBusy(true);setError('');setMessage('')
    try { await commit(next); if(live.current)setMessage(setup?'Kept for this new game.':'Saved to this playthrough.'); return live.current }
    catch(e) { if(live.current)setError(e instanceof Error ? e.message : 'Could not save Echo.'); return false }
    finally { if(live.current)setBusy(false) }
  }
  async function generateOne(id:string):Promise<void> {
    const api=window.api.echo
    if (!api) throw Error('Echo artwork is not available in this build.')
    const start=readGame(), current=id==='player'?start.exEcho.player:start.exEcho.girls[id]
    if(!current) throw Error('Echo assignment is missing.')
    const token=crypto.randomUUID();request.current=token
    const char=start.characters[id]
    const result=await api.generate({requestId:token,identity:current,name:id==='player'?`${start.playerFirstName} ${start.playerLastName}`:fullNameOf(char),bio:id==='player'?start.bio:char.personality,backstory:id==='player'?undefined:char.backstory})
    if(!live.current || request.current!==token || !modIsOn('echo')) throw Error('Generation cancelled.')
    request.current=null
    if(!result.ok) throw Error(result.error.message)
    const now=readGame()
    if(now.playthroughId!==start.playthroughId || now.loads!==start.loads) throw Error('The playthrough changed.')
    const next=withEchoArtwork(now.exEcho,id,result.data,'generated')
    await commit(next)
  }
  async function generate(all:boolean,automatic=false):Promise<void> {
    setBusy(true);setError('');batch.current=true
    const queue=automatic?['player']:all?missing:[selected]
    try {
      // Persist BEFORE dispatch so closing/reopening or a provider failure cannot trigger repeated paid calls.
      if(automatic)await commit({...readGame().exEcho,playerAutoArtAttempted:true})
      for(let i=0;i<queue.length && batch.current && live.current;i++) {
        setGeneratingId(queue[i])
        setMessage(`Generating ${i+1} / ${queue.length} · ${label(queue[i])}…`)
        await generateOne(queue[i])
      }
      if(live.current)setMessage(batch.current?'Artwork saved.':'Generation stopped.')
    } catch(e) { if(live.current)setError(e instanceof Error?e.message:'Image generation failed.') }
    finally { request.current=null;batch.current=false;if(live.current){setBusy(false);setGeneratingId(null)} }
  }
  async function installModels():Promise<void> {
    if(!window.api.echo?.installLocalModels)return
    const id=crypto.randomUUID();request.current=id
    setBusy(true);setError('');setMessage('Checking and downloading local art models… This may take a while. Stop generation cancels the download.')
    try { const result=await window.api.echo.installLocalModels(id); if(!result.ok)throw Error(result.error.message); if(live.current&&request.current===id)setMessage('Local art models are installed and verified.') }
    catch(e){if(live.current)setError(e instanceof Error?e.message:'Model setup failed.')}
    finally {request.current=null;if(live.current)setBusy(false)}
  }
  async function upload():Promise<void> {
    if(!identity || !window.api.echo)return
    setBusy(true);setError('');setMessage('')
    const start=readGame(), id=selected
    try {
      const result=await window.api.echo.upload()
      if(!live.current || readGame().playthroughId!==start.playthroughId || readGame().loads!==start.loads)return
      if(!result.ok)throw Error(result.error.message)
      if(!result.data)return
      const next=withEchoArtwork(readGame().exEcho,id,result.data,'uploaded')
      await commit(next);if(live.current)setMessage('Your artwork is saved. Transparent PNGs work best behind characters.')
    }catch(e){if(live.current)setError(e instanceof Error?e.message:'Could not upload image.')}
    finally{if(live.current)setBusy(false)}
  }
  async function saveName():Promise<void>{
    try{await apply(renameEcho(readGame().exEcho,selected,editedName))}
    catch(e){setError(e instanceof Error?e.message:'Could not save this name.')}
  }
  async function downloadArt():Promise<void>{
    if(!identity?.art||!window.api.echo||downloading)return
    setDownloading(true);setError('');setMessage('')
    try{
      const result=await window.api.echo.export(identity.art,identity.name,identity.source!=='uploaded')
      if(!live.current)return
      if(!result.ok)throw Error(result.error.message)
      if(result.data)setMessage('Echo image downloaded as a PNG.')
    }catch(e){if(live.current)setError(e instanceof Error?e.message:'Could not download the image.')}
    finally{setDownloading(false)}
  }
  function generateName():void{
    setEditedName(suggestEchoName(readGame().exEcho,selected,crypto.randomUUID(),editedName,editedCreatureType))
    setError('');setMessage('Name suggested. Edit it if you like, then choose Save name.')
  }
  function generateCreature():void{
    setEditedCreatureType(suggestEchoCreature(crypto.randomUUID(),editedCreatureType))
    setError('');setMessage('Creature suggested. Edit it if you like, then choose Save monster details.')
  }
  async function saveCreature():Promise<void>{
    try{await apply(editEchoCreature(readGame().exEcho,selected,editedCreatureType,editedDescription))}
    catch(e){setError(e instanceof Error?e.message:'Could not save monster details.')}
  }
  async function saveStartingAspect():Promise<void>{
    if(!setup)return
    try{await apply(chooseSetupEchoAspect(readGame().exEcho,selected,chosenAspect,setup.roster,setup.bio,setup.locked))}
    catch(e){setError(e instanceof Error?e.message:'Could not choose this aspect.')}
  }
  async function saveAllSettings():Promise<boolean> {
    if (busy || !safe) return false
    try {
      let next = editEchoSettings(readGame().exEcho, selected, {
        ...(namePending ? { name: editedName } : {}),
        ...(creaturePending ? { creature: { type: editedCreatureType, description: editedDescription } } : {}),
        ...(stagePending ? { stage: placement } : {}),
        ...(opacity !== state.opacity ? { opacity } : {})
      })
      if (aspectPending && setup) {
        next = chooseSetupEchoAspect(next, selected, chosenAspect, setup.roster, setup.bio, setup.locked)
      }
      return await apply(next)
    } catch (e) {
      setMessage('')
      setError(e instanceof Error ? e.message : 'Could not save these Echo settings.')
      return false
    }
  }
  function switchOwner(id: string): void {
    setPendingSwitch(null)
    setSelected(id)
    setError('')
    setMessage('')
  }
  function requestOwner(id: string): void {
    if (busy || id === selected) return
    if (pendingEdits) {
      setError('')
      setPendingSwitch(id)
    } else switchOwner(id)
  }
  async function saveAndSwitch(): Promise<void> {
    const destination = pendingSwitch
    if (destination !== null && await saveAllSettings()) switchOwner(destination)
  }
  async function finishSetup():Promise<void>{
    if(!setup||busy)return
    setBusy(true);setError('')
    try{await setup.onContinue(readGame().exEcho)}
    catch(e){if(live.current)setError(e instanceof Error?e.message:'Could not start the semester.')}
    finally{if(live.current)setBusy(false)}
  }
  const pendingEdits=namePending||creaturePending||stagePending||aspectPending||opacity!==state.opacity
  if(hidden || !enabled || !game.playthroughId || !state.player || (!setup&&(game.replaying || game.createdScene)))return null
  const aspect=aspectOf(identity?.aspect ?? state.player.aspect)
  const baseAbility=selected==='player'?echoBreakthroughAbility(identity?.aspect):null
  const ability=baseAbility?{...baseAbility,cost:rates.cost(baseAbility.cost)}:null
  return <>
    {gallery&&<section className="echo-gallery-section" aria-label="Echo gallery"><div className="vu-bb-section">Echoes</div><p>Echoes belonging to you and the students you’ve met. Open one to edit its design or artwork.</p><div className="echo-gallery-grid">{galleryIds.map(id=>{const e=id==='player'?state.player:state.girls[id];return e?<button type="button" className="echo-gallery-tile" key={id} onClick={()=>{setSelected(id);setOpen(true);setError('');setMessage('');setBusy(false)}} aria-label={`Open ${id==='player'?'your Echo':label(id)+' Echo'}`}><div><EchoArt identity={e} status/></div><b>{e.name}</b><span>{id==='player'?'Your Echo':label(id)} · {aspectOf(e.aspect).name}</span><small>{e.art?'View / regenerate':'Generate artwork'}</small></button>:null})}</div></section>}
    {open && identity && <dialog ref={dialog} className="echo-dialog" data-theme={setup?'day':theme} data-setup={!!setup} aria-labelledby="echo-title" onCancel={e=>{e.preventDefault();close()}}
      onClick={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
      <header><div><h1 id="echo-title">Echoes</h1><p>{setup?'Before the semester begins · Keep the suggested Echoes, or make them your own.':'A shape for the part of you that resonates.'}</p></div><button type="button" className="echo-close" onClick={close} aria-label={setup?'Back to class selection':'Close Echoes'}>×</button></header>
      <div className="echo-layout">
        <nav aria-label="Echo owners">
          <button type="button" aria-pressed={selected==='player'} disabled={busy} onClick={()=>requestOwner('player')}><b>Your Echo</b><span>{aspectOf(state.player.aspect).name}</span></button>
          <small>{setup?'THIS SEMESTER’S CAST':'MET THIS SEMESTER'} · {ids.length}</small>
          {ids.map(id=><button type="button" key={id} aria-pressed={selected===id} disabled={busy} onClick={()=>requestOwner(id)}><b>{label(id)} {matchingEcho(state,id)&&<em title={`Matching aspect · ${rates.label('matching')}`}>✦</em>}{echoAffinity(state,id)==='competing'&&<em className="echo-competing" title={`Competing aspect · ${rates.label('competing')}`}>◇</em>}</b><span>{aspectOf(state.girls[id]?.aspect??'horizonbound').name}</span></button>)}
        </nav>
        <div className="echo-workspace">
          <div className="echo-preview">
          <div className="echo-card" style={{'--echo-tint':aspect.color} as CSSProperties}>{section==='stage'?<><EchoStagePreview identity={identity} charId={selected} height={game.characters[selected]?.height??1} placement={placement} opacity={opacity}/><p className="echo-help">Live positioning &amp; motion preview</p></>:<div className="echo-card-art"><EchoArt identity={identity} status/>{generatingId===selected&&<span className="echo-art-status" role="status">Creating Echo artwork…</span>}</div>}<small>{selected==='player'?'YOUR ECHO':label(selected)}</small><h2>{identity.name}</h2></div>
          <label className="echo-provider">Artwork source<select aria-label="Artwork source" value={localArt?'local':'api'} disabled={busy||!safe} onChange={e=>void useModsStore.getState().setOption('echo','megaten-art',e.target.value==='local')}><option value="api">Gemini / image API (default)</option><option value="local" disabled={!window.api.echo?.installLocalModels}>Local · Megaten LoRA (desktop)</option></select></label><div className="echo-actions echo-art-actions"><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||namePending||creaturePending||aspectPending} onClick={()=>void generate(false)}>{identity.art?'Regenerate artwork':'Generate artwork'}</button><button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy||!safe} onClick={()=>void upload()}>Upload your own</button></div>
          <p className="echo-help">{localArt?'Uses the ComfyUI server and checkpoint selected in Settings, with the Megaten Style LoRA installed on that server. No image API charge.':'Uses Gemini or your image API from Settings, then removes the background locally. First use downloads a background-removal model and runtime (about 100 MB) from IMG.LY. Images stay on your device; ComfyUI is not needed. API charges may apply.'} Uploads are free. Names and aspects stay the same. <EchoNotice notice="software" theme={setup?'day':theme}/>.</p>
          {localArt&&window.api.echo?.installLocalModels&&<details className="echo-help"><summary>Set up local artwork</summary><p>{externalComfy?'Your own ComfyUI server is selected. Install Megaten_Style.safetensors in that server’s models/loras folder and select a compatible SDXL checkpoint in Settings.':'For game-managed ComfyUI, use the game’s Setup screen first. This installer downloads missing models: Megaten Style (218 MB) and Nova Anime XL (6.9 GB). Existing matching files are reused. You can instead install the LoRA manually and choose a compatible SDXL checkpoint in Settings.'} Downloads come from the original hosts under their own terms. The creator does not grant image or model sales permission. <a href="https://civitai.com/models/1767059/megaten-style-kazuma-kaneko" target="_blank" rel="noreferrer">Megaten Style by emerjk</a>. <EchoNotice notice="models" theme={setup?'day':theme}/>.</p>{!externalComfy&&<button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy||!safe} onClick={()=>void installModels()}>Install local art models</button>}</details>}
          <button type="button" className="vu-btn vu-btn--quiet echo-action echo-download" disabled={busy||downloading||!identity.art||preview.loading||preview.missing} onClick={()=>void downloadArt()}>{downloading?'Saving image…':'Download image'}</button>
          {(namePending||creaturePending)&&<p className="echo-help">Save your name and monster details before generating artwork.</p>}
          {!identity.art&&selected==='player'&&!imageReady&&<p className="echo-help">{setup?'Add an Image API key in Settings to generate artwork, or upload an image.':'Add an Image API key in Settings for automatic first-time artwork, or upload an image.'}</p>}
          {preview.missing && <p role="alert" className="echo-error">Artwork is missing from this copy. Upload it again or regenerate it.</p>}
          </div>
          <section className="echo-details">
            <small className="echo-kicker">{setup?(setupAspectEditable?'CHOOSE YOUR STARTING ECHO':'RETURNING ECHO · ASPECT CARRIED'):selected==='player'?'YOUR PERSONAL ECHO':identity.assignment==='chosen'?'PLAYER CHOSEN · ASPECT FIXED':'PROFILE ASSIGNED · ASPECT FIXED'}</small>
            <h2>{selected==='player'?'Your Echo':label(selected)}</h2><p className="echo-owner-aspect"><strong>{aspect.name}</strong> — {aspect.meaning}</p>
            <div className="echo-tabs" role="tablist" aria-label="Echo settings">
              {(['appearance','resonance','stage'] as const).map((tab,index,tabs)=><button type="button" key={tab} id={`echo-tab-${tab}`} role="tab" aria-selected={section===tab} aria-controls={`echo-section-${tab}`} tabIndex={section===tab?0:-1} onClick={()=>setSection(tab)} onKeyDown={e=>{
                const next=e.key==='ArrowRight'?(index+1)%tabs.length:e.key==='ArrowLeft'?(index+tabs.length-1)%tabs.length:e.key==='Home'?0:e.key==='End'?tabs.length-1:null
                if(next!==null){e.preventDefault();setSection(tabs[next]);e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()}
              }}>{tab==='appearance'?'Appearance':tab==='resonance'?'Resonance':'Stage'}</button>)}
            </div>
            {section==='appearance'&&<div id="echo-section-appearance" role="tabpanel" aria-labelledby="echo-tab-appearance" tabIndex={0}>
            {setup&&<div className="echo-setup-aspect"><label>Starting aspect<select aria-label="Starting Echo aspect" value={chosenAspect} disabled={busy||!setupAspectEditable} onChange={e=>setChosenAspect(e.target.value as EchoAspect)}>{ECHO_ASPECTS.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><small>{aspectOf(chosenAspect).meaning}. Competes with {aspectOf(aspectOf(chosenAspect).opposite).name}.</small></label>{selected==='player'?<EchoAspectAbility aspect={chosenAspect}/>:<EchoAspectMatchups aspect={chosenAspect}/>}{setupAspectEditable?<><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!aspectPending} onClick={()=>void saveStartingAspect()}>Choose starting aspect</button><p className="echo-help">Suggestions come from {selected==='player'?'your bio':'her personality and backstory'}. Change the starting aspect as often as you like. Your names, creature details and existing images stay; regenerate artwork only if you want it to reflect the new aspect. Your reader’s one later change stays available.</p></>:<p className="echo-help">This aspect comes from the previous semester. Appearance and stage placement are still editable.</p>}</div>}
            <div className="echo-draft-field"><label htmlFor="echo-name-input">Echo name</label><div className="echo-input-roll"><input id="echo-name-input" type="text" maxLength={60} value={editedName} disabled={busy} onChange={e=>setEditedName(e.target.value)}/><EchoDice label="Roll a random Echo name" disabled={busy} onClick={generateName}/></div></div>
            <div className="echo-name-actions"><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||!editedName.trim()||editedName.trim()===identity.name} onClick={()=>void saveName()}>Save name</button></div>
            <p className="echo-help">Roll the dice for a free suggestion, then save your favorite. The next artwork uses the name you save.</p>
            <div className="echo-creature-editor">
              <div className="echo-draft-field"><label htmlFor="echo-creature-input">Monster type</label><div className="echo-input-roll"><input id="echo-creature-input" type="text" maxLength={100} value={editedCreatureType} disabled={busy} onChange={e=>setEditedCreatureType(e.target.value)} placeholder="For example, an armored wolf"/><EchoDice label="Roll a random creature type" disabled={busy} onClick={generateCreature}/></div></div>
              <label>Monster description<textarea aria-label="Monster description" rows={3} maxLength={1200} value={editedDescription} disabled={busy} onChange={e=>setEditedDescription(e.target.value)} placeholder="Build, colors, markings, expression…"/><small>{editedDescription.length} / 1,200 · optional</small></label>
              <button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||!creaturePending||!editedCreatureType.trim()} onClick={()=>void saveCreature()}>Save monster details</button>
              <p className="echo-help">Try a creature with the dice, or write your own. Save your details to guide the next image. Your current artwork and relationship aspect stay the same.</p>
            </div>
            </div>}
            {section==='resonance'&&<div id="echo-section-resonance" role="tabpanel" aria-labelledby="echo-tab-resonance" tabIndex={0}>
            {selected==='player'&&<section className="echo-bond" aria-label="Your Breakthrough ability"><strong>{ability?.name||'Standard Breakthrough'}</strong><p>{ability?.summary||'Normal Breakthrough remains available.'}</p>{ability&&<p><b>{ability.strength} influence · {ability.cost} spirit.</b> {ability.balance}</p>}<p>{ability?`In a scene, spend ${ability.cost} spirit with a character for one exchange. Unspent spirit stays in the bar. Normal Breakthrough costs 100.`:'Each player Echo aspect has its own Breakthrough ability.'}</p>{ability&&(!abilityOption||!breakthroughOn)&&<p>Enable Breakthrough and Echo’s “Echo Breakthrough abilities” option in Mods to use it.</p>}</section>}
            <div className="echo-bond"><strong>{selected==='player'?`${matches.length} matching · ${competitors.length} competing`:matchingEcho(state,selected)?`Resonance · ${rates.label('matching')}`:echoAffinity(state,selected)==='competing'?`Competing · ${rates.label('competing')}`:`Neutral · ${rates.label('neutral')}`}</strong><p>New positive memories: matching <b>{rates.label('matching')}</b>, competing <b>{rates.label('competing')}</b>, other pairings <b>{rates.label('neutral')}</b>. Negative memories are unchanged. Effects settle at the end of the time slot.</p><p><b>{aspect.name}</b> competes with <b>{aspectOf(aspect.opposite).name}</b>.</p></div>
            <details className="echo-reason" key={selected}><summary>Why this type? <span className="echo-spoiler-badge">Spoilers</span></summary><p>{identity.reason}</p>{identity.reasonExamples.map((example,i)=><div className="echo-reason-example" key={i}><b>{example.source}{!example.supportsType?' · context':''}</b><blockquote>{example.quote}</blockquote><p>{example.connection}</p></div>)}<small>These passages come from the saved profile. They offer one way to read this Echo’s connection to its owner.</small></details>
            <p className="echo-help">Opening “Why this type?” reveals details from the owner’s personal history.</p>
            {setup?<p className="echo-lock">{setupAspectEditable?'Choose a starting aspect in Appearance. You can change it freely until you begin the semester.':'This aspect carries over from the previous semester.'}</p>:selected==='player' ? state.playerChangeUsed ? <p className="echo-lock">Relationship aspect locked · Your one change has been used. You can still edit the monster design and replace the artwork.</p> : <div className="echo-change"><label>Choose your one aspect change<select aria-label="Player Echo aspect" disabled={busy||!safe} value={chosenAspect} onChange={e=>setChosenAspect(e.target.value as EchoAspect)}>{ECHO_ASPECTS.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select><small>{aspectOf(chosenAspect).meaning}. Competes with {aspectOf(aspectOf(chosenAspect).opposite).name}.</small></label><EchoAspectAbility aspect={chosenAspect}/><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||chosenAspect===identity.aspect} onClick={()=>void apply(changePlayerEcho(state,chosenAspect,game.bio))}>Use my one aspect change</button><p className="echo-help">This permanently locks your relationship aspect for this playthrough and returning semesters. It creates a new Echo name and clears its current artwork. Your monster details and earned progress stay as they were.</p></div> : <p className="echo-lock">Her starting relationship aspect is fixed for this playthrough and returning semesters. You can edit her monster design and artwork freely.</p>}
            </div>}
            {section==='stage'&&<div id="echo-section-stage" role="tabpanel" aria-labelledby="echo-tab-stage" tabIndex={0}>
            <section className="echo-placement" aria-label="Echo placement and motion">
              <h3>{selected==='player'?'Your Echo during the questions':'Her Echo on stage'}</h3><p>Move and resize only {label(selected)}’s Echo. The preview follows your adjustments.</p>
              {selected!=='player'&&<><label><input type="checkbox" aria-label="Show her Echo on stage" checked={placement.visible!==false} disabled={busy} onChange={e=>changePlacement('visible',e.target.checked)}/> Show her Echo on stage</label><p className="echo-help">Hides only her Echo in scenes and the Unspoken Void, including the questions. Her artwork, aspect and abilities stay available.</p></>}
              {([
                {key:'x',label:'Horizontal (X)',min:-ECHO_STAGE_LIMITS.offset,max:ECHO_STAGE_LIMITS.offset,step:1,value:placement.x,unit:'px'},
                {key:'y',label:'Vertical (Y)',min:-ECHO_STAGE_LIMITS.offset,max:ECHO_STAGE_LIMITS.offset,step:1,value:placement.y,unit:'px'},
                {key:'scale',label:'Size',min:ECHO_STAGE_LIMITS.minScale*100,max:ECHO_STAGE_LIMITS.maxScale*100,step:1,value:Math.round(placement.scale*100),unit:'%'}
              ] as const).map(control=><EchoPlacementControl key={`${selected}-${control.key}`} id={`echo-stage-${control.key}`} label={control.label} min={control.min} max={control.max} value={control.value} unit={control.unit} disabled={busy} onChange={value=>changePlacement(control.key,value/(control.key==='scale'?100:1))}/>)}
              <p className="echo-help">X: left − / right +. Y: up − / down +. Offsets use the game’s stage coordinates. Size grows from the bottom center. {selected==='player'?'Your Echo fills the left background at 18% visibility. Adjust it freely, including over the date and time.':'Her Echo follows her position when the cast moves.'}</p>
              <label><input type="checkbox" aria-label="Floating wobble" checked={placement.floating??selected==='player'} disabled={busy} onChange={e=>changePlacement('floating',e.target.checked)}/> Floating wobble</label>
              <EchoPlacementControl id="echo-float-speed" label="Float cycle" min={3} max={20} value={placement.floatSeconds??ECHO_FLOAT_SECONDS_DEFAULT} unit="s" disabled={busy||!(placement.floating??selected==='player')} onChange={value=>changePlacement('floatSeconds',value)}/>
              <p className="echo-help">The default is a gentle 14-second drift. Shorter cycles move faster; longer cycles drift slowly. Reduced-motion settings disable the animation.</p>
              <EchoPlacementControl id="echo-owner-opacity" label="This Echo visibility" min={5} max={80} value={Math.round(echoStageOpacity(placement,opacity,selected==='player')*100)} unit="%" disabled={busy} onChange={value=>changePlacement('opacity',value/100)}/>
              <button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy||placement.opacity===undefined} onClick={()=>{const {opacity:_opacity,...rest}=placement;setPlacement(rest)}}>{selected==='player'?'Use faint default · 18%':'Use shared visibility'}</button>
              <div className="echo-actions"><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||!stagePending} onClick={()=>void apply(editEchoStage(state,selected,placement))}>Save placement</button><button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy||(placement.x===defaultStage.x&&placement.y===defaultStage.y&&placement.scale===defaultStage.scale)} onClick={()=>setPlacement({...placement,...defaultStage})}>Reset position &amp; size</button></div>
              <p className="echo-help">Save to apply. Save all settings also keeps your name, creature details and placement together. Switching Echoes asks what to do with unsaved edits; closing this window discards them. Artwork and gallery images stay unchanged.</p>
              {selected==='player'&&<div className="echo-reckoning-effects"><label><input type="checkbox" aria-label="Inner-world glitch effects" checked={glitchEffects} disabled={busy} onChange={e=>void useModsStore.getState().setOption('reckoning','glitch-effects',e.target.checked)}/> Inner-world glitch effects</label><p className="echo-help">Brief full-screen interference and text distortions during private whispers and reflection questions. Off keeps whispers as calm translucent text. Saves automatically. Reduced-motion settings disable the effects.</p></div>}
            </section>
            <h3>Shared visibility for girls’ Echoes</h3>
            <p>Girls without their own visibility setting use this value. Your Echo uses its own faint default.</p>
            <label>Echo visibility on stage · {Math.round(opacity*100)}%<input aria-label="Echo visibility on stage" type="range" min="5" max="80" value={Math.round(opacity*100)} disabled={busy} onChange={e=>setOpacity(Number(e.target.value)/100)}/></label>
            <p className="echo-help">Lower values make Echoes fainter; higher values make them more solid. Individual visibility overrides are kept. Gallery images keep their full visibility.</p>
            <div className="echo-actions"><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||opacity===state.opacity} onClick={()=>void apply({...state,opacity})}>Apply visibility</button><button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy||!safe} aria-pressed={state.visible} onClick={()=>void apply({...state,visible:!state.visible})}>{state.visible?'Hide on stage':'Show on stage'}</button></div>
            <p className="echo-help">Your Echo appears while breaking through the silence. Girls’ Echoes appear behind standing portraits, outside replays and created scenes. Hide on stage hides both; each girl also has her own stage switch above.</p>
            </div>}
            {!safe && <p className="echo-help">Wait for narration and messages to finish before saving or generating artwork.</p>}
          </section>
        </div>
      </div>
      <footer><div aria-live="polite">{error?<span role="alert" className="echo-error">{error}</span>:pendingEdits?'Unsaved changes for this Echo. Choose Save all settings to keep them together.':message|| (setup?'Artwork is optional. Changes are saved when you begin the semester.':'')}</div><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||namePending||creaturePending||aspectPending||!missing.length} onClick={()=>void generate(true)}>Generate all missing · {missing.length} {missing.length===1?'image':'images'}</button><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action" disabled={busy||!safe||!pendingEdits||!editedName.trim()||!editedCreatureType.trim()} onClick={()=>void saveAllSettings()}>Save all settings</button>{busy&&<button type="button" className="vu-btn vu-btn--quiet echo-action" onClick={cancel}>Stop generation</button>}{setup&&<><button type="button" className="vu-btn vu-btn--quiet echo-action" disabled={busy} onClick={close}>Back</button><button type="button" className="vu-btn vu-btn--primary vu-paper echo-action echo-begin" disabled={busy||pendingEdits} onClick={()=>void finishSetup()}>Begin semester</button></>}</footer>
    </dialog>}
    {open && pendingSwitch !== null && <EchoSwitchDialog
      firstName={selected === 'player' ? undefined : game.characters[selected]?.firstName}
      ownerName={selected === 'player' ? undefined : label(selected)} theme={setup ? 'day' : theme}
      busy={busy} canSave={safe && !!editedName.trim() && !!editedCreatureType.trim()} error={error}
      onStay={() => setPendingSwitch(null)} onDiscard={() => switchOwner(pendingSwitch)}
      onSave={() => void saveAndSwitch()}/>}
  </>
}
