import {createElement,lazy,Suspense} from 'react'
import {registerHooks,type SceneSeatProps} from '@vx/modkit/renderer'
const Seat=lazy(()=>import('../ScreenCompanionEntry').then(m=>({default:m.LaptopSeat})))
registerHooks('screen-companion',{scenePlay:{Seat:(p:SceneSeatProps)=>createElement(Suspense,{fallback:null},createElement(Seat,p)),Panel:()=>null}})
