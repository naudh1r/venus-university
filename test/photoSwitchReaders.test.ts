import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest'
import { restoreApi, stubApi } from './fixtures'

// Capture React's external-store subscriptions while exercising the real kit hooks and stores.
const hook = vi.hoisted(() => ({ reads: [] as { subscribe: (fn: () => void) => () => void; read: () => unknown }[] }))
vi.mock('react', async original => {
  const actual = await original<typeof import('react')>()
  // Zustand is externalized by Vitest; its React default object must see the same dispatcher.
  const react = (actual as typeof actual & { default?: typeof actual }).default ?? actual
  const callback = <T,>(fn: T): T => fn
  const debug = (): void => {}
  const external = (subscribe: (fn: () => void) => () => void, read: () => unknown): unknown => {
    hook.reads.push({ subscribe, read })
    return read()
  }
  vi.spyOn(react, 'useCallback').mockImplementation(callback)
  vi.spyOn(react, 'useDebugValue').mockImplementation(debug)
  vi.spyOn(react, 'useSyncExternalStore').mockImplementation(external)
  return { ...actual, useCallback: callback, useDebugValue: debug, useSyncExternalStore: external }
})
afterAll(() => vi.restoreAllMocks())
stubApi({ jobs: { onProgress: () => () => {} } })
const { useModsStore } = await import('../src/renderer/stores/modsStore')
const { withMod, withOption, optionKey } = await import('../src/shared/mods')
const { PHOTO_LOADERS } = await import('../src/shared/photoLoader')
const { PHOTO_FEATURE_ID: ID, photoSwitches, photoFeatureOn } = await import('../src/shared/photoSwitches')
await import('../src/renderer/modEntries/photo-feature')
const { BodyFieldsSection } = await import('../src/renderer/views/bodyFields')
const state = () => useModsStore.getState().switches
beforeEach(() => {
  useModsStore.setState({ switches: { on: { [ID]: true }, options: {} } })
  hook.reads = []
})
afterEach(restoreApi)

it.each(['photos', 'explicit', 'webp', 'body', 'duo'] as const)('reads renderer %s live from the kit', option => {
  for (const value of [false, true]) {
    useModsStore.setState({ switches: withOption(state(), ID, option, value) })
    expect(photoSwitches()[option]).toBe(value)
    expect(photoSwitches()).toBe(photoSwitches())
  }
})
it.each(PHOTO_LOADERS)('reads renderer loader $value live', loader => {
  useModsStore.setState({ switches: withOption(state(), ID, `loader-${loader.value}`, true) })
  expect(photoSwitches().loader).toBe(loader.value)
})
it('falls back to the bunny and reads the running mod’s on/off rule synchronously', () => {
  useModsStore.setState({ switches: { ...state(), options: Object.fromEntries(
    PHOTO_LOADERS.map(loader => [optionKey(ID, `loader-${loader.value}`), false])) } })
  expect(photoSwitches().loader).toBe('bunny')
  expect(photoFeatureOn()).toBe(true)
  useModsStore.setState({ switches: withMod(state(), ID, false) })
  expect(photoFeatureOn()).toBe(false)
  expect(photoSwitches().on).toBe(false)
})
it('redraws the body field immediately, only when a subscribed answer moves', () => {
  const render = () => BodyFieldsSection({ body: {}, baseAppearance: [], onChange: () => {} })
  expect(render()).toBeNull()
  const heard = vi.fn()
  const stops = hook.reads.map(({ subscribe, read }) => {
    let before = read()
    return subscribe(() => {
      const next = read()
      if (!Object.is(before, next)) { before = next; heard() }
    })
  })
  const before = photoSwitches()
  useModsStore.setState({ switches: withMod(state(), ID, true) })
  expect(heard).not.toHaveBeenCalled()
  expect(photoSwitches()).toBe(before)
  useModsStore.setState({ switches: withOption(state(), ID, 'body', true) })
  expect(heard).toHaveBeenCalledTimes(1)
  expect(photoSwitches()).not.toBe(before)
  expect(render()).not.toBeNull()
  for (const stop of stops) stop()
  useModsStore.setState({ switches: withOption(state(), ID, 'body', false) })
  expect(heard).toHaveBeenCalledTimes(1)
  expect(render()).toBeNull()
})
