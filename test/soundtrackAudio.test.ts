import './fixtures/maestroModelKit'
/// <reference path="../src/renderer/signalsmith-stretch.d.ts" />
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { volumesOf, type AudioKey } from '@shared/audio'

const flags = vi.hoisted(() => ({ enabled: true }))
vi.mock('../src/renderer/stores/modsStore', () => ({ modIsOn: () => flags.enabled }))
vi.mock('signalsmith-stretch', () => ({ default: async () => ({ addBuffers: async () => {}, connect() {}, disconnect() {}, schedule: async () => {}, stop: async () => {} }) }))

class Param {
  value = 1
  cancelAndHoldAtTime() {}
  setValueAtTime(value: number) { this.value = value }
  linearRampToValueAtTime(value: number) { this.value = value }
}
class Node {
  gain = new Param(); frequency = new Param(); Q = new Param()
  outputs: Node[] = []
  connect(node: Node) { this.outputs.push(node) }; disconnect() { this.outputs = [] }
}
class Source extends Node {
  static made: Source[] = []
  buffer: AudioBuffer | null = null
  loop = false; onended: (() => void) | null = null; stopped = false
  playbackRate = new Param()
  constructor() { super(); Source.made.push(this) }
  start() {}
  stop() { this.stopped = true }
  finish() { this.onended?.() }
}
class Context {
  currentTime = 0; state = 'running'; destination = new Node(); sampleRate = 44100
  resume = async () => {}; close = async () => {}
  createGain() { return new Node() }
  createBufferSource() { return new Source() }
  createBiquadFilter() { return new Node() }
  createConvolver() { return new Node() }
  createBuffer(channels: number, length: number, rate: number) { return { numberOfChannels: channels, length, duration: length / rate, getChannelData: () => new Float32Array(length) } }
  async decodeAudioData(bytes: ArrayBuffer) {
    return this.createBuffer(1, new Uint8Array(bytes)[0] === 2 ? 88200 : 5292000, 44100)
  }
}
let engine: typeof import('../src/renderer/stores/audioEngine')
let store: typeof import('../src/renderer/stores/soundtrackStore')
const track = { file: 'a'.repeat(64) + '.wav', name: 'custom.wav', loop: true }
async function settle() { for (let i = 0; i < 40; i++) await Promise.resolve() }
async function cue(key: AudioKey | null) { engine.apply('music', { key, fade: .01 }); await settle() }
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); flags.enabled = true; Source.made = []
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('AudioBufferSourceNode', Source)
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, api: {
    assets: { readAudio: vi.fn(async () => ({ ok: true, data: new Uint8Array([1]) })) },
    soundtracks: {
      list: vi.fn(async () => ({ ok: true, data: { title: track, landing_day: track } })),
      read: vi.fn(async () => ({ ok: true, data: new Uint8Array([2]) }))
    }
  } })
  store = await import('../src/renderer/stores/soundtrackStore')
  await store.useSoundtrackStore.getState().load()
  engine = await import('../src/renderer/stores/audioEngine')
  engine.start()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('loops a short custom title and never applies the stock thirty-second ending clock', async () => {
  const ending = vi.fn(); engine.onEnding(ending)
  await cue('title')
  expect(Source.made.at(-1)?.loop).toBe(true)
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  await vi.advanceTimersByTimeAsync(10_000)
  expect(ending).not.toHaveBeenCalled()
})

it('loops the dungeon and question tracks, switches to Bloom once, and restores custom overrides', async () => {
  await cue('reckoning_dungeon')
  expect(window.api.assets.readAudio).toHaveBeenCalledWith('community/reckoning/reckoning_rise_from_the_dark.mp3')
  expect(Source.made.at(-1)?.loop).toBe(true)
  store.useSoundtrackStore.setState({map:{reckoning_dungeon:{...track,loop:false}}})
  engine.refreshSoundtracks();await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  expect(Source.made.at(-1)?.loop).toBe(false)
  store.useSoundtrackStore.setState({map:{}})
  engine.refreshSoundtracks();await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(Source.made.at(-1)?.loop).toBe(true)
  await cue('reckoning')
  expect(window.api.assets.readAudio).toHaveBeenCalledWith('community/reckoning/reckoning_breakthrough.mp3')
  expect(Source.made.at(-1)?.loop).toBe(true)
  await cue('reckoning_victory')
  expect(window.api.assets.readAudio).toHaveBeenCalledWith('community/reckoning/reckoning_bloom.mp3')
  const victory=Source.made.at(-1)!
  expect(victory.loop).toBe(false)
  victory.finish();const count=Source.made.length
  await cue('reckoning_victory');expect(Source.made).toHaveLength(count)
  await cue(null);await cue('reckoning_victory');expect(Source.made).toHaveLength(count+1)
  store.useSoundtrackStore.setState({map:{reckoning:{...track,loop:false}}})
  await cue('reckoning')
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  expect(Source.made.at(-1)?.loop).toBe(false)
  flags.enabled=false;engine.refreshSoundtracks();await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(Source.made.at(-1)?.loop).toBe(true)
})

