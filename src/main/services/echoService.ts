import { readPortableReflection, writePortableReflection } from './reflectionStorage'
import { nativeImage } from 'electron'
import { randomUUID } from 'crypto'
import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { join } from 'path'
import { ECHO_ART_ID, echoImagePrompt, echoLocalImagePrompt, normalizeEchoIdentity, type EchoArtRequest } from '../../shared/echo'
import { generateImage } from '@shared/llm/cloudImage'
import { getDataPath } from '../paths'
import { modIsOn, modOptionOn } from '@vx/modkit/main'
import { clearEchoMatte } from './echoMatte'
import { generateLocalEcho } from './echoLocalImage'
import { decodeEchoArt, MAX_ECHO_ART_BYTES } from './echoArtImage'
import { generateLocalReflection, resolveLocalReflectionTarget } from './reflectionLocalImage'
import { installEchoModels } from './echoModelSetup'
import { cutoutEchoImage, prepareEchoCutout, releaseEchoCutout } from './echoCutout'
import { assertSafeCharId } from '@vx/modkit/shared'
import { expressionRel } from '@shared/characterFiles'
import { getCharacter, readCharacterImage } from './characterService'
import { reflectionPortraitPrompt, reflectionStageOf, assertReflectionStage, type ReflectionStage } from '@shared/reflectionPortrait'
import { registerComfyLaunchEnvironment } from '@vx/modkit/main'

// The managed ComfyUI keeps the transparent-background model under its own root, on every boot.
registerComfyLaunchEnvironment('echo', ({ root }) => ({ TRANSPARENT_BACKGROUND_FILE_PATH: root }))

