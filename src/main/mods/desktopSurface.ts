import { BrowserWindow, type BrowserWindowConstructorOptions } from 'electron'
import { join } from 'node:path'
import { SURFACE_NAME } from '@shared/desktopSurface'

/** Create a local auxiliary window with the host preload and a channel namespace bound at launch. */
export function createDesktopSurface(owner: string, options: Omit<BrowserWindowConstructorOptions,'webPreferences'>): BrowserWindow {
  if (!SURFACE_NAME.test(owner)) throw Error('Invalid mod surface owner')
  const win = new BrowserWindow({...options, webPreferences:{
    sandbox:true, contextIsolation:true, nodeIntegration:false, backgroundThrottling:false,
    autoplayPolicy:'no-user-gesture-required', preload:join(__dirname,'../preload/modSurface.js'),
    additionalArguments:[`--ve-surface=${owner}`]
  }})
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}))
  win.webContents.on('will-navigate',event=>event.preventDefault())
  win.webContents.on('will-frame-navigate',event=>event.preventDefault())
  return win
}
