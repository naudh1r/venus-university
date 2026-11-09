import { describe, expect, it } from 'vitest'
import { groupPhotoPair, photoFriendHandle } from '../src/shared/photoDuo'
import { buildDuoPhotoPrompt, withoutTouching } from '../src/shared/photoPrompt'
import { character } from './fixtures'

describe('who is in a group photo', () => {
  it('takes two different girls from the scene, and nobody from a scene with fewer', () => {
    expect(groupPhotoPair(['risa', 'ana', 'lia'], {}, () => 0)).toEqual({ poster: 'risa', friend: 'ana' })
    expect(groupPhotoPair(['risa', 'ana', 'lia'], {}, () => 0.99)).toEqual({ poster: 'lia', friend: 'ana' })
    expect(groupPhotoPair(['risa', 'risa'], {}, () => 0)).toBeNull()
    expect(groupPhotoPair(['risa'], {})).toBeNull()
  })

  it('skips every enemy pair, still takes acquaintances, and refuses a scene of enemies only', () => {
    const relationships = {
      'ana|risa': { affinity: -4 },
      'lia|risa': { affinity: -6 },
      'ana|lia': { affinity: -3 }
    }
    for (const roll of [0, 0.25, 0.5, 0.99]) {
      const pair = groupPhotoPair(['risa', 'ana', 'lia'], relationships, () => roll)!
      expect([pair.poster, pair.friend].sort()).toEqual(['ana', 'lia'])
    }
    expect(groupPhotoPair(['risa', 'ana'], relationships)).toBeNull()
    expect(groupPhotoPair(['risa', 'ana', 'lia'], {
      ...relationships, 'ana|lia': { affinity: -4 }
    })).toBeNull()
    expect(groupPhotoPair(['ana', 'lia'], { 'ana|lia': { affinity: 4 } }, () => 0))
      .toEqual({ poster: 'ana', friend: 'lia' })
  })
})

describe('the friend tagged under a photo', () => {
  it('reads their current friendship and her handle, leaving other pairs and missing handles untagged', () => {
    const info = { ana: { handle: 'ana.moss' } }
    const relationships = { 'ana|risa': { affinity: 3 } }
    for (const affinity of [-6, -4, -3, 0, 3, 4, 6]) {
      relationships['ana|risa'].affinity = affinity
      expect(photoFriendHandle(relationships, 'risa', 'ana', info))
        .toBe(affinity >= 4 ? 'ana.moss' : null)
    }
    expect(photoFriendHandle({}, 'risa', 'ana', info)).toBeNull()
    expect(photoFriendHandle(undefined, 'risa', 'ana', info)).toBeNull()
    expect(photoFriendHandle(relationships, 'risa', undefined, info)).toBeNull()
    expect(photoFriendHandle(relationships, 'risa', 'risa', info)).toBeNull()
    expect(photoFriendHandle(relationships, 'risa', 'ana', {})).toBeNull()
    expect(photoFriendHandle(relationships, 'risa', 'ana', { ana: { handle: '' } })).toBeNull()
  })
})

