import { describe, expect, it } from 'vitest'
import { groupPhotoPair } from '../src/shared/photoDuo'
import { buildDuoPhotoPrompt } from '../src/shared/photoPrompt'
import { character } from './fixtures'

describe('who is in a group photo', () => {
  it('takes two different girls from the scene, and nobody from a scene with fewer', () => {
    expect(groupPhotoPair(['risa', 'ana', 'lia'], () => 0)).toEqual({ poster: 'risa', friend: 'ana' })
    expect(groupPhotoPair(['risa', 'ana', 'lia'], () => 0.99)).toEqual({ poster: 'lia', friend: 'ana' })
    expect(groupPhotoPair(['risa', 'risa'], () => 0)).toBeNull()
    expect(groupPhotoPair(['risa'])).toBeNull()
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
