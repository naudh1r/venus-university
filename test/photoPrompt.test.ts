import { describe, expect, it } from 'vitest'
import { buildPhotoPrompt, plainColours } from '../src/shared/photoPrompt'
import type { Character } from '../src/shared/types'
import { character } from './fixtures'

/** Enough of a character to prompt from; the rest of her is not read here. */
const celest = {
  charId: 'c1',
  firstName: 'Celest',
  lastName: 'Varga',
  baseAppearance: ['aqua_hair', 'light_purple_eyes'],
  outfit: ['pink cardigan', 'white blouse'],
  // A body is only here while the body switch is on: the render strips it otherwise.
  body: {
    build: 'curvy',
    breasts: 'large_breasts',
    hipsThighs: 'wide_hips',
    buttocks: 'huge_ass',
    pubicHair: 'female_pubic_hair'
  },
  negativeTags: ['glasses']
} as unknown as Character

/** What the prompt says about her, as one string, for the assertions below. */
const promptFor = (tier: Parameters<typeof buildPhotoPrompt>[1], caption: string): string =>
  buildPhotoPrompt(celest, tier, caption).positive

describe('buildPhotoPrompt', () => {
  it('strikes out her name and the name of the place', () => {
    const positive = promptFor(
      'everyday',
      'Celest sitting cross-legged on her bed in her Lowrise 3 room, holding her sketchbook'
    )
    expect(positive).toContain('sitting cross-legged on her bed in her room, holding her sketchbook')
    expect(positive).not.toMatch(/Celest|Lowrise/)
  })

  // The quality run is the feature's own, not the sprites': `imagePrompt` keeps its private,
  // and a photo is a different picture on a different graph. The assertion is that a photo opens
  // on quality and refuses a sprite's cut-out background, not that the two strings match.
  it('leads with quality tags, and no white background', () => {
    const { positive, negative } = buildPhotoPrompt(celest, 'everyday', 'at a window in the rain')
    expect(positive.startsWith('masterpiece, best_quality, very_aesthetic')).toBe(true)
    expect(negative).toContain('white_background')
  })

  it('undresses her only at the explicit tier', () => {
    expect(promptFor('explicit', 'lying back on her bed, naked')).toContain('nude')
    expect(promptFor('suggestive', 'lying back on her bed')).toContain('pink cardigan')
  })

  it('names only the parts the picture contains', () => {
    // On her back and bare: her chest and between her legs are both in shot.
    const back = promptFor('explicit', 'naked, lying on her back on the sheets')
    expect(back).toContain('nipples')
    expect(back).toContain('pussy')
    expect(back).toContain('female_pubic_hair')
    expect(back).not.toContain('huge_ass')

    // Turned away: her chest is not, and saying so would put a second woman in the frame.
    const behind = promptFor('explicit', 'naked, standing with her back turned to the mirror')
    expect(behind).toContain('huge_ass')
    expect(behind).not.toContain('nipples')
    expect(behind).not.toContain('female_pubic_hair')
  })

  it('reads her through her clothes rather than under them', () => {
    const bra = promptFor('suggestive', 'in a black lace bra, sitting on the edge of the bed')
    expect(bra).toContain('cleavage')
    expect(bra).not.toContain('nipples')
  })

  it('keeps her build and her chest whatever the picture shows', () => {
    const face = promptFor('everyday', 'a close-up of her face by the window')
    expect(face).toContain('curvy')
    expect(face).toContain('large_breasts')
  })

  it('names the hair between her legs only when she is undressed', () => {
    expect(promptFor('suggestive', 'in black lace panties on the bed')).not.toContain('pubic')
  })

  /** Her hips through cloth are her own hips, not the shape every other girl gets. */
  it('reads her own hips through cloth, where she has them', () => {
    const shorts = promptFor('suggestive', 'in black leggings, standing by the mirror')
    expect(shorts).toContain('wide_hips')
    const plain = { ...celest, body: { build: 'toned' } } as unknown as Character
    expect(
      buildPhotoPrompt(plain, 'suggestive', 'in black leggings, standing by the mirror').positive
    ).not.toContain('wide_hips')
  })

  it('gives the composition its own tags', () => {
    const shot = promptFor('explicit', 'naked on all fours on the bed, looking back at the camera')
    expect(shot).toContain('all_fours')
    expect(shot).toContain('looking_at_viewer')
  })

  it('leaves her wardrobe out when the picture already dresses her', () => {
    expect(promptFor('suggestive', 'in a black bikini at the lake')).not.toContain('pink cardigan')
  })

  /**
   * The game's cast has no body written, so a bare picture is described the way her nude sprite
   * is: the same fixed words, for only the parts in shot.
   */
  it("names a bare picture in the nude sprite's words, for the parts in shot", () => {
    const plain = { ...celest, body: undefined } as unknown as Character
    const front = buildPhotoPrompt(plain, 'explicit', 'naked, lying on her back').positive
    expect(front).toContain('nipples')
    expect(front).toContain('navel')
    expect(front).toContain('pussy')
    expect(front).not.toContain('pubic_hair')

    const back = buildPhotoPrompt(plain, 'explicit', 'naked, standing from behind').positive
    expect(back).not.toMatch(/\bnipples\b|\bpussy\b/)
  })

  it('never reads a covered part through the cloth by the tags that confused the checkpoint', () => {
    const bra = promptFor('suggestive', 'in a black lace bra and panties, sitting on the bed')
    expect(bra).not.toContain('visible_through_clothes')
    expect(bra).not.toContain('cameltoe')
  })

  it('refuses a second person in every picture', () => {
    const { negative } = buildPhotoPrompt(celest, 'explicit', 'naked, lying on her back')
    for (const tag of ['1boy', 'multiple_girls', 'hetero', 'penis']) {
      expect(negative).toContain(tag)
    }
  })

  /** Anal on her own is hers to send; only somebody else doing it is refused, by the tags above. */
  it('does not refuse anything she does on her own', () => {
    const { negative } = buildPhotoPrompt(celest, 'explicit', 'naked on all fours, a butt plug in')
    const tags = String(negative).split(',').map((tag) => tag.trim())
    expect(tags).not.toContain('anal')
    expect(tags).not.toContain('anus')
  })

  /** A caption that dresses her replaces her wardrobe; one that does not keeps it. */
  it('puts her in the clothes the caption names, and only those', () => {
    const sundress = promptFor('everyday', 'In a yellow sundress on the quad, waving')
    expect(sundress).toContain('yellow sundress')
    expect(sundress).not.toContain('pink cardigan')

    const onTop = promptFor('everyday', 'Sitting on top of her bed with a book')
    expect(onTop).toContain('pink cardigan')
  })
})

