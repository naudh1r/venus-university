import { describe, expect, it } from 'vitest'
import {
  buildPhotoPrompt,
  buildDuoPhotoPrompt,
  lookingAtViewer,
  plainColours,
  shopNotDrink,
  withoutWhoTookIt
} from '../src/shared/photoPrompt'
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

describe('the clothes she is moving aside', () => {
  const girl = character({
    outfit: ['ivory_sweater', 'plaid_skirt'],
    peOutfit: ['gym_uniform'],
    swimOutfit: ['blue_bikini'],
    customOutfits: { custom1: { name: 'Date night', tags: ['black_dress'] } }
  })
  const tagsOf = (positive: string): string[] => positive.split(',').map((tag) => tag.trim())

  it('gives the park reveal its outfit, reveal, and occupied hands', () => {
    const scene =
      'In a park at night, standing under a dim path light, pulling down the ' +
      'neckline of her everyday clothes with both hands to bare both breasts, ' +
      'looking straight into the viewer, from the waist up.'
    const { positive } = buildPhotoPrompt(girl, 'explicit', scene)
    const tags = tagsOf(positive)
    expect(tags).toEqual(
      expect.arrayContaining([
        'clothes_pull',
        'breasts_out',
        '(ivory_sweater:1.2)',
        'partially_undressed'
      ])
    )
    expect(tags).not.toContain('hand_on_own_hip')
    expect(tags).not.toContain('plaid_skirt')
    expect(positive).not.toContain('everyday clothes')
    expect(positive).toContain('pulling down the neckline with both hands to bare both breasts')
    expect(positive.indexOf('ivory_sweater')).toBeLessThan(positive.indexOf('partially_undressed'))
  })

  it.each([
    ['pulling down her top to show her breasts', ['clothes_pull', 'breasts_out']],
    ['her shirt pulled down, her breasts exposed', ['clothes_pull', 'breasts_out']],
    ['pulling down her dress to bare both breasts', ['clothes_pull', 'breasts_out']],
    ['lifting her sweater, exposing her breasts', ['shirt_lift', 'breasts_out']],
    ['her shirt lifted, showing underboob', ['shirt_lift', 'underboob']],
    ['lifting her skirt', ['skirt_lift']],
    ['her skirt lifted', ['skirt_lift']],
    ['pulling down her panties', ['panty_pull']],
    ['her panties pulled down', ['panty_pull']],
    ['pulling down her shorts', ['pants_pull']],
    ['her pants pulled down', ['pants_pull']],
    ['her open shirt', ['open_shirt']],
    ['her shirt unbuttoned', ['open_shirt', 'open_clothes']],
    ['her bra pushed up', ['bra_lift']],
    ['her bra pulled down', ['bra_pull']]
  ])('names the explicit reveal in %s', (action, expected) => {
    const { positive } = buildPhotoPrompt(girl, 'explicit', `In her everyday clothes, ${action}.`)
    expect(tagsOf(positive)).toEqual(expect.arrayContaining(expected))
    if (expected.includes('panty_pull')) expect(tagsOf(positive)).not.toContain('panties_aside')
    if (expected.includes('bra_pull')) expect(tagsOf(positive)).not.toContain('bra_lift')
  })

  it.each([
    ['tugging her sweater off one shoulder, smiling at the viewer', ['off_shoulder']],
    ['her top off her shoulder', ['off_shoulder']],
    ['her strap slipping down', ['strap_slip']],
    ['lifting her shirt to show her bra', ['shirt_lift', 'bra']],
    ['lifting her top to show her stomach', ['shirt_lift', 'bra']],
    ['tugging her neckline', ['clothes_pull']],
    ['her skirt lifted to show her underwear', ['skirt_lift', 'panties']],
    ['flipping her skirt to show her underwear', ['skirt_lift', 'panties']]
  ])('keeps the suggestive reveal clothed in %s', (action, expected) => {
    const scene = `Standing in her everyday clothes, ${action}.`
    const { positive, negative } = buildPhotoPrompt(girl, 'suggestive', scene)
    const tags = tagsOf(positive)
    expect(tags).toEqual(expect.arrayContaining(['(ivory_sweater:1.2)', ...expected]))
    if (/tugging|lifting/.test(action)) expect(tags).not.toContain('hand_on_own_hip')
    for (const tag of ['breasts_out', 'underboob', 'nipples', 'nude', 'pussy']) {
      expect(tags).not.toContain(tag)
    }
    expect(negative).toBe(buildPhotoPrompt(girl, 'suggestive', 'Standing at home.').negative)
  })

  it('does not infer explicit reveals when a caption is passed at the suggestive tier', () => {
    const { positive } = buildPhotoPrompt(
      girl,
      'suggestive',
      'In her everyday clothes, lifting her shirt to bare her breasts.'
    )
    const tags = tagsOf(positive)
    expect(tags).not.toContain('breasts_out')
    expect(tags).not.toContain('nipples')
    expect(tags).not.toContain('underboob')
  })

  it('leaves everyday slipping clothes out of the reveal tables', () => {
    const { positive } = buildPhotoPrompt(
      girl,
      'everyday',
      'Standing in her everyday clothes, her sweater slipping off a shoulder.'
    )
    expect(tagsOf(positive)).toContain('(ivory_sweater:1.2)')
    for (const tag of [
      'off_shoulder',
      'strap_slip',
      'shirt_lift',
      'breasts_out',
      'undressing',
      'clothes_pull'
    ]) {
      expect(tagsOf(positive)).not.toContain(tag)
    }
  })

  it.each([
    ['her everyday clothes', 'ivory_sweater'],
    ['her PE kit', 'gym_uniform'],
    ['her swimsuit', 'blue_bikini'],
    ['her Date night outfit', 'black_dress']
  ])('adds the named set she is undressing: %s', (name, garment) => {
    const { positive } = buildPhotoPrompt(
      girl,
      'explicit',
      `Standing, pulling down the neckline of ${name} to bare both breasts.`
    )
    expect(positive).toContain(garment)
    expect(positive).not.toContain(name)
    expect(tagsOf(positive)).toContain('partially_undressed')
  })

  it('keeps described clothing as words, and a fully nude photo without outfit tags', () => {
    const described = buildPhotoPrompt(
      girl,
      'explicit',
      'Pulling down her red blouse to bare her breasts.'
    ).positive
    expect(described).toContain('red blouse')
    expect(described).not.toContain('ivory_sweater')
    const nude = buildPhotoPrompt(
      girl,
      'explicit',
      'Naked on her bed, her everyday clothes beside her.'
    ).positive
    expect(nude).toContain('nude, completely_nude, uncensored')
    expect(nude).toContain('her everyday clothes beside her')
    expect(nude).not.toContain('partially_undressed')
    expect(nude).not.toContain('ivory_sweater')
  })

  it('gives each girl her own named set to move aside in a duo', () => {
    const friend = character({ outfit: ['pink_shirt'] })
    const prompts = buildDuoPhotoPrompt(
      girl,
      friend,
      'explicit',
      'In their everyday clothes, pulling down their necklines to bare their breasts.'
    )
    expect(prompts.scene).not.toContain('everyday clothes')
    for (const [half, garment] of [
      [prompts.left, 'ivory_sweater'],
      [prompts.right, 'pink_shirt']
    ]) {
      expect(half).toContain(garment)
      expect(half).toContain('partially_undressed')
      expect(half).toContain('breasts_out')
    }
  })
})

