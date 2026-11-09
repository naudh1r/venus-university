import { describe, expect, it } from 'vitest'
import {
  bodyBriefLines,
  bodyOfDraft,
  bodySchemaFields,
  bodySchemaRequired
} from '../src/renderer/prompts/bodyBrief'
import { BODY_POOLS } from '../src/shared/characterBody'

/** What character creation asks about her body, with the switch on and with it off. */
describe('the body brief', () => {
  it('asks nothing, and adds nothing to the schema, with the switch off', () => {
    expect(bodyBriefLines(false)).toEqual([])
    expect(bodySchemaRequired(false)).toEqual([])
    expect(bodySchemaFields(false)).toEqual({})
  })

  it('asks for her build alone, from the pool, with the switch on', () => {
    const brief = bodyBriefLines(true).join('\n')
    expect(brief).toContain('BODY')
    for (const tag of BODY_POOLS.build) expect(brief).toContain(tag)
    expect(bodySchemaRequired(true)).toEqual(['body'])
    const schema = bodySchemaFields(true) as { body: { properties: Record<string, unknown> } }
    expect(Object.keys(schema.body.properties)).toEqual(['build'])
  })

  it('writes no body where none was asked for', () => {
    expect(bodyOfDraft(undefined, ['big_breasts'])).toBeUndefined()
  })

  it('writes the build it picked, her chest from her appearance, and draws the rest', () => {
    const body = bodyOfDraft({ build: ['toned'] }, ['big_breasts'], () => 0)
    expect(body).toEqual({ build: 'toned', breasts: 'large_breasts' })
  })
})