describe('a picture of two', () => {
  const risa = character({ charId: 'risa', firstName: 'Risa', lastName: 'Vale', outfit: ['pink_top', 'black_thighhighs', 'white_sneakers'] })
  const ana = character({ charId: 'ana', firstName: 'Ana', lastName: 'Moss', outfit: ['brown_sweater'] })

  it('draws them apart, never touching, and leaves her legs out of a shot from the waist up', () => {
    const prompts = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana at the cafe, hugging and smiling at the camera')
    expect(prompts.scene).not.toMatch(/hugg|Ana/)
    expect(prompts.scene).toContain('her friend')
    expect(prompts.left).toContain('(pink_top:1.2)')
    expect(prompts.left).not.toMatch(/thighhighs|sneakers/)
    expect(prompts.right).toContain('(brown_sweater:1.2)')
    expect(prompts.negative).not.toMatch(/\b2girls\b|multiple_girls/)
  })

  it('gives each girl the face the caption gives her, and both the same where it splits none', () => {
    const split = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana in a cafe booth, me smiling softly while Ana grins widely')
    expect(split.left).toMatch(/\bsmile\b/)
    expect(split.left).not.toMatch(/\bgrin\b/)
    expect(split.right).toMatch(/\bgrin\b/)
    expect(split.right).not.toMatch(/\bsmile\b/)
    const shared = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana in a cafe booth, both laughing')
    expect(shared.left).toMatch(/\blaughing\b/)
    expect(shared.right).toMatch(/\blaughing\b/)
  })

  it.each([
    ['everyday clothes', 'pink_top', 'brown_sweater'],
    ['PE kit', 'gym_uniform', 'gym_uniform'],
    ['swimsuits', 'white_bikini', 'white_bikini']
  ])('keeps the place after their %s, with each outfit in its own half', (set, left, right) => {
    const sender = {
      ...risa,
      peOutfit: ['gym_uniform'],
      swimOutfit: ['white_bikini']
    }
    const friend = {
      ...ana,
      peOutfit: ['gym_uniform'],
      swimOutfit: ['white_bikini']
    }
    const prompts = buildDuoPhotoPrompt(
      sender,
      friend,
      'suggestive',
      `A photo of her and Ana in their ${set} beside the arcade cabinets, smiling.`
    )
    expect(prompts.scene).toContain('A photo of her and her friend beside the arcade cabinets, smiling')
    expect(prompts.scene).not.toContain(set)
    expect(prompts.left).toContain(left)
    expect(prompts.right).toContain(right)
  })

  it('keeps their room and the place after touching', () => {
    const prompts = buildDuoPhotoPrompt(
      risa,
      ana,
      'everyday',
      'Her and Ana in her room wearing their everyday clothes, smiling.'
    )
    expect(prompts.scene).toContain('Her and her friend in her room, smiling')
    expect(withoutTouching('Her and her friend hugging beside the arcade cabinets.')).toBe(
      'Her and her friend beside the arcade cabinets.'
    )
  })

  it('keeps described clothes out of the scene and each wardrobe in its own half', () => {
    const prompts = buildDuoPhotoPrompt(
      risa,
      ana,
      'everyday',
      'Her and Ana in matching pink hoodies beside the arcade cabinets.'
    )
    expect(prompts.scene).not.toContain('matching pink hoodies')
    expect(prompts.scene).toContain('beside the arcade cabinets')
    expect(prompts.left).toContain('(pink_top:1.2)')
    expect(prompts.right).toContain('(brown_sweater:1.2)')
  })

  it('keeps a close-up selfie at waist framing in both halves', () => {
    const prompts = buildDuoPhotoPrompt(
      risa,
      ana,
      'everyday',
      'A close-up selfie of her and Ana in her room'
    )
    for (const prompt of [prompts.scene, prompts.left, prompts.right]) {
      expect(prompt).toContain('(upper_body:1.3)')
      expect(prompt).not.toContain('portrait')
    }
  })

  it('gives each girl the gesture the caption gives her', () => {
    const prompts = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana in a booth, me flashing a peace sign while Ana gives a thumbs up')
    expect(prompts.left).toMatch(/\bv\b/)
    expect(prompts.left).not.toContain('thumbs_up')
    expect(prompts.right).toContain('thumbs_up')
    expect(prompts.right).not.toMatch(/\bv\b/)
  })

  it('splits a blush and a blown kiss to the girl the caption gives them, and leaves her chin to the sentence', () => {
    const blush = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana on my bed, me giving a thumbs up while Ana blushes')
    expect(blush.right).toContain('blush')
    expect(blush.right).not.toContain('thumbs_up')
    const kiss = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Me and Ana in a booth, me blowing a kiss while Ana smirks')
    expect(kiss.scene).toContain('blowing a kiss')
    expect(kiss.left).toContain('blowing_kiss')
    const chin = buildDuoPhotoPrompt(risa, ana, 'everyday', 'Her and Ana in a booth, her with her chin on her hand while Ana pouts')
    expect(chin.left).not.toContain('head_rest')
    expect(chin.scene).toContain('chin on her hand')
  })

  it('gives a selfie room for her arm, and a photo somebody took the waist-up shot', () => {
    expect(buildDuoPhotoPrompt(risa, ana, 'everyday', 'A selfie of me and Ana at the park').scene).toContain('cowboy_shot')
    expect(buildDuoPhotoPrompt(risa, ana, 'everyday', 'A photo of me and Ana at the park').scene).toContain('(upper_body:1.3)')
  })

  it('gives the phone to the girl who sent it alone', () => {
    const prompts = buildDuoPhotoPrompt(risa, ana, 'everyday', 'A selfie of me and Ana at the park')
    expect(prompts.left).toContain('outstretched_arm')
    expect(prompts.right).not.toContain('outstretched_arm')
  })
})
