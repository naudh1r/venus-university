import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from '../fixtures'
import { MODS, NO_SWITCHES, optionKey, setInstalledMods, type ModDef } from '@shared/mods'

stubApi({ jobs: { onProgress: () => () => {} } })
const readers = await import('../../src/renderer/mods/readers')
const { useSettingsStore } = await import('../../src/renderer/stores/settingsStore')
const { useSetupStore } = await import('../../src/renderer/stores/setupStore')
const { useBunnyboardStore } = await import('../../src/renderer/stores/bunnyboardStore')
const { useGrabBagStore } = await import('../../src/renderer/stores/grabBagStore')
const { modOptionOn, useModsStore } = await import('../../src/renderer/stores/modsStore')
const { FEED_HANDLE_BAG, FEED_HANDLE_POOL, FEED_EMOJI_BAG, FEED_EMOJI } = await import(
  '../../src/renderer/prompts/feedRandoms'
)
const beforeMods = [...MODS]
const beforeIds = beforeMods.map(mod => mod.id)

beforeEach(() => {
  stubApi({ platform: 'desktop', jobs: { onProgress: () => () => {} } })
  useSettingsStore.setState({ settings: null })
  useSetupStore.setState({ status: null })
  useBunnyboardStore.getState().reset()
  useGrabBagStore.getState().reset()
  useModsStore.setState({ switches: NO_SWITCHES })
})
afterEach(() => {
  setInstalledMods(beforeMods, beforeIds)
  restoreApi()
  vi.restoreAllMocks()
})

it('reads and subscribes to the image rule without reacting to unrelated settings', () => {
  const values: boolean[] = []
  const stop = readers.subscribeNoNsfwImages(() => values.push(readers.noNsfwImages()))
  expect(readers.noNsfwImages()).toBe(false)
  useSettingsStore.setState({ settings: { noNsfwImages: false } as never })
  expect(values).toEqual([])
  useSettingsStore.setState({ settings: { noNsfwImages: true } as never })
  expect(readers.noNsfwImages()).toBe(true)
  useSettingsStore.setState({ settings: { noNsfwImages: true, lessNsfwText: false } as never })
  useSettingsStore.setState({ settings: null })
  expect(values).toEqual([true, false])
  stop()
  useSettingsStore.setState({ settings: { noNsfwImages: true } as never })
  expect(readers.noNsfwImages()).toBe(true)
  expect(values).toEqual([true, false])
})

it('follows both sources of local rendering availability and preserves the native gates', () => {
  const values: boolean[] = []
  const stop = readers.subscribeCanRenderLocalImages(() => values.push(readers.canRenderLocalImages()))
  expect(readers.canRenderLocalImages()).toBe(false)
  useSettingsStore.setState({ settings: { comfySource: 'managed', comfyDeferred: false } as never })
  expect(readers.canRenderLocalImages()).toBe(false)
  useSetupStore.setState({ status: { comfyReady: true } as never })
  expect(readers.canRenderLocalImages()).toBe(true)
  useSettingsStore.setState({ settings: { comfySource: 'managed', comfyDeferred: true } as never })
  useSettingsStore.setState({ settings: { comfySource: 'external', comfyDeferred: true } as never })
  useSetupStore.setState({ status: null })
  expect(readers.canRenderLocalImages()).toBe(true)
  useSettingsStore.setState({ settings: null })
  expect(values).toEqual([true, false, true, false])
  stop()
  useSettingsStore.setState({ settings: { comfySource: 'external' } as never })
  expect(readers.canRenderLocalImages()).toBe(true)
  expect(values).toEqual([true, false, true, false])
  stubApi({ platform: 'web', jobs: { onProgress: () => () => {} } })
  expect(readers.canRenderLocalImages()).toBe(false)
})

it('reports phone opening and closing independently of unrelated transient state', () => {
  const values: boolean[] = []
  const stop = readers.subscribePhoneView(() => values.push(readers.phoneOpen()))
  expect(readers.phoneOpen()).toBe(false)
  useBunnyboardStore.getState().openApp()
  useBunnyboardStore.getState().setLocked(true)
  expect(values).toEqual([true])
  useBunnyboardStore.getState().closeApp()
  expect(values).toEqual([true, false])
  stop()
  useBunnyboardStore.getState().openApp()
  expect(readers.phoneOpen()).toBe(true)
  expect(values).toEqual([true, false])
})

it('reads the selected thread and follows navigation without exposing phone actions', () => {
  const values: (string | null)[] = []
  const stop = readers.subscribePhoneView(() => values.push(readers.viewingThread()))
  expect(readers.viewingThread()).toBeNull()
  useBunnyboardStore.getState().viewChar('lia')
  expect(readers.viewingThread()).toBe('lia')
  useBunnyboardStore.getState().setLocked(true)
  useBunnyboardStore.getState().backToList()
  useBunnyboardStore.getState().viewChar('risa')
  useBunnyboardStore.getState().setTab('updates')
  expect(values).toEqual(['lia', null, 'risa', null])
  stop()
  useBunnyboardStore.getState().viewChar('lia')
  expect(values).toEqual(['lia', null, 'risa', null])
})

