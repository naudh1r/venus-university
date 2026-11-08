import {useState,type JSX} from 'react'
import {createPortal} from 'react-dom'
import {motion} from 'motion/react'
import {openPanel,useModalShell,TitleTab,veilIn,panelUnderTab,showError,type ScreenSlotProps,type GameModalProps} from '@vx/modkit/renderer'
import {STUDY_MOD} from '../../shared/studyRoom'
import {studyLanding,useStudyLanding,useStudyContacts} from './host'
import {eligible} from './session'
import {startNativeStudy} from './nativeHost'
import '../sceneNotes/style.css'
const Icon=()=> <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 5v15M3 4c4-1 7 0 9 2 2-2 5-3 9-2v14c-4-1-7 0-9 2-2-2-5-3-9-2Z"/></svg>
export function StudyRail({Tool,visible}:ScreenSlotProps['landingTool']):JSX.Element{
 const allowed=useStudyLanding()
 return visible&&allowed?<Tool label="Study together" onClick={()=>{if(studyLanding())openPanel(STUDY_MOD)}}><Icon/></Tool>:<></>
}
export function StudyRoom({theme,onClose}:GameModalProps):JSX.Element|null{
 const contacts=useStudyContacts()
 const allowed=useStudyLanding()
 const [chosen,setChosen]=useState(''),[topic,setTopic]=useState(''),[busy,setBusy]=useState(false)
 const shell=useModalShell(onClose)
 function begin(){if(!topic.trim()||!studyLanding()||eligible(chosen))return;setBusy(true);onClose();void startNativeStudy(chosen,topic.trim()).catch(e=>showError({code:'STUDY_START',message:e.message}))}
 if(!shell.host)return null
 return createPortal(<motion.div className="vu-veil" data-theme={theme} variants={veilIn} initial="hidden" animate="shown" exit="gone" {...shell.overlayProps}><motion.section className="vu-study-room vu-paper" role="dialog" aria-modal="true" aria-label="Study together" variants={panelUnderTab} onKeyDown={e=>e.stopPropagation()}>
 <TitleTab>Study together</TitleTab><button className="study-close" aria-label="Close Study together" onClick={onClose}>×</button>
 <div className="study-work">
 <><label>Who’s free?<select aria-label="Study partner" value={chosen} onChange={e=>setChosen(e.target.value)} disabled={busy}><option value="">Choose a friend</option>{contacts.map(({id,name,reason})=><option key={id} value={id} disabled={Boolean(reason)}>{name}{reason?' — '+reason:''}</option>)}</select></label><label>What would you like to study?<textarea aria-label="Study topic" value={topic} maxLength={2000} rows={3} onChange={e=>setTopic(e.target.value)} placeholder="A concept, a skill, a chapter, a project…"/></label></>
 <div className="study-actions"><button disabled={busy||!allowed||!chosen||!topic.trim()||Boolean(eligible(chosen))} onClick={begin}>Invite her to study</button></div>
 </div></motion.section></motion.div>,shell.host)
}
