import { describe, expect, it } from 'vitest'
import { openingStagedAt, parseOpeningLine } from '@shared/opening'

describe('safe dialogue in a slot opening', () => {
  it('reads a string or a normal text object as narration', () => {
    expect(parseOpeningLine(' Words. ', [])).toEqual({ speaker: '', text: 'Words.' })
    expect(parseOpeningLine({ text: ' Words. ' }, [])).toEqual({ speaker: '', text: 'Words.' })
  })

  it('keeps a known speaker and a valid expression', () => {
    expect(parseOpeningLine({ speaker: 'sarah_rose', text: 'Hello.', emotion: 'happy' }, ['sarah_rose']))
      .toEqual({ speaker: 'sarah_rose', text: 'Hello.', actions: ['sprite:sarah_rose,happy'] })
  })

  it('falls back to narration for invalid dialogue and drops text that cannot be read', () => {
    for (const line of [
      { speaker: 'unknown', emotion: 'happy', text: 'Words.' },
      { speaker: 'sarah_rose', emotion: 'unknown', text: 'Words.' },
      { speaker: 7, emotion: 'happy', text: 'Words.' },
      { speaker: 'sarah_rose', text: 'Words.', actions: ['show:unknown'], bg: 'quad' }
    ]) expect(parseOpeningLine(line, ['sarah_rose'])).toEqual({ speaker: '', text: 'Words.' })
    for (const line of [null, [], 7, { text: 7 }, { text: ' ' }]) expect(parseOpeningLine(line, [])).toBeNull()
  })
})

describe('the boundary of a staged opening', () => {
  it('stages only indices before until', () => {
    expect(openingStagedAt({ until: 2 }, 1)).toBe(true)
    expect(openingStagedAt({ until: 2 }, 2)).toBe(false)
    expect(openingStagedAt({ until: 2 }, 3)).toBe(false)
    expect(openingStagedAt({ until: 0 }, 0)).toBe(false)
  })

  it('stages the whole opening without until, and none without a look', () => {
    expect(openingStagedAt({}, 0)).toBe(true)
    expect(openingStagedAt({}, 20)).toBe(true)
    expect(openingStagedAt(null, 0)).toBe(false)
  })
})
