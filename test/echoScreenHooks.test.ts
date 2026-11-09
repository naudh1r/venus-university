import { createElement, type ReactNode } from 'react'
import { PassThrough } from 'node:stream'
import { renderToStaticMarkup, renderToPipeableStream } from 'react-dom/server'
import { MotionConfig } from 'motion/react'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { normalizeEcho } from '@shared/echo'
import { MODS } from '@shared/mods'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { useSettingsStore } from '../src/renderer/stores/settingsStore'
import { resetLoopState } from '../src/renderer/stores/loop/state'
import { screenSlot, subscribeHookRules } from '../src/renderer/mods/hooks'
import { ModSlot } from '../src/renderer/mods/ModSlot'
import { character, charInfo, restoreApi, stubApi } from './fixtures'

// Real synthetic stores and rules, with subscriptions bypassed for server rendering.
vi.mock('../src/renderer/stores/gameStore', async importOriginal => {
  const module = await importOriginal<typeof import('../src/renderer/stores/gameStore')>()
  type State = ReturnType<typeof module.useGameStore.getState>
  return { ...module, useGameStore: Object.assign(<T>(selector: (state: State) => T) =>
    selector(module.useGameStore.getState()), module.useGameStore) }
})
vi.mock('../src/renderer/stores/modsStore', async importOriginal => {
  const module = await importOriginal<typeof import('../src/renderer/stores/modsStore')>()
  type State = ReturnType<typeof module.useModsStore.getState>
  return { ...module, useModOn: module.modIsOn,
    useModsStore: Object.assign(<T>(selector: (state: State) => T) =>
      selector(module.useModsStore.getState()), module.useModsStore) }
})

// Wait for real lazy components; unlike a static render this resolves Suspense.
function draw(element: ReactNode): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = new PassThrough()
    let html = ''
    output.on('data', chunk => { html += chunk.toString() })
    output.on('end', () => resolve(html.replace(/<!--.*?-->/g, '')))
    output.on('error', reject)
    const stream = renderToPipeableStream(element, {
      onAllReady() { stream.pipe(output) }, onError: reject
    })
  })
}

stubApi({ jobs: { onProgress: () => () => {} } })
await import('../src/renderer/modEntries/echo')
const { EchoAura, EchoPanel } = await import('../src/renderer/views/EchoPanel')
const { PhotosPage } = await import('../src/renderer/views/PhotosPage')

const drawStage = (charId = 'a') => draw(createElement(ModSlot<'portraitOverlay'>, {
  slot: 'portraitOverlay', props: { charId }
}))
const drawGallery = () => draw(createElement(ModSlot<'photosPageSection'>, {
  slot: 'photosPageSection', props: { theme: 'night' }
}))
const switches = (echo: boolean, photos: boolean) => useModsStore.setState({
  switches: { on: { echo, 'photo-feature': photos }, options: {} }
})

beforeEach(() => {
  useGameStore.getState().reset()
  resetLoopState()
  switches(true, false)
  useSettingsStore.setState({ settings: null })
  useGameStore.setState({
    playthroughId: 'echo-screen-test', chars: ['a', 'b'],
    characters: { a: character({ charId: 'a' }), b: character({ charId: 'b' }) },
    charInfo: { a: charInfo({ nameKnown: true }), b: charInfo({ nameKnown: false }) },
    exEcho: normalizeEcho({
      player: { aspect: 'daylark', name: 'Reader Light' },
      girls: {
        a: { aspect: 'veilkeeper', name: 'Hidden Star', stage: {
          x: 135, y: -80, scale: 1.4, opacity: .42, floating: true, floatSeconds: 17
        } },
        b: { aspect: 'daylark', name: 'Unmet Echo' }
      }
    })
  })
})
afterEach(() => { vi.restoreAllMocks(); useGameStore.getState().reset(); resetLoopState() })
afterAll(restoreApi)

