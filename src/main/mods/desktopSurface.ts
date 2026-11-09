import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import { SURFACE_NAME } from '@shared/desktopSurface'
import { modById } from '@shared/mods'
import { sharedModOn } from '@shared/modRules'
import { subscribeModSwitches } from '../services/modsService'

const surfaces = new Set<BrowserWindow>()

/** Create a local auxiliary window with the host preload and a channel namespace bound at launch. */
export function createDesktopSurface(owner: string, options: Omit<BrowserWindowConstructorOptions,'webPreferences'>): BrowserWindow {
  if (!SURFACE_NAME.test(owner) || !modById(owner) || !sharedModOn(owner)) throw Error('Mod surface owner is unavailable')
  const parent = options.parent ?? BrowserWindow.getAllWindows().find(window => !surfaces.has(window) && !window.isDestroyed())
  if (!(parent instanceof BrowserWindow) || parent.isDestroyed() || surfaces.has(parent)) throw Error('No game window owns this surface')
  const win = new BrowserWindow({...options, parent, webPreferences:{
    sandbox:true, contextIsolation:true, nodeIntegration:false, backgroundThrottling:false,
    autoplayPolicy:'no-user-gesture-required', preload:join(__dirname,'../preload/modSurface.js'),
    additionalArguments:[`--ve-surface=${owner}`]
  }})
  surfaces.add(win)
  const close = (): void => { if (!win.isDestroyed()) win.destroy() }
  parent.once('closed', close)
  const stop = subscribeModSwitches(() => { if (!sharedModOn(owner)) close() })
  win.once('closed', () => {
    surfaces.delete(win)
    parent.removeListener('closed', close)
    stop()
  })
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',event=>event.preventDefault())
  win.webContents.on('will-frame-navigate',event=>event.preventDefault())
  return win
}
