import {createElement,lazy,Suspense} from 'react'
import {registerHooks,type ScreenSlotProps,type GameModalProps} from '@vx/modkit/renderer'
import { registerPreviousDocument } from '../sceneNotes/host'
import {studyScene,studyHooks} from '../studyRoom/nativeStudy'
registerPreviousDocument(() => studyScene.read()?.document)
const view=()=>import('../studyRoom/StudyRoom')
const Rail=lazy(()=>view().then(m=>({default:m.StudyRail})))
const Panel=lazy(()=>view().then(m=>({default:m.StudyRoom})))
registerHooks('study-room',{...studyHooks,
 landingTool:(p:ScreenSlotProps['landingTool'])=>createElement(Suspense,{fallback:null},createElement(Rail,p)),
 gameModals:{'study-room':(p:GameModalProps)=>createElement(Suspense,{fallback:null},createElement(Panel,p))}
})
