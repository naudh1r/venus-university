import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ complete: vi.fn(), frame: vi.fn(), windows: [] as any[] }))
const area = { x: 0, y: 0, width: 1920, height: 1080 }
class Window extends EventEmitter {
  dead = false
  visible = false
  throttled = true
  parent: Window | null
  bounds = { ...area }
  webContents = Object.assign(new EventEmitter(), { id: 1, send: vi.fn(), setZoomFactor: vi.fn(), getBackgroundThrottling: () => this.throttled, setBackgroundThrottling: (value: boolean) => { this.throttled = value } })
  constructor(public options: Record<string, any> = {}) { super(); this.parent = options.parent ?? null }
  setParentWindow(parent: Window | null) { this.parent = parent }
  getParentWindow() { return this.parent }
  isDestroyed() { return this.dead }
  destroy() { if (!this.dead) { this.dead = true; this.emit('closed') } }
  show() { this.visible = true }
  showInactive() { this.visible = true }
  hide() { this.visible = false; this.emit('hide') }
  focus() {}
  isFocused() { return false }
  isVisible() { return this.visible }
  getBounds() { return this.bounds }
  setBounds(bounds: typeof area) { this.bounds = bounds }
  setContentProtection() {}
  setMenuBarVisibility() {}
  setAlwaysOnTop() {}
  setIgnoreMouseEvents() {}
  loadFile() { return Promise.resolve() }
  loadURL() { return Promise.resolve() }
}
vi.mock('electron', () => ({
  app: {}, BrowserWindow: Window,
  screen: { getPrimaryDisplay: () => ({ workArea: area, size: area, scaleFactor: 1 }), getDisplayMatching: () => ({ workArea: area }) },
  powerMonitor: new EventEmitter(), globalShortcut: { register: () => true, unregister: vi.fn() },
  desktopCapturer: { getSources: async () => [{ id: 'screen:fixture', display_id: '1', name: 'Synthetic source' }] }
}))
vi.mock('@vx/modkit/main', () => ({
  createDesktopSurface: (_id: string, options: Record<string, any>) => {
    const win = new Window({ ...options, parent: mocks.windows[0] }); mocks.windows.push(win); return win
  },
  hasExpressionArt: async () => true,
  completeModStructured: (...args: unknown[]) => mocks.complete(...args)
}))
vi.mock('../src/main/services/companionCapture', () => ({
  companionFrame: (...args: unknown[]) => mocks.frame(...args), receiveCompanionFrame: vi.fn(), stopCompanionCapture: vi.fn()
}))
vi.mock('../src/main/services/companionPointer', () => ({ pointerSource: async () => null, pointCompanion: vi.fn(), clearCompanionPointer: vi.fn(), closeCompanionPointer: vi.fn() }))
vi.mock('../src/main/services/companionMoveHandle', () => ({ watchCompanionMoveHandles: () => () => {} }))
vi.mock('../src/main/services/companionDictation', () => ({ openWindowsDictation: vi.fn() }))
vi.mock('../src/main/services/companionVoice', () => ({ getCompanionVoice: async () => ({}), onVoiceSettings: () => () => {}, saveCompanionVoice: vi.fn(), transcribeCompanionAudio: vi.fn(), synthesizeCompanionSpeech: vi.fn() }))

const {
  openCompanion, closeCompanion, companionState, companionCharacters, companionDocument,
  previewCompanion, startCompanion, pauseCompanion, pauseCompanionConversation,
  takeCompanionTurn, captureCompanionDesktop, acknowledgeCompanion
} = await import('../src/main/screenCompanion')
const context = JSON.stringify({ scene: { kind: 'story' }, profiles: { girl: { charId: 'girl', firstName: 'Synthetic', lastName: 'Participant' } }, characters: { girl: {} }, sprites: { girl: { neutral: 'fixture' } } })
beforeEach(() => {
  vi.useFakeTimers(); mocks.windows = [new Window()]; mocks.complete.mockReset(); mocks.frame.mockReset()
  mocks.frame.mockResolvedValue(Buffer.from([255, 216, 255, 217]))
  openCompanion(mocks.windows[0], context, 'fixture-scene')
})
afterEach(() => { closeCompanion(); vi.useRealTimers() })

it('detaches every companion window from native game ownership but still closes them with the game', async () => {
  expect(mocks.windows).toHaveLength(6)
  expect(mocks.windows.slice(1).every(win => win.getParentWindow() === null)).toBe(true)
  await previewCompanion('girl', 'neutral')
  expect(mocks.windows[2].visible).toBe(true)
  mocks.windows[0].destroy()
  expect(mocks.windows.slice(1).every(win => win.isDestroyed())).toBe(true)
})

it('labels an unknown scene participant without exposing her name in selectors or overlays', async () => {
  expect(await companionCharacters()).toEqual([{ charId: 'girl', name: 'Unknown character 1', onScreen: false }])
  await previewCompanion('girl', 'neutral')
  expect(companionState().members[0].name).toBe('Unknown character 1')
})

it('keeps Creator acknowledgements responsive in the background and restores the prior timer policy', () => {
  const owner = mocks.windows[0]
  expect(owner.throttled).toBe(false)
  closeCompanion()
  expect(owner.throttled).toBe(true)
  owner.throttled = false
  openCompanion(owner, JSON.stringify({ ...JSON.parse(context), scene: { kind: 'creator' } }), 'creator-fixture')
  expect(owner.throttled).toBe(false)
  closeCompanion()
  expect(owner.throttled).toBe(false)
})

it.each(['The API key was rejected.', 'This model does not support images.'])('preserves provider error: %s', async message => {
  mocks.complete.mockRejectedValue(new Error(message))
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(3000)
  expect(companionState()).toMatchObject({ sharing: false, busy: false, error: message })
})

