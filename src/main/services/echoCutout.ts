import { BrowserWindow } from 'electron'
import { join } from 'path'
import { assertEchoPng, ECHO_CUTOUT_PREPARE_ERROR } from '../../shared/echoArtwork'

let host: BrowserWindow | null = null

/** Only the sandboxed segmentation page is destroyed; never a player's game window. */
export function releaseEchoCutout(): void {
  if (host && !host.isDestroyed()) host.destroy()
  host = null
}

async function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted()
  let stop: () => void = () => {}
  const cancelled = new Promise<never>((_resolve, reject) => {
    stop = () => { releaseEchoCutout(); reject(new DOMException('Generation cancelled.', 'AbortError')) }
    signal.addEventListener('abort', stop, { once: true })
  })
  try { return await Promise.race([work, cancelled]) }
  finally { signal.removeEventListener('abort', stop) }
}

/** Initialize the portable model before any paid request; no Python, GPU or ComfyUI needed. */
export async function prepareEchoCutout(signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  releaseEchoCutout()
  const parent = BrowserWindow.getAllWindows().find(window => window.isVisible())
  const owned = new BrowserWindow({ show: false, ...(parent ? { parent } : {}), webPreferences: {
    sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false
  } })
  host = owned
  owned.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  owned.webContents.on('will-navigate', event => event.preventDefault())
  const closeWithParent = (): void => { if (!owned.isDestroyed()) owned.destroy() }
  parent?.once('closed', closeWithParent)
  owned.once('closed', () => parent?.removeListener('closed', closeWithParent))
  try {
    const loading = process.env.ELECTRON_RENDERER_URL
      ? owned.loadURL(`${process.env.ELECTRON_RENDERER_URL}/echoCutout.html`)
      : owned.loadFile(join(__dirname, '../renderer/echoCutout.html'))
    await abortable(loading, signal)
    await abortable(owned.webContents.executeJavaScript('window.echoCutout.prepare()'), signal)
  } catch (error) {
    releaseEchoCutout()
    signal.throwIfAborted()
    throw new Error(ECHO_CUTOUT_PREPARE_ERROR, { cause: error })
  }
}

export async function cutoutEchoImage(png: Uint8Array, signal: AbortSignal): Promise<Uint8Array> {
  signal.throwIfAborted()
  assertEchoPng(png)
  if (!host || host.isDestroyed()) throw Error('The Echo background remover is no longer available.')
  const result: unknown = await abortable(host.webContents.executeJavaScript(`window.echoCutout.cutout(${JSON.stringify(Buffer.from(png).toString('base64'))})`), signal)
  if (typeof result !== 'string' || result.length > 28 * 1024 * 1024) throw Error('Invalid Echo cutout response.')
  const bytes = Buffer.from(result, 'base64')
  assertEchoPng(bytes)
  return bytes
}
