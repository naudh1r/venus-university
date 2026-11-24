import type { BrowserWindow, WebContents } from 'electron'
import type { CompanionFrameRequest } from '../../shared/screenCompanion'

let sequence = 0
let pending: { id: number; sender: WebContents; resolve: (bytes: Buffer) => void; reject: (error: Error) => void } | null = null

/** One reusable renderer-owned capture stream; only the requested frame crosses IPC. */
export function companionFrame(window: BrowserWindow, sourceId: string, signal: AbortSignal): Promise<Buffer> {
  if (signal.aborted || window.isDestroyed()) return Promise.reject(new Error('Screen capture stopped.'))
  if (pending) return Promise.reject(new Error('A screen capture is already pending.'))
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const finish = (bytes?: Buffer, error?: Error) => {
      clearTimeout(timer); signal.removeEventListener('abort', abort)
      if (pending?.id === id) pending = null
      if (error) reject(error); else resolve(bytes!)
    }
    const abort = () => finish(undefined, new Error('Screen capture stopped.'))
    const timer = setTimeout(() => finish(undefined, new Error('The shared screen did not deliver a frame. Restore it or choose another source.')), 10000)
    pending = { id, sender: window.webContents, resolve: bytes => finish(bytes), reject: error => finish(undefined, error) }
    signal.addEventListener('abort', abort, { once: true })
    const request: CompanionFrameRequest = { id, sourceId, width: 1280, height: 720 }
    window.webContents.send('surface:screen-companion:capture-request', request)
  })
}
export function receiveCompanionFrame(sender: WebContents, id: number, bytes: ArrayBuffer | null, error?: string): void {
  if (!pending || pending.id !== id || pending.sender !== sender) return
  if (error || !(bytes instanceof ArrayBuffer) || bytes.byteLength < 4 || bytes.byteLength > 4_000_000) {
    pending.reject(new Error(error?.slice(0, 200) || 'The screen frame was invalid.')); return
  }
  const buffer = Buffer.from(bytes)
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) { pending.reject(new Error('The screen frame was not a JPEG.')); return }
  pending.resolve(buffer)
}
export function stopCompanionCapture(window: BrowserWindow | null): void {
  pending?.reject(new Error('Screen capture stopped.'))
  if (window && !window.isDestroyed()) window.webContents.send('surface:screen-companion:capture-request', null)
}
