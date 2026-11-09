import './fixtures/maestroModelKit'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Result } from '@shared/types'

const flags = vi.hoisted(() => ({ enabled: true }))
vi.mock('../src/renderer/stores/modsStore', () => ({ modIsOn: () => flags.enabled }))

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const track = (letter: string) => ({ file: letter.repeat(64) + '.wav', name: letter + '.wav', loop: true })
const buffer = (length: number) => ({ length, numberOfChannels: 1, duration: 12 }) as AudioBuffer

beforeEach(() => { vi.resetModules(); flags.enabled = true })
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

it.each(['read', 'decode'] as const)('ignores a late old-track %s failure after a replacement has decoded', async stage => {
  const oldRead = deferred<Result<Uint8Array<ArrayBuffer> | null>>()
  const oldDecode = deferred<AudioBuffer>()
  const oldBytes = new Uint8Array([1]), nextBytes = new Uint8Array([2])
  const read = vi.fn().mockImplementationOnce(() => oldRead.promise)
    .mockResolvedValue({ ok: true, data: nextBytes })
  vi.stubGlobal('window', { api: { soundtracks: { read } } })
  const { useSoundtrackStore: store, soundtrackActive } = await import('../src/renderer/stores/soundtrackStore')
  const { customSoundtrackBuffer, clearSoundtrackAudio } = await import('../src/renderer/stores/soundtrackAudio')
  const replacement = buffer(200)
  const decode = vi.fn(async (bytes: ArrayBuffer) => new Uint8Array(bytes)[0] === 1 ? oldDecode.promise : replacement)
  const context = { decodeAudioData: decode } as unknown as AudioContext
  store.setState({ loaded: true, map: { landing_day: track('a') }, errors: {} })
  const obsolete = customSoundtrackBuffer('landing_day', context)
  expect(read).toHaveBeenCalledTimes(1)
  if (stage === 'decode') {
    oldRead.resolve({ ok: true, data: oldBytes })
    await vi.waitFor(() => expect(decode).toHaveBeenCalledTimes(1))
  }
  // The audioStore assignment subscriber calls refreshSoundtracks, which invokes this invalidator.
  store.setState({ map: { landing_day: track('b') }, errors: {} })
  clearSoundtrackAudio(['landing_day'])
  expect(await customSoundtrackBuffer('landing_day', context)).toBe(replacement)
  if (stage === 'read') oldRead.resolve({ ok: false, error: { code: 'MISSING', message: 'Old recording unavailable.' } })
  else oldDecode.reject(Error('Old recording decode failed.'))
  expect(await obsolete).toBeNull()
  expect(store.getState().errors).toEqual({})
  expect(soundtrackActive('landing_day')).toBe(true)
  expect(await customSoundtrackBuffer('landing_day', context)).toBe(replacement)
  expect(read).toHaveBeenCalledTimes(2)
})

it('keeps a new same-file pending load owned after an older generation settles', async () => {
  const oldRead = deferred<Result<Uint8Array<ArrayBuffer> | null>>()
  const newRead = deferred<Result<Uint8Array<ArrayBuffer> | null>>()
  const read = vi.fn().mockImplementationOnce(() => oldRead.promise).mockImplementationOnce(() => newRead.promise)
  vi.stubGlobal('window', { api: { soundtracks: { read } } })
  const { useSoundtrackStore: store } = await import('../src/renderer/stores/soundtrackStore')
  const { customSoundtrackBuffer, clearSoundtrackAudio } = await import('../src/renderer/stores/soundtrackAudio')
  const replacement = buffer(200)
  const context = { decodeAudioData: vi.fn(async () => replacement) } as unknown as AudioContext
  store.setState({ loaded: true, map: { landing_day: track('a') }, errors: {} })
  const obsolete = customSoundtrackBuffer('landing_day', context)
  // Disabling and enabling Custom soundtracks refreshes the same cue/file generation.
  flags.enabled = false; clearSoundtrackAudio()
  expect(await customSoundtrackBuffer('landing_day', context)).toBeNull()
  flags.enabled = true; clearSoundtrackAudio()
  const current = customSoundtrackBuffer('landing_day', context)
  oldRead.resolve({ ok: true, data: new Uint8Array([1]) })
  expect(await obsolete).toBeNull()
  const shared = customSoundtrackBuffer('landing_day', context)
  expect(read).toHaveBeenCalledTimes(2)
  newRead.resolve({ ok: true, data: new Uint8Array([2]) })
  expect(await current).toBe(replacement)
  expect(await shared).toBe(replacement)
  expect(store.getState().errors).toEqual({})
})
