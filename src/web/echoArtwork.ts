import { ECHO_ART_ID, echoImagePrompt, normalizeEchoIdentity, type EchoArtRequest } from '@shared/echo'
import { assertEchoPng, ECHO_ART_MAX_BYTES } from '@shared/echoArtwork'
import { bytesToBase64 } from '@shared/base64'
import { generateImage } from '@shared/llm/cloudImage'
import { modOn, optionOn } from '@shared/mods'
import { normalizePortableImage, portableCutout, preparePortableCutout } from '../renderer/art/echoCutoutClient'
import { database, storage } from './db/open'
import { readModSwitches } from './mods'
import { pickFile } from './transfer'
import { offerDownload } from './download'

const jobs = new Map<string, AbortController>()

async function enabled(): Promise<void> {
  if (!modOn(await readModSwitches(), 'echo')) throw Error('Enable Echo in Mods first.')
}

async function storeArt(bytes: Uint8Array, source = false, signal?: AbortSignal): Promise<string> {
  assertEchoPng(bytes)
  const id = crypto.randomUUID()
  await storage('save Echo artwork', async () => {
    const db = await database()
    signal?.throwIfAborted()
    await db.add(source ? 'echoSources' : 'echoArt', new Blob([new Uint8Array(bytes)], { type: 'image/png' }), id)
  })
  return id
}

export async function generateEchoArt(value: EchoArtRequest): Promise<string> {
  const identity = normalizeEchoIdentity(value?.identity)
  if (!identity?.name || !ECHO_ART_ID.test(value?.requestId ?? '') || typeof value.name !== 'string' || typeof value.bio !== 'string' || (value.backstory !== undefined && typeof value.backstory !== 'string')) throw Error('Invalid Echo request.')
  if (jobs.size) throw Error('An Echo image is already being generated. Wait or cancel it first.')
  const controller = new AbortController(), signal = AbortSignal.any([controller.signal, AbortSignal.timeout(600_000)])
  jobs.set(value.requestId, controller)
  try {
    const switches = await readModSwitches()
    signal.throwIfAborted()
    if (!modOn(switches, 'echo')) throw Error('Enable Echo in Mods first.')
    if (optionOn(switches, 'echo', 'megaten-art')) throw Error('Local Megaten generation requires the desktop game. Turn off Local Megaten artwork to use your configured image API here.')
    await preparePortableCutout(signal)
    signal.throwIfAborted()
    const bytes = await generateImage(echoImagePrompt({ ...value, identity }), { aspectRatio: '3:4', signal })
    signal.throwIfAborted()
    const png = await normalizePortableImage(bytes)
    const original = await storeArt(png, true, signal)
    try {
      const cutout = await portableCutout(png, signal)
      signal.throwIfAborted()
      return await storeArt(cutout, false, signal)
    } catch (error) {
      signal.throwIfAborted()
      throw new Error(`Echo background removal failed. Previous artwork is unchanged. The original is retained in this browser's Echo sources (${original}); no automatic paid retry was made.`, { cause: error })
    }
  } finally { jobs.delete(value.requestId) }
}

export function cancelEchoArt(id: string): null { jobs.get(id)?.abort(); return null }

export async function uploadEchoArt(): Promise<string | null> {
  // Open the picker synchronously inside the user's click; some browsers require activation.
  const picking = pickFile('image/png,image/jpeg,image/webp')
  const file = await picking
  if (!file) return null
  await enabled()
  if (file.size > ECHO_ART_MAX_BYTES) throw Error('Choose an image smaller than 20 MB.')
  return storeArt(await normalizePortableImage(new Uint8Array(await file.arrayBuffer())))
}

export async function echoArtBytes(id: string): Promise<Uint8Array | null> {
  if (typeof id !== 'string' || !ECHO_ART_ID.test(id)) throw Error('Invalid Echo artwork id.')
  return storage('read Echo artwork', async () => {
    const blob = await (await database()).get('echoArt', id)
    if (!blob) return null
    if (blob.size > ECHO_ART_MAX_BYTES) throw Error('Echo artwork is too large.')
    const bytes = new Uint8Array(await blob.arrayBuffer()); assertEchoPng(bytes)
    return bytes
  })
}

export async function readEchoArt(id: string): Promise<string | null> {
  const bytes = await echoArtBytes(id)
  return bytes ? `data:image/png;base64,${bytesToBase64(bytes)}` : null
}

export async function exportEchoArt(id: string, name: string): Promise<string | null> {
  const bytes = await echoArtBytes(id)
  if (!bytes) throw Error('That Echo artwork is no longer available.')
  const safeName = typeof name === 'string' ? name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 60) : ''
  return offerDownload(`${safeName || 'Echo'}.png`, bytes, 'image/png')
}
