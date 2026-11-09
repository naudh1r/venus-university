import { describe, expect, it } from 'vitest'
import { buildPhotoPrompt } from '../src/shared/photoPrompt'
import { photoWardrobe, wardrobeLine, photoWardrobeFromGarment } from '../src/shared/photoWardrobe'
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

  it('keeps the arcade, replacing her everyday clothes with their tags', () => {
    const positive = drawn(
      'everyday',
      'A mirror selfie of her in her everyday clothes holding an empty token cup ' +
        'beside a row of brightly lit arcade cabinets.'
    )
    expect(positive).toContain('A mirror selfie of her beside a row of brightly lit arcade cabinets')
    expect(positive).toContain('pink_cardigan')
    expect(positive).not.toMatch(/everyday clothes|token cup/)
  })

  it('keeps her room and smile around a named outfit', () => {
    const positive = drawn(
      'everyday',
      'A mirror selfie of her in her room wearing her everyday clothes, ' +
        'smiling sweetly at the viewer.'
    )
    expect(positive).toContain('A mirror selfie of her in her room, smiling sweetly at the viewer')
    expect(positive).not.toContain('everyday clothes')
  })

  it.each([
    ['in her own everyday cloth', 'pink_cardigan'],
    ['dressed in their everyday outfit', 'pink_cardigan'],
    ['wearing her own usual clothes', 'pink_cardigan'],
    ['in her clothes', 'pink_cardigan'],
    ['in their PE kit', 'gym_uniform'],
    ['wearing her swimsuit', 'white_bikini'],
    ['dressed in her Date night', 'black_dress'],
    ['in Date night', 'black_dress'],
    ['wearing her Date night outfit', 'black_dress']
  ])('replaces only the named set in %s', (reference, tag) => {
    const positive = drawn('suggestive', `At her desk ${reference}, smiling.`)
    expect(positive).toContain(tag)
    expect(positive).toContain('At her desk, smiling')
    expect(positive).not.toContain(reference)
  })

  it('handles punctuation and quotes in a custom set name', () => {
    const girl = {
      ...mina,
      customOutfits: { custom1: { name: 'After-hours (rain)', tags: ['yellow_raincoat'] } }
    } as Character
    const positive = buildPhotoPrompt(
      girl,
      'everyday',
      'At the arcade, dressed in her "After-hours (rain)" outfit, smiling.'
    ).positive
    expect(positive).toContain('yellow_raincoat')
    expect(positive).toContain('At the arcade, smiling')
    expect(positive).not.toContain('After-hours')
  })

  it('keeps real clothes instead of replacing them with a wardrobe', () => {
    const positive = drawn('everyday', 'At the arcade in a red raincoat, smiling.')
    expect(positive).toContain('At the arcade in a red raincoat, smiling')
    expect(positive).not.toContain('pink_cardigan')
  })

  it.each([
    'hat', 'beanie', 'cap', 'scarf', 'glasses', 'sunglasses', 'earrings', 'necklace',
    'choker', 'bracelet', 'ring', 'bag', 'purse', 'backpack', 'hair clip', 'ribbon',
    'headphones', 'watch'
  ])('keeps her set underneath an accessory alone: %s', (accessory) => {
    for (const caption of [`Waving in a ${accessory}`, `Wearing a ${accessory}, waving`]) {
      const positive = drawn('everyday', caption)
      expect(positive).toContain('pink_cardigan')
      expect(positive).toContain(caption)
    }
  })

  it('keeps a described dress and choker without adding her set', () => {
    const positive = drawn('everyday', 'In a black slip dress and a choker')
    expect(positive).toContain('In a black slip dress and a choker')
    expect(positive).not.toContain('pink_cardigan')
  })

  it('keeps an outfit reference when no outfit tags were supplied', () => {
    const undressed = { ...mina, outfit: [] }
    expect(
      buildPhotoPrompt(undressed, 'everyday', 'In her everyday clothes at home').positive
    ).toContain('In her everyday clothes at home')
    expect(
      buildPhotoPrompt(undressed, 'explicit', 'In her everyday clothes, skirt lifted').positive
    ).toContain('In her everyday clothes')
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

describe('a set identified by one of its garments', () => {
  const girl = {
    ...mina,
    outfit: ['white_blouse', '(lavender_pleated_mini_skirt:1.2)'],
    peOutfit: ['blue_track_pants', 'sports_bra'],
    customOutfits: { custom1: { name: 'Rainy day', tags: ['yellow_raincoat'] } }
  } as Character

  it('reads colour or style beside the garment noun, including tag separators and weights', () => {
    expect(photoWardrobeFromGarment(girl, 'Her lavender mini skirt hitched up')).toEqual(
      girl.outfit
    )
    expect(photoWardrobeFromGarment(girl, 'Her pleated skirt lifted')).toEqual(girl.outfit)
    expect(photoWardrobeFromGarment(girl, 'Her blue track pants pulled down')).toEqual(
      girl.peOutfit
    )
    expect(photoWardrobeFromGarment(girl, 'Her yellow raincoat held open')).toEqual([
      'yellow_raincoat'
    ])
  })

  it('requires a modifier of the same garment, not one on another item or a bare noun', () => {
    expect(photoWardrobeFromGarment(girl, 'Lifting a skirt')).toBeNull()
    expect(photoWardrobeFromGarment(girl, 'A lavender shirt and a plain skirt')).toBeNull()
    expect(photoWardrobeFromGarment(girl, 'A yellow scarf and a plain raincoat')).toBeNull()
  })
})
