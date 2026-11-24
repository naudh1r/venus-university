import { mkdtemp, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { character, stubApi } from './fixtures'

let root = ''
beforeEach(async () => { root = await mkdtemp(join(tmpdir(), 'photo-registration-')) })
afterEach(async () => { await rm(root, { recursive: true, force: true }) })

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => root, getPath: () => root }
}))

/** Loads either side of the shared import cycle before either process registers Photo. */
async function fresh(kitFirst: boolean, side: 'renderer' | 'main') {
  vi.resetModules()
  stubApi({ jobs: { onProgress: () => () => {} } })
  if (!kitFirst) await import('../src/shared/mods')
  const kit = await import('@vx/modkit/shared')
  const catalog = await import('../src/shared/mods')
  expect(catalog.MODS.some(mod => mod.id === 'photo-feature')).toBe(true)
  const switches = { on: { 'photo-feature': true }, options: { 'photo-feature:body': true } }
  if (side === 'renderer') {
    const { useModsStore } = await import('../src/renderer/stores/modsStore')
    useModsStore.setState({ switches })
  } else {
    const { setModSwitches } = await import('../src/main/services/modsService')
    await setModSwitches(switches)
  }
  const { draftedParts } = await import('../src/shared/imagePromptDrafts')
  const girl = character({ body: { build: 'petite' } } as never)
  const parts = () => {
    return draftedParts({ appearance: [], negative: [] }, { character: girl, kind: 'cg' })
  }
  expect(parts().appearance).not.toContain('petite')
  expect(kit.registerImagePromptDraft).toBeTypeOf('function')
  return parts
}

it.each([true, false])('defers Photo registration until the renderer boots, kit first: %s', async first => {
  const parts = await fresh(first, 'renderer')
  await import('../src/renderer/modEntries/photo-feature')
  expect(parts().appearance).toContain('petite')
})

it.each([true, false])('defers Photo registration until main boots, kit first: %s', async first => {
  const parts = await fresh(first, 'main')
  const { photoMainEntry } = await import('../src/main/modEntries/photo-feature')
  expect(parts().appearance).not.toContain('petite')
  photoMainEntry()
  expect(parts().appearance).toContain('petite')
})