it('leaves a play-once cue finished across repeated updates, then plays it on re-entry', async () => {
  store.useSoundtrackStore.setState({ map: { landing_day: { ...track, loop: false } } })
  await cue('landing_day')
  const first = Source.made.at(-1)!
  expect(first.loop).toBe(false)
  first.finish()
  await cue('landing_day'); await cue('landing_day')
  expect(Source.made).toHaveLength(1)
  await cue(null); await cue('landing_day')
  expect(Source.made).toHaveLength(2)
})

it('restores native playback on disable and returns to the kept replacement on enable', async () => {
  await cue('title')
  flags.enabled = false; engine.refreshSoundtracks(); await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(Source.made.at(-1)?.loop).toBe(false)
  flags.enabled = true; engine.refreshSoundtracks(); await settle()
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  expect(Source.made.at(-1)?.loop).toBe(true)
  expect(store.useSoundtrackStore.getState().map.title).toEqual(track)
})

it('does not restart a finished track when an unrelated slot changes', async () => {
  store.useSoundtrackStore.setState({ map: { landing_day: { ...track, loop: false } } })
  await cue('landing_day'); Source.made[0].finish()
  engine.refreshSoundtracks(['ending']); await settle()
  await cue('landing_day')
  expect(Source.made).toHaveLength(1)
})

it('falls back once to the original when an imported file is missing', async () => {
  vi.mocked(window.api.soundtracks.read).mockResolvedValue({ ok: true, data: null })
  await cue('title')
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(store.useSoundtrackStore.getState().errors.title).toContain('missing')
  await cue(null); await cue('title')
  expect(window.api.soundtracks.read).toHaveBeenCalledTimes(1)
})

it('discards an in-flight replacement when the cue is restored or disabled', async () => {
  let finish!: (value: Awaited<ReturnType<typeof window.api.soundtracks.read>>) => void
  vi.mocked(window.api.soundtracks.read).mockReturnValue(new Promise(resolve => { finish = resolve }))
  engine.apply('music', { key: 'title', fade: .01 }); await settle()
  flags.enabled = false; engine.refreshSoundtracks(); await settle()
  finish({ ok: true, data: new Uint8Array([2]) }); await settle()
  expect(Source.made).toHaveLength(1)
  expect(Source.made[0].buffer?.duration).toBe(120)
})

/** Measure the connected path, so tests catch audible overlap rather than a UI flag. */
function gainAtOutput(node: Node): number {
  return node.gain.value * (node.outputs.length ? node.outputs.reduce((sum, out) => sum + gainAtOutput(out), 0) : 1)
}

it('silences the background during previews without stopping the title, and restores the user volume', async () => {
  flags.enabled = false
  await cue('title')
  engine.apply('ambience', { key: 'amb_indoor', fade: .01 }); await settle()
  const title = Source.made[0], ambience = Source.made[1]
  const before = gainAtOutput(title)
  const ended = vi.fn(); engine.onEnded(ended)
  await engine.previewSoundtrack('landing_day')
  const preview = Source.made.at(-1)!
  expect(gainAtOutput(title)).toBe(0)
  expect(gainAtOutput(ambience)).toBe(0)
  expect(gainAtOutput(preview)).toBeGreaterThan(0)
  expect(title.stopped).toBe(false)
  expect(engine.current('music')).toBe('title')
  engine.setVolumes(volumesOf({ music: 25 }))
  expect(gainAtOutput(title)).toBe(0)
  expect(gainAtOutput(preview)).toBeGreaterThan(0)
  engine.stopSnippet(); await vi.advanceTimersByTimeAsync(120)
  expect(preview.stopped).toBe(true)
  expect(gainAtOutput(title)).toBeGreaterThan(0)
  expect(gainAtOutput(title)).toBeLessThan(before)
  expect(gainAtOutput(ambience)).toBeGreaterThan(0)
  expect(ended).not.toHaveBeenCalled()
})

