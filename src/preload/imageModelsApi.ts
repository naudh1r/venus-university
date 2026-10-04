import { ipcRenderer } from 'electron'

/** The renderer's half of the model picker's channel; declared in `shared/imageModels.ts`. */
export const imageModelsApi = {
  imageModels: {
    list: () => ipcRenderer.invoke('comfy:listModelFiles')
  }
}
