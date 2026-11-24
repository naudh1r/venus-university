import { useEffect } from 'react'
import type { CompanionApi, CompanionFrameRequest } from '../shared/screenCompanion'

/** Reuse the selected desktop track and canvas instead of restarting capture for every reply. */
export function installCompanionCapture(api: Pick<CompanionApi, 'onFrameRequest' | 'frame'>): () => void {
  let stream: MediaStream | null = null, source = '', generation = 0
  let opening: Promise<void> | null = null
  const video = document.createElement('video'), canvas = document.createElement('canvas')
  video.muted = true; video.playsInline = true
  const stop = () => {
    generation++; stream?.getTracks().forEach(track => track.stop())
    stream = null; source = ''; opening = null; video.pause(); video.srcObject = null
    canvas.width = 0; canvas.height = 0
  }
  async function prepare(request: CompanionFrameRequest) {
    if (source !== request.sourceId) stop()
    if (stream?.getVideoTracks()[0]?.readyState === 'live') return
    if (opening) return opening
    source = request.sourceId
    const current = generation
    opening = (async () => {
      const next = await navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: {
        chromeMediaSource: 'desktop', chromeMediaSourceId: request.sourceId,
        maxWidth: request.width, maxHeight: request.height, maxFrameRate: 1
      } } as MediaTrackConstraints })
      if (current !== generation) { next.getTracks().forEach(track => track.stop()); throw Error('Screen capture stopped.') }
      stream = next; video.srcObject = next
      await video.play()
    })()
    try { await opening } finally { if (current === generation) opening = null }
  }
  async function frame(request: CompanionFrameRequest) {
    try {
      await prepare(request)
      const current = generation
      if (!video.videoWidth || !video.videoHeight || !stream) throw Error('The shared window is unavailable. Restore it or choose another source.')
      const scale = Math.min(1, request.width / video.videoWidth, request.height / video.videoHeight)
      const width = Math.max(1, Math.round(video.videoWidth * scale)), height = Math.max(1, Math.round(video.videoHeight * scale))
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height }
      canvas.getContext('2d', { alpha: false })!.drawImage(video, 0, 0, width, height)
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(Error('Could not capture the shared screen.')), 'image/jpeg', .75))
      if (current !== generation) return
      await api.frame(request.id, await blob.arrayBuffer())
    } catch (error) { await api.frame(request.id, null, error instanceof Error ? error.message : 'Screen capture failed.') }
  }
  const off = api.onFrameRequest(request => { if (request) void frame(request); else stop() })
  return () => { off(); stop() }
}
export function useCompanionCapture(api: CompanionApi, enabled: boolean): void {
  useEffect(() => enabled ? installCompanionCapture(api) : undefined, [api, enabled])
}