it('automatically restores the background after ten seconds, including short looping previews', async () => {
  await cue('title'); const title = Source.made[0]
  await engine.previewSoundtrack('landing_day'); const preview = Source.made.at(-1)!
  expect(preview.loop).toBe(true)
  await vi.advanceTimersByTimeAsync(9999)
  expect(gainAtOutput(title)).toBe(0)
  await vi.advanceTimersByTimeAsync(1)
  expect(preview.stopped).toBe(true)
  expect(gainAtOutput(title)).toBeGreaterThan(0)
  expect(title.stopped).toBe(false)
})

it('does not let an older preview timeout unmute a newer one', async () => {
  await cue('title'); const title = Source.made[0]
  await engine.previewSoundtrack('landing_day')
  await vi.advanceTimersByTimeAsync(8000)
  await engine.previewSoundtrack('ending')
  await vi.advanceTimersByTimeAsync(2500)
  expect(gainAtOutput(title)).toBe(0)
  await vi.advanceTimersByTimeAsync(7500)
  expect(gainAtOutput(title)).toBeGreaterThan(0)
})

it('keeps new background cues silent during a preview and returns to the latest cue', async () => {
  await cue('title'); const old = Source.made[0]
  await engine.previewSoundtrack('ending')
  await cue('landing_night'); const next = Source.made.at(-1)!
  expect(gainAtOutput(next)).toBe(0)
  engine.stopSnippet(); await vi.advanceTimersByTimeAsync(120)
  expect(engine.current('music')).toBe('landing_night')
  expect(old.stopped).toBe(true)
  expect(gainAtOutput(next)).toBeGreaterThan(0)
})

it('restores the background on preview load failure', async () => {
  await cue('title'); const title = Source.made[0]
  vi.mocked(window.api.assets.readAudio).mockResolvedValue({ok:true,data:null})
  await expect(engine.previewSoundtrack('ending')).rejects.toThrow('could not be loaded')
  expect(gainAtOutput(title)).toBeGreaterThan(0)
  expect(title.stopped).toBe(false)
})

it('cancels a loading preview on close and does not start it or re-mute later', async () => {
  await cue('title'); const title = Source.made[0]
  let finish!: (value: Awaited<ReturnType<typeof window.api.assets.readAudio>>) => void
  vi.mocked(window.api.assets.readAudio).mockReturnValue(new Promise(resolve => { finish = resolve }))
  const preview = engine.previewSoundtrack('ending'); await settle()
  expect(gainAtOutput(title)).toBe(0)
  engine.stopSnippet()
  expect(gainAtOutput(title)).toBeGreaterThan(0)
  finish({ok:true,data:new Uint8Array([1])}); await preview; await settle()
  expect(Source.made).toHaveLength(1)
  expect(gainAtOutput(title)).toBeGreaterThan(0)
})

it('does not restart a finished play-once cue after a preview', async () => {
  store.useSoundtrackStore.setState({ map: { landing_day: { ...track, loop: false } } })
  await cue('landing_day'); Source.made[0].finish()
  await engine.previewSoundtrack('ending')
  engine.stopSnippet(); await cue('landing_day')
  expect(Source.made).toHaveLength(2) // Original plus the preview only.
})

it('refreshing a stock title does not report that the title session has ended', async () => {
  flags.enabled = false
  await cue('title')
  const ended = vi.fn(); engine.onEnded(ended)
  // Off/on without an assigned replacement must keep stock music alive too.
  store.useSoundtrackStore.setState({map:{}})
  for (const enabled of [true, false, true, false]) {
    flags.enabled = enabled; engine.refreshSoundtracks(); await settle()
    expect(engine.current('music')).toBe('title')
    expect(Source.made.at(-1)?.stopped).toBe(false)
  }
  expect(ended).not.toHaveBeenCalled()
  Source.made.at(-1)!.finish(); await settle()
  expect(ended).toHaveBeenCalledWith('music', 'title')
})

it('toggling off while previewing restores native music without a false title completion', async () => {
  await cue('title')
  await engine.previewSoundtrack('landing_day'); const preview=Source.made.at(-1)!
  const ended=vi.fn(); engine.onEnded(ended)
  flags.enabled=false; engine.refreshSoundtracks(); await settle(); await vi.advanceTimersByTimeAsync(120)
  expect(preview.stopped).toBe(true)
  expect(Source.made.at(-1)?.buffer?.duration).toBe(120)
  expect(gainAtOutput(Source.made.at(-1)!)).toBeGreaterThan(0)
  expect(ended).not.toHaveBeenCalled()
})