describe('Echo screen contributions', () => {
  it.each([false, true])('keeps the API configuration hint tied to the native credential answer (%s)', configured => {
    useSettingsStore.setState({ settings: { apiProvider: 'gemini', apiKeySet: configured } as never })
    const html = renderToStaticMarkup(createElement(EchoPanel, { hidden: false, theme: 'day' }))
    expect(html.includes('Add an Image API key in Settings for automatic first-time artwork')).toBe(!configured)
  })

  it.each(['managed', 'external'] as const)('keeps local artwork guidance and model installation scoped to %s', source => {
    stubApi({ jobs: { onProgress: () => () => {} }, echo: { installLocalModels: async () => ({ ok: true, data: null }) } })
    useModsStore.setState({ switches: { on: { echo: true }, options: { 'echo:megaten-art': true } } })
    useSettingsStore.setState({ settings: { apiProvider: 'gemini', apiKeySet: false, comfySource: source } as never })
    const html = renderToStaticMarkup(createElement(EchoPanel, { hidden: false, theme: 'day' }))
    expect(html.includes('Your own ComfyUI server is selected.')).toBe(source === 'external')
    expect(html.includes('Install local art models</button>')).toBe(source === 'managed')
    expect(html).not.toContain('Add an Image API key in Settings for automatic first-time artwork')
  })

  it.each([false, true])('keeps stage and gallery independent of Photo Feature (photos = %s)', async photos => {
    switches(true, photos)
    expect(MODS.find(mod => mod.id === 'echo')?.requires ?? []).not.toContain('photo-feature')
    expect(screenSlot('portraitOverlay').map(entry => entry.modId)).toEqual(['echo'])
    expect(screenSlot('photosPageSection').map(entry => entry.modId)).toEqual(['echo'])
    expect(await drawStage()).toContain('data-echo-owner="a"')
    expect(await drawGallery()).toContain('aria-label="Echo gallery"')
    switches(false, photos)
    expect(await drawStage()).toBe('')
    expect(await drawGallery()).toBe('')
  })

  it('renders exactly the former stage markup, with saved placement and floating settings', async () => {
    const html = await drawStage()
    expect(html).toBe(renderToStaticMarkup(createElement(EchoAura, { charId: 'a' })))
    expect(html.match(/class="echo-aura"/g)).toHaveLength(1)
    expect(html).toContain('--echo-x:135px')
    expect(html).toContain('--echo-y:-80px')
    expect(html).toContain('--echo-scale:1.4')
    expect(html).toContain('opacity:0.42')
    expect(html).toContain('data-floating="true"')
    expect(html).toContain('--echo-float-seconds:17s')
    expect(await drawStage('missing')).toBe('')
  })

  it('keeps per-owner and shared stage visibility separate from the gallery', async () => {
    const exEcho = useGameStore.getState().exEcho
    useGameStore.setState({ exEcho: { ...exEcho, girls: { ...exEcho.girls, a: {
      ...exEcho.girls.a, stage: { ...exEcho.girls.a.stage!, visible: false }
    } } } })
    expect(await drawStage()).toBe('')
    expect(await drawStage('b')).toContain('data-echo-owner="b"')
    expect(await drawGallery()).toContain('Hidden Star')
    useGameStore.setState({ exEcho: { ...exEcho, visible: false } })
    expect(await drawStage()).toBe('')
    expect(await drawStage('b')).toBe('')
    expect(await drawGallery()).toContain('Hidden Star')
  })

  it('preserves the former gallery markup and shows only the reader and met students', async () => {
    const html = await drawGallery()
    expect(html).toBe(renderToStaticMarkup(createElement(EchoPanel, { hidden: false, gallery: true, theme: 'night' })))
    expect(html).toContain('Reader Light')
    expect(html).toContain('Hidden Star')
    expect(html).not.toContain('Unmet Echo')
  })

  it.each([false, true])('mounts one gallery on the actual Photos page (photos = %s)', async photos => {
    switches(true, photos)
    const drawPage = () => draw(createElement(MotionConfig, { isStatic: true },
      createElement(PhotosPage, { theme: 'night' })))
    expect((await drawPage()).match(/aria-label="Echo gallery"/g)).toHaveLength(1)
    switches(false, photos)
    const html = await drawPage()
    expect(html).not.toContain('aria-label="Echo gallery"')
    expect(html).toContain('vu-photos')
  })

  it('redraws on switch changes and restores one contribution without changing saved Echo data', async () => {
    const before = structuredClone(useGameStore.getState().exEcho)
    const redraw = vi.fn(), stop = subscribeHookRules(redraw)
    try {
      switches(false, true)
      expect(await drawStage()).toBe('')
      switches(true, false)
      expect(redraw).toHaveBeenCalledTimes(2)
      expect((await drawStage()).match(/class="echo-aura"/g)).toHaveLength(1)
      expect((await drawGallery()).match(/aria-label="Echo gallery"/g)).toHaveLength(1)
      expect(useGameStore.getState().exEcho).toEqual(before)
    } finally { stop() }
  })

  it('keeps replays hidden and restores the stage after returning to ordinary play', async () => {
    useGameStore.setState({ replaying: {} })
    expect(await drawStage()).toBe('')
    expect(await drawGallery()).toBe('')
    useGameStore.setState({ replaying: null })
    expect(await drawStage()).toContain('data-echo-owner="a"')
    expect(await drawGallery()).toContain('aria-label="Echo gallery"')
  })
})