const jobs = new Map<string, { owner: number; controller: AbortController }>()
const folder = (): string => join(getDataPath(),'echoes','art')
const MAX_BYTES = MAX_ECHO_ART_BYTES
export async function readReflectionStage(charId:string):Promise<ReflectionStage> {
 return (await readPortableReflection(charId))?.stage ?? reflectionStageOf(null)
}
export async function saveReflectionStage(charId:string,value:unknown):Promise<ReflectionStage> {
 assertSafeCharId(charId);assertReflectionStage(value)
 if(!await modIsOn('reckoning'))throw Error('Enable Reckoning in Mods first.')
 const stage=reflectionStageOf(value),existing=await readPortableReflection(charId)
 await writePortableReflection(charId,{version:1,image:existing?.image??null,stage})
 return stage
}
export async function readReflectionPortrait(charId:string):Promise<string|null> {
 return (await readPortableReflection(charId))?.image ?? null
}
/** An explicit null masks legacy artwork too, without removing the saved placement. */
export async function resetReflectionPortrait(charId:string):Promise<void> {
 assertSafeCharId(charId);await getCharacter(charId)
 if(!await modIsOn('reckoning'))throw Error('Enable Reckoning in Mods first.')
 if(jobs.size)throw Error('Wait for image generation to finish or cancel it first.')
 const existing=await readPortableReflection(charId)
 await writePortableReflection(charId,{version:1,image:null,stage:existing?.stage??reflectionStageOf(null)})
}
async function storeReflection(charId:string,bytes:Uint8Array,signal?:AbortSignal):Promise<string> {
 const image=`data:image/png;base64,${(await decodeEchoArt(bytes)).toString('base64')}`
 const existing=await readPortableReflection(charId)
 signal?.throwIfAborted()
 await writePortableReflection(charId,{version:1,image,stage:existing?.stage??reflectionStageOf(null)})
 return image
}
export async function uploadReflectionPortrait(charId:string,path:string):Promise<string> {
 assertSafeCharId(charId);await getCharacter(charId)
 if(!await modIsOn('reckoning'))throw Error('Enable Reckoning in Mods first.')
 if((await stat(path)).size>MAX_BYTES)throw Error('Choose an image smaller than 20 MB.')
 return storeReflection(charId,await readFile(path))
}
export async function generateReflectionPortrait(charId:string,requestId:string,owner:number,source:unknown='api'):Promise<string> {
 assertSafeCharId(charId)
 if(source!=='api' && source!=='local')throw Error('Choose the image API or Local ComfyUI for this portrait.')
 if(!ECHO_ART_ID.test(requestId))throw Error('Invalid artwork request.')
 if(jobs.size)throw Error('Another image is already being generated. Wait or cancel it first.')
 // Admit the job before any await, so Stop also covers the settings read.
 const controller=new AbortController();jobs.set(requestId,{owner,controller})
 try {
  const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(source==='local'?900000:600000)])
  const on=await modIsOn('reckoning');signal.throwIfAborted()
  if(!on)throw Error('Enable Reckoning in Mods first.')
  const target=source==='local'?await resolveLocalReflectionTarget():null
  signal.throwIfAborted()
  const character=await getCharacter(charId),original=await readCharacterImage(charId,expressionRel('neutral'))
  signal.throwIfAborted()
  if(!original)throw Error('Generate or import her normal neutral portrait first.')
  const reference=await decodeEchoArt(original)
  signal.throwIfAborted()
  await prepareEchoCutout(signal)
  signal.throwIfAborted()
  const bytes=target
   ?await generateLocalReflection(character,reference,signal,target)
   :await generateImage(reflectionPortraitPrompt(character),{aspectRatio:'3:4',sources:[{bytes:reference,mimeType:'image/png'}],signal})
  signal.throwIfAborted()
  const png=await decodeEchoArt(bytes),sourceId=randomUUID(),sourceFolder=join(getDataPath(),'echoes','sources')
  signal.throwIfAborted()
  await mkdir(sourceFolder,{recursive:true});await writeFile(join(sourceFolder,`${sourceId}.png`),png,{flag:'wx'})
  const cutout=await cutoutEchoImage(png,signal);signal.throwIfAborted()
  return await storeReflection(charId,cutout,signal)
 } finally {releaseEchoCutout();jobs.delete(requestId)}
}
function artPath(id: string): string {
  if (typeof id !== 'string' || !ECHO_ART_ID.test(id)) throw Error('Invalid Echo artwork id.')
  return join(folder(),`${id}.png`)
}
/** An immutable file id lets old saves keep their original artwork after a replacement. */
async function storeArt(bytes: Uint8Array, signal?: AbortSignal): Promise<string> {
  const image = await decodeEchoArt(bytes)
  const id = randomUUID()
  await mkdir(folder(),{recursive:true})
  signal?.throwIfAborted()
  await writeFile(artPath(id),image,{flag:'wx'})
  return id
}
export async function generateEchoArt(value: EchoArtRequest, owner: number): Promise<string> {
  const identity = normalizeEchoIdentity(value?.identity)
  if (!identity?.name || !ECHO_ART_ID.test(value?.requestId ?? '') || typeof value.name !== 'string' || typeof value.bio !== 'string' || (value.backstory !== undefined && typeof value.backstory !== 'string')) throw Error('Invalid Echo request.')
  if (jobs.size) throw Error('An Echo image is already being generated. Wait or cancel it first.')
  // The renderer can cancel as soon as it sends this request ID.
  const controller = new AbortController()
  jobs.set(value.requestId,{owner,controller})
  try {
    const on = await modIsOn('echo')
    controller.signal.throwIfAborted()
    if (!on) throw Error('Enable Echo in Mods first.')
    const local = modOptionOn('echo','megaten-art')
    const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(local ? 900000 : 600000)])
    const prompt = (local ? echoLocalImagePrompt : echoImagePrompt)({...value,identity})
    await prepareEchoCutout(signal)
    signal.throwIfAborted()
    const bytes = local ? await generateLocalEcho(prompt,signal) : await generateImage(prompt,{aspectRatio:'3:4',signal})
    signal.throwIfAborted()
    const png = await decodeEchoArt(bytes)
    signal.throwIfAborted()
    const sourceFolder = join(getDataPath(),'echoes','sources')
    const sourceId = randomUUID()
    await mkdir(sourceFolder,{recursive:true})
    await writeFile(join(sourceFolder,`${sourceId}.png`),png,{flag:'wx'})
    try {
      const cutout = await cutoutEchoImage(png,signal)
      signal.throwIfAborted()
      return await storeArt(cutout,signal)
    } catch (error) {
      signal.throwIfAborted()
      throw new Error(`Echo background removal failed. Your previous artwork is unchanged. The original image is kept in data/echoes/sources/${sourceId}.png; no automatic paid retry was made.`,{cause:error})
    }
  } finally { releaseEchoCutout(); jobs.delete(value.requestId) }
}
export function cancelEchoArt(id: string, owner: number): null {
  const job = jobs.get(id)
  if (job?.owner === owner) job.controller.abort()
  return null
}
export async function installLocalEchoModels(id: string, owner: number): Promise<null> {
  if (typeof id !== 'string' || !ECHO_ART_ID.test(id)) throw Error('Invalid Echo setup request.')
  if (jobs.size) throw Error('An Echo job is already running. Wait or cancel it first.')
  const controller = new AbortController()
  jobs.set(id, { owner, controller })
  try { await installEchoModels(AbortSignal.any([controller.signal, AbortSignal.timeout(3_600_000)])); return null }
  finally { jobs.delete(id) }
}
export async function uploadEchoArt(path: string): Promise<string> {
  if (!await modIsOn('echo')) throw Error('Enable Echo in Mods first.')
  if ((await stat(path)).size > MAX_BYTES) throw Error('Choose an image smaller than 20 MB.')
  return storeArt(await readFile(path))
}
export async function readEchoArt(id: string, generated = false): Promise<string | null> {
  if (typeof generated !== 'boolean') throw Error('Invalid Echo artwork source.')
  const path = artPath(id)
  try {
    const bytes = await readFile(path)
    if (bytes.byteLength > MAX_BYTES) throw Error('Echo artwork is too large.')
    if (generated) {
      const image = nativeImage.createFromBuffer(bytes),size = image.getSize()
      if (size.width * size.height > 25_000_000) throw Error('Echo artwork is too large.')
      if (!image.isEmpty()) {
        const cleaned = clearEchoMatte(image.toBitmap(),size.width,size.height)
        if (cleaned.cleared || cleaned.feathered) {
          const preview = nativeImage.createFromBitmap(Buffer.from(cleaned.bitmap),size).toPNG()
          return `data:image/png;base64,${preview.toString('base64')}`
        }
      }
    }
    return `data:image/png;base64,${bytes.toString('base64')}`
  }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null; throw error }
}
