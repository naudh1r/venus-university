import { beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEcho, echoImagePrompt } from '@shared/echo'
import { NO_SWITCHES, optionOn } from '@shared/mods'

const mocks = vi.hoisted(() => ({
  switches: vi.fn(), cloud: vi.fn(), local: vi.fn(), reflectionLocal: vi.fn(), target: vi.fn(), decode: vi.fn(), prepare: vi.fn(), cutout: vi.fn(),
  mkdir: vi.fn(), write: vi.fn(), read: vi.fn(), stat: vi.fn(), matte: vi.fn(), rename:vi.fn(),character:vi.fn(),sprite:vi.fn(), rm:vi.fn(), readdir:vi.fn()
}))
vi.mock('../src/main/services/modsService', async () => {
  const { modOn, optionOn } = await import('../src/shared/mods')
  let switches: import('../src/shared/mods').ModSwitches = { on: {}, options: {} }
  return {
    getModSwitches: mocks.switches,
    modIsOn: async (id: string) => { switches = await mocks.switches(); return modOn(switches, id) },
    modOptionOn: (id: string, option: string) => optionOn(switches, id, option)
  }
})
vi.mock('@shared/llm/cloudImage', () => ({ generateImage: mocks.cloud }))
vi.mock('../src/main/services/echoLocalImage', () => ({ generateLocalEcho: mocks.local }))
vi.mock('../src/main/services/reflectionLocalImage', () => ({ generateLocalReflection: mocks.reflectionLocal, resolveLocalReflectionTarget: mocks.target }))
// Service tests exercise writes/routing; echoArtImage.test uses the real decoder and image bytes.
vi.mock('../src/main/services/echoArtImage', () => ({ decodeEchoArt: mocks.decode, MAX_ECHO_ART_BYTES: 20 * 1024 * 1024 }))
vi.mock('../src/main/services/echoCutout', () => ({ prepareEchoCutout: mocks.prepare, cutoutEchoImage: mocks.cutout, releaseEchoCutout: vi.fn() }))
vi.mock('../src/main/services/echoMatte', () => ({ clearEchoMatte: mocks.matte }))
vi.mock('../src/main/paths', () => ({ getDataPath: () => 'echo-test-data' }))
vi.mock('fs/promises', () => ({ mkdir: mocks.mkdir, writeFile: mocks.write, readFile: mocks.read, stat: mocks.stat,rename:mocks.rename,rm:mocks.rm,readdir:mocks.readdir }))
vi.mock('../src/main/services/characterService',()=>({getCharacter:mocks.character,readCharacterImage:mocks.sprite}))
vi.mock('electron', () => ({ nativeImage: { createFromBuffer: (bytes: Buffer) => ({
  isEmpty: () => false, getSize: () => ({ width: 768, height: 1024 }), toPNG: () => bytes
}) } }))

import { cancelEchoArt, generateEchoArt, uploadEchoArt,generateReflectionPortrait, readReflectionStage, saveReflectionStage, resetReflectionPortrait, readReflectionPortrait } from '../src/main/services/echoService'
const request = () => ({ requestId: 'fdc99b1a-bd3b-41ca-897f-757b3bf983c3',
  identity: normalizeEcho({ player: { name: 'Vaelum', aspect: 'veilkeeper', motif: 0 } }).player!,
  name: 'Test owner', bio: 'Curious and thoughtful.' })

beforeEach(() => {
  vi.resetAllMocks()
  mocks.decode.mockImplementation(async bytes => Buffer.from(bytes))
  mocks.target.mockResolvedValue({ source: 'external', baseUrl: 'http://127.0.0.1:8189', loraWeight: 1 })
  mocks.reflectionLocal.mockResolvedValue(Buffer.from('local-reflection'))
  mocks.switches.mockResolvedValue({ on: { echo: true, reckoning: true }, options: {} })
  mocks.cloud.mockResolvedValue(Buffer.from('original'))
  mocks.cutout.mockResolvedValue(Buffer.from('transparent'))
  mocks.local.mockResolvedValue(Buffer.from('local-transparent'))
  mocks.read.mockResolvedValue(Buffer.from('uploaded'))
  mocks.stat.mockResolvedValue({ size: 10 })
  mocks.character.mockResolvedValue({charId:'nina',firstName:'Nina',lastName:'Bell',personality:'Outspoken and guarded.',backstory:'She fears letting people down.'})
  mocks.sprite.mockResolvedValue(Buffer.from('normal-portrait'))
})

