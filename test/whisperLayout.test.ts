import {expect,it} from 'vitest'
import {rectsOverlap,whisperRegions,type WhisperRect} from '@shared/whisperLayout'

const area={x:20,y:20,width:1880,height:690}
const panel={x:1530,y:0,width:390,height:210}
it('keeps every candidate outside the girl and top-right controls, with space above and beside her',()=>{
 const girl={x:635,y:165,width:670,height:920}
 const regions=whisperRegions(area,[girl,panel])
 expect(regions.length).toBeGreaterThan(2)
 expect(regions.some(r=>r.y+r.height<=girl.y)).toBe(true)
 expect(regions.some(r=>r.x+r.width<=girl.x&&r.height>400)).toBe(true)
 expect(regions.some(r=>r.x>=girl.x+girl.width&&r.y>=panel.y+panel.height)).toBe(true)
 for(const r of regions){expect(rectsOverlap(r,girl)||rectsOverlap(r,panel)).toBe(false);expect(r.y+r.height).toBeLessThanOrEqual(710)}
})
it('adapts to different character widths, heights and stage sizes without assuming a center slot',()=>{
 for(const width of [1440,1920])for(const scale of [.65,1,1.3])for(const x of [180,650,1100]){
  const a={...area,width:width-40},girl={x,y:1080-900*scale,width:450*scale,height:1400*scale}
  for(const r of whisperRegions(a,[girl,panel])){
   expect(rectsOverlap(r,girl)).toBe(false);expect(rectsOverlap(r,panel)).toBe(false)
   expect(r.x).toBeGreaterThanOrEqual(a.x);expect(r.x+r.width).toBeLessThanOrEqual(a.x+a.width)
  }
 }
})
it('handles tapered silhouettes and multiple girls; a completely crowded background offers no placement',()=>{
 const bands:WhisperRect[]=Array.from({length:20},(_,i)=>({x:760-i*5,y:100+i*35,width:300+i*10,height:36}))
 const other={x:200,y:160,width:400,height:1000}
 const regions=whisperRegions(area,[...bands,other,panel])
 expect(regions.length).toBeGreaterThan(0)
 for(const r of regions)for(const b of [...bands,other,panel])expect(rectsOverlap(r,b)).toBe(false)
 expect(whisperRegions(area,[{x:0,y:0,width:1920,height:1080}])).toEqual([])
})