describe('the half a partly undressed photo bares', () => {
  const girl = character({
    outfit: ['ivory_blouse', 'lavender pleated mini skirt'],
    peOutfit: ['blue_track_pants', 'sports_bra']
  })
  const tagsOf = (positive: string): string[] => positive.split(',').map((tag) => tag.trim())

  it('draws the restroom reveal with the top from her set and only her lower half bare', () => {
    const caption =
      'In the restaurant restroom stall, she stands with her lavender pleated ' +
      'mini skirt hitched up to her ribcage, having completely removed her panties which she ' +
      'dangles from one trembling finger, fully exposing her bare pink slit and flushed inner ' +
      'thighs, looking down toward the viewer, captured from the knees up.'
    const { positive } = buildPhotoPrompt(girl, 'explicit', caption)
    const tags = tagsOf(positive)
    expect(tags).toEqual(
      expect.arrayContaining([
        'holding_panties',
        'pussy',
        'no_panties',
        'bottomless',
        'skirt_lift',
        '(ivory_blouse:1.2)',
        'lavender pleated mini skirt',
        'partially_undressed'
      ])
    )
    expect(tags).not.toContain('hand_on_own_hip')
    expect(tags).not.toContain('nipples')
    expect(tags).not.toContain('breasts_out')
    expect(positive).toContain('her lavender pleated mini skirt hitched up')
  })

  it('bares only her lower half when she is naked from the waist down', () => {
    const tags = tagsOf(
      buildPhotoPrompt(
        girl,
        'explicit',
        'Standing, naked from the waist down in just her bandeau top, pulling up the back of her shorts.'
      ).positive
    )
    expect(tags).toContain('bottomless')
    expect(tags).not.toContain('completely_nude')
    expect(tags).not.toContain('nipples')
    expect(tags).not.toContain('breasts_out')
  })

  it('bares only her upper half when she pulls down her top', () => {
    const tags = tagsOf(
      buildPhotoPrompt(girl, 'explicit', 'Standing, pulling down her top to bare her breasts.')
        .positive
    )
    expect(tags).toEqual(expect.arrayContaining(['nipples', 'breasts_out', 'partially_undressed']))
    expect(tags).not.toContain('pussy')
    expect(tags).not.toContain('bottomless')
  })

  it.each([
    ['Took off her panties, her skirt hitched up.', ['no_panties', 'skirt_lift', 'pussy']],
    ['In her everyday clothes, no panties, her skirt pulled up.', ['no_panties', 'pussy']],
    ['Her panties around her ankle, her skirt lifted.', ['panty_pull', 'pussy']],
    ['Her panties around her knee, her skirt lifted.', ['panty_pull', 'pussy']],
    ['Her panties around one leg, her skirt lifted.', ['panties_around_one_leg', 'pussy']],
    ['Her skirt lifted, her pussy showing.', ['pussy', 'skirt_lift']],
    ['Her skirt lifted, her pussy fully exposed.', ['pussy', 'skirt_lift']],
    ['Her skirt lifted, exposing her pink slit.', ['pussy', 'skirt_lift']]
  ])('reads the lower reveal in %s', (caption, expected) => {
    const tags = tagsOf(buildPhotoPrompt(girl, 'explicit', caption).positive)
    expect(tags).toEqual(expect.arrayContaining(expected))
    expect(tags).not.toContain('nipples')
    expect(tags).not.toContain('breasts_out')
  })

  it('keeps both bare halves when both are revealed, and fully nude photos as they were', () => {
    const both = tagsOf(
      buildPhotoPrompt(
        girl,
        'explicit',
        'In her everyday clothes, lifting her shirt to show her breasts, her skirt lifted, no panties.'
      ).positive
    )
    expect(both).toEqual(expect.arrayContaining(['nipples', 'breasts_out', 'pussy', 'no_panties']))
    const nude = tagsOf(buildPhotoPrompt(girl, 'explicit', 'Fully naked on her bed.').positive)
    expect(nude).toEqual(expect.arrayContaining(['nude', 'completely_nude', 'nipples', 'pussy']))
    expect(nude).not.toContain('partially_undressed')
    expect(nude).not.toContain('(ivory_blouse:1.2)')
  })

  it('does not select a set from a garment noun alone', () => {
    const { positive } = buildPhotoPrompt(girl, 'explicit', 'Lifting a skirt.')
    expect(positive).not.toContain('ivory_blouse')
    expect(positive).not.toContain('lavender pleated mini skirt')
    expect(tagsOf(positive)).toContain('partially_undressed')
  })

  it('does not apply garment matching or partial coverage to clothed photos', () => {
    const { positive } = buildPhotoPrompt(girl, 'everyday', 'In a lavender mini skirt at a cafe.')
    expect(positive).not.toContain('ivory_blouse')
    expect(tagsOf(positive)).not.toContain('pussy')
    expect(tagsOf(positive)).not.toContain('no_panties')
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


describe('the colour of what she wears', () => {
  it('holds her top to its colour, and leaves her shoes and the rest alone', () => {
    const her = character({ outfit: ['pink_sports_bra', 'black_spandex_shorts', 'white_running_shoes'] })
    const { positive } = buildPhotoPrompt(her, 'everyday', 'posing in a neon-lit alley at night')
    expect(positive).toContain('(pink_sports_bra:1.2)')
    expect(positive).toContain('black_spandex_shorts')
    expect(positive).not.toContain('(white_running_shoes')
  })
})

describe('legwear she was never given', () => {
  /** The in-game caption that drew pink latex leggings under white thighhighs. */
  const scene =
    'Sitting at a small wooden cafe table in her everyday clothes, leaning forward with one ' +
    'elbow propped up and her cheek resting on her hand while she bites softly on a pastel ' +
    'boba straw, looking directly into the camera'

  it('is not named in the negative, where it painted one of her legs instead', () => {
    const her = character({ baseAppearance: ['1girl', 'pink_hair', 'pink_eyeshadow'] })
    const { positive, negative } = buildPhotoPrompt(
      her,
      'everyday',
      'posing in a neon-lit back alley at night in a white crop top and black shorts'
    )
    expect(negative).not.toMatch(/legwear|pantyhose|leggings|thighhighs|latex/)
    expect(positive).not.toContain('bare_legs')
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

describe('a shop named after its drink', () => {
  it('becomes a tea shop where her hands are free', () => {
    // The in-game caption that put a cup at her lips on every seed.
    expect(shopNotDrink('A close-up selfie in a brightly lit pastel bubble tea shop')).toBe(
      'A close-up selfie in a brightly lit pastel tea shop'
    )
    expect(shopNotDrink('waving from a boba cafe')).toBe('waving from a tea cafe')
  })

  it('stays as it is where she has the drink', () => {
    for (const scene of [
      'sipping a taro milk tea in a bubble tea shop',
      'holding a cup of boba outside a bubble tea shop'
    ]) {
      expect(shopNotDrink(scene)).toBe(scene)
    }
  })
})

describe('a dressed picture', () => {
  it('keeps her covered where the caption does not undress her', () => {
    const { negative } = buildPhotoPrompt(character(), 'everyday', 'lying on her bed in a sweater')
    for (const tag of ['nude', 'nipples', 'areolae', 'pussy']) {
      expect(negative).toContain(tag)
    }
    expect(negative).not.toContain('pantyshot')
  })

  it('keeps her chest covered in an everyday photo unless what she wears shows it', () => {
    const plain = buildPhotoPrompt(character(), 'everyday', 'lying on her bed in a sweater')
    expect(plain.negative).toContain('cleavage')
    expect(plain.negative).toContain('downblouse')
    const low = buildPhotoPrompt(character(), 'everyday', 'in an off-shoulder sweater at the cafe')
    expect(low.negative).not.toContain('cleavage')
    const flirty = buildPhotoPrompt(character(), 'suggestive', 'lying on her bed in a sweater')
    expect(flirty.negative).not.toContain('cleavage')
  })

  it('leaves what the caption names, and an explicit picture alone', () => {
    const { negative } = buildPhotoPrompt(
      character(),
      'suggestive',
      'sitting on the bed, nude under a loose shirt'
    )
    expect(negative).not.toMatch(/\bnude\b/)
    const bare = buildPhotoPrompt(character(), 'explicit', 'naked on the bed').negative
    expect(bare).not.toContain('nipples')
  })
})

describe('where she looks', () => {
  it('says the viewer, not the camera, so no camera is drawn', () => {
    expect(lookingAtViewer('lying on her side, looking at the camera')).toBe(
      'lying on her side, looking at the viewer'
    )
    expect(lookingAtViewer('she smirks into the lens')).toBe('she smirks into the viewer')
    const { positive } = buildPhotoPrompt(character(), 'everyday', 'smiling at the camera')
    expect(positive).not.toMatch(/camera/)
    expect(positive).toContain('looking_at_viewer')
  })

  it('leaves a camera of her own', () => {
    const scene = 'holding her film camera, looking at the camera'
    expect(lookingAtViewer(scene)).toBe(scene)
  })
})

describe('the in-game mirror selfie that splashed pink everywhere', () => {
  const caption =
    'A close mirror selfie of a girl with bright pink hair wearing an off-the-shoulder cropped ' +
    'knit sweater that slips down one bare shoulder, sitting cross-legged on an unmade dorm bed ' +
    'with a glass of pink liquid in hand'

  it('says the drink as a drink, and keeps splashes and stains out', () => {
    const { positive, negative } = buildPhotoPrompt(character(), 'suggestive', caption)
    // A mirror selfie's other hand holds nothing, so the glass leaves her sentence entirely.
    expect(positive).not.toMatch(/liquid|glass/)
    const sat = buildPhotoPrompt(character(), 'everyday', 'on her bed with a glass of pink liquid')
    expect(sat.positive).toContain('a glass of pink drink')
    for (const tag of ['paint_splatter', 'splashing', 'stain']) expect(negative).toContain(tag)
  })

  it('keeps her hands off her lap, and the close shot close', () => {
    const { positive } = buildPhotoPrompt(character(), 'suggestive', caption)
    expect(positive).not.toContain('hands_on_lap')
    expect(positive).not.toContain('full_body')
    expect(positive).toContain('mirror')
  })
})

describe('a photo a friend took', () => {
  it('leaves the friend out of the sentence, so she is drawn alone', () => {
    expect(withoutWhoTookIt('a photo a friend took of her on the couch, smiling')).toBe(
      'a photo on the couch, smiling'
    )
    expect(withoutWhoTookIt('full body in a sundress at the beach, taken by a friend')).toBe(
      'full body in a sundress at the beach'
    )
    expect(withoutWhoTookIt('a photo somebody took of her at the park')).toBe('a photo at the park')
    const { positive } = buildPhotoPrompt(character(), 'everyday', 'a photo my friend took of me')
    expect(positive).not.toMatch(/friend/)
  })
})
