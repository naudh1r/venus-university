import { contextBridge, ipcRenderer } from 'electron'
import { desktopChannel } from '../shared/desktopSurface'

const owner = process.argv.find(arg=>arg.startsWith('--ve-surface='))?.slice('--ve-surface='.length)
if (!owner) throw Error('Desktop surface has no owner')
contextBridge.exposeInMainWorld('modSurface',{
  invoke: (method: string,...args: unknown[])=>ipcRenderer.invoke(desktopChannel(owner,method),...args),
  on: (method: string,listener: (...args: unknown[])=>void)=>{
    const channel=desktopChannel(owner,method)
    const receive=(_event: Electron.IpcRendererEvent,...args:unknown[])=>listener(...args)
    ipcRenderer.on(channel,receive)
    return ()=>ipcRenderer.removeListener(channel,receive)
  }
})
