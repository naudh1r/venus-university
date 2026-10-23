import { describe, expect, it } from 'vitest'
import {
  candidateNamed,
  duoCandidates,
  friendStays,
  togetherInPrivate,
  type DuoWhereabouts
} from '../src/shared/photoDuo'
import { pairKeyOf } from '../src/shared/npcRelationships'
import { buildDuoPhotoPrompt } from '../src/shared/photoPrompt'
import { character } from './fixtures'

const ROSTER = ['risa', 'ana', 'lia', 'sara']

function where(groups: { members: string[]; location: string; host?: string }[]): DuoWhereabouts {
  return {
    overlay: { date: 10, time: 0, groups, wentOut: [] },
    date: 10,
    time: 0,
    relationships: { [pairKeyOf('risa', 'lia')]: { affinity: 5 } }
  }
}

describe('who she may put in a picture beside her', () => {
  it('offers whoever is with her, then the girls she gets on with, never one she has fallen out with', () => {
    expect(duoCandidates('risa', ROSTER, where([{ members: ['risa', 'ana'], location: 'cafe' }]))).toEqual(['ana', 'lia'])
    expect(duoCandidates('risa', ROSTER, where([]))).toEqual(['lia'])
    const quarrel = { ...where([]), relationships: { [pairKeyOf('risa', 'lia')]: { affinity: -5 } } }
    expect(duoCandidates('risa', ROSTER, quarrel)).toEqual([])
    expect(duoCandidates('sara', ROSTER, where([]))).toEqual([])
  })

  it('reads a group only for the slot it was rolled for', () => {
    const stale = { ...where([{ members: ['risa', 'ana'], location: 'room', host: 'risa' }]), time: 1 as const }
    expect(duoCandidates('risa', ROSTER, stale)).toEqual(['lia'])
    expect(togetherInPrivate('risa', 'ana', stale)).toBe(false)
  })

  it('counts only one of their own rooms as private', () => {
    expect(togetherInPrivate('risa', 'ana', where([{ members: ['risa', 'ana'], location: 'room', host: 'ana' }]))).toBe(true)
    expect(togetherInPrivate('risa', 'ana', where([{ members: ['risa', 'ana', 'lia'], location: 'room', host: 'lia' }]))).toBe(false)
    expect(togetherInPrivate('risa', 'ana', where([{ members: ['risa', 'ana'], location: 'cafe' }]))).toBe(false)
  })

  it('takes a name only from her list, by first or full name', () => {
    const ana = character({ charId: 'ana', firstName: 'Ana', lastName: 'Moss' })
    expect(candidateNamed('ana moss', [ana])).toBe(ana)
    expect(candidateNamed('Ana', [ana])).toBe(ana)
    expect(candidateNamed('Lia', [ana])).toBeNull()
    expect(candidateNamed('', [ana])).toBeNull()
  })

  it('keeps a friend past everyday only where she would send it herself, alone with her in private', () => {
    expect(friendStays({ tier: 'everyday', friendAllows: 'none', togetherInPrivate: false })).toBe(true)
    expect(friendStays({ tier: 'suggestive', friendAllows: 'suggestive', togetherInPrivate: true })).toBe(true)
    expect(friendStays({ tier: 'explicit', friendAllows: 'suggestive', togetherInPrivate: true })).toBe(false)
    expect(friendStays({ tier: 'explicit', friendAllows: 'explicit', togetherInPrivate: false })).toBe(false)
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
