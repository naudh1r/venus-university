import { BrowserWindow, screen, type DesktopCapturerSource } from 'electron'
import { companionPoint, pointInRect, samePointerRect, type PointerRect } from '../../shared/companionPointer'
import { companionWindowBounds, stopCompanionWindowBounds } from './companionWindowBounds'

export interface PointerSource { id: string; displayId: string; rect: PointerRect; physical: boolean }
let aura: BrowserWindow | null = null
let auraReady: Promise<void> | null = null
let expires: ReturnType<typeof setTimeout> | undefined
let generation = 0
const SIZE = 88

export async function pointerSource(source: Pick<DesktopCapturerSource, 'id' | 'display_id'>): Promise<PointerSource | null> {
  if (source.id.startsWith('screen:')) {
    const display = screen.getAllDisplays().find(d => String(d.id) === source.display_id)
    return display ? { id: source.id, displayId: source.display_id, rect: { ...display.bounds }, physical: false } : null
  }
  const rect = await companionWindowBounds(source.id)
  return rect ? { id: source.id, displayId: '', rect, physical: true } : null
}

export function clearCompanionPointer(): void {
  generation++
  clearTimeout(expires)
  if (aura && !aura.isDestroyed()) aura.hide()
}
export function closeCompanionPointer(): void {
  stopCompanionWindowBounds()
  clearCompanionPointer()
  if (aura && !aura.isDestroyed()) aura.destroy()
  aura = null; auraReady = null
}

export async function pointCompanion(source: PointerSource | null, value: unknown, speaker: number, current: () => boolean, rapid = false): Promise<void> {
  if (!current()) return
  clearCompanionPointer()
  const point = companionPoint(value), token = generation
  if (!source || !point || !current()) return
  const live = source.physical ? await companionWindowBounds(source.id, point)
    : screen.getAllDisplays().find(d => String(d.id) === source.displayId)?.bounds
  if (!live || !samePointerRect(source.rect, live) || token !== generation || !current()) return
  const raw = pointInRect(point, live)
  const target = source.physical ? screen.screenToDipPoint(raw) : raw
  if (!screen.getAllDisplays().some(d => target.x >= d.bounds.x && target.x < d.bounds.x + d.bounds.width && target.y >= d.bounds.y && target.y < d.bounds.y + d.bounds.height)) return
  if (!aura || aura.isDestroyed()) {
    aura = new BrowserWindow({ width: SIZE, height: SIZE, show: false, frame: false, transparent: true,
      backgroundColor: '#00000000', hasShadow: false, resizable: false, movable: false, focusable: false,
      skipTaskbar: true, alwaysOnTop: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } })
    aura.setContentProtection(true)
    aura.setIgnoreMouseEvents(true, { forward: true })
    aura.setAlwaysOnTop(true, 'screen-saver')
    aura.setMenuBarVisibility(false)
    aura.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  }
  const win = aura
  const color = ['#ed9dc9', '#c6b2ff', '#9ddfdf'][Math.max(0, speaker) % 3]
  const duration = rapid ? 850 : 2600, ripple = rapid ? 360 : 1200
  if (!auraReady) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Venus pointing aura</title><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent;pointer-events:none}
.aura{position:absolute;inset:0;color:var(--aura-color, #ed9dc9);animation:fade var(--aura-duration, 2600ms) ease-out forwards}
.aura::before,.aura::after,.ring{content:'';position:absolute;inset:23px;border:2px solid currentColor;border-radius:50%;box-shadow:0 0 10px currentColor,inset 0 0 7px currentColor;animation:ripple var(--aura-ripple, 1200ms) ease-out infinite}
.aura::after{animation-delay:var(--aura-delay-one, 400ms)}.ring{animation-delay:var(--aura-delay-two, 800ms)}.dot{position:absolute;inset:39px;border:1px solid #fff;border-radius:50%;background:var(--aura-color, #ed9dc9);box-shadow:0 0 12px currentColor}
@keyframes ripple{from{transform:scale(.35);opacity:.9}to{transform:scale(1.8);opacity:0}}
@keyframes fade{0%{opacity:0}12%,70%{opacity:1}100%{opacity:0}}
@media(prefers-reduced-motion:reduce){.aura::before,.aura::after,.ring{animation:none;opacity:.45}.aura::after,.ring{display:none}}
</style></head><body><div class="aura" aria-label="Character pointing here"><span class="ring"></span><span class="dot"></span></div></body></html>`
    auraReady = win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  }
  win.setBounds({ x: target.x - SIZE / 2, y: target.y - SIZE / 2, width: SIZE, height: SIZE })
  try {
    await auraReady
    if (token !== generation || !current() || win.isDestroyed()) return
    await win.webContents.executeJavaScript(`(() => {
      const style = document.documentElement.style;
      style.setProperty('--aura-color', '${color}');
      style.setProperty('--aura-duration', '${duration}ms');
      style.setProperty('--aura-ripple', '${ripple}ms');
      style.setProperty('--aura-delay-one', '${ripple / 3}ms');
      style.setProperty('--aura-delay-two', '${ripple * 2 / 3}ms');
      const old = document.querySelector('.aura'); old.replaceWith(old.cloneNode(true));
    })()` )
  }
  catch { return }
  if (token !== generation || !current() || win.isDestroyed()) return
  win.showInactive()
  expires = setTimeout(() => { if (!win.isDestroyed()) win.hide() }, duration + 100)
}
