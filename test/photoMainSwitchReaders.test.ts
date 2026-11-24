import { mkdtemp, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
let root = ''
vi.mock('electron', () => ({ app: { isPackaged: false, getAppPath: () => root, getPath: () => root } }))
const { setModSwitches, getModSwitches } = await import('../src/main/services/modsService')
const { getModsPath } = await import('../src/main/paths')
const { withMod, withOption, optionKey } = await import('../src/shared/mods')
const { PHOTO_LOADERS } = await import('../src/shared/photoLoader')
const { PHOTO_FEATURE_ID: ID, photoSwitches, photoFeatureOn } = await import('../src/shared/photoSwitches')
const { photoMainEntry } = await import('../src/main/modEntries/photo-feature')
photoMainEntry()
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'photo-main-switches-'))
  await setModSwitches({ on: { [ID]: true }, options: {} })
})
afterEach(async () => { await rm(root, { recursive: true, force: true }) })
it.each(['photos', 'explicit', 'webp', 'body', 'duo'] as const)('reads main %s from the latest known switches', async option => {
  for (const value of [false, true]) {
    await setModSwitches(withOption(await getModSwitches(), ID, option, value))
    expect(photoSwitches()[option]).toBe(value)
    expect(photoSwitches()).toBe(photoSwitches())
  }
})
it.each(PHOTO_LOADERS)('reads main loader $value live', async loader => {
  await setModSwitches(withOption(await getModSwitches(), ID, `loader-${loader.value}`, true))
  expect(photoSwitches().loader).toBe(loader.value)
})
it('uses the bunny fallback and follows the synchronous running-mod rule', async () => {
  await setModSwitches({ on: { [ID]: true }, options: Object.fromEntries(
    PHOTO_LOADERS.map(loader => [optionKey(ID, `loader-${loader.value}`), false])) })
  expect(photoSwitches().loader).toBe('bunny')
  expect(photoFeatureOn()).toBe(true)
  await setModSwitches(withMod(await getModSwitches(), ID, false))
  expect(photoFeatureOn()).toBe(false)
  expect(photoSwitches().on).toBe(false)
})
it('refreshes options when main reads a changed switches file', async () => {
  const next = withOption(await getModSwitches(), ID, 'body', true)
  await writeFile(getModsPath(), JSON.stringify({ schemaVersion: 1, ...next }))
  const before = photoSwitches()
  await getModSwitches()
  expect(photoSwitches().body).toBe(true)
  expect(photoSwitches()).not.toBe(before)
})
