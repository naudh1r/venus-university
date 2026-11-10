import { afterEach, expect, it, vi } from 'vitest'
import { companionOverlayLayout } from '../src/shared/screenCompanion'
const cursor = vi.hoisted(() => ({ x: 0, y: 0 }))
vi.mock('electron', () => ({ screen: { getCursorScreenPoint: () => cursor } }))
import { watchCompanionMoveHandles } from '../src/main/services/companionMoveHandle'
afterEach(() => { vi.useRealTimers() })
it('finds the hover and native drag target without any DOM events, including a partly offscreen girl', () => {
  vi.useFakeTimers()
  let layout = companionOverlayLayout(520, 100, false)
  const bounds = { x: -900, y: 850, width: layout.width, height: 630 }
  const win = { id: 1, isDestroyed: () => false, isVisible: () => true, getBounds: () => bounds,
    webContents: { send: vi.fn() }, setIgnoreMouseEvents: vi.fn() }
  const stop = watchCompanionMoveHandles([win as any], () => layout)
  cursor.x = bounds.x + bounds.width / 2; cursor.y = bounds.y + layout.padding + 15
  vi.advanceTimersByTime(80)
  expect(win.webContents.send).toHaveBeenLastCalledWith('surface:screen-companion:move-handle', true)
  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true })
  cursor.x = bounds.x + bounds.width - 20
  vi.advanceTimersByTime(80)
  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false, { forward: true })
  const sent = win.webContents.send.mock.calls.length, switches = win.setIgnoreMouseEvents.mock.calls.length
  vi.advanceTimersByTime(1600)
  expect(win.webContents.send).toHaveBeenCalledTimes(sent)
  expect(win.setIgnoreMouseEvents).toHaveBeenCalledTimes(switches)
  // A larger rapid message area changes both the native window and the handle's local coordinates.
  layout = companionOverlayLayout(520, 200, true)
  bounds.width = layout.width; bounds.height = 520 + layout.padding; bounds.y = 500
  cursor.x = bounds.x + (bounds.width + layout.characterWidth) / 2 - 20
  cursor.y = bounds.y + layout.padding + 15
  vi.advanceTimersByTime(80)
  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false, { forward: true })
  cursor.y = bounds.y + 5
  vi.advanceTimersByTime(80)
  expect(win.webContents.send).toHaveBeenLastCalledWith('surface:screen-companion:move-handle', false)
  expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true })
  stop()
  expect(vi.getTimerCount()).toBe(0)
})
it('tracks up to three overlays independently and ignores hidden or destroyed girls', () => {
  vi.useFakeTimers()
  const layout = companionOverlayLayout(520, 100, false)
  const windows = [0, 1, 2].map(id => ({ id, isDestroyed: () => id === 2, isVisible: () => id !== 1,
    getBounds: () => ({ x: id * 400, y: 0, width: layout.width, height: 630 }),
    webContents: { send: vi.fn() }, setIgnoreMouseEvents: vi.fn() }))
  cursor.x = 800; cursor.y = 150
  const stop = watchCompanionMoveHandles(windows as any, () => layout)
  expect(windows[0].webContents.send).toHaveBeenLastCalledWith('surface:screen-companion:move-handle', false)
  expect(windows[1].webContents.send).toHaveBeenLastCalledWith('surface:screen-companion:move-handle', false)
  expect(windows[2].webContents.send).not.toHaveBeenCalled()
  cursor.x = 340; cursor.y = 120; vi.advanceTimersByTime(80)
  expect(windows[0].setIgnoreMouseEvents).toHaveBeenLastCalledWith(false, { forward: true })
  expect(windows[1].setIgnoreMouseEvents).toHaveBeenLastCalledWith(true, { forward: true })
  stop()
})
