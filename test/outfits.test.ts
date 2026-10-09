import { describe, expect, it } from 'vitest'
import { EMOTIONS } from '@shared/emotions'
import type { PromptEdit } from '@shared/imagePrompt'
import {
  CUSTOM_OUTFIT_NAME_MAX,
  CUSTOM_OUTFIT_SLOTS,
  followsMain,
  offeredCustomOutfits,
  OUTFIT_SETS,
  outfitTagsFor,
  parseSpriteRef,
  spriteRef,
  storedRefOf,
  withCustomOutfit,
  withoutCustomOutfit,
  writtenRefOf
} from '@shared/outfits'
import type { CustomOutfit } from '@shared/types'
import { character } from './fixtures'

/**
 * The sprite-reference grammar, read back. A `SpriteRef` is written into
 * every save's `scene.emotions` and read again on load, so the join and the split
 * have to be exact inverses — a ref that stops parsing is a sprite silently dropped.
 */

describe('parseSpriteRef', () => {
  it('reads back every reference `spriteRef` can write', () => {
    for (const emotion of EMOTIONS) {
      expect(parseSpriteRef(spriteRef(emotion, null))).toEqual({ emotion, set: null })
      for (const set of OUTFIT_SETS) {
        expect(parseSpriteRef(spriteRef(emotion, set))).toEqual({ emotion, set })
      }
    }
  })
})

describe('outfitTagsFor', () => {
  it('reads a custom slot’s tags, and answers nothing for a slot she has none for', () => {
    const written = character({ customOutfits: { custom1: { tags: ['maid', 'apron'] } } })
    expect(outfitTagsFor(written, 'custom1')).toEqual(['maid', 'apron'])
    expect(outfitTagsFor(written, 'custom2')).toEqual([])
    expect(outfitTagsFor(character(), 'custom1')).toEqual([])
  })

  it('answers nothing for a hand-edited entry whose tags are not a list of strings', () => {
    // The prompt builder reads this straight off the record; a throw here is a render lost.
    const broken = character({
      customOutfits: { custom1: { tags: 'maid' } as unknown as CustomOutfit }
    })
    expect(outfitTagsFor(broken, 'custom1')).toEqual([])
  })
})

describe('followsMain', () => {
  it('reads a set with no flag of its own as armed, and a false flag as spent', () => {
    expect(followsMain(character({ seedFollowsMain: {} }), 'custom1')).toBe(true)
    expect(followsMain(character({ seedFollowsMain: { custom1: false } }), 'custom1')).toBe(false)
  })
})

describe('withCustomOutfit', () => {
  it('lowercases the name and takes its spaces out, drops a blank one and cuts a long one', () => {
    const blank = withCustomOutfit(character(), 'custom1', { name: '   ', tags: ['maid'] })
    expect(blank.customOutfits?.custom1).toEqual({ tags: ['maid'] })

    const squished = withCustomOutfit(character(), 'custom1', { name: ' Bunny Girl ', tags: [] })
    expect(squished.customOutfits?.custom1?.name).toBe('bunnygirl')

    const long = withCustomOutfit(character(), 'custom1', { name: 'x'.repeat(40), tags: [] })
    expect(long.customOutfits?.custom1?.name).toBe('x'.repeat(CUSTOM_OUTFIT_NAME_MAX))
  })

  it('keeps what a write leaves out, and clears what it blanks', () => {
    // A rename landing after the instructions were written must not take them away.
    const held = character({
      customOutfits: { custom1: { name: 'maid', tags: ['maid'], instructions: 'she works' } }
    })
    const renamed = withCustomOutfit(held, 'custom1', { name: 'Cafe Maid' })
    expect(renamed.customOutfits?.custom1).toEqual({
      name: 'cafemaid',
      tags: ['maid'],
      instructions: 'she works'
    })

    const cleared = withCustomOutfit(held, 'custom1', { instructions: '  ' })
    expect(cleared.customOutfits?.custom1).toEqual({ name: 'maid', tags: ['maid'] })
  })
})

