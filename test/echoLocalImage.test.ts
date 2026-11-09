import { beforeEach, describe, expect, it, vi } from 'vitest'
import workflow from '../assets/workflows/echoMegaten.json'
const mocks=vi.hoisted(()=>({stat:vi.fn(),run:vi.fn(),target:vi.fn()}))
vi.mock('fs/promises',()=>({stat:mocks.stat}))
vi.mock('../src/main/paths',()=>({getComfyModelFilePath:(folder:string,file:string)=>`${folder}/${file}`,getComfyPythonPath:()=> 'python.exe',getComfyUiPath:()=> 'comfy',getTempPath:()=> 'temporary'}))
vi.mock('../src/main/services/comfyService',()=>({resolveTarget:mocks.target}))
vi.mock('@vx/modkit/main',()=>({renderComfyImage:mocks.run}))
import { generateLocalEcho } from '../src/main/services/echoLocalImage'
const managed={source:'managed',baseUrl:'http://127.0.0.1:8188',picks:undefined,loraWeight:1}
beforeEach(()=>{vi.resetAllMocks();mocks.target.mockResolvedValue(managed);mocks.stat.mockResolvedValue({});mocks.run.mockResolvedValue(Buffer.from('image'))})
describe('Echo-only local artwork',()=>{
  it('returns raw artwork for the shared portable remover without a Python cutout node',()=>{
    expect(workflow['9'].inputs.images).toEqual(['8',0])
    expect(workflow['9'].inputs.filename_prefix).toBe('echo_sources/raw')
    expect(workflow['5'].inputs.text).toContain('silhouette')
    expect(workflow['5'].inputs.text).not.toContain('white background')
  })
  it('uses its own LoRA, clip skip and model without the portrait style LoRA',()=>{
    expect(workflow['2'].inputs.lora_name).toBe('Megaten_Style.safetensors')
    expect(workflow['2'].inputs.strength_model).toBe(.7)
    expect(workflow['3'].inputs.stop_at_clip_layer).toBe(-2)
    expect(JSON.stringify(workflow)).not.toContain('usnrStyle')
  })
  it('passes saved design and trigger to the isolated graph through the kit renderer',async()=>{
    const signal=new AbortController().signal
    expect(await generateLocalEcho('Frostfang, armored wolf',signal)).toEqual(Buffer.from('image'))
    expect(mocks.run).toHaveBeenCalledWith('echo',expect.objectContaining({workflow,prompts:expect.objectContaining({positive:expect.stringContaining('Frostfang, armored wolf')})}),{signal})
    expect(mocks.run.mock.calls[0][1].prompts.positive).toContain('kazuma_kaneko_(style)')
    expect(mocks.run.mock.calls[0][1].workflow).toEqual(workflow)
  })
  it('refuses missing local assets without quietly making a paid request',async()=>{
    mocks.stat.mockRejectedValue(Error('missing'))
    await expect(generateLocalEcho('wolf',new AbortController().signal)).rejects.toThrow('Install local art models')
    expect(mocks.run).not.toHaveBeenCalled()
  })
  it('uses the selected external server without requiring an unrelated managed install',async()=>{
    const target={source:'external',baseUrl:'http://localhost:8189',picks:{checkpoint:'custom.safetensors'},loraWeight:1}
    mocks.target.mockResolvedValue(target)
    mocks.stat.mockRejectedValue(Error('No managed installation'))
    const signal=new AbortController().signal
    await expect(generateLocalEcho('wolf',signal)).resolves.toEqual(Buffer.from('image'))
    expect(mocks.stat).not.toHaveBeenCalled()
    expect(mocks.run).toHaveBeenCalledWith('echo',expect.anything(),{signal})
    expect(mocks.target).toHaveBeenCalledOnce()
  })
  it('allows a managed custom checkpoint without requiring the unused shipped checkpoint',async()=>{
    mocks.target.mockResolvedValue({...managed,picks:{checkpoint:'custom.safetensors'}})
    mocks.stat.mockImplementation(async path=>{if(String(path).includes('checkpoints'))throw Error('Unused checkpoint is absent');return {}})
    await expect(generateLocalEcho('wolf',new AbortController().signal)).resolves.toEqual(Buffer.from('image'))
    expect(mocks.run).toHaveBeenCalledOnce()
  })
  it('honors cancellation and propagates kit render failures',async()=>{
    const controller=new AbortController();controller.abort()
    await expect(generateLocalEcho('wolf',controller.signal)).rejects.toThrow()
    expect(mocks.run).not.toHaveBeenCalled()
    mocks.run.mockRejectedValue(Error('render failed'))
    await expect(generateLocalEcho('wolf',new AbortController().signal)).rejects.toThrow('render failed')
    expect(mocks.run.mock.calls[0][1].workflow).toEqual(workflow)
  })
  it('rejects bytes returned after the owner cancels',async()=>{
    const controller=new AbortController()
    mocks.run.mockImplementation(async()=>{controller.abort();return Buffer.from('late image')})
    await expect(generateLocalEcho('wolf',controller.signal)).rejects.toThrow()
  })
})
