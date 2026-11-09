import { mkdir, readFile, stat, writeFile } from 'fs/promises'
import { dirname, join } from 'path'
import { ECHO_LOCAL_MODELS } from '../../shared/echoModels'
import { getComfyModelFilePath, getComfyPythonPath } from '../paths'
import { downloadFile, hashFile } from './downloadService'
import { resolveTarget } from './comfyService'

export async function installEchoModels(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  const target = await resolveTarget()
  signal.throwIfAborted()
  if (target.source === 'external') {
    throw Error('Your ComfyUI server is selected in Settings. Install the Megaten Style LoRA on that server and choose its checkpoint in Settings. This installer only writes to the game-managed ComfyUI.')
  }
  if (!(await stat(getComfyPythonPath()).catch(() => null))?.isFile()) {
    throw Error('Install ComfyUI through the game’s Setup screen first, then return here for the Echo models. Gemini does not need ComfyUI.')
  }
  const license = await readFile(join(__dirname, '../renderer/echo-model-license.txt'), 'utf8')
  for (const model of ECHO_LOCAL_MODELS) {
    signal.throwIfAborted()
    const destPath = getComfyModelFilePath(model.destDir, model.destFile)
    const existing = await stat(destPath).catch(error => { if (error.code === 'ENOENT') return null; throw error })
    if (existing) {
      const checked = await hashFile(destPath)
      if (checked.bytes !== model.bytes || checked.sha256.toUpperCase() !== model.sha256) {
        throw Error(`${model.label} is already present but does not match the expected version. Move that file aside before installing; it was not overwritten.`)
      }
    }
    try {
      if (!existing) await downloadFile({ url: model.url, destPath, expectedBytes: model.bytes, expectedSha256: model.sha256, signal })
      signal.throwIfAborted()
      if (model.destFile === 'Megaten_Style.safetensors') {
        await mkdir(dirname(destPath), { recursive: true })
        await writeFile(destPath + '.LICENSE.txt', license, 'utf8')
      }
    } catch (error) {
      signal.throwIfAborted()
      throw new Error(`Could not install ${model.label}. You can also download the original from its creator and place it in ComfyUI/models/${model.destDir}/${model.destFile}.`, { cause: error })
    }
  }
}
