import { describe, expect, it } from 'vitest'
import {
  allowedPhotoTier,
  describedPhotoTier,
  describesSomebodyElse,
  settlePhoto
} from '@shared/photoGate'
import type { CharacterTrait } from '@shared/traits'
import type { CharFlags } from '@shared/types'

/** What she will photograph of herself, decided from the save and never from the reply. */

function flags(over: Partial<CharFlags> = {}): CharFlags {
  return {
    hasMet: true,
    hasCrush: false,
    friendZoned: false,
    friendZonedBy: false,
    isLover: false,
    brokenUp: 0,
    hasKissed: false,
    hadSex: false,
    benefits: false,
    harem: false,
    gaveContactInfo: true,
    blocked: false,
    knowsTraits: false,
    knowsBackstory: false,
    knowsLoveLife: false,
    ...over
  }
}

const AT_EASE = 12

describe('allowedPhotoTier', () => {
  it('sends nothing to a stranger or to a blocked number', () => {
    expect(allowedPhotoTier({ flags: undefined, affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })).toBe('none')
    expect(
      allowedPhotoTier({ flags: flags({ gaveContactInfo: false }), affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })
    ).toBe('none')
    expect(
      allowedPhotoTier({ flags: flags({ blocked: true, isLover: true }), affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })
    ).toBe('none')
  })

  it('sends nothing while she is annoyed with him, whatever they have been', () => {
    // `annoyed` starts below -15; a lover she is sour with gets nothing either.
    expect(allowedPhotoTier({ flags: flags({ isLover: true }), affection: -20, traits: [], noNsfwImages: false, canRender: true })).toBe('none')
  })

  it('lets a contact have the everyday pictures', () => {
    expect(allowedPhotoTier({ flags: flags(), affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })).toBe('everyday')
  })

  it('opens the teasing ones once they have kissed and she likes him', () => {
    expect(
      allowedPhotoTier({ flags: flags({ hasKissed: true }), affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })
    ).toBe('suggestive')
    // A contact they have never kissed stays on the everyday ones however fond she is.
    expect(allowedPhotoTier({ flags: flags(), affection: 40, traits: [], noNsfwImages: false, canRender: true })).toBe('everyday')
  })

  it('opens the explicit ones to a lover, and the player can close them again', () => {
    expect(allowedPhotoTier({ flags: flags({ isLover: true }), affection: AT_EASE, traits: [], noNsfwImages: false, canRender: true })).toBe(
      'explicit'
    )
    expect(allowedPhotoTier({ flags: flags({ isLover: true }), affection: AT_EASE, traits: [], noNsfwImages: true, canRender: true })).toBe(
      'suggestive'
    )
  })
})

describe('a bold character', () => {
  it('sends what she likes to anyone with her number, however she feels about him', () => {
    const bold = {
      flags: flags(),
      traits: ['Promiscuous'] as CharacterTrait[],
      noNsfwImages: false,
      canRender: true
    }
    // No kiss, no milestones, and she barely knows him.
    expect(allowedPhotoTier({ ...bold, affection: 0 })).toBe('explicit')
    // Sour on him, which stops everybody else outright.
    expect(allowedPhotoTier({ ...bold, affection: -40 })).toBe('explicit')
  })

  it("is still bound by the player's switch and by a block", () => {
    expect(
      allowedPhotoTier({ flags: flags(), traits: ['Promiscuous'] as CharacterTrait[], affection: 0, noNsfwImages: true, canRender: true })
    ).toBe('suggestive')
    expect(
      allowedPhotoTier({
        flags: flags({ blocked: true }),
        traits: ['Promiscuous'] as CharacterTrait[],
        affection: 40,
        noNsfwImages: false,
        canRender: true
      })
    ).toBe('none')
  })

  /**
   * The local renderer is optional, and the browser ships none. Without one a photograph she
   * offers cannot arrive, and the thread would talk about a picture that will never exist — so
   * she is never told she may send one, whatever they are to each other.
   */
  it('sends nothing at all where no picture can be drawn', () => {
    expect(
      allowedPhotoTier({
        flags: flags({ isLover: true, hadSex: true }),
        affection: 80,
        traits: ['Promiscuous'] as CharacterTrait[],
        noNsfwImages: false,
        canRender: false
      })
    ).toBe('none')
  })
})

describe('describedPhotoTier', () => {
  it('reads the picture off her own words', () => {
    expect(describedPhotoTier('me at the bakery with a huge parfait')).toBe('everyday')
    expect(describedPhotoTier('lying on my bed in my underwear, smiling')).toBe('suggestive')
    expect(describedPhotoTier('topless, looking at the camera')).toBe('explicit')
  })

  it('answers none for nothing at all', () => {
    expect(describedPhotoTier('   ')).toBe('none')
  })
})

