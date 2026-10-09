import { describe, expect, it } from 'vitest'
import { buildPhotoPrompt } from '../src/shared/photoPrompt'
import { photoWardrobe, wardrobeLine } from '../src/shared/photoWardrobe'
import type { Character } from '../src/shared/types'
import { character } from './fixtures'

/** Her three fixed sets, and one of her own. */
const mina = {
  ...character({ charId: 'm', firstName: 'Mina', lastName: 'Kwon' }),
  baseAppearance: ['aqua_hair'],
  outfit: ['pink_cardigan', 'pleated_skirt'],
  peOutfit: ['gym_uniform', 'buruma'],
  swimOutfit: ['white_bikini'],
  customOutfits: { custom1: { name: 'Date night', tags: ['black_dress'] } }
} as Character

const drawn = (tier: 'everyday' | 'suggestive', caption: string): string =>
  buildPhotoPrompt(mina, tier, caption).positive

describe('photoWardrobe', () => {
  it('puts her in her own swimsuit or PE kit when the caption names it', () => {
    expect(drawn('suggestive', 'in her swimsuit by the water')).toContain('white_bikini')
    expect(drawn('everyday', 'in her PE kit after class')).toContain('gym_uniform')
  })

  it('reads the place a set is for, where the caption names no clothes', () => {
    expect(drawn('suggestive', 'lounging at the pool')).toContain('white_bikini')
    expect(drawn('everyday', 'stretching at the gym')).toContain('gym_uniform')
  })

  /** A swimsuit is suggestive: an everyday picture may not become one by where it was taken. */
  it('keeps an everyday picture at the pool in her ordinary clothes', () => {
    const pool = drawn('everyday', 'reading at the pool')
    expect(pool).toContain('pink_cardigan')
    expect(pool).not.toContain('white_bikini')
  })

  it('finds a set of her own by its name', () => {
    expect(drawn('everyday', 'ready to go out in Date night')).toContain('black_dress')
  })

  it('names her everyday clothes when the caption does', () => {
    expect(drawn('everyday', 'in her everyday clothes at her desk')).toContain('pink_cardigan')
  })

  it('leaves clothes none of her sets is to the caption', () => {
    expect(photoWardrobe(mina, 'wrapped in a towel after a shower', true, true)).toBeNull()
  })

  it('falls back to her main outfit when nothing is said', () => {
    expect(photoWardrobe(mina, 'at her desk with a coffee', false, true)).toEqual(mina.outfit)
  })
})

describe('wardrobeLine', () => {
  it('tells the caption writer every set she owns, in words', () => {
    const line = wardrobeLine(mina)
    expect(line).toContain('pink cardigan')
    expect(line).toContain('gym uniform')
    expect(line).toContain('white bikini')
    expect(line).toContain('"Date night"')
  })
})
