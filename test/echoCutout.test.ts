import { beforeEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ options: [] as unknown[], windows: [] as any[], load: vi.fn(), execute: vi.fn() }))
vi.mock('electron', () => ({ BrowserWindow: class {
  static getAllWindows() { return [] }
  destroyed = false
  webContents = { setWindowOpenHandler: vi.fn(), on: vi.fn(), executeJavaScript: mocks.execute }
  constructor(options: unknown) { mocks.options.push(options); mocks.windows.push(this) }
  loadFile = mocks.load
  loadURL = mocks.load
  once() { return this }
  isDestroyed() { return this.destroyed }
  destroy() { this.destroyed = true }
} }))
import { prepareEchoCutout, cutoutEchoImage, releaseEchoCutout } from '../src/main/services/echoCutout'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64')
beforeEach(() => { releaseEchoCutout(); vi.resetAllMocks(); mocks.options.length = 0; mocks.windows.length = 0 })
it('uses a hidden sandbox without a game preload or Python runtime', async () => {
  await prepareEchoCutout(new AbortController().signal)
  expect(mocks.options[0]).toMatchObject({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } })
  expect(mocks.options[0]).not.toHaveProperty('webPreferences.preload')
  expect(mocks.execute).toHaveBeenCalledWith('window.echoCutout.prepare()')
})
it('fails preparation before asking the image API and closes the failed helper', async () => {
  mocks.execute.mockRejectedValueOnce(Error('offline'))
  await expect(prepareEchoCutout(new AbortController().signal)).rejects.toThrow('no image API request')
  expect(mocks.windows[0].destroyed).toBe(true)
})
it('cancels a loading helper and permits a fresh attempt', async () => {
  mocks.load.mockImplementationOnce(() => new Promise(() => {}))
  const controller = new AbortController(), pending = prepareEchoCutout(controller.signal)
  controller.abort()
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.windows[0].destroyed).toBe(true)
  await expect(prepareEchoCutout(new AbortController().signal)).resolves.toBeUndefined()
})
it('accepts only bounded PNG responses and releases only its helper', async () => {
  await prepareEchoCutout(new AbortController().signal)
  mocks.execute.mockResolvedValueOnce(png.toString('base64'))
  expect(await cutoutEchoImage(png, new AbortController().signal)).toEqual(png)
  mocks.execute.mockResolvedValueOnce('bad')
  await expect(cutoutEchoImage(png, new AbortController().signal)).rejects.toThrow('PNG')
  releaseEchoCutout()
  expect(mocks.windows[0].destroyed).toBe(true)
})
it('does not launch a helper for an already cancelled request', async () => {
  const controller = new AbortController(); controller.abort()
  await expect(prepareEchoCutout(controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  expect(mocks.options).toHaveLength(0)
})
