import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { companionPoint, pointInRect } from '../src/shared/companionPointer'
const mock = vi.hoisted(() => ({
  windows: [] as any[],
  displays: [{ id: 7, bounds: { x: -1920, y: 0, width: 1920, height: 1080 } }],
  windowBounds: vi.fn(),
  toDip: vi.fn((p: { x: number; y: number }) => ({ x: Math.round(p.x / 2), y: Math.round(p.y / 2) }))
}))
vi.mock('electron', () => ({
  BrowserWindow: class {
    options: unknown; bounds: unknown; destroyed = false
    hide = vi.fn(); showInactive = vi.fn(); setContentProtection = vi.fn(); setIgnoreMouseEvents = vi.fn()
    setAlwaysOnTop = vi.fn(); setMenuBarVisibility = vi.fn(); loadURL = vi.fn(async () => {})
    webContents = { setWindowOpenHandler: vi.fn(), executeJavaScript: vi.fn(async () => {}) }
    constructor(options: unknown) { this.options = options; mock.windows.push(this) }
    setBounds(bounds: unknown) { this.bounds = bounds }
    isDestroyed() { return this.destroyed }
    destroy() { this.destroyed = true }
  },
  screen: { getAllDisplays: () => mock.displays, screenToDipPoint: mock.toDip }
}))
vi.mock('../src/main/services/companionWindowBounds', () => ({ companionWindowBounds: mock.windowBounds, stopCompanionWindowBounds: vi.fn() }))
import { pointerSource, pointCompanion, clearCompanionPointer, closeCompanionPointer } from '../src/main/services/companionPointer'
beforeEach(() => { vi.useFakeTimers(); mock.windows.length = 0; mock.windowBounds.mockReset(); mock.toDip.mockClear() })
afterEach(() => { closeCompanionPointer(); vi.useRealTimers() })

it('rejects invalid or hallucinated coordinates without changing a valid conversation', () => {
  for (const value of [null, {}, { x: -0.1, y: 0.5 }, { x: 1.1, y: 0 }, { x: NaN, y: 0 }, { x: '0.5', y: 0 }, { x: 0, y: Infinity }]) expect(companionPoint(value)).toBeNull()
  expect(companionPoint({ x: 0, y: 1 })).toEqual({ x: 0, y: 1 })
  expect(pointInRect({ x: 1, y: 1 }, { x: -1920, y: 0, width: 1920, height: 1080 })).toEqual({ x: -1, y: 1079 })
})
it('uses the selected monitor including negative coordinates, never primary as a fallback', async () => {
  expect(await pointerSource({ id: 'screen:missing:0', display_id: '' })).toBeNull()
  const source = await pointerSource({ id: 'screen:0:0', display_id: '7' })
  await pointCompanion(source, { x: 0.5, y: 0.5 }, 0, () => true)
  const win = mock.windows[0]
  expect(win.bounds).toEqual({ x: -1004, y: 496, width: 88, height: 88 })
  expect(win.options).toMatchObject({ focusable: false, transparent: true, skipTaskbar: true })
  expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true })
  expect(win.setContentProtection).toHaveBeenCalledWith(true)
  expect(win.showInactive).toHaveBeenCalledOnce()
  vi.advanceTimersByTime(2700)
  expect(win.hide).toHaveBeenCalledOnce()
})
it('maps a window from physical pixels to DIPs and suppresses moved, hidden, or covered targets', async () => {
  const rect = { x: -2000, y: 100, width: 1000, height: 600 }
  mock.windowBounds.mockResolvedValue(rect)
  const source = await pointerSource({ id: 'window:123:0', display_id: '' })
  await pointCompanion(source, { x: 0.5, y: 0.5 }, 1, () => true)
  expect(mock.toDip).toHaveBeenCalledWith({ x: -1500, y: 400 })
  expect(mock.windows[0].bounds).toMatchObject({ x: -794, y: 156 })
  mock.windowBounds.mockResolvedValueOnce({ ...rect, x: -1900 })
  await pointCompanion(source, { x: 0.5, y: 0.5 }, 1, () => true)
  mock.windowBounds.mockResolvedValueOnce(null)
  await pointCompanion(source, { x: 0.5, y: 0.5 }, 1, () => true)
  expect(mock.windows[0].showInactive).toHaveBeenCalledTimes(1)
})
it('does not resurrect a pointer after sharing is paused or closed during a bounds lookup', async () => {
  const rect = { x: -2000, y: 100, width: 1000, height: 600 }
  mock.windowBounds.mockResolvedValueOnce(rect)
  const source = await pointerSource({ id: 'window:123:0', display_id: '' })
  let finish!: (value: unknown) => void
  mock.windowBounds.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const pending = pointCompanion(source, { x: 0.5, y: 0.5 }, 2, () => true)
  clearCompanionPointer(); finish(rect); await pending
  expect(mock.windows).toHaveLength(0)
  await pointCompanion(source, { x: 0.5, y: 0.5 }, 0, () => false)
  expect(mock.windows).toHaveLength(0)
})

it('retires a rapid highlight in under a second and ignores a stale callback without hiding the new highlight', async () => {
  const source = await pointerSource({ id: 'screen:0:0', display_id: '7' })
  await pointCompanion(source, { x: 0.4, y: 0.5 }, 0, () => true, true)
  const win = mock.windows[0]
  const hides = win.hide.mock.calls.length
  await pointCompanion(source, { x: 0.7, y: 0.1 }, 0, () => false, true)
  expect(win.hide).toHaveBeenCalledTimes(hides)
  vi.advanceTimersByTime(949)
  expect(win.hide).toHaveBeenCalledTimes(hides)
  vi.advanceTimersByTime(1)
  expect(win.hide).toHaveBeenCalledTimes(hides + 1)
})

it('reuses one loaded aura page across many generations', async () => {
  const source = await pointerSource({ id: 'screen:0:0', display_id: '7' })
  for (let n = 0; n < 100; n++) await pointCompanion(source, { x: 0.4, y: 0.5 }, 0, () => true, true)
  expect(mock.windows).toHaveLength(1)
  expect(mock.windows[0].loadURL).toHaveBeenCalledTimes(1)
  expect(mock.windows[0].webContents.executeJavaScript).toHaveBeenCalledTimes(100)
})
