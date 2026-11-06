import { expect, it, vi } from 'vitest'
import { character, stubApi } from './fixtures'

vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/tmp', getPath: () => '/tmp' }
}))

/** Loads either side of the shared import cycle before either process registers Photo. */
async function fresh(kitFirst: boolean) {
  vi.resetModules()
  stubApi({ jobs: { onProgress: () => () => {} } })
  if (!kitFirst) await import('../src/shared/mods')
  const kit = await import('@vx/modkit/shared')
  const catalog = await import('../src/shared/mods')
  expect(catalog.MODS.some(mod => mod.id === 'photo-feature')).toBe(true)
  const { setSharedModRules } = await import('../src/shared/modRules')
  setSharedModRules(id => id === 'photo-feature')
  const { setPhotoSwitches } = await import('../src/shared/photoSwitches')
  setPhotoSwitches({ on: true, body: true })
  const { draftedParts } = await import('../src/shared/imagePromptDrafts')
  const girl = character({ body: { build: 'petite' } } as never)
  const parts = () => {
    setSharedModRules(id => id === 'photo-feature')
    setPhotoSwitches({ on: true, body: true })
    return draftedParts({ appearance: [], negative: [] }, { character: girl, kind: 'cg' })
  }
  expect(parts().appearance).not.toContain('petite')
  expect(kit.registerImagePromptDraft).toBeTypeOf('function')
  return parts
}

it.each([true, false])('defers Photo registration until the renderer boots, kit first: %s', async first => {
  const parts = await fresh(first)
  await import('../src/renderer/modEntries/photo-feature')
  expect(parts().appearance).toContain('petite')
})

it.each([true, false])('defers Photo registration until main boots, kit first: %s', async first => {
  const parts = await fresh(first)
  const { photoInvocations } = await import('../src/main/photoIpc')
  expect(parts().appearance).not.toContain('petite')
  photoInvocations()
  expect(parts().appearance).toContain('petite')
})
