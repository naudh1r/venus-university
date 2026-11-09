/// <reference path="../src/renderer/signalsmith-stretch.d.ts" />
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
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

const track = { file: 'a'.repeat(64) + '.wav', name: 'synthetic.wav', loop: true }
let engine: typeof import('../src/renderer/stores/audioEngine')
let audio: typeof import('../src/renderer/stores/audioStore')
let mods: typeof import('../src/renderer/stores/modsStore')
let ui: typeof import('../src/renderer/stores/uiStore')
let game: typeof import('../src/renderer/stores/gameStore')
let crossing: typeof import('../src/renderer/stores/crossingStore')
let soundtracks: typeof import('../src/renderer/stores/soundtrackStore')
async function settle() { for (let i = 0; i < 120; i++) await Promise.resolve() }
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers(); Source.made = []
  // Reset the forwarding mock with the stores; a cached factory would keep the previous test's switches.
  vi.doMock('@vx/modkit/renderer', () => import('../src/renderer/stores/modsStore'))
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('AudioBufferSourceNode', Source)
  vi.stubGlobal('window', { addEventListener() {}, removeEventListener() {}, api: {
    assets: { readAudio: vi.fn(async () => ({ ok: true, data: new Uint8Array([1]) })) },
    soundtracks: { list: vi.fn(async () => ({ ok: true, data: { title: track } })),
      read: vi.fn(async () => ({ ok: true, data: new Uint8Array([2]) })) }
  } })
  soundtracks = await import('../src/renderer/stores/soundtrackStore')
  await soundtracks.useSoundtrackStore.getState().load()
  engine = await import('../src/renderer/stores/audioEngine')
  audio = await import('../src/renderer/stores/audioStore')
  mods = await import('../src/renderer/stores/modsStore')
  ui = await import('../src/renderer/stores/uiStore')
  game = await import('../src/renderer/stores/gameStore')
  crossing = await import('../src/renderer/stores/crossingStore')
  ui.useUiStore.setState({ view: 'mainMenu', menuTheme: 'day' })
  audio.useAudioStore.getState().start()
  await settle()
}, 30_000)
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

it('restores a native menu soundscape after disabling a custom title during gameplay', async () => {
  expect(engine.current('music')).toBe('title')
  expect(Source.made.at(-1)?.buffer?.duration).toBe(2)
  expect(audio.useAudioStore.getState()).toMatchObject({ titleStarted: true, titleDone: false })
  game.useGameStore.setState({ playthroughId: 'qa-synthetic', date: 7, time: 0, awaitingInput: true })
  ui.useUiStore.getState().setView('game')
  await settle()
  expect(engine.current('music')).toBe('landing_day')
  mods.useModsStore.setState({ switches: { on: { 'custom-soundtracks': false }, options: {} } })
  await settle()
  // The real quit path covers the game before resetting it and showing the menu.
  crossing.useCrossingStore.setState({ phase: 'holding', waited: false })
  game.useGameStore.getState().reset()
  ui.useUiStore.setState({ view: 'mainMenu', menuTheme: 'day' })
  crossing.useCrossingStore.setState({ phase: 'idle' })
  await settle()
  // Either stock title or native menu ambience must be requested; both null is a silent dead end.
  expect([engine.current('music'), engine.current('ambience')]).not.toEqual([null, null])
  expect(engine.current('ambience')).toBe('amb_outdoor_day')
})

it('still restores the native title when disabled directly on the menu, then lets it finish once', async () => {
  mods.useModsStore.setState({ switches: { on: { 'custom-soundtracks': false }, options: {} } })
  await settle()
  expect(engine.current('music')).toBe('title')
  const native = Source.made.at(-1)!
  expect(native.buffer?.duration).toBe(120)
  expect(native.loop).toBe(false)
  native.finish(); await settle()
  expect(audio.useAudioStore.getState().titleDone).toBe(true)
  expect(engine.current('ambience')).toBe('amb_outdoor_day')
  const count = Source.made.length
  ui.useUiStore.setState({ view: 'manageCharacters' }); await settle()
  ui.useUiStore.setState({ view: 'mainMenu' }); await settle()
  expect(Source.made.length).toBe(count)
})

it('does not revive a finished one-shot replacement on unrelated store updates', async () => {
  soundtracks.useSoundtrackStore.setState({ map: { title: { ...track, loop: false } } })
  await settle()
  Source.made.at(-1)!.finish()
  const count = Source.made.length
  game.useGameStore.setState({ date: 9 }); await settle()
  ui.useUiStore.setState({ view: 'manageCharacters' }); await settle()
  ui.useUiStore.setState({ view: 'mainMenu' }); await settle()
  expect(Source.made.length).toBe(count)
})

it('keeps menu audio working when the custom title remains enabled across gameplay', async () => {
  game.useGameStore.setState({ playthroughId: 'qa-synthetic', date: 7, time: 0, awaitingInput: true })
  ui.useUiStore.getState().setView('game'); await settle()
  crossing.useCrossingStore.setState({ phase: 'holding', waited: false })
  game.useGameStore.getState().reset()
  ui.useUiStore.setState({ view: 'mainMenu', menuTheme: 'day' })
  crossing.useCrossingStore.setState({ phase: 'idle' }); await settle()
  expect(engine.current('music')).toBe('title')
})
