export interface WhisperRect {x:number;y:number;width:number;height:number}
export function rectsOverlap(a:WhisperRect,b:WhisperRect):boolean {
 return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y
}
const contains=(a:WhisperRect,b:WhisperRect):boolean=>a.x<=b.x&&a.y<=b.y&&a.x+a.width>=b.x+b.width&&a.y+a.height>=b.y+b.height

/** Maximal empty rectangles; overlapping candidates are fine, overlapping obstacles are not. */
export function whisperRegions(area:WhisperRect,obstacles:readonly WhisperRect[]):WhisperRect[] {
 let regions=[area]
 for(const obstacle of obstacles){
  const next:WhisperRect[]=[]
  for(const r of regions){
   if(!rectsOverlap(r,obstacle)){next.push(r);continue}
   const right=r.x+r.width,bottom=r.y+r.height
   if(obstacle.x>r.x)next.push({...r,width:obstacle.x-r.x})
   if(obstacle.x+obstacle.width<right)next.push({...r,x:obstacle.x+obstacle.width,width:right-obstacle.x-obstacle.width})
   if(obstacle.y>r.y)next.push({...r,height:obstacle.y-r.y})
   if(obstacle.y+obstacle.height<bottom)next.push({...r,y:obstacle.y+obstacle.height,height:bottom-obstacle.y-obstacle.height})
  }
  const unique=next.filter(r=>r.width>=220&&r.height>=48)
  regions=unique.filter((r,i)=>!unique.some((other,j)=>i!==j&&contains(other,r)&&(!contains(r,other)||j<i)))
 }
 return regions.sort((a,b)=>b.width*b.height-a.width*a.height)
}
