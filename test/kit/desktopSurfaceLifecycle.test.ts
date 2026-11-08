import { expect, it, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
const control = vi.hoisted(()=>({on:true,listener:null as null|(()=>void)}))
class Window extends EventEmitter {
  static root: Window
  static getAllWindows(){return [Window.root]}
  dead=false
  webContents={setWindowOpenHandler:vi.fn(),on:vi.fn()}
  constructor(public options: Record<string,unknown>={}){super()}
  isDestroyed(){return this.dead}
  destroy(){this.dead=true;this.emit('closed')}
}
vi.mock('electron',()=>({BrowserWindow:Window}))
vi.mock('@shared/mods',()=>({modById:(id:string)=>id==='test-surface'?{id}:undefined}))
vi.mock('@shared/modRules',()=>({sharedModOn:()=>control.on}))
vi.mock('../../src/main/services/modsService',()=>({subscribeModSwitches:(listener:()=>void)=>{control.listener=listener;return ()=>{control.listener=null}}}))
const {createDesktopSurface}=await import('../../src/main/mods/desktopSurface')
beforeEach(()=>{Window.root=new Window();control.on=true;control.listener=null})
it('parents the sandboxed surface and destroys it with the game window',()=>{
  const win=createDesktopSurface('test-surface',{}) as unknown as Window
  expect(win.options.parent).toBe(Window.root)
  expect(win.options.webPreferences).toMatchObject({sandbox:true,contextIsolation:true,nodeIntegration:false})
  Window.root.destroy()
  expect(win.dead).toBe(true)
  expect(control.listener).toBeNull()
})
it('destroys the surface when its mod is disabled and removes ownership listeners',()=>{
  const win=createDesktopSurface('test-surface',{}) as unknown as Window
  control.on=false;control.listener!()
  expect(win.dead).toBe(true)
  expect(Window.root.listenerCount('closed')).toBe(0)
  expect(control.listener).toBeNull()
})
it('refuses unknown and disabled owners',()=>{
  expect(()=>createDesktopSurface('unknown',{})).toThrow()
  control.on=false
  expect(()=>createDesktopSurface('test-surface',{})).toThrow()
})