it('draws handles from the current native bag without spending emoji', () => {
  const faces = [FEED_EMOJI[0]]
  useGrabBagStore.setState({ bags: {
    [FEED_HANDLE_BAG]: FEED_HANDLE_POOL.slice(0, -1).map(entry => entry.key),
    [FEED_EMOJI_BAG]: faces
  } })
  expect(readers.drawFeedHandles(1)).toEqual([FEED_HANDLE_POOL.at(-1)!.handle])
  expect(useGrabBagStore.getState().bags[FEED_EMOJI_BAG]).toBe(faces)
  useGrabBagStore.setState({ bags: {
    [FEED_HANDLE_BAG]: FEED_HANDLE_POOL.slice(1).map(entry => entry.key), [FEED_EMOJI_BAG]: faces
  } })
  expect(readers.drawFeedHandles(1)).toEqual([FEED_HANDLE_POOL[0].handle])
})

it.each([
  ['gemini', false, false, false, '', false],
  ['gemini', true, false, false, '', true],
  ['openai', true, false, false, '', true],
  ['openai', true, false, false, 'https://pictures.example/v1', false],
  ['openai', false, true, false, 'https://pictures.example/v1', true],
  ['openai', false, false, true, 'https://pictures.example/v1', true]
])('uses native image credentials for %s with presence flags %s/%s/%s and endpoint %s',
  (apiProvider, apiKeySet, imageApiKeySet, endpointApiKeySet, imageEndpointUrl, expected) => {
    useSettingsStore.setState({ settings: { apiProvider, apiKeySet, imageApiKeySet, endpointApiKeySet, imageEndpointUrl } as never })
    expect(readers.imageApiConfigured()).toBe(expected)
  })

it('isolates provider configuration and local-source subscriptions, including load/reset and cleanup', () => {
  const api: boolean[] = [], sources: (string | null)[] = []
  const stopApi = readers.subscribeImageApiConfigured(() => api.push(readers.imageApiConfigured()))
  const stopSource = readers.subscribeLocalImageSource(() => sources.push(readers.localImageSource()))
  expect(readers.imageApiConfigured()).toBe(false)
  expect(readers.localImageSource()).toBeNull()
  const settings = { apiProvider: 'gemini', apiKeySet: false, comfySource: 'managed' }
  useSettingsStore.setState({ settings: settings as never })
  useSettingsStore.setState({ settings: { ...settings, temperature: 0.7 } as never })
  useSetupStore.setState({ status: { comfyReady: true } as never })
  expect(api).toEqual([])
  expect(sources).toEqual(['managed'])
  useSettingsStore.setState({ settings: { ...settings, apiKeySet: true } as never })
  useSettingsStore.setState({ settings: { ...settings, apiKeySet: true, comfySource: 'external' } as never })
  expect(api).toEqual([true])
  expect(sources).toEqual(['managed', 'external'])
  useSettingsStore.setState({ settings: null })
  expect(api).toEqual([true, false])
  expect(sources).toEqual(['managed', 'external', null])
  stopApi(); stopSource()
  useSettingsStore.setState({ settings: { ...settings, apiKeySet: true } as never })
  expect(api).toEqual([true, false])
  expect(sources).toEqual(['managed', 'external', null])
})

it('draws emoji from the current native bag without spending handles', () => {
  const handles = [FEED_HANDLE_POOL[0].key]
  useGrabBagStore.setState({ bags: {
    [FEED_HANDLE_BAG]: handles, [FEED_EMOJI_BAG]: FEED_EMOJI.slice(0, -1)
  } })
  expect(readers.drawFeedEmoji(1)).toEqual([FEED_EMOJI.at(-1)!])
  expect(useGrabBagStore.getState().bags[FEED_HANDLE_BAG]).toBe(handles)
  useGrabBagStore.setState({ bags: { [FEED_HANDLE_BAG]: handles, [FEED_EMOJI_BAG]: FEED_EMOJI.slice(1) } })
  expect(readers.drawFeedEmoji(1)).toEqual([FEED_EMOJI[0]])
})

it('reads a declared option outside React, including defaults, changes and unknown options', () => {
  const mod: ModDef = { id: 'reader-options', name: 'Reader options', author: 'test',
    version: '1.0.0', scope: 'anytime', defaultOn: false, blurb: '',
    options: [{ id: 'announce', label: 'Announce', hint: '', default: true }] }
  setInstalledMods([...beforeMods, mod], beforeIds)
  expect(modOptionOn(mod.id, 'announce')).toBe(true)
  useModsStore.setState({ switches: { on: {}, options: { [optionKey(mod.id, 'announce')]: false } } })
  expect(modOptionOn(mod.id, 'announce')).toBe(false)
  useModsStore.setState({ switches: { on: { [mod.id]: false }, options: {} } })
  expect(modOptionOn(mod.id, 'announce')).toBe(true)
  expect(modOptionOn(mod.id, 'missing')).toBe(false)
  expect(modOptionOn('unknown-mod', 'announce')).toBe(false)
})
