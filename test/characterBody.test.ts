import { describe, expect, it } from 'vitest'
import {
  allowedBeside,
  appearanceBreasts,
  bodyAppearance,
  bodyNegative,
  BODY_FIELDS,
  BODY_POOLS,
  cleanBody,
  drawBody,
  gateBody,
  type CharacterBody
} from '../src/shared/characterBody'
import { cgSetDraft, spriteDraft } from '../src/shared/imagePrompt'
import { buildPhotoPrompt } from '../src/shared/photoPrompt'
import type { Character } from '../src/shared/types'
import { character } from './fixtures'

/** Her, with the appearance the dev's call writes: `big_breasts` for a big chest. */
function her(body?: CharacterBody): Character {
  return {
    ...character({ charId: 'c1', firstName: 'Risa' }),
    baseAppearance: ['1girl', 'aqua_hair', 'big_breasts'],
    ...(body ? { body } : {})
  }
}

/** A draw that always takes the option at `at` of the way through. */
const at = (fraction: number) => () => fraction

describe('the pools', () => {
  it('holds one list per field, and nothing past large_breasts', () => {
    expect(BODY_FIELDS).toEqual(['build', 'breasts', 'hipsThighs', 'buttocks', 'pubicHair'])
    expect(BODY_POOLS.breasts).not.toContain('huge_breasts')
    expect(BODY_POOLS.build).not.toContain('skinny')
  })
})

describe('cleanBody', () => {
  it('keeps one pooled tag per field', () => {
    expect(cleanBody({ build: 'toned', hipsThighs: 'long_legs' })).toEqual({
      build: 'toned',
      hipsThighs: 'long_legs'
    })
  })

  it('drops anything the pools do not hold', () => {
    expect(cleanBody({ build: 'athletic but soft', breasts: 'huge_breasts' })).toBeUndefined()
  })

  /** The first bodies were free tags per region; read now, they keep what the pools know. */
  it('reads a body written before the pools', () => {
    const legacy = {
      bodyType: ['slim', 'curvy'],
      bust: ['large_breasts', 'heavy'],
      nipples: ['pink nipples'],
      stomach: ['soft stomach'],
      hipsThighs: 'wide hips, thick_thighs',
      buttocks: ['round ass']
    }
    expect(cleanBody(legacy)).toEqual({
      build: 'curvy',
      breasts: 'large_breasts',
      hipsThighs: 'thick_thighs'
    })
  })

  it('drops a field that contradicts one before it', () => {
    expect(cleanBody({ build: 'petite', buttocks: 'huge_ass' })).toEqual({ build: 'petite' })
    expect(cleanBody({ build: 'plump', breasts: 'flat_chest', hipsThighs: 'thigh_gap' })).toEqual({
      build: 'plump'
    })
    expect(cleanBody({ hipsThighs: 'wide_hips', buttocks: 'flat_ass' })).toEqual({
      hipsThighs: 'wide_hips'
    })
  })

  it('answers nothing for no body at all', () => {
    expect(cleanBody(undefined)).toBeUndefined()
    expect(cleanBody('curvy')).toBeUndefined()
  })
})

describe('allowedBeside', () => {
  it('lets through what fits, and nothing outside the pool', () => {
    expect(allowedBeside({ build: 'petite' }, 'breasts', 'large_breasts')).toBe(true)
    expect(allowedBeside({ build: 'curvy' }, 'buttocks', 'flat_ass')).toBe(false)
    expect(allowedBeside({}, 'build', 'slim')).toBe(false)
  })
})

describe('appearanceBreasts', () => {
  it("reads the dev's appearance under the tag the checkpoint knows", () => {
    expect(appearanceBreasts(['big_breasts'])).toBe('large_breasts')
    expect(appearanceBreasts(['small_breasts'])).toBe('small_breasts')
    expect(appearanceBreasts(['aqua_hair'])).toBe('medium_breasts')
  })
})

