import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX } from 'react'
import { rectsOverlap,whisperRegions,type WhisperRect } from '@shared/whisperLayout'
import { whisperSilhouette } from '../art/whisperSilhouette'

export interface Whisper {id:number;words:string;x:number;y:number;duration:number}
const gap=20
export function UnspokenWhisper({whisper,glitch}:{whisper:Whisper;glitch:boolean}):JSX.Element {
 const root=useRef<HTMLElement>(null),words=useRef<HTMLParagraphElement>(null)
 const [placed,setPlaced]=useState(false)
 useLayoutEffect(()=>{
  const layer=root.current,p=words.current,stage=layer?.closest<HTMLElement>('.vu-dungeon,.vu-stage')
  if(!layer||!p||!stage)return
  let disposed=false,current:WhisperRect|undefined
  const masks=new Map<HTMLImageElement,WhisperRect[]|null>(),loading=new Map<HTMLImageElement,string>()
  function layout():void {
   if(disposed)return
   const origin=layer!.getBoundingClientRect(),width=layer!.clientWidth,height=layer!.clientHeight
   const toLocal=(r:DOMRect):WhisperRect=>({x:r.left-origin.left,y:r.top-origin.top,width:r.width,height:r.height})
   const pad=(r:WhisperRect):WhisperRect=>({x:r.x-gap,y:r.y-gap,width:r.width+gap*2,height:r.height+gap*2})
   const obstacles:WhisperRect[]=[]
   let bottom=height*.68
   for(const e of stage!.querySelectorAll<HTMLElement>('.vu-box-face,.vu-scene-stamp,.vu-scene-rail,.vu-turn,.vu-breakthrough,.vu-dungeon>header,.vu-dungeon-dialogue')){
    const r=toLocal(e.getBoundingClientRect());if(!r.width||!r.height)continue
    obstacles.push(pad(r))
    if(e.matches('.vu-box-face,.vu-dungeon-dialogue'))bottom=Math.min(bottom,r.y-gap)
   }
   for(const image of stage!.querySelectorAll<HTMLImageElement>('.vu-stage-portrait,.vu-stage-cg,.vu-dungeon-character')){
    const url=image.currentSrc||image.src,r=toLocal(image.getBoundingClientRect())
    if(!r.width||!r.height)continue
    if(loading.get(image)!==url){
     loading.set(image,url);masks.delete(image)
     void whisperSilhouette(image).then(mask=>{if(!disposed&&loading.get(image)===url){masks.set(image,mask);layout()}})
    }
    const bands=masks.get(image),flipped=image.classList.contains('vu-stage-portrait--flipped')
    if(bands)for(const b of bands)obstacles.push(pad({x:r.x+(flipped?1-b.x-b.width:b.x)*r.width,y:r.y+b.y*r.height,width:b.width*r.width,height:b.height*r.height}))
    else obstacles.push(pad(r)) // A loading/unreadable image keeps its entire box protected.
   }
   const area={x:gap,y:gap,width:Math.max(0,width-2*gap),height:Math.max(0,bottom-gap)}
   if(current)current.height=p!.getBoundingClientRect().height
   if(current&&current.x>=area.x&&current.y>=area.y&&current.x+current.width<=area.x+area.width&&current.y+current.height<=bottom&&!obstacles.some(o=>rectsOverlap(o,current!)))return
   const regions=whisperRegions(area,obstacles),start=Math.floor(whisper.x*regions.length)
   for(let n=0;n<regions.length;n++){
    const region=regions[(n+start)%regions.length],w=Math.min(640,region.width)
    p!.style.width=`${w}px`
    const h=p!.getBoundingClientRect().height
    if(h>region.height)continue
    current={x:region.x+(region.width-w)*whisper.x,y:region.y+(region.height-h)*whisper.y,width:w,height:h}
    p!.style.left=`${current.x}px`;p!.style.top=`${current.y}px`;setPlaced(true)
    return
   }
   current=undefined;setPlaced(false)
  }
  layout()
  const resize=new ResizeObserver(layout);resize.observe(stage)
  const interval=setInterval(layout,180) // Covers breathing, roster movement and expanded UI.
  void document.fonts.ready.then(()=>{if(!disposed){current=undefined;layout()}})
  return()=>{disposed=true;resize.disconnect();clearInterval(interval)}
 },[whisper])

 useEffect(()=>{
  const stage=root.current?.closest<HTMLElement>('.vu-dungeon,.vu-stage'),motion=matchMedia('(prefers-reduced-motion: reduce)')
  if(!stage||!glitch||!placed)return
  const stop=():void=>{delete stage.dataset.unspokenGlitch}
  if(!motion.matches)stage.dataset.unspokenGlitch='true'
  const timer=setTimeout(stop,1000)
  motion.addEventListener('change',stop)
  return()=>{clearTimeout(timer);motion.removeEventListener('change',stop);stop()}
 },[glitch,placed])

 return <aside ref={root} className="vu-unspoken-voice" data-glitch={glitch||undefined} data-placed={placed||undefined} style={{'--voice-duration':`${whisper.duration}ms`} as CSSProperties} role="status" aria-live="polite" aria-atomic="true" aria-label="A private echo">
  <div className="vu-unspoken-field"><p ref={words} className="vu-unspoken-words" data-long={whisper.words.length>180||undefined}>
   <span>{whisper.words}</span><span className="vu-unspoken-double" aria-hidden="true">{whisper.words}</span><span className="vu-unspoken-double" aria-hidden="true">{whisper.words}</span>
  </p></div>
 </aside>
}
