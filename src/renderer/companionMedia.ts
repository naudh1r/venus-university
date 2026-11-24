import { useCallback, useEffect, useRef, useState } from 'react'
import type { CompanionApi, CompanionState } from '../shared/screenCompanion'
import type { Result } from '@vx/modkit/shared'

export async function companionResult<T>(result: Promise<Result<T>>): Promise<T> {
  const value = await result
  if (!value.ok) throw new Error(value.error.message)
  return value.data
}

/** One hidden quick-chat page owns playback, so three overlays never speak over each other. */
export function useCompanionPlayback(api: Pick<CompanionApi, 'onAudio' | 'audioDone'>, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return
    let playing: HTMLAudioElement | undefined
    let url: string | undefined
    const stop = (): void => {
      if (playing) { playing.onended = null; playing.onerror = null; playing.pause(); playing.removeAttribute('src'); playing.load() }
      if (url) URL.revokeObjectURL(url)
      playing = undefined; url = undefined
    }
    const off = api.onAudio(clip => {
      stop()
      if (!clip) return
      try {
        const bytes = Uint8Array.from(atob(clip.data), c => c.charCodeAt(0))
        url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }))
        const audio = new Audio(url)
        playing = audio
        const finish = (error?: string): void => {
          if (playing !== audio) return
          stop()
          void api.audioDone(clip.id, error)
        }
        audio.onended = () => finish()
        audio.onerror = () => finish('Playback failed')
        void audio.play().catch(() => finish('Playback failed'))
      } catch { void api.audioDone(clip.id, 'Playback failed') }
    })
    return () => { off(); stop() }
  }, [api, enabled])
}

type RecordingPhase = 'idle' | 'requesting' | 'recording' | 'transcribing'
export function useCompanionMicrophone(api: Pick<CompanionApi, 'microphone' | 'transcribe' | 'cancelTranscription'>, state: Pick<CompanionState, 'inputEpoch'> | null, enabled: boolean, onText: (text: string) => void, onError: (message: string) => void): {
  phase: RecordingPhase; start: () => Promise<void>; stop: () => void; cancel: () => void
} {
  const [phase, setPhase] = useState<RecordingPhase>('idle')
  const generation = useRef(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onTextRef = useRef(onText), onErrorRef = useRef(onError)
  onTextRef.current = onText; onErrorRef.current = onError
  const release = useCallback((): void => {
    clearTimeout(deadline.current)
    stream.current?.getTracks().forEach(track => track.stop())
    stream.current = null
  }, [])
  const cancel = useCallback((): void => {
    if (!enabled) return
    generation.current++
    if (recorder.current) {
      recorder.current.onstop = null; recorder.current.ondataavailable = null; recorder.current.onerror = null
      if (recorder.current.state !== 'inactive') recorder.current.stop()
      recorder.current = null
    }
    release(); setPhase('idle')
    void api.cancelTranscription(); void api.microphone(false)
  }, [api, release, enabled])
  useEffect(() => { cancel() }, [state?.inputEpoch, cancel])
  useEffect(() => {
    const hide = (): void => { if (document.hidden) cancel() }
    document.addEventListener('visibilitychange', hide)
    window.addEventListener('pagehide', cancel)
    return () => { document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', cancel); cancel() }
  }, [cancel])
  const start = async (): Promise<void> => {
    const current = ++generation.current
    setPhase('requesting')
    try {
      await companionResult(api.microphone(true))
      if (current !== generation.current) { void api.microphone(false); return }
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false })
      if (current !== generation.current) { media.getTracks().forEach(track => track.stop()); void api.microphone(false); return }
      stream.current = media
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      if (!mime) throw new Error('This device cannot record a supported microphone format. Use Windows voice typing instead.')
      const active = new MediaRecorder(media, { mimeType: mime, audioBitsPerSecond: 64000 })
      recorder.current = active
      const chunks: Blob[] = []
      let size = 0
      active.ondataavailable = event => {
        if (current !== generation.current) return
        size += event.data.size
        if (size > 4 * 1024 * 1024) { cancel(); onErrorRef.current('The recording was too large. Try a shorter message.'); return }
        if (event.data.size) chunks.push(event.data)
      }
      active.onerror = () => { cancel(); onErrorRef.current('Microphone recording failed. Check your microphone and try again.') }
      active.onstop = () => {
        if (current !== generation.current) return
        release(); recorder.current = null; setPhase('transcribing')
        void (async () => {
          try {
            await companionResult(api.microphone(false))
            const blob = new Blob(chunks, { type: active.mimeType })
            const bytes = await blob.arrayBuffer()
            if (current !== generation.current) return
            const text = await companionResult(api.transcribe(bytes, active.mimeType.split(';')[0]))
            if (current === generation.current) onTextRef.current(text)
          } catch (error) {
            if (current === generation.current) onErrorRef.current(error instanceof Error ? error.message : 'Transcription failed.')
          } finally { if (current === generation.current) setPhase('idle') }
        })()
      }
      active.start(250)
      setPhase('recording')
      deadline.current = setTimeout(() => { if (active.state === 'recording') active.stop() }, 60000)
    } catch (error) {
      if (current === generation.current) {
        cancel()
        onErrorRef.current(error instanceof Error ? error.message : 'Could not open your microphone.')
      }
    }
  }
  return { phase, start, stop: () => { if (recorder.current?.state === 'recording') recorder.current.stop() }, cancel }
}
