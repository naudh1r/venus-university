import { emptyFlags } from '../src/shared/relationship'
import { describe, expect, it } from 'vitest'
import { character } from './fixtures'
import { buildPhotoPrompt, buildDuoPhotoPrompt } from '../src/shared/photoPrompt'
import {
  bodyAppearance,
  BODY_POOLS,
  MALE_BODY_POOLS,
  cleanBody,
  drawBody,
  gateBody
} from '../src/shared/characterBody'
import { allowedPhotoTier, describedPhotoTier, settlePhoto } from '../src/shared/photoGate'
import { canSharePhoto, photoCompanions, photoFriendHandle } from '../src/shared/photoDuo'
import { normalizePhoto, savedPhoto } from '../src/shared/photoTypes'
import { DEFAULT_PHOTO_SWITCHES, explicitPhotosAllowed } from '../src/shared/photoSwitches'
import { bodyDraftGender, bodyOfDraft } from '../src/renderer/prompts/bodyBrief'
import type { Character } from '@vx/modkit/shared'

const female = character({
  charId: 'f',
  baseAppearance: ['1girl', 'mature_female', 'blue_hair', 'large_breasts'],
  outfit: ['red_shirt'],
  swimOutfit: ['red_bikini']
})
const male = character({
  charId: 'm',
  gender: 'male',
  baseAppearance: ['1boy', 'male_focus', 'brown_hair'],
  outfit: ['blue_shirt', 'black_pants'],
  swimOutfit: []
})
const tags = (text: string) => text.split(/,\s*|\n+/).map((tag) => tag.trim())
const people = [female, male]

describe('gender in Photo prompts', () => {
  it.each(['everyday', 'suggestive', 'explicit'] as const)(
    'keeps a male subject and adult tag at %s',
    (tier) => {
      const caption =
        tier === 'explicit' ? 'naked, standing in his room' : 'standing in his everyday clothes'
      const prompt = buildPhotoPrompt(male, tier, caption)

      expect(tags(prompt.positive)).toContain('1boy')
      expect(tags(prompt.positive)).toContain('mature_male')
      expect(prompt.positive).not.toMatch(/1girl|breasts|mature_female|pussy|female_pubic_hair/)
      expect(tags(prompt.negative)).not.toContain('1boy')
      expect(tags(prompt.negative)).toEqual(expect.arrayContaining(['1girl', 'breasts']))
      if (tier !== 'explicit') {
        expect(tags(prompt.positive)).not.toEqual(expect.arrayContaining(['nude']))
        for (const tag of ['nude', 'penis', 'sex', 'nipples', 'pussy']) {
          expect(tags(prompt.positive)).not.toContain(tag)
          expect(tags(prompt.negative)).toContain(tag)
        }
      } else {
        expect(tags(prompt.positive)).toEqual(
          expect.arrayContaining([
            'nude',
            'nipples',
            'navel',
            'penis',
            'bare_arms',
            'bare_legs',
            'bare_shoulders'
          ])
        )
        expect(tags(prompt.negative)).not.toContain('penis')
      }
    }
  )

  it.each([
    [0, 0, ['2girls'], ['1boy', '3girls']],
    [1, 1, ['2boys'], ['1girl', '3boys']],
    [0, 1, ['1girl', '1boy'], ['2girls', '2boys']],
    [1, 0, ['1boy', '1girl'], ['2girls', '2boys']]
  ] as const)('counts pair %i/%i without banning its subjects', (a, b, positive, negative) => {
    const prompt = buildDuoPhotoPrompt(
      people[a],
      people[b],
      'everyday',
      'Side by side in their everyday clothes, smiling at the camera'
    )

    expect(tags(prompt.scene)).toEqual(expect.arrayContaining([...positive]))
    expect(tags(prompt.negative)).toEqual(
      expect.arrayContaining([...negative, 'nude', 'penis', 'sex'])
    )
    for (const tag of positive) expect(tags(prompt.negative)).not.toContain(tag)
    for (const [person, half] of [
      [people[a], prompt.left],
      [people[b], prompt.right]
    ] as const) {
      expect(tags(half)).toContain(person.gender === 'male' ? 'mature_male' : 'mature_female')
      expect(half).toContain(person.gender === 'male' ? 'blue_shirt' : 'red_shirt')
      expect(half).not.toContain(person.gender === 'male' ? 'red_shirt' : 'blue_shirt')
    }
  })

  it('keeps male and mixed expressions, gestures and clothing in their own halves', () => {
    const prompt = buildDuoPhotoPrompt(
      male,
      female,
      'everyday',
      'Him and his friend in their everyday clothes, him waving while his friend winks'
    )

    expect(prompt.left).toContain('waving')
    expect(prompt.left).not.toContain('one_eye_closed')
    expect(prompt.right).toContain('one_eye_closed')
    expect(prompt.right).not.toContain('waving')
    expect(prompt.left).toContain('(blue_shirt:1.2)')
    expect(prompt.right).toContain('(red_shirt:1.2)')
  })

  it('keeps a female character’s boyish hair and cowboy hat', () => {
    const person = {
      ...female,
      baseAppearance: [...female.baseAppearance, 'boyish_short_hair'],
      outfit: ['cowboy_hat', 'red_shirt']
    }

    const prompt = buildPhotoPrompt(person, 'everyday', 'standing in her everyday clothes')

    expect(prompt.positive).toContain('boyish_short_hair')
    expect(prompt.positive).toContain('cowboy_hat')
  })

  it('uses a male swim fallback when character creation supplied no swim set', () => {
    const prompt = buildPhotoPrompt(male, 'suggestive', 'standing at the pool in his swimsuit')

    expect(prompt.positive).toContain('swim_trunks')
    expect(prompt.positive).not.toMatch(/bikini|breasts|pussy/)
  })

  it('reads a male face crop and a male explicit hand action', () => {
    const face = buildPhotoPrompt(male, 'everyday', 'A close-up of his face filling the photo')
    const explicit = buildPhotoPrompt(male, 'explicit', 'Naked on his back, stroking his penis')

    expect(face.positive).toContain('face_focus')
    expect(face.positive).not.toContain('black_pants')
    expect(explicit.positive).toContain('on_back')
    expect(explicit.positive).toContain('penis_grab')
    expect(explicit.positive).not.toMatch(/pussy|fingering|breasts|clitoris/)
  })
})

