import { describe, expect, it } from 'vitest'
import { bodyTagsFor, partialExposureIn } from '../src/shared/photoBody'
import { framingOf } from '../src/shared/photoFraming'
import { photoPose, posePhotoTags } from '../src/shared/photoPose'

describe('the framing a caption names', () => {
  it('reads how much of her is in the picture', () => {
    expect(framingOf('just her face, a sleepy smile')).toBe('face')
    expect(framingOf('from the waist up, on the couch')).toBe('waist')
    expect(framingOf('from the knees up, leaning on the doorframe')).toBe('knees')
    expect(framingOf('head to toe in her new sundress')).toBe('full')
    expect(framingOf('in the cafe, smiling')).toBeNull()
  })

  it.each([
    ['A close-up in a cozy booth', 'face'],
    ['A closeup in a cozy booth', 'face'],
    ['A close up in a cozy booth', 'face'],
    ['A close-up selfie in a sunlit dorm room', 'waist'],
    ['A closeup selfie in a sunlit dorm room', 'waist'],
    ['A close up selfie in a sunlit dorm room', 'waist'],
    ['A medium shot standing in an aisle', 'waist'],
    ['A medium close-up in the cafe', 'waist'],
    ['A medium close up in the cafe', 'waist'],
    ['A half body shot in the cafe', 'waist'],
    ['A half-body shot in the cafe', 'waist'],
    ['A three-quarter shot in the park', 'knees'],
    ['A three quarter shot in the park', 'knees'],
    ['A cowboy shot in the park', 'knees'],
    ['A shot from the thighs up in the park', 'knees'],
    ['A full shot in the park', 'full']
  ])('reads the framing in %s', (caption, framing) => {
    expect(framingOf(caption)).toBe(framing)
  })

  it('keeps explicit framing through selfie and lying-down defaults', () => {
    for (const scene of [
      'A close-up mirror selfie in her room',
      'A medium shot selfie sitting in a booth',
      'A medium shot selfie lying on her side',
      'A medium shot selfie lying on her stomach'
    ]) {
      const tags = photoPose(scene, 'everyday').tags
      expect(tags).toContain('(upper_body:1.3)')
      expect(tags).not.toContain('full_body')
      expect(tags).not.toContain('portrait')
    }
    const face = photoPose('A close-up lying on her side in a booth', 'everyday').tags
    expect(face).toEqual(expect.arrayContaining(['on_side', 'close-up', 'portrait']))
    expect(face).not.toContain('(upper_body:1.3)')
    const knees = photoPose('A three-quarter selfie sitting in a booth', 'everyday').tags
    expect(knees).toContain('cowboy_shot')
    expect(knees).not.toContain('full_body')
  })

  it("replaces the framing her position came with", () => {
    const full = posePhotoTags('standing in the hallway, full body, in her sundress', false)
    expect(full).toEqual(expect.arrayContaining(['standing', 'full_body']))
    expect(full).not.toContain('cowboy_shot')
    const waist = posePhotoTags('sitting on the couch, waist up', false)
    expect(waist).toEqual(expect.arrayContaining(['sitting', '(upper_body:1.3)']))
    expect(waist).not.toContain('cowboy_shot')
  })

  it('keeps pose defaults only where the caption names no framing', () => {
    expect(posePhotoTags('standing by the window', false)).toContain('cowboy_shot')
    expect(photoPose('a selfie in the cafe, waist up', 'everyday').tags).toContain('(upper_body:1.3)')
    const side = posePhotoTags('waist up, lying on her side in bed', false)
    expect(side).toEqual(expect.arrayContaining(['on_side', '(upper_body:1.3)']))
    const stomach = posePhotoTags('waist up, on her stomach on the bed', false)
    expect(stomach).toContain('(upper_body:1.3)')
  })
})

describe('her body as far as the shot reaches', () => {
  const body = { build: 'curvy', breasts: 'large_breasts', hipsThighs: 'wide_hips' }

  it('names no hips in a shot from the waist up, selfie or not', () => {
    const scene = 'a selfie in her bikini on the beach'
    expect(bodyTagsFor(body, scene, false)).toContain('wide_hips')
    expect(bodyTagsFor(body, scene, false, 'waist')).not.toContain('wide_hips')
    expect(bodyTagsFor(body, scene, false, 'waist')).toContain('cleavage')
  })

  it('names nothing of her body in a shot of her face', () => {
    expect(bodyTagsFor(body, 'just her face, in her bikini', false, 'face')).toEqual([])
  })

  it('leaves the rest to the caption, as before', () => {
    const scene = 'standing in her bikini on the beach'
    expect(bodyTagsFor(body, scene, false, 'knees')).toEqual(bodyTagsFor(body, scene, false))
  })
})

describe('partial exposure and the parts in shot', () => {
  it('masks the unmentioned half while respecting the camera framing', () => {
    const lower = partialExposureIn('Her skirt lifted and panties removed', [
      'skirt_lift',
      'no_panties'
    ])
    expect(
      bodyTagsFor(undefined, 'Her skirt lifted and panties removed', true, 'knees', lower)
    ).toContain('pussy')
    expect(
      bodyTagsFor(undefined, 'Her skirt lifted and panties removed', true, 'knees', lower)
    ).not.toContain('nipples')
    expect(
      bodyTagsFor(undefined, 'Her skirt lifted and panties removed', true, 'face', lower)
    ).toEqual([])
    const upper = partialExposureIn('Pulling down her top', ['clothes_pull'])
    expect(bodyTagsFor(undefined, 'Pulling down her top', true, 'full', upper)).toContain('nipples')
    expect(bodyTagsFor(undefined, 'Pulling down her top', true, 'full', upper)).not.toContain(
      'pussy'
    )
  })

  it('leaves unrecognised and fully nude coverage to the existing rules', () => {
    expect(partialExposureIn('Her clothes bunched', ['clothes_pull'])).toBeUndefined()
    expect(partialExposureIn('Fully naked', ['skirt_lift'])).toBeUndefined()
    expect(bodyTagsFor(undefined, 'Fully naked', true, 'full')).toEqual([
      'nipples',
      'navel',
      'pussy'
    ])
  })

  it('names bottomless only when the lower clothes are moved away', () => {
    expect(
      partialExposureIn('Her skirt lifted, panties removed', ['skirt_lift', 'no_panties'])
        ?.bottomless
    ).toBe(true)
    expect(partialExposureIn('In her skirt, panties removed', ['no_panties'])?.bottomless).toBe(
      false
    )
    expect(
      partialExposureIn('Her skirt lifted, panties aside', ['skirt_lift', 'panties_aside'])
        ?.bottomless
    ).toBe(false)
  })
})