describe('separate reflection portraits for default and custom girls',()=>{
 beforeEach(()=>{
  const files=new Map<string,unknown>()
  mocks.read.mockImplementation(async(path:string)=>{if(files.has(path))return files.get(path);throw Object.assign(Error('missing'),{code:'ENOENT'})})
  mocks.write.mockImplementation(async(path:string,data:unknown)=>{files.set(path,data)})
  mocks.rename.mockImplementation(async(from:string,to:string)=>{files.set(to,files.get(from));files.delete(from)})
  mocks.cutout.mockResolvedValue(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))
 })
 it('stores placement separately from the artwork and normal sprites, then reads it after reload',async()=>{
  const stage={x:-14,y:8,scale:1.25}
  expect(await saveReflectionStage('nina',stage)).toEqual(stage)
  expect(mocks.write).toHaveBeenCalledTimes(1)
  expect(String(mocks.write.mock.calls[0][0])).toMatch(/reflections[/\\]nina\.portable\.json\..+\.tmp$/)
  expect(String(mocks.rename.mock.calls[0][1])).toMatch(/reflections[/\\]nina\.portable\.json$/)
  mocks.read.mockResolvedValueOnce(JSON.stringify({version:1,image:null,stage}))
  expect(await readReflectionStage('nina')).toEqual(stage)
  await generateReflectionPortrait('nina',request().requestId,7)
  expect(String(mocks.rename.mock.calls[1][1])).toMatch(/reflections[/\\]nina\.portable\.json$/)
  expect(await readReflectionStage('nina')).toEqual(stage)
 })
 it('defaults missing placement but refuses unsafe writes and does not hide disk errors',async()=>{
  mocks.read.mockRejectedValueOnce(Object.assign(Error('missing'),{code:'ENOENT'}))
  expect(await readReflectionStage('nina')).toEqual({x:0,y:0,scale:1})
  for(const stage of [null,{x:Infinity,y:0,scale:1},{x:0,y:0,scale:9}])await expect(saveReflectionStage('nina',stage)).rejects.toThrow('Invalid reflection position')
  await expect(saveReflectionStage('../escape',{x:0,y:0,scale:1})).rejects.toThrow()
  expect(mocks.write).not.toHaveBeenCalled()
  mocks.read.mockRejectedValueOnce(Error('disk unavailable'))
  await expect(readReflectionStage('nina')).rejects.toThrow('disk unavailable')
  mocks.rename.mockRejectedValueOnce(Error('disk full'))
  await expect(saveReflectionStage('nina',{x:5,y:0,scale:1})).rejects.toThrow('disk full')
 })
 it('restores the default portrait while keeping placement, without exposing a legacy image again',async()=>{
  const stage={x:-18,y:7,scale:1.1}
  await saveReflectionStage('nina',stage);await generateReflectionPortrait('nina',request().requestId,7)
  expect(await readReflectionPortrait('nina')).toMatch(/^data:image\/png/)
  await resetReflectionPortrait('nina')
  expect(await readReflectionPortrait('nina')).toBeNull()
  expect(await readReflectionStage('nina')).toEqual(stage)
  const reads=mocks.read.mock.calls.length
  expect(await readReflectionPortrait('nina')).toBeNull()
  expect(mocks.read.mock.calls.slice(reads)).toHaveLength(1) // null portable record masks the legacy pointer
  expect(mocks.cloud).toHaveBeenCalledTimes(1)
  await expect(resetReflectionPortrait('../escape')).rejects.toThrow()
 })
 it('leaves the existing artwork intact when restoring the default cannot be saved',async()=>{
  await generateReflectionPortrait('nina',request().requestId,7)
  const before=await readReflectionPortrait('nina')
  mocks.rename.mockRejectedValueOnce(Error('disk full'))
  await expect(resetReflectionPortrait('nina')).rejects.toThrow('disk full')
  expect(await readReflectionPortrait('nina')).toEqual(before)
 })
 it.each(['nina','a86c6b2c-1726-437e-b952-5a9fc5e602e2'])('uses the actual normal portrait as reference and writes only a separate %s image',async charId=>{
  await generateReflectionPortrait(charId,request().requestId,7)
  expect(mocks.sprite).toHaveBeenCalledWith(charId,'expressions/neutral.png')
  expect(mocks.cloud.mock.calls[0][1].sources).toEqual([{bytes:Buffer.from('normal-portrait'),mimeType:'image/png'}])
  expect(mocks.cloud.mock.calls[0][0]).toContain('SAME adult character')
  expect(mocks.cloud.mock.calls[0][0]).toContain('No scenery, text')
  expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.cloud.mock.invocationCallOrder[0])
  expect(mocks.rename).toHaveBeenCalledTimes(1)
  for(const call of mocks.write.mock.calls)expect(String(call[0])).toMatch(/echoes[/\\](sources|art|reflections)[/\\]/)
  expect(mocks.local).not.toHaveBeenCalled()
 })
 it('rejects traversal, missing references and missing remover before any paid call',async()=>{
  await expect(generateReflectionPortrait('../escape',request().requestId,7)).rejects.toThrow()
  mocks.sprite.mockResolvedValueOnce(null);await expect(generateReflectionPortrait('nina',request().requestId,7)).rejects.toThrow('neutral portrait')
  mocks.prepare.mockRejectedValueOnce(Error('missing remover'));await expect(generateReflectionPortrait('nina',request().requestId,7)).rejects.toThrow('missing remover')
  expect(mocks.cloud).not.toHaveBeenCalled();expect(mocks.rename).not.toHaveBeenCalled()
 })
 it('routes the actual reference to the captured local server and preserves placement without calling the image API', async () => {
  mocks.switches.mockResolvedValue({ on: { reckoning: true, echo: false }, options: {} })
  const stage = { x: 11, y: -8, scale: 1.2 }
  await saveReflectionStage('nina', stage)
  await generateReflectionPortrait('nina', request().requestId, 7, 'local')
  expect(mocks.reflectionLocal).toHaveBeenCalledWith(await mocks.character.mock.results[0].value,
   Buffer.from('normal-portrait'), expect.any(AbortSignal), await mocks.target.mock.results[0].value)
  expect(mocks.target).toHaveBeenCalledOnce()
  expect(mocks.cloud).not.toHaveBeenCalled()
  expect(mocks.local).not.toHaveBeenCalled()
  expect(await readReflectionStage('nina')).toEqual(stage)
  expect(await readReflectionPortrait('nina')).toMatch(/^data:image\/png;base64,/)
 })
 it('keeps prior artwork on local failure or cancellation, with no cloud fallback', async () => {
  await generateReflectionPortrait('nina', request().requestId, 7)
  const before = await readReflectionPortrait('nina')
  mocks.cloud.mockClear(); mocks.write.mockClear()
  mocks.reflectionLocal.mockRejectedValueOnce(Error('missing local model'))
  await expect(generateReflectionPortrait('nina', request().requestId, 7, 'local')).rejects.toThrow('missing local model')
  mocks.reflectionLocal.mockImplementationOnce(async (_character, _reference, signal: AbortSignal) => {
   cancelEchoArt(request().requestId, 8)
   expect(signal.aborted).toBe(false)
   cancelEchoArt(request().requestId, 7)
   signal.throwIfAborted()
  })
  await expect(generateReflectionPortrait('nina', request().requestId, 7, 'local')).rejects.toMatchObject({ name: 'AbortError' })
  expect(await readReflectionPortrait('nina')).toEqual(before)
  expect(mocks.cloud).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
 })
 it('rejects an unknown provider or unreadable reference before either generator or any write', async () => {
  await expect(generateReflectionPortrait('nina', request().requestId, 7, 'other')).rejects.toThrow('Choose the image API')
  mocks.decode.mockRejectedValueOnce(Error('unreadable reference'))
  await expect(generateReflectionPortrait('nina', request().requestId, 7, 'local')).rejects.toThrow('unreadable reference')
  expect(mocks.cloud).not.toHaveBeenCalled(); expect(mocks.reflectionLocal).not.toHaveBeenCalled()
  expect(mocks.write).not.toHaveBeenCalled()
 })
 it('does not replace the previous reflection or retry a paid request after segmentation fails',async()=>{
  mocks.cutout.mockRejectedValueOnce(Error('segmentation failed'))
  await expect(generateReflectionPortrait('nina',request().requestId,7)).rejects.toThrow('segmentation failed')
  expect(mocks.cloud).toHaveBeenCalledTimes(1);expect(mocks.rename).not.toHaveBeenCalled();expect(mocks.write).toHaveBeenCalledTimes(1)
 })
})