describe('body pools and existing female saves', () => {
  it('keeps every old valid female choice, and rejects the other gender’s picks', () => {
    for (const [field, pool] of Object.entries(BODY_POOLS)) {
      for (const tag of pool)
        expect(cleanBody({ [field]: tag }, 'female')).toEqual({ [field]: tag })
    }
    expect(
      cleanBody(
        { build: 'muscular_female', breasts: 'large_breasts', pubicHair: 'female_pubic_hair' },
        'male'
      )
    ).toBeUndefined()
    expect(
      cleanBody(
        { build: 'muscular_male', breasts: 'pectorals', pubicHair: 'male_pubic_hair' },
        'female'
      )
    ).toBeUndefined()
  })

  it('draws male body details from the male pools and keeps them through normalization', () => {
    const body = drawBody('muscular_male', ['1boy'], () => 0.6, 'pectorals', 'male')
    const withBody = { ...male, ex: { 'photo-feature': { v: '1.8.0', data: body } } }

    expect(cleanBody(body)).toEqual(body)
    for (const [field, tag] of Object.entries(body))
      expect(MALE_BODY_POOLS[field as keyof typeof MALE_BODY_POOLS]).toContain(tag)
    expect(bodyAppearance(gateBody(withBody, true), 'nude')).toEqual(
      expect.arrayContaining(['muscular_male', 'pectorals'])
    )
    expect(bodyAppearance(gateBody(withBody, true), 'nude')).not.toContain('female_pubic_hair')
  })

  it('filters incompatible legacy appearance and body data before drawing a male', () => {
    const mismatched = {
      ...male,
      baseAppearance: [...female.baseAppearance, '1boy'],
      body: { breasts: 'large_breasts', pubicHair: 'female_pubic_hair', build: 'muscular_female' }
    } as Character
    const prompt = buildPhotoPrompt(mismatched, 'explicit', 'naked in his room')

    expect(prompt.positive).not.toMatch(
      /1girl|mature_female|breasts|female_pubic_hair|muscular_female|pussy/
    )
    expect(prompt.positive).toContain('mature_male')
  })

  it('uses the host subject tags or male appearance shape when drawing a generated body', () => {
    expect(bodyDraftGender({ appearance: { facialHair: [] } }, ['custom_subject'])).toBe('male')
    expect(bodyDraftGender({}, ['1boy'])).toBe('male')
    expect(bodyDraftGender({}, ['1girl'])).toBe('female')
    const body = bodyOfDraft({ build: ['muscular_male'] }, ['1boy'], () => 0)

    expect(body).toEqual({ build: 'muscular_male', breasts: 'flat_chest' })
  })

  it('reads legacy and slice photos without changing their contents or source records', () => {
    const photo = {
      tier: 'explicit',
      scene: 'her old photo',
      file: 'risa_chat_004.webp',
      with: 'ana',
      pending: true as const,
      held: true as const,
      outAt: 123
    }
    const legacy = { photo }
    const record = { ex: { 'photo-feature': { v: '1.7.3', data: photo } } }
    const before = structuredClone([legacy, record])

    expect(normalizePhoto(undefined, legacy)).toEqual(photo)
    expect(savedPhoto(record)).toEqual(photo)
    expect([legacy, record]).toEqual(before)
  })
})

