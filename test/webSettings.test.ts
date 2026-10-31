import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, expect, it, vi } from 'vitest'
import type { SettingsPatch } from '@shared/types'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
})

it("keeps both the notice's write and the player's save when they overlap", async () => {
  const settings = await import('../src/web/settings')
  const patch = { ...(await settings.rendererSettings()), lessNsfwText: true } as SettingsPatch

  await Promise.all([settings.setUnversionedSeen('p1'), settings.patchSettings(patch)])

  settings.forgetSettings()
  const stored = await settings.currentSettings()
  expect(stored.modUnversionedSeen).toEqual(['p1'])
  expect(stored.lessNsfwText).toBe(true)
})
