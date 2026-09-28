import { describe, expect, it } from 'vitest'
import { bodyTags, cleanBody } from '../src/shared/characterBody'
import type { CharacterBody } from '../src/shared/characterBody'

/** A body written the way the record keeps it now: a list of tags per region. */
const written = {
  bodyType: ['slim', 'pale skin'],
  bust: ['large_breasts'],
  nipples: [],
  stomach: ['soft stomach'],
  hipsThighs: ['wide hips'],
  buttocks: []
} as CharacterBody

describe('bodyTags', () => {
  it('reads the tags of one region', () => {
    expect(bodyTags(written, 'bodyType')).toEqual(['slim', 'pale skin'])
  })

  /** The first characters written with a body kept each region as one comma-separated string. */
  it('reads a region an older record kept as a string', () => {
    const legacy = { bodyType: 'slim, pale skin' } as unknown as CharacterBody
    expect(bodyTags(legacy, 'bodyType')).toEqual(['slim', 'pale skin'])
  })

  it('answers nothing for a region nobody wrote, or a character with no body', () => {
    expect(bodyTags(written, 'nipples')).toEqual([])
    expect(bodyTags(undefined, 'bust')).toEqual([])
  })
})

describe('cleanBody', () => {
  it('normalises every region to trimmed tags, whichever shape it arrived in', () => {
    const ragged = {
      bodyType: ' slim ,  pale skin ',
      bust: ['  large_breasts  ', ''],
      nipples: [],
      stomach: [],
      hipsThighs: [],
      buttocks: []
    } as unknown as CharacterBody

    expect(cleanBody(ragged)).toEqual({
      bodyType: ['slim', 'pale skin'],
      bust: ['large_breasts'],
      nipples: [],
      stomach: [],
      hipsThighs: [],
      buttocks: []
    })
  })

  it('answers nothing for a body with nothing written in it', () => {
    const blank = Object.fromEntries(
      (['bodyType', 'bust', 'nipples', 'stomach', 'hipsThighs', 'buttocks'] as const).map(
        (field) => [field, []]
      )
    ) as unknown as CharacterBody

    expect(cleanBody(blank)).toBeUndefined()
    expect(cleanBody(undefined)).toBeUndefined()
  })
})