describe('male coverage and gates', () => {
  it.each([
    'shirtless in his shorts',
    'bare-chested at the gym',
    'topless in jeans',
    'naked from the waist up',
    'wearing only shorts',
    'wearing nothing but shorts'
  ])('keeps %s non-explicit', (caption) => {
    const verdict = settlePhoto({
      sendPhoto: true,
      photoPrompt: caption,
      allowed: 'everyday',
      gender: 'male'
    })
    const prompt = buildPhotoPrompt(male, 'everyday', caption)

    expect(verdict).toEqual({ send: true, tier: 'everyday' })
    expect(prompt.positive).not.toMatch(/\bnude\b|\bpenis\b|\bnipples\b/)
  })

  it.each([
    'naked in his room',
    'his penis in his hand',
    'bottomless wearing a shirt',
    'pulling down his boxers',
    'wearing only a shirt',
    'nude below the waist'
  ])('keeps %s behind the explicit gate', (caption) => {
    expect(describedPhotoTier(caption, 'male')).toBe('explicit')
    expect(
      settlePhoto({ sendPhoto: true, photoPrompt: caption, allowed: 'suggestive', gender: 'male' })
        .send
    ).toBe(false)
    expect(
      settlePhoto({ sendPhoto: true, photoPrompt: caption, allowed: 'explicit', gender: 'male' })
    ).toEqual({ send: true, tier: 'explicit' })
  })

  it.each([false, true])(
    'uses the same relationship and NSFW gate with No NSFW = %s',
    (noNsfwImages) => {
      for (const person of people) {
        const allowed = allowedPhotoTier({
          flags: { ...emptyFlags(), gaveContactInfo: true, hadSex: true },
          affection: 30,
          traits: person.traits,
          canRender: true,
          noNsfwImages
        })
        expect(allowed).toBe(noNsfwImages ? 'everyday' : 'explicit')
      }
      expect(explicitPhotosAllowed(noNsfwImages, DEFAULT_PHOTO_SWITCHES)).toBe(!noNsfwImages)
      expect(
        explicitPhotosAllowed(noNsfwImages, { ...DEFAULT_PHOTO_SWITCHES, explicit: false })
      ).toBe(false)
      expect(describedPhotoTier('shirtless in her shorts', 'female')).toBe('explicit')
    }
  )
})

describe('coverage in a known duo', () => {
  it('reads each subject’s nudity and still refuses a third person or sexual act', () => {
    const pair = {
      sendPhoto: true,
      allowed: 'suggestive' as const,
      gender: 'male' as const,
      companionGender: 'female' as const
    }

    expect(
      settlePhoto({
        ...pair,
        photoPrompt: 'Him and his friend in their clothes, his fingers making a peace sign'
      }).send
    ).toBe(true)
    expect(
      settlePhoto({ ...pair, photoPrompt: 'Him and his friend, his penis showing' }).send
    ).toBe(false)
    expect(
      settlePhoto({ ...pair, photoPrompt: 'Him and his friend topless in their shorts' }).send
    ).toBe(false)
    expect(settlePhoto({ ...pair, photoPrompt: 'Him and his friend with another boy' }).send).toBe(
      false
    )
    expect(settlePhoto({ ...pair, photoPrompt: 'Him and his friend giving a handjob' }).send).toBe(
      false
    )
  })
})

describe('current partners in the friend pool', () => {
  it('includes dating at day zero, keeps friends, and excludes ended-only or unrelated pairs', () => {
    const relationships = {
      'a|b': { affinity: 0, dating: 0 },
      'a|c': { affinity: 5 },
      'a|d': { affinity: 0, ended: 7 },
      'a|e': { affinity: 0 }
    }

    expect(photoCompanions(relationships, 'a', ['a', 'b', 'c', 'd', 'e', 'b'])).toEqual(['b', 'c'])
    expect(canSharePhoto(relationships, 'a', 'b')).toBe(true)
    expect(canSharePhoto(relationships, 'a', 'd')).toBe(false)
    expect(photoFriendHandle(relationships, 'a', 'b', { b: { handle: 'b' } })).toBe('b')
    expect(photoCompanions({ 'a|b': { affinity: 0, ended: 8 } }, 'a', ['b'])).toEqual([])
  })
})
