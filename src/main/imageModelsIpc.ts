import { readdir } from 'fs/promises'
import { join, relative } from 'path'
import type { IpcMainInvokeEvent } from 'electron'
import { MODEL_FILE, type ModelFiles } from '@shared/imageModels'
import { getComfyModelDirPath } from './paths'

/** How `ipc.ts` wraps a listener into its own `Result` envelope. */
type Handle = <Args extends unknown[], T>(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: Args) => Promise<T> | T
) => void

/**
 * Every model file under one of ComfyUI's model folders, named the way its loaders name them:
 * relative to the folder, subfolders included. None where the folder is missing.
 */
async function modelFiles(subdir: string): Promise<string[]> {
  const dir = getComfyModelDirPath(subdir)
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true })
    return entries
      .filter((entry) => entry.isFile() && MODEL_FILE.test(entry.name))
      .map((entry) => relative(dir, join(entry.parentPath, entry.name)))
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** Registers the model picker's one channel. Called from `registerIpcHandlers`. */
export function registerImageModelsIpc(handle: Handle): void {
  handle(
    'comfy:listModelFiles',
    async (): Promise<ModelFiles> => ({
      checkpoints: await modelFiles('checkpoints'),
      loras: await modelFiles('loras')
    })
  )
}