describe('settlePhoto', () => {
  it('sends what the gate reaches', () => {
    expect(settlePhoto({ sendPhoto: true, photoPrompt: 'me in my new cardigan', allowed: 'everyday' })).toEqual({
      send: true,
      tier: 'everyday'
    })
  })

  it('refuses a picture past the gate rather than softening it', () => {
    // The flag says yes and the words say nude: the words are what she is measured by.
    const verdict = settlePhoto({ sendPhoto: true, photoPrompt: 'nude in the shower', allowed: 'suggestive' })
    expect(verdict.send).toBe(false)
    expect(verdict.note).toContain('described explicit')
  })

  it('sends nothing when she did not offer one', () => {
    expect(settlePhoto({ sendPhoto: false, photoPrompt: 'anything', allowed: 'explicit' }).send).toBe(false)
    expect(settlePhoto({ sendPhoto: true, photoPrompt: '  ', allowed: 'explicit' }).send).toBe(false)
  })
})

/**
 * The caption that got through. She wrote "bare-chested and wearing only black lace panties",
 * the picture came back exactly as described, and the reading was `suggestive` — so the cover
 * that holds an explicit picture back until it is asked for never went on it. Every word naming
 * what was bare was a word nobody had put in the list.
 */
describe('a picture described without any of the words for it', () => {
  const CAPTION =
    'Framed from the waist up while sitting back against the pillows on the bed in her dim room, ' +
    'bare-chested and wearing only black lace panties, resting one hand against her collarbone ' +
    'while her other hand rests on her thigh, looking straight into the lens with a deadpan smirk.'

  it('reads the caption that got through as explicit', () => {
    expect(describedPhotoTier(CAPTION)).toBe('explicit')
  })

  it('reads the other ways of saying it', () => {
    for (const said of [
      'she is bare-chested on the bed',
      'her chest bare, one arm across her',
      'shirtless in the mirror',
      'braless under an open shirt',
      'wearing only a towel',
      'in only her underwear',
      'nothing covering her above the waist'
    ]) {
      expect(describedPhotoTier(said)).toBe('explicit')
    }
  })

  /** The ones that mean underwear and not the absence of it stay where they were. */
  it('leaves what is merely suggestive alone', () => {
    expect(describedPhotoTier('in black lace lingerie on the bed')).toBe('suggestive')
    expect(describedPhotoTier('in a bikini by the pool')).toBe('suggestive')
    expect(describedPhotoTier('sitting in a cafe with a coffee')).toBe('everyday')
  })
})

/**
 * What she says the picture is, beside what her caption says it is. A word list can be written
 * around; a model can under-report. Whichever says more is the one taken.
 */
describe('settlePhoto with a tier she stated', () => {
  const words = 'in a bikini by the pool'

  it('takes hers where it says more than the caption does', () => {
    const verdict = settlePhoto({
      sendPhoto: true,
      photoPrompt: words,
      stated: 'explicit',
      allowed: 'explicit'
    })
    expect(verdict.tier).toBe('explicit')
  })

  it('keeps the caption where she says less than it does', () => {
    const verdict = settlePhoto({
      sendPhoto: true,
      photoPrompt: 'she is topless on the bed',
      stated: 'everyday',
      allowed: 'explicit'
    })
    expect(verdict.tier).toBe('explicit')
  })

  /** Raising it past what the save allows refuses the picture, as the caption's own would. */
  it('refuses a picture she raised past what is allowed', () => {
    const verdict = settlePhoto({
      sendPhoto: true,
      photoPrompt: words,
      stated: 'explicit',
      allowed: 'suggestive'
    })
    expect(verdict.send).toBe(false)
  })

  it('is unchanged where she said nothing', () => {
    expect(settlePhoto({ sendPhoto: true, photoPrompt: words, allowed: 'explicit' }).tier).toBe(
      'suggestive'
    )
  })
})

/** Every photo is her alone and taken by her; the renderer draws nobody else. */
describe('a picture of anybody but her', () => {
  it('is refused, whatever the gate would allow', () => {
    for (const photoPrompt of [
      'naked, riding him on the bed',
      'on her knees, his hand in her hair',
      'naked, lying back with her boyfriend',
      'on all fours, a butt plug in',
      'a selfie with another girl on the couch'
    ]) {
      const verdict = settlePhoto({ sendPhoto: true, photoPrompt, allowed: 'explicit' })
      expect(verdict.send).toBe(false)
    }
  })

  it('leaves a picture of her alone that only mentions him', () => {
    expect(describesSomebodyElse('a mirror selfie in his hoodie, for him')).toBe(false)
    expect(describesSomebodyElse('she types up the documents at her desk')).toBe(false)
  })
})

/** Words are read as words: a cue inside another word says nothing. */
describe('describedPhotoTier, reading words rather than letters', () => {
  it('does not find a cue inside another word', () => {
    expect(describedPhotoTier('reading in the library, a necklace on')).toBe('everyday')
    expect(describedPhotoTier('her desk covered in documents')).toBe('everyday')
    expect(describedPhotoTier('curled up with cumin tea in the bathroom')).toBe('everyday')
  })

  it('still reads a plural or a longer form of a stem', () => {
    expect(describedPhotoTier('in matching bras and panties')).toBe('suggestive')
    expect(describedPhotoTier('masturbating on her bed')).toBe('explicit')
  })
})
