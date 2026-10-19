import { describe, expect, it } from 'vitest'
import { emptyFlags } from '@shared/relationship'
import type { CharFlags, CharInfo } from '@shared/types'
import { pickHomecomingVisitor } from '../src/renderer/prompts/homecoming'
import { charInfo } from './fixtures'

/**
 * Which graduate Homecoming brings back: the one answer the save keeps for the day, and what
 * decides whether she can be cast at all.
 */

/** A graduate who gave him her number, with whatever else the case needs. */
function graduate(flags: Partial<CharFlags> = {}): CharInfo {
  return charInfo({
    pursuing: 'teaching in Portland',
    flags: { ...emptyFlags(), gaveContactInfo: true, ...flags }
  })
}

function pick(
  infos: Record<string, CharInfo>,
  scores: Record<string, number>,
  exclude: ReadonlySet<string> = new Set()
): string | null {
  return pickHomecomingVisitor(
    Object.keys(infos),
    (charId) => infos[charId],
    (charId) => scores[charId] ?? 0,
    exclude
  )
}

describe('pickHomecomingVisitor', () => {
  it('takes the graduate with the most affection', () => {
    expect(pick({ a: graduate(), b: graduate(), c: graduate() }, { a: 20, b: 45, c: 30 })).toBe(
      'b'
    )
  })

  it('takes a lover over a friend with more affection', () => {
    expect(pick({ a: graduate(), b: graduate({ isLover: true }) }, { a: 60, b: 20 })).toBe('b')
  })

  it('passes over anybody below friendly, a lover included', () => {
    expect(pick({ a: graduate({ isLover: true }), b: graduate() }, { a: 10, b: 16 })).toBe('b')
    expect(pick({ a: graduate(), b: graduate() }, { a: 15, b: -40 })).toBeNull()
  })

  it('passes over a girl he cannot text', () => {
    const infos = {
      a: graduate({ gaveContactInfo: false }),
      b: graduate({ blocked: true }),
      c: graduate()
    }
    expect(pick(infos, { a: 50, b: 50, c: 20 })).toBe('c')
  })

  it('passes over a girl breaking up with him', () => {
    expect(pick({ a: graduate(), b: graduate() }, { a: 40, b: 20 }, new Set(['a']))).toBe('b')
  })

  it('breaks a tie by who graduated first, so the answer cannot churn', () => {
    expect(pick({ a: graduate(), b: graduate() }, { a: 25, b: 25 })).toBe('a')
  })

  it('picks nobody when nobody qualifies', () => {
    expect(pick({}, {})).toBeNull()
  })
})
