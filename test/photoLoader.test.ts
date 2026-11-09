import { describe, expect, it } from 'vitest'
import { photoLoaderOf } from '../src/shared/photoLoader'

describe('photoLoaderOf', () => {
  it('is the bunny when nothing was picked', () => {
    expect(photoLoaderOf(undefined)).toBe('bunny')
  })

  it('keeps a choice this build knows', () => {
    expect(photoLoaderOf('shimmer')).toBe('shimmer')
    expect(photoLoaderOf('dots')).toBe('dots')
  })

  it('falls back to the bunny for a choice it does not know', () => {
    expect(photoLoaderOf('sparkles')).toBe('bunny')
  })
})