it('preserves the capture failure instead of reporting a model timeout', async () => {
  mocks.frame.mockRejectedValue(new Error('The selected window was closed.'))
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(3000)
  expect(companionState().error).toBe('The selected window was closed.')
  expect(mocks.complete).not.toHaveBeenCalled()
})

it('includes the complete current uploaded reference in the vision request', async () => {
  companionDocument('reference.txt', 'CURRENT SYNTHETIC REFERENCE CONTENT')
  mocks.complete.mockRejectedValue(new Error('Synthetic provider stop.'))
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(3000)
  expect(JSON.parse(mocks.complete.mock.calls[0][0].user).documentReference).toEqual({ name: 'reference.txt', text: 'CURRENT SYNTHETIC REFERENCE CONTENT' })
})

it('reports a timeout only when the reaction deadline actually fires', async () => {
  mocks.complete.mockImplementation((_request, signal: AbortSignal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Request aborted.')), { once: true })))
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(63001)
  expect(companionState()).toMatchObject({ sharing: false, busy: false, error: 'The reaction timed out. Sharing is paused.' })
})

it('does not show a timeout when the player pauses an in-flight reaction', async () => {
  mocks.complete.mockImplementation((_request, signal: AbortSignal) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('Request aborted.')), { once: true })))
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(3000)
  pauseCompanion()
  await vi.advanceTimersByTimeAsync(60001)
  expect(companionState()).toMatchObject({ sharing: false, busy: false, error: '' })
})

it('does not capture or infer until three seconds after starting, and can cancel the countdown', async () => {
  mocks.complete.mockRejectedValue(new Error('Synthetic stop.'))
  await startCompanion('girl', 'screen:fixture', 20)
  expect(companionState().startingIn).toBe(3)
  await vi.advanceTimersByTimeAsync(1000)
  expect(companionState().startingIn).toBe(2)
  await vi.advanceTimersByTimeAsync(1999)
  expect(mocks.frame).not.toHaveBeenCalled()
  expect(mocks.complete).not.toHaveBeenCalled()
  pauseCompanion()
  await vi.advanceTimersByTimeAsync(10000)
  expect(mocks.frame).not.toHaveBeenCalled()
  await startCompanion('girl', 'screen:fixture', 20)
  await vi.advanceTimersByTimeAsync(2999)
  expect(mocks.frame).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  expect(mocks.frame).toHaveBeenCalledTimes(1)
  expect(mocks.complete).toHaveBeenCalledTimes(1)
})

it('withdraws an unacknowledged reply when chat pauses, then delivers a fresh Creator turn on resume', async () => {
  openCompanion(mocks.windows[0], JSON.stringify({ ...JSON.parse(context), scene: { kind: 'creator' } }), 'creator')
  const line = { charId: 'girl', emotion: 'happy', text: 'That changed.' }
  mocks.complete.mockResolvedValue({ lines: [line] })
  await startCompanion('girl', 'screen:fixture', 5)
  await vi.advanceTimersByTimeAsync(3000)
  const first = takeCompanionTurn('creator')!
  expect(first.lines).toEqual([expect.objectContaining(line)])
  pauseCompanionConversation(true)
  expect(takeCompanionTurn('creator')).toBeNull()
  pauseCompanionConversation(false)
  await vi.advanceTimersByTimeAsync(1)
  const fresh = takeCompanionTurn('creator')!
  expect(fresh.id).toBeGreaterThan(first.id)
  acknowledgeCompanion(mocks.windows[0].webContents, 'creator', first.id, true)
  expect(takeCompanionTurn('creator')).toBe(fresh)
  acknowledgeCompanion(mocks.windows[0].webContents, 'creator', fresh.id, true)
  await vi.advanceTimersByTimeAsync(1)
  expect(companionState().text).toBe(line.text)
})

it('clears an elapsed countdown when chat resumes after its start time', async () => {
  mocks.complete.mockResolvedValue({ lines: [] })
  await startCompanion('girl', 'screen:fixture', 5)
  await vi.advanceTimersByTimeAsync(1000)
  pauseCompanionConversation(true)
  await vi.advanceTimersByTimeAsync(5000)
  expect(mocks.frame).not.toHaveBeenCalled()
  pauseCompanionConversation(false)
  await vi.advanceTimersByTimeAsync(1)
  expect(mocks.frame).toHaveBeenCalledTimes(1)
  expect(companionState().startingIn).toBe(0)
})

it('releases a timed-out provider call even if it ignores cancellation and later answers', async () => {
  let finish!: (reply: unknown) => void
  mocks.complete.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  await startCompanion('girl', 'screen:fixture', 5)
  await vi.advanceTimersByTimeAsync(63000)
  try {
    expect(companionState()).toMatchObject({ busy: false, sharing: false, error: 'The reaction timed out. Sharing is paused.' })
  } finally {
    finish({ lines: [] })
    await vi.advanceTimersByTimeAsync(10000)
  }
  expect(takeCompanionTurn('fixture-scene')).toBeNull()
  expect(mocks.frame).toHaveBeenCalledTimes(1)
})

it('cancels a souvenir screenshot when its session closes during the exposure delay', async () => {
  const { desktopCapturer } = await import('electron')
  const sources = vi.spyOn(desktopCapturer, 'getSources').mockRejectedValue(new Error('Unexpected desktop access'))
  try {
    await previewCompanion('girl', 'neutral')
    const capture = captureCompanionDesktop(3).catch(error => error)
    await vi.advanceTimersByTimeAsync(3000)
    closeCompanion()
    await vi.advanceTimersByTimeAsync(350)
    expect(sources).not.toHaveBeenCalled()
    expect(await capture).toBeInstanceOf(Error)
  } finally { sources.mockRestore() }
})
