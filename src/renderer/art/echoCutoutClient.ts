import { assertEchoPng, ECHO_ART_MAX_BYTES, ECHO_CUTOUT_PREPARE_ERROR } from '../../shared/echoArtwork'
import { refineWhiteEchoEdges } from '../../shared/echoCutoutEdges'

let worker: Worker | null = null
let serial = 0
let prepared = false
let busy = false

export function releasePortableCutout(): void {
  worker?.terminate(); worker = null; prepared = false
}

async function job(png: Uint8Array | undefined, signal: AbortSignal): Promise<Uint8Array | undefined> {
  signal.throwIfAborted()
  if (busy) throw Error('Background removal is already running.')
  busy = true
  try {
    const owned = worker ??= new Worker(new URL('./echoCutoutWorker.ts', import.meta.url), { type: 'module' })
    const id = ++serial
    return await new Promise((resolve, reject) => {
      const done = (error?: Error, bytes?: Uint8Array): void => {
        clearTimeout(timer)
        signal.removeEventListener('abort', abort)
        owned.removeEventListener('message', message)
        owned.removeEventListener('error', failed)
        if (error) { releasePortableCutout(); reject(error) } else resolve(bytes)
      }
      const abort = (): void => done(new DOMException('Generation cancelled.', 'AbortError'))
      const failed = (): void => done(Error('Could not load the Echo background remover. Check your connection and browser support.'))
      const message = (event: MessageEvent<{ id: number; bytes?: Uint8Array; error?: string }>): void => {
        if (event.data.id === id) done(event.data.error ? Error(event.data.error) : undefined, event.data.bytes)
      }
      const timer = setTimeout(() => done(Error('Echo background removal timed out.')), 300_000)
      signal.addEventListener('abort', abort, { once: true })
      owned.addEventListener('message', message)
      owned.addEventListener('error', failed)
      try { owned.postMessage({ id, png }) }
      catch { failed() }
    })
  } finally { busy = false }
}

/** No image provider call happens until model and runtime initialization succeed. */
export async function preparePortableCutout(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  if (prepared) return
  try { await job(undefined, signal); prepared = true }
  catch (error) {
    signal.throwIfAborted()
    throw new Error(ECHO_CUTOUT_PREPARE_ERROR, { cause: error })
  }
}

/** Decode and bound uploads/provider bytes before allocating the segmentation canvas. */
export async function normalizePortableImage(bytes: Uint8Array): Promise<Uint8Array> {
  if (bytes.length > ECHO_ART_MAX_BYTES) throw Error('Choose an image smaller than 20 MB.')
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]))
  try {
    if (bitmap.width * bitmap.height > 25_000_000) throw Error('Choose an image smaller than 25 megapixels.')
    const ratio = Math.min(1, 1536 / Math.max(bitmap.width, bitmap.height))
    const canvas = new OffscreenCanvas(Math.max(1, Math.round(bitmap.width * ratio)), Math.max(1, Math.round(bitmap.height * ratio)))
    const context = canvas.getContext('2d')!
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())
  } finally { bitmap.close() }
}

export async function portableCutout(png: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  assertEchoPng(png)
  await preparePortableCutout(signal)
  const result = await job(png, signal)
  signal.throwIfAborted()
  if (!result) throw Error('Background removal returned no artwork.')
  assertEchoPng(result)
  const bitmap = await createImageBitmap(new Blob([new Uint8Array(result)]))
  const original = await createImageBitmap(new Blob([new Uint8Array(png)]))
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    const masked = ctx.getImageData(0, 0, canvas.width, canvas.height)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(original, 0, 0, canvas.width, canvas.height)
    const source = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const pixels = refineWhiteEchoEdges(source.data, masked.data, canvas.width, canvas.height)
    let solid = 0, clear = 0
    for (let i = 3; i < pixels.length; i += 4) { if (pixels[i] >= 128) solid++; else clear++ }
    if (solid < canvas.width * canvas.height * .001 || clear < canvas.width * canvas.height * .001) throw Error('Background removal could not separate a solid creature from its background.')
    masked.data.set(pixels); ctx.putImageData(masked, 0, 0)
    return new Uint8Array(await (await canvas.convertToBlob({ type: 'image/png' })).arrayBuffer())
  } finally { bitmap.close(); original.close() }
}
