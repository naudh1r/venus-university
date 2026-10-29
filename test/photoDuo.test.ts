import { describe, expect, it } from 'vitest'
import { groupPhotoPair, photoFriendHandle } from '../src/shared/photoDuo'
import { buildDuoPhotoPrompt } from '../src/shared/photoPrompt'
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

  it('gives the phone to the girl who sent it alone', () => {
    const prompts = buildDuoPhotoPrompt(risa, ana, 'everyday', 'A selfie of me and Ana at the park')
    expect(prompts.left).toContain('outstretched_arm')
    expect(prompts.right).not.toContain('outstretched_arm')
  })
})