describe('drawBody', () => {
  it('keeps her build and her chest, and draws the rest', () => {
    const body = drawBody('toned', ['big_breasts'], at(0.99))
    expect(body.build).toBe('toned')
    expect(body.breasts).toBe('large_breasts')
    for (const field of ['hipsThighs', 'buttocks', 'pubicHair'] as const) {
      expect(BODY_POOLS[field]).toContain(body[field])
    }
  })

  it('draws average where the draw lands on none', () => {
    expect(drawBody(undefined, [], at(0))).toEqual({ breasts: 'medium_breasts' })
  })

  it('never draws what her build rules out', () => {
    for (let step = 0; step < 100; step++) {
      const body = drawBody('petite', [], at(step / 100))
      expect(body.buttocks).not.toBe('huge_ass')
      expect(['wide_hips', 'thick_thighs', 'long_legs']).not.toContain(body.hipsThighs)
      expect(cleanBody(body)).toEqual(body)
    }
  })

  /** The editor's reroll: the same build again, and a fresh draw of everything it decides. */
  it('keeps her build and chest across rerolls, and varies the rest within the rules', () => {
    const seen = new Set<string>()
    for (let step = 0; step < 100; step++) {
      const body = drawBody('curvy', ['small_breasts'], at(step / 100))
      expect(body.build).toBe('curvy')
      expect(body.breasts).toBe('small_breasts')
      expect(body.buttocks).not.toBe('flat_ass')
      seen.add(JSON.stringify(body))
    }
    expect(seen.size).toBeGreaterThan(1)
  })

  it('ignores a build outside the pool', () => {
    expect(drawBody('slim', [], at(0)).build).toBeUndefined()
  })
})

describe('gateBody', () => {
  it('takes her body away while the switch is off', () => {
    expect(gateBody(her({ build: 'curvy' }), false).body).toBeUndefined()
  })

  it('keeps it, filtered, while the switch is on, and gives her an empty one where she has none', () => {
    expect(gateBody(her({ build: 'curvy' }), true).body).toEqual({ build: 'curvy' })
    expect(gateBody(her(), true).body).toEqual({})
  })
})

/** The dev's prompts, untouched while the switch is off. */
describe('with no body', () => {
  it("writes the dev's sprite and CG prompts exactly as they were", () => {
    const plain = her()
    const sprite = spriteDraft(plain, ['standing'], 'nude')
    expect(sprite.appearance).toEqual(plain.baseAppearance)
    expect(sprite.negative).not.toContain('loli')
    expect(cgSetDraft(plain).appearance).toEqual(plain.baseAppearance)
    expect(bodyAppearance(plain, 'photo')).toEqual(plain.baseAppearance)
  })
})

describe('bodyAppearance', () => {
  const body: CharacterBody = {
    build: 'curvy',
    breasts: 'medium_breasts',
    hipsThighs: 'wide_hips',
    buttocks: 'huge_ass',
    pubicHair: 'female_pubic_hair'
  }

  it('puts her chest in place of the one her appearance names', () => {
    const tags = bodyAppearance(her(body), 'sprite')
    expect(tags).toContain('medium_breasts')
    expect(tags).not.toContain('big_breasts')
  })

  it('writes the appearance chest under its real tag where her body names none', () => {
    const tags = bodyAppearance(her({}), 'sprite')
    expect(tags).toContain('large_breasts')
    expect(tags).not.toContain('big_breasts')
  })

  it('leaves her backside off a sprite, and her hair off anything dressed', () => {
    const sprite = bodyAppearance(her(body), 'sprite')
    expect(sprite).toEqual(expect.arrayContaining(['curvy', 'wide_hips']))
    expect(sprite).not.toContain('huge_ass')
    expect(sprite).not.toContain('female_pubic_hair')
  })

  it('adds her hair to the nude sprite, and everything to a CG', () => {
    const nude = bodyAppearance(her(body), 'nude')
    expect(nude).toContain('female_pubic_hair')
    expect(nude).not.toContain('huge_ass')
    expect(bodyAppearance(her(body), 'cg')).toEqual(
      expect.arrayContaining(['curvy', 'wide_hips', 'huge_ass', 'female_pubic_hair'])
    )
  })

  it("reaches the dev's sprite and CG prompts through their own builders", () => {
    expect(spriteDraft(her(body), ['standing'], 'nude').appearance).toContain('female_pubic_hair')
    expect(spriteDraft(her(body), ['standing'], null).appearance).not.toContain('female_pubic_hair')
    expect(cgSetDraft(her(body)).appearance).toContain('huge_ass')
  })
})

/** Petite pulls the checkpoint young; her negatives, and only hers, say it may not. */
describe('bodyNegative', () => {
  it('keeps a petite girl from being drawn young, in every picture of her', () => {
    const petite = her({ build: 'petite' })
    expect(bodyNegative(petite)).toEqual(['loli', 'child', 'aged_down'])
    expect(spriteDraft(petite, ['standing'], null).negative).toContain('loli')
    expect(cgSetDraft(petite).negative).toContain('aged_down')
    expect(buildPhotoPrompt(petite, 'everyday', 'at her desk').negative).toContain('child')
  })

  it('adds nothing to anybody else', () => {
    expect(bodyNegative(her({ build: 'curvy' }))).toEqual([])
    expect(spriteDraft(her({ build: 'toned' }), ['standing'], null).negative).not.toContain('loli')
  })
})
