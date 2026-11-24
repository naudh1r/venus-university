import { expect, it } from 'vitest'
import { bgKindOf, bgThumbUrl, bgUrl, shippedBackgrounds } from '../src/renderer/views/bgAssets'

it('discovers the studio pair and uses its small thumbnails in the native asset pipeline', () => {
  expect(shippedBackgrounds().interior).toContain('dance_studio')
  expect(bgKindOf('dance_studio')).toBe('interior')
  for (const half of ['day', 'night'] as const) {
    const full = bgUrl('dance_studio', half, false)
    const thumb = bgThumbUrl('dance_studio', half, false)
    expect(full).toContain(`dance_studio_${half}.png`)
    expect(thumb).toContain(`dance_studio_${half}.webp`)
    expect(thumb).not.toBe(full)
    expect(bgUrl('dance_studio', half, true)).toBe(full)
  }
  expect(bgUrl('dance_studio', 'day', false)).not.toBe(bgUrl('dance_studio', 'night', false))
})
