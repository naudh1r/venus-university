import { describe, expect, it } from 'vitest'
import { clearEchoMatte } from '../src/main/services/echoMatte'

const width=11,height=11
function fixture(background:number):Uint8Array {
  const pixels=new Uint8Array(width*height*4)
  for(let i=0;i<pixels.length;i+=4)pixels.set([background,background,background,255],i)
  for(let y=3;y<=7;y++)for(let x=3;x<=7;x++)pixels.set([60,90,170,255],(y*width+x)*4)
  return pixels
}
const at=(pixels:Uint8Array,x:number,y:number):number[]=>[...pixels.slice((y*width+x)*4,(y*width+x)*4+4)]
describe('Echo flat-background extraction',()=>{
  it('clears white outer background while retaining an enclosed white highlight and dark outlines',()=>{
    const image=fixture(255)
    image.set([255,255,255,255],(5*width+5)*4)
    image.set([2,2,2,255],(3*width+5)*4)
    const original=new Uint8Array(image)
    const result=clearEchoMatte(image,width,height)
    expect(result.background).toBe('white')
    expect(at(result.bitmap,0,0)).toEqual([0,0,0,0])
    expect(at(result.bitmap,5,5)).toEqual([255,255,255,255])
    expect(at(result.bitmap,5,3)).toEqual([2,2,2,255])
    expect(image).toEqual(original)
  })
  it('clears black borders without erasing dark details inside the creature',()=>{
    const image=fixture(0)
    image.set([4,7,12,255],(5*width+5)*4)
    const result=clearEchoMatte(image,width,height)
    expect(result.background).toBe('black')
    expect(at(result.bitmap,0,0)).toEqual([0,0,0,0])
    expect(at(result.bitmap,5,5)).toEqual([4,7,12,255])
  })
  it('preserves existing alpha, including transparent border art, exactly',()=>{
    const image=fixture(0)
    for(let i=0;i<image.length;i+=4)if(image[i+2]===0)image[i+3]=0
    image.set([10,20,35,60],(3*width+5)*4)
    const result=clearEchoMatte(image,width,height)
    expect(result.background).toBeNull()
    expect(result.bitmap).toBe(image)
  })
  it('does not color-key a nonuniform or colored scene',()=>{
    const image=fixture(100)
    expect(clearEchoMatte(image,width,height).bitmap).toBe(image)
    for(let i=0;i<image.length;i+=4)image.set([20,100,200,255],i)
    expect(clearEchoMatte(image,width,height).background).toBeNull()
  })
  it('accepts a slightly off-white border',()=>{
    const result=clearEchoMatte(fixture(244),width,height)
    expect(result.background).toBe('white')
    expect(at(result.bitmap,0,0)[3]).toBe(0)
  })
  it('feathers only the outer boundary with valid premultiplied colors',()=>{
    const image=fixture(255)
    image.set([221,227,234,255],(3*width+5)*4)
    image.set([221,227,234,255],(5*width+5)*4)
    const result=clearEchoMatte(image,width,height)
    const edge=at(result.bitmap,5,3)
    expect(edge[3]).toBeGreaterThan(0)
    expect(edge[3]).toBeLessThan(255)
    for(const c of edge.slice(0,3))expect(c).toBeLessThanOrEqual(edge[3])
    expect(at(result.bitmap,5,5)).toEqual([221,227,234,255])
  })
  it('does not progressively erase artwork when read repeatedly',()=>{
    const first=clearEchoMatte(fixture(255),width,height)
    expect(clearEchoMatte(first.bitmap,width,height).bitmap).toBe(first.bitmap)
  })
  it('rejects malformed or unbounded bitmap dimensions',()=>{
    expect(()=>clearEchoMatte(new Uint8Array(4),2,2)).toThrow()
    expect(()=>clearEchoMatte(new Uint8Array(4),1.5,1)).toThrow()
    expect(()=>clearEchoMatte(new Uint8Array(0),1e8,1e8)).toThrow()
  })
})
