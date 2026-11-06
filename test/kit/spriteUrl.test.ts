import { expect, it, vi } from 'vitest'
import { stubApi } from '../fixtures'

stubApi({ jobs: { onProgress: () => () => {} } })
const kit = await import('@vx/modkit/renderer')
const { setImageResolver } = await import('../../src/renderer/stores/imageUrl')
const { spriteRel } = await import('../../src/shared/characterFiles')

it('uses the native neutral sprite path with default cache and staging values', () => {
  expect(kit.spriteUrl('test-girl', 'neutral')).toBe(`charimg://test-girl/${spriteRel('neutral')}?v=0`)
})

it('honors the active browser resolver, cache version and editor staging', () => {
  const resolver = vi.fn(() => 'blob:test-portrait')
  setImageResolver(resolver)
  expect(kit.spriteUrl('test-girl', 'neutral', 7, true)).toBe('blob:test-portrait')
  expect(resolver).toHaveBeenCalledExactlyOnceWith('test-girl', spriteRel('neutral'), 7, true)
})