describe('offeredCustomOutfits', () => {
  it('offers a rendered slot with instructions, under a suffix no other set answers to', () => {
    const wardrobe = (name: string | undefined): CustomOutfit => ({
      ...(name !== undefined ? { name } : {}),
      tags: ['x'],
      instructions: 'always'
    })
    const dressed = character({
      customOutfits: {
        custom1: wardrobe('maid'),
        custom2: wardrobe('maid'),
        custom3: wardrobe('pe'),
        custom4: wardrobe('custom1'),
        custom5: { name: 'nurse', tags: ['x'] }
      }
    })
    const offered = offeredCustomOutfits(dressed, [...CUSTOM_OUTFIT_SLOTS])
    expect(offered.map((outfit) => [outfit.slot, outfit.suffix])).toEqual([
      ['custom1', 'maid'],
      ['custom2', 'custom2'],
      ['custom3', 'custom3'],
      ['custom4', 'custom4']
    ])
    // Not whole on disk, nothing offered.
    expect(offeredCustomOutfits(dressed, ['custom2', 'pe']).map((outfit) => outfit.slot)).toEqual([
      'custom2'
    ])
  })

  it('reads every written reference back to the slot it was offered under', () => {
    // A written suffix is what reaches `scene.emotions` once translated; a miss is the wrong
    // wardrobe saved, or the sprite dropped.
    const dressed = character({
      customOutfits: {
        custom1: { name: 'bunny_girl', tags: ['x'], instructions: 'always' },
        custom3: { tags: ['x'], instructions: 'always' }
      }
    })
    const offered = offeredCustomOutfits(dressed, ['custom1', 'custom3'])
    for (const emotion of EMOTIONS) {
      for (const outfit of offered) {
        const stored = spriteRef(emotion, outfit.slot)
        expect(storedRefOf(writtenRefOf(stored, offered), offered)).toBe(stored)
      }
    }
    expect(storedRefOf('happy_nobody', offered)).toBeNull()
  })
})

describe('withoutCustomOutfit', () => {
  it('takes the entry, its recorded seed and its arming flag off the record together', () => {
    // A slot left holding a seed would render the player's next wardrobe under the
    // clothes the last one was cut from.
    const held = character({
      customOutfits: { custom1: { tags: ['maid'] }, custom2: { tags: ['apron'] } },
      setSeeds: { custom1: 999, pe: 111 },
      seedFollowsMain: { custom1: false, pe: false }
    })
    const result = withoutCustomOutfit(held, 'custom1')

    expect(result.customOutfits).toEqual({ custom2: { tags: ['apron'] } })
    expect(result.setSeeds).toEqual({ pe: 111 })
    expect(result.seedFollowsMain).toEqual({ pe: false })
  })

  it('drops the field entirely once the last wardrobe is gone', () => {
    const only = character({ customOutfits: { custom1: { tags: ['maid'] } } })
    expect('customOutfits' in withoutCustomOutfit(only, 'custom1')).toBe(false)
  })

  it('forgets what the slot’s button and its sprites’ buttons last sent, and nothing else', () => {
    const slotEdit: PromptEdit = {
      kind: 'sprite',
      set: 'custom1',
      base: [],
      appearance: [],
      outfit: [],
      pose: [],
      negative: []
    }
    const kept = character({
      customOutfits: { custom1: { tags: ['maid'] } },
      regenTags: {
        custom1: slotEdit,
        'expression:happy_custom1': { kind: 'expression', expression: ['happy_custom1'] },
        'expression:happy_pe': { kind: 'expression', expression: ['happy_pe'] }
      }
    })
    const result = withoutCustomOutfit(kept, 'custom1')
    expect(result.regenTags).toEqual({
      'expression:happy_pe': { kind: 'expression', expression: ['happy_pe'] }
    })

    const only = character({
      customOutfits: { custom1: { tags: ['maid'] } },
      regenTags: { custom1: slotEdit }
    })
    expect('regenTags' in withoutCustomOutfit(only, 'custom1')).toBe(false)
  })
})
