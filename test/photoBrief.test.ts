import { describe, expect, it } from 'vitest'
import { photoLines } from '../src/renderer/prompts/photoBrief'
import type { CharFlags } from '@shared/types'
import type { CharacterTrait } from '@shared/traits'
import { character } from './fixtures'

/**
 * The PHOTOS section, which is one of two briefs: the one for a girl who may undress, and the one
 * for a girl who may not. Each is read only by the girl it is for.
 */

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

/** Her PHOTOS section, as one string, for the save described. */
function briefFor(over: Partial<CharFlags>, traits: CharacterTrait[] = []): string {
  return photoLines(
    character({ charId: 'a', firstName: 'Risa', traits }),
    { flags: flags(over) } as never,
    { date: 0, time: 0, canRenderImages: true, noNsfwImages: false } as never
  ).join('\n')
}

describe('the two photo briefs', () => {
  it('gives a girl who may not undress no undressed caption rules and no reason to', () => {
    const brief = briefFor({})
    expect(brief).toContain('only sends ordinary pictures')
    expect(brief).not.toContain('will send anything')
    expect(brief).not.toContain('captioned as one, in plain words')
  })

  it('gives a girl who may undress the intimate brief', () => {
    const brief = briefFor({ isLover: true })
    expect(brief).toContain('Risa will send anything of herself, undressed included.')
    expect(brief).toContain('captioned as one, in plain words')
    expect(brief).not.toContain('Nothing undressed')
  })

  it('never says anything about anal', () => {
    for (const brief of [
      briefFor({}),
      briefFor({ hasKissed: true }),
      briefFor({ isLover: true })
    ]) {
      expect(brief.toLowerCase()).not.toContain('anal')
    }
  })

  it('does not assume she took it herself', () => {
    const brief = briefFor({ isLover: true })
    expect(brief).not.toContain('took it herself')
    expect(brief).toContain('Whoever took it stays behind the camera')
    expect(brief).not.toContain('no phone in her hand')
  })
})

/** Why she would send one is said as what is true: a model told otherwise writes the history in. */
describe('the reason in the intimate brief', () => {
  it('says they have been that far only where they have', () => {
    const brief = briefFor({ hadSex: true })
    expect(brief).toContain('She has already been that far with him')
    expect(brief).toContain('somebody she has slept with')
  })

  it('says it is nothing new for a promiscuous girl he has not slept with', () => {
    const brief = briefFor({}, ['Promiscuous'])
    expect(brief).toContain('This is nothing new for her')
    expect(brief).not.toContain('been that far')
    expect(brief).not.toContain('slept with')
  })

  it('says it is her own decision for a girl with a crush', () => {
    const brief = briefFor({ hasCrush: true })
    expect(brief).toContain('Sending one is her own decision, and not a small one')
    expect(brief).not.toContain('been that far')
    expect(brief).not.toContain('slept with')
  })

  it('takes what they have done over who she is', () => {
    const brief = briefFor({ benefits: true }, ['Promiscuous'])
    expect(brief).toContain('She has already been that far with him')
    expect(brief).not.toContain('nothing new for her')
  })
})