describe('an explicit picture she is still partly dressed in', () => {
  /** The caption a playtest drew wrong: dressed, a thong pulled aside, legs crossed, shot low. */
  const caption =
    'Sitting in a corner booth in her everyday clothes with her pleated skirt bunched at her hip, sheer white thighhighs on, her pink lacy thong pulled to the side as two fingers rest on her bare pussy, legs crossed tight, shot low from under the table close on her lap, eyes glancing down at her own hand.'
  const positive = buildPhotoPrompt(celest, 'explicit', caption).positive

  it('is partly undressed by what she moved aside, not completely nude', () => {
    expect(positive).not.toContain('completely_nude')
    expect(positive).toContain('partially_undressed')
    expect(positive).toContain('panties_aside')
    expect(positive).toContain('skirt_lift')
  })

  it('keeps her top on: her clothes still cover her chest', () => {
    expect(positive).not.toMatch(/\bnipples\b/)
  })

  it('keeps her legs crossed and the camera low', () => {
    expect(positive).not.toContain('spread_legs')
    expect(positive).toContain('crossed_legs')
    expect(positive).toContain('from_below')
  })

  it('says 1girl once, and leaves no full stop in front of the tags', () => {
    expect(positive.match(/\b1girl\b/g)).toHaveLength(1)
    expect(positive).not.toContain('.,')
  })

  it('is still completely nude where the caption says so', () => {
    expect(buildPhotoPrompt(celest, 'explicit', 'naked, lying on her back').positive).toContain(
      'completely_nude'
    )
  })
})


describe('legwear she was never given', () => {
  /** The in-game caption that drew pink latex leggings under white thighhighs. */
  const scene =
    'Sitting at a small wooden cafe table in her everyday clothes, leaning forward with one ' +
    'elbow propped up and her cheek resting on her hand while she bites softly on a pastel ' +
    'boba straw, looking directly into the camera'

  it('refuses the legwear she has not got, and keeps the thighhighs she has', () => {
    const her = character({ baseAppearance: ['1girl', 'pink_eyeshadow'] })
    const { negative } = buildPhotoPrompt(
      her,
      'everyday',
      `${scene}, in a white pleated skirt and sheer white thighhigh socks`
    )
    expect(negative).toEqual(expect.stringContaining('leggings'))
    expect(negative).toEqual(expect.stringContaining('latex'))
    expect(negative).toEqual(expect.stringContaining('colored_legwear'))
    // The pink of her eyeshadow is refused on her legs; a colour the prompt never names is not.
    expect(negative).toContain('pink_legwear')
    expect(negative).not.toContain('green_legwear')
    expect(negative).not.toContain('thighhighs')
  })

  it('bares her legs under a skirt with nothing named on them', () => {
    const { positive, negative } = buildPhotoPrompt(
      character(),
      'everyday',
      'sitting in the cafe in a short pleated skirt, smiling'
    )
    expect(positive).toContain('bare_legs')
    expect(negative).toContain('thighhighs')
  })

  it('leaves the coloured legwear she asked for', () => {
    const { negative } = buildPhotoPrompt(
      character(),
      'everyday',
      'standing by the window in a red skirt and pink thighhigh stockings'
    )
    expect(negative).not.toContain('colored_legwear')
    expect(negative).not.toContain('pink_legwear')
    expect(negative).toContain('red_legwear')
    expect(negative).not.toContain('thighhighs')
  })

  it('takes her hands off her lap when her cheek is resting on one', () => {
    const { positive } = buildPhotoPrompt(character(), 'everyday', scene)
    expect(positive).not.toContain('hands_on_lap')
  })
})

describe('a colour named after food', () => {
  it('is said plainly where it colours what she wears', () => {
    // The in-game caption that drew cream poured on her chest.
    expect(
      plainColours('lounging across dark sheets in an unbuttoned cream silk shirt')
    ).toBe('lounging across dark sheets in an unbuttoned ivory silk shirt')
    expect(plainColours('honey blonde hair and a cherry red dress')).toBe(
      'blonde hair and a red dress'
    )
    expect(plainColours('a cream-colored cardigan')).toBe('a ivory cardigan')
  })

  it('is left as food where it is food', () => {
    for (const scene of [
      'licking an ice cream cone',
      'a bite of strawberry cake with cream',
      'holding a coffee in her hand',
      'a glass of wine on the table'
    ]) {
      expect(plainColours(scene)).toBe(scene)
    }
  })

  it('reaches the prompt', () => {
    const { positive } = buildPhotoPrompt(character(), 'everyday', 'in a cream silk shirt')
    expect(positive).toContain('ivory silk shirt')
    expect(positive).not.toMatch(/cream/)
  })
})