describe('Echo artwork routing and safe background removal', () => {
  it('defaults to the cloud and asks for a clean white backdrop without a dark aura', async () => {
    expect(optionOn(NO_SWITCHES, 'echo', 'megaten-art')).toBe(false)
    const prompt = echoImagePrompt(request())
    expect(prompt).toContain('plain white background')
    expect(prompt).toContain('do not surround it with a black halo')
    expect(prompt).not.toContain('ethereal aura')
    await generateEchoArt(request(), 7)
    expect(mocks.prepare.mock.invocationCallOrder[0]).toBeLessThan(mocks.cloud.mock.invocationCallOrder[0])
    expect(mocks.write.mock.calls[0][0]).toMatch(/echoes[/\\]sources[/\\]/)
    expect(mocks.write.mock.calls[0][1]).toEqual(Buffer.from('original'))
    expect(mocks.write.mock.calls[1][0]).toMatch(/echoes[/\\]art[/\\]/)
    expect(mocks.write.mock.calls[1][1]).toEqual(Buffer.from('transparent'))
    expect(mocks.write.mock.invocationCallOrder[0]).toBeLessThan(mocks.cutout.mock.invocationCallOrder[0])
    expect(mocks.local).not.toHaveBeenCalled()
    expect(mocks.matte).not.toHaveBeenCalled()
  })
  it('refuses a missing remover before spending an API call, then releases the job', async () => {
    mocks.prepare.mockRejectedValueOnce(Error('missing remover'))
    await expect(generateEchoArt(request(), 7)).rejects.toThrow('missing remover')
    expect(mocks.cloud).not.toHaveBeenCalled()
    expect(mocks.write).not.toHaveBeenCalled()
    await expect(generateEchoArt(request(), 7)).resolves.toBeTypeOf('string')
  })
  it('keeps the paid original if cleanup fails, without replacing art or retrying the API', async () => {
    mocks.cutout.mockRejectedValue(Error('segmentation failed'))
    await expect(generateEchoArt(request(), 7)).rejects.toThrow('original image is kept')
    expect(mocks.cloud).toHaveBeenCalledTimes(1)
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.write.mock.calls[0][0]).toMatch(/sources/)
  })
  it('cancels cleanup only for the request owner and does not publish canceled art', async () => {
    mocks.cutout.mockImplementation(async (_png: Uint8Array, signal: AbortSignal) => {
      cancelEchoArt(request().requestId, 8)
      expect(signal.aborted).toBe(false)
      cancelEchoArt(request().requestId, 7)
      signal.throwIfAborted()
    })
    await expect(generateEchoArt(request(), 7)).rejects.toThrow()
    expect(mocks.write).toHaveBeenCalledTimes(1)
    expect(mocks.cloud).toHaveBeenCalledTimes(1)
  })
  it('uses the local generator and portable cleanup without making a cloud request', async () => {
    mocks.switches.mockResolvedValue({ on: { echo: true }, options: { 'echo:megaten-art': true } })
    await generateEchoArt(request(), 7)
    await uploadEchoArt('chosen.png')
    expect(mocks.local).toHaveBeenCalledTimes(1)
    expect(mocks.cloud).not.toHaveBeenCalled()
    expect(mocks.prepare).toHaveBeenCalledTimes(1)
    expect(mocks.cutout).toHaveBeenCalledTimes(1)
    expect(mocks.write.mock.calls.map(call => call[1])).toEqual([Buffer.from('local-transparent'), Buffer.from('transparent'), Buffer.from('uploaded')])
  })
})
