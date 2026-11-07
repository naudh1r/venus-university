import { afterEach, expect, it, vi } from 'vitest'
import { companionFrame, receiveCompanionFrame, stopCompanionCapture } from '../src/main/services/companionCapture'
import { installCompanionCapture } from '../src/renderer/companionCapture'
import type { CompanionFrameRequest } from '../src/shared/screenCompanion'
afterEach(() => { stopCompanionCapture(null); vi.unstubAllGlobals() })
it('accepts only the requested frame from its owning window and discards a canceled frame', async () => {
  const sender = { send: vi.fn() }, window = { isDestroyed: () => false, webContents: sender } as any
  const abort = new AbortController()
  const result = companionFrame(window, 'screen:0:0', abort.signal)
  const id = sender.send.mock.calls[0][1].id
  receiveCompanionFrame({} as any, id, new Uint8Array([255,216,255,217]).buffer)
  await expect(companionFrame(window, 'screen:0:0', abort.signal)).rejects.toThrow('already pending')
  receiveCompanionFrame(sender as any, id, new Uint8Array([255,216,255,217]).buffer)
  expect(await result).toEqual(Buffer.from([255,216,255,217]))
  const pending = companionFrame(window, 'screen:0:0', abort.signal)
  abort.abort()
  await expect(pending).rejects.toThrow('stopped')
  receiveCompanionFrame(sender as any, id + 1, new Uint8Array([255,216,255,217]).buffer)
})
it('reuses one track and canvas across a long run and releases capture on stop', async () => {
  const track = { readyState: 'live', stop: vi.fn() }
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] }
  const getUserMedia = vi.fn(async () => stream)
  const video = { videoWidth: 1920, videoHeight: 1080, srcObject: null, play: vi.fn(async () => {}), pause: vi.fn() }
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn() }), toBlob: (done: (blob: Blob) => void) => done(new Blob([new Uint8Array([255,216,255,217])])) }
  const createElement = vi.fn((tag: string) => tag === 'video' ? video : canvas)
  vi.stubGlobal('document', { createElement }); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } })
  let receive!: (request: CompanionFrameRequest | null) => void
  const frame = vi.fn(async () => ({ ok: true as const, data: undefined }))
  const dispose = installCompanionCapture({ onFrameRequest: listener => { receive = listener; return () => {} }, frame })
  for (let id = 1; id <= 100; id++) {
    receive({ id, sourceId: 'screen:0:0', width: 1280, height: 720 })
    await vi.waitFor(() => expect(frame).toHaveBeenCalledTimes(id), { interval: 1 })
  }
  expect(getUserMedia).toHaveBeenCalledTimes(1)
  expect(createElement).toHaveBeenCalledTimes(2)
  expect(canvas.width).toBe(1280); expect(canvas.height).toBe(720)
  receive(null)
  expect(track.stop).toHaveBeenCalledTimes(1)
  expect(video.srcObject).toBeNull()
  expect(canvas.width).toBe(0)
  dispose()
})
