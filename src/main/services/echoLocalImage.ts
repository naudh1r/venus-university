import { randomInt } from 'crypto'
import { stat } from 'fs/promises'
import { renderComfyImage } from '@vx/modkit/main'
import workflow from '../../../assets/workflows/echoMegaten.json'
import { getComfyModelFilePath, getComfyPythonPath } from '../paths'
import { resolveTarget } from './comfyService'

/** Isolated graph: never changes portrait/photo workflows or cloud settings. */
export async function generateLocalEcho(prompt: string, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted()
  const target = await resolveTarget()
  signal.throwIfAborted()
  if (target.source === 'managed') for (const path of [getComfyPythonPath(),getComfyModelFilePath('loras','Megaten_Style.safetensors')]) {
    try { await stat(path) } catch { throw Error('Echo local artwork needs ComfyUI and the Megaten Style LoRA. Use Install local art models in Echoes after setting up ComfyUI, or select Gemini / image API.') }
  }
  signal.throwIfAborted()
  const bytes = await renderComfyImage('echo', {workflow,nodes:{seed:'7',positivePrompt:'4',saveImage:'9'},
    prompts:{positive:`kazuma_kaneko_(style), masterpiece, best quality, solo fantasy creature, full body, plain white background, well-lit opaque body, colored surfaces, balanced midtones, soft fill light, readable shadow details, restrained dark accents, visible surface details, ${prompt}`,negative:'(text, lettering, typography, words, letters, numbers, captions, labels, annotations, speech bubble, watermark, signature, logo:1.4), character sheet, reference sheet, infographic, diagram, border, frame, scenery, black background, silhouette, underexposed, crushed blacks, featureless black body, monochrome, invisible body, rim lighting only, checkerboard, chibi, plush toy, cropped, out of frame, human, person'},
    seed:randomInt(0,2147483647)
  },{signal})
  signal.throwIfAborted()
  return bytes
}
