import type { WhisperRect } from '@shared/whisperLayout'

// Normalized horizontal bands follow the actual picture, including custom body shapes.
const silhouettes=new Map<string,Promise<WhisperRect[]|null>>()
export function whisperSilhouette(image:HTMLImageElement):Promise<WhisperRect[]|null> {
 const url=image.currentSrc||image.src
 const cached=silhouettes.get(url)
 if(cached)return cached
 const pending=(async()=>{
  let bitmap:ImageBitmap|undefined
  try{
   const parsed=new URL(url)
   let source:CanvasImageSource=image
   if(parsed.protocol==='charimg:'){
    const result=await window.api.chars.readImage(parsed.hostname,decodeURIComponent(parsed.pathname).replace(/^\//,''))
    if(!result.ok||!result.data)return null
    bitmap=await createImageBitmap(new Blob([result.data]));source=bitmap
   }else {
    if(!image.complete)await image.decode()
    if(!image.naturalWidth)return null
   }
   const width=128,height=Math.max(1,Math.round(width*(bitmap?.height??image.naturalHeight)/(bitmap?.width??image.naturalWidth)))
   const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height
   const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)return null
   context.drawImage(source,0,0,width,height)
   const pixels=context.getImageData(0,0,width,height).data,bands:WhisperRect[]=[]
   const step=Math.max(1,Math.ceil(height/32))
   for(let top=0;top<height;top+=step){
    const bottom=Math.min(height,top+step);let left=width,right=-1
    for(let y=top;y<bottom;y++)for(let x=0;x<width;x++)if(pixels[(y*width+x)*4+3]>=12){left=Math.min(left,x);right=Math.max(right,x)}
    if(right>=left)bands.push({x:Math.max(0,left-1)/width,y:Math.max(0,top-1)/height,width:(Math.min(width,right+2)-Math.max(0,left-1))/width,height:(Math.min(height,bottom+1)-Math.max(0,top-1))/height})
   }
   return bands.length?bands:null
  }catch{return null}finally{bitmap?.close()}
 })()
 if(silhouettes.size>=64)silhouettes.delete(silhouettes.keys().next().value!)
 silhouettes.set(url,pending)
 return pending
}
