import { randomInt, randomUUID } from 'crypto'
import { readFile, rm } from 'fs/promises'
import { join } from 'path'
import { characterLoraOf } from '@vx/modkit/shared'
import { appError } from '@vx/modkit/shared'
import { reflectionLocalPrompt } from '@shared/reflectionPortrait'
import type { Character } from '@vx/modkit/shared'
import { getTempPath } from '../paths'
import { runGenerationJob, start, type ComfyTarget } from './comfyService'
import { openImage } from './imageFiles'

export { resolveTarget as resolveLocalReflectionTarget } from './comfyService'

/** This mod stages its own reference; the shared ComfyUI render pipeline owns the job. */
async function stageReference(target: ComfyTarget, reference: Buffer, signal: AbortSignal): Promise<string> {
  // A solid backdrop keeps transparent sprite edges from becoming black in the VAE.
  const png = await (await openImage(reference)).flatten({ background: '#eeeeee' })
    .resize(768, 1024, { fit: 'contain', background: '#eeeeee' }).png().toBuffer()
  signal.throwIfAborted()
  const form = new FormData()
  form.append('image', new Blob([new Uint8Array(png)], { type: 'image/png' }), `unheard-${randomUUID()}.png`)
  form.append('type', 'input')
  form.append('subfolder', 'venus-university/unheard-soul')
  let response: Response
  try {
    response = await fetch(`${target.baseUrl}/upload/image`, {
      method: 'POST', body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(30000)])
    })
  } catch {
    signal.throwIfAborted()
    throw appError('COMFY_UNREACHABLE', 'Could not send the reference portrait to ComfyUI. Check Settings → ComfyUI and try again.')
  }
  signal.throwIfAborted()
  if (!response.ok) throw appError('COMFY_UPLOAD_FAILED', 'ComfyUI could not accept the reference portrait.', `HTTP ${response.status}`)
  const body: unknown = await response.json().catch(() => null)
  const answer = (body && typeof body === 'object' ? body : {}) as { name?: unknown; subfolder?: unknown }
  const name = answer.name, subfolder = answer.subfolder ?? ''
  if (typeof name !== 'string' || !name || /[/\\:]/.test(name) || name === '.' || name === '..' ||
    typeof subfolder !== 'string' || (subfolder !== '' && subfolder !== 'venus-university/unheard-soul')) {
    throw appError('COMFY_UPLOAD_FAILED', 'ComfyUI did not return a usable reference portrait.')
  }
  return subfolder ? `${subfolder}/${name}` : name
}

/** Image-to-image generation preserves the neutral sprite as the starting composition. */
export async function generateLocalReflection(
  character: Character, reference: Buffer, signal: AbortSignal, target: ComfyTarget
): Promise<Uint8Array> {
  signal.throwIfAborted()
  await start(target)
  signal.throwIfAborted()
  const sourceImageName = await stageReference(target, reference, signal)
  signal.throwIfAborted()
  const destPath = join(getTempPath(), `unheard-${randomUUID()}.png`)
  try {
    await runGenerationJob({
      workflowFile: 'reflectionPortrait.json',
      nodes: { seed: '7', positivePrompt: '4', negativePrompt: '5', saveImage: '9', sourceImage: '6', characterLora: '10' },
      prompts: reflectionLocalPrompt(character), lora: characterLoraOf(character), sourceImageName,
      seed: randomInt(0, 2147483647), destPath, format: 'raw', label: 'Unheard Soul artwork', logContext: 'portrait reference'
    }, { signal, target })
    signal.throwIfAborted()
    return await readFile(destPath)
  } finally {
    await rm(destPath, { force: true })
    await rm(`${destPath}.partial`, { force: true })
  }
}
