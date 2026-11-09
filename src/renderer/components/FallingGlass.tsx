import type { CSSProperties, JSX } from 'react'
import '../vu_styles/FallingGlass.css'

// One continuous pane, split into irregular adjoining triangles. No detached confetti.
const cols=8,rows=8
const point=(x:number,y:number):[number,number]=>[
 x*100/cols+(x>0&&x<cols?Math.sin(x*7+y*13)*20/cols:0),
 y*100/rows+(y>0&&y<rows?Math.cos(x*11+y*5)*20/rows:0)
]
export const GLASS_SHARDS=Array.from({length:cols*rows},(_,i)=>{
 const x=i%cols,y=Math.floor(i/cols),a=point(x,y),b=point(x+1,y),c=point(x+1,y+1),d=point(x,y+1)
 return (i%2?[[a,b,d],[b,c,d]]:[[a,b,c],[a,c,d]]).map((vertices,j)=>{
  const cx=vertices.reduce((sum,p)=>sum+p[0],0)/3,cy=vertices.reduce((sum,p)=>sum+p[1],0)/3,n=i*2+j
  return {points:vertices.map(p=>p.join(',')).join(' '),clip:`polygon(${vertices.map(p=>`${p[0]}% ${p[1]}%`).join(',')})`,
   style:{'--glass-drift':`${(cx-50)*1.6}px`,'--glass-turn':`${Math.sin(n*3.7)*36}deg`,'--glass-delay':`${(100-cy)*.0014+(n%3)*.018}s`,transformOrigin:`${cx}% ${cy}%`} as CSSProperties}
 })
}).flat()

export function FallingGlass():JSX.Element {
 return <svg className="vu-falling-glass" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
  {GLASS_SHARDS.map((shard,i)=><polygon key={i} points={shard.points} style={shard.style}/>)}
 </svg>
}
