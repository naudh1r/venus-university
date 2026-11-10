import { screen, type BrowserWindow } from 'electron'

type Layout = { padding: number; characterWidth: number }
/** Native drag regions can swallow forwarded mousemove events on Windows. Read
 * the desktop cursor directly, without activating the overlay or polling the renderer. */
export function watchCompanionMoveHandles(windows: readonly BrowserWindow[], layout: () => Layout): () => void {
  const previous = new Map<number, { visible: boolean; interactive: boolean }>()
  const update = () => {
    const point = screen.getCursorScreenPoint()
    const { padding, characterWidth } = layout()
    for (const win of windows) {
      if (win.isDestroyed()) continue
      const bounds = win.getBounds()
      const x = point.x - bounds.x, y = point.y - bounds.y
      const width = Math.min(characterWidth, bounds.width)
      const left = (bounds.width - width) / 2
      const top = padding - 10
      const visible = win.isVisible() && x >= left && x <= left + width && y >= top && y <= bounds.height - 10
      const interactive = visible && x >= left + width - 38 && x <= left + width - 8 && y >= top + 6 && y <= top + 36
      const old = previous.get(win.id)
      if (!old || old.visible !== visible) win.webContents.send('surface:screen-companion:move-handle', visible)
      if (!old || old.interactive !== interactive) win.setIgnoreMouseEvents(!interactive, { forward: true })
      previous.set(win.id, { visible, interactive })
    }
  }
  update()
  const timer = setInterval(update, 80)
  timer.unref()
  return () => {
    clearInterval(timer)
    for (const win of windows) if (!win.isDestroyed()) win.webContents.send('surface:screen-companion:move-handle', false)
    previous.clear()
  }
}
