import { describe, expect, it } from 'vitest'
import {
  coldPassOf,
  coldStageAt,
  COLD_READER,
  withColdCaught,
  withDose,
  withGiftDoses,
  type ColdPassInput
} from '@shared/colds'
import { COLD_SEED_COOLDOWN_DAYS } from '@shared/odds'
import type { ColdCase } from '@shared/types'

/**
 * Where a cold stands in any slot and who catches one at a boundary: a stage read wrong keeps a
 * girl off class or the reader off work on the wrong slots, and a pass that is not a pure
 * replacement would give somebody a second cold, or the same strain twice, on a replayed boundary.
 */

/** A cold caught in slot 10 that incubates two slots: it shows from 13 and is over from 27. */
const caught = (over: Partial<ColdCase> = {}): ColdCase => ({
  strain: 4,
  since: 10,
  incubation: 2,
  ...over
})

/** The stage at each slot from `from` through `to`. */
const stages = (cold: ColdCase, from: number, to: number): (string | null)[] =>
  Array.from({ length: to - from + 1 }, (_, i) => coldStageAt(cold, from + i))

describe('coldStageAt', () => {
  it('runs incubating, coming down, the worst, getting better and the cough, then nothing', () => {
    expect(stages(caught(), 10, 27)).toEqual([
      null,
      'incubating',
      'incubating',
      'comingDown',
      'comingDown',
      'worst',
      'worst',
      'worst',
      'worst',
      'gettingBetter',
      'gettingBetter',
      'gettingBetter',
      'gettingBetter',
      'cough',
      'cough',
      'cough',
      'cough',
      null
    ])
  })

  it('skips the worst of a mild cold', () => {
    expect(stages(caught({ mild: true }), 13, 16)).toEqual([
      'comingDown',
      'comingDown',
      'gettingBetter',
      'gettingBetter'
    ])
  })

  it('ends the stage a dose falls in from the next slot, and only from the next', () => {
    const dosed = caught({ doseSlots: [15] })
    expect(coldStageAt(dosed, 15)).toBe('worst')
    expect(coldStageAt(dosed, 16)).toBe('gettingBetter')
    // A dose a slot from the first symptoms has it over in four.
    expect(stages(caught({ doseSlots: [13, 14, 15, 16] }), 13, 17)).toEqual([
      'comingDown',
      'worst',
      'gettingBetter',
      'cough',
      null
    ])
  })

  it('ignores a dose taken while it incubates', () => {
    expect(stages(caught({ doseSlots: [11] }), 11, 14)).toEqual(stages(caught(), 11, 14))
  })
})

describe('withDose and withColdCaught', () => {
  it('record a dose and a strain once, however often they are applied', () => {
    const once = withDose(caught(), 15)
    expect(withDose(once, 15)).toBe(once)
    const holder = withColdCaught({ coldsHad: [1] }, caught())
    expect(holder.coldsHad).toEqual([1, 4])
    expect(withColdCaught(holder, caught()).coldsHad).toEqual([1, 4])
  })

  it('files a gift dose only for a gift that was one', () => {
    const charInfo = { a: { cold: caught() }, b: { cold: caught() } }
    expect(withGiftDoses(charInfo, [{ charId: 'a' }], 15)).toBe(charInfo)
    const next = withGiftDoses(charInfo, [{ charId: 'a', dose: true }], 15)
    expect(next.a.cold?.doseSlots).toEqual([15])
    expect(next.b).toBe(charInfo.b)
  })
})

describe('coldPassOf', () => {
  /** Slot 14: the reader's cold is coming down, the girls are well, and nothing reaches campus. */
  const input = (over: Partial<ColdPassInput> = {}): ColdPassInput => ({
    slot: 14,
    seedable: false,
    present: ['a', 'b'],
    girls: { a: {}, b: {} },
    reader: { cold: caught(), coldsHad: [4] },
    bodyTier: 1,
    contacts: [{ kind: 'private', members: [COLD_READER, 'a'] }],
    ...over
  })
  const always = (): number => 0

  it('passes the spreader’s strain on, dated from the slot, and says it came off him while he was sick', () => {
    const pass = coldPassOf(input(), always)
    expect(Object.keys(pass.caught)).toEqual(['a'])
    expect(pass.caught.a).toMatchObject({ strain: 4, since: 14, fromReader: true })
    expect(pass.reader).toBeUndefined()
  })

  it('passes nothing on from a cold past its contagious stages', () => {
    expect(coldPassOf(input({ slot: 24 }), always).caught).toEqual({})
  })

  it('never gives a strain to somebody who has had it, or a cold to somebody who has one', () => {
    expect(coldPassOf(input({ girls: { a: { coldsHad: [4] }, b: {} } }), always).caught).toEqual({})
    const sick = { cold: caught({ strain: 2, since: 12 }), coldsHad: [2] }
    expect(coldPassOf(input({ girls: { a: sick, b: {} } }), always).caught).toEqual({})
  })

  it('reaches nobody off campus, whatever the contacts say', () => {
    expect(coldPassOf(input({ present: ['b'] }), always).caught).toEqual({})
  })

  it('seeds a new strain only where allowed and past the cooldown since the last', () => {
    const quiet = input({ contacts: [], reader: {} })
    expect(coldPassOf({ ...quiet, seedable: true, girls: { a: { coldsHad: [10] }, b: {} } }, always)).toEqual({
      caught: {}
    })
    expect(coldPassOf(quiet, always)).toEqual({ caught: {} })
    const seeded = coldPassOf({ ...quiet, seedable: true, slot: COLD_SEED_COOLDOWN_DAYS * 2 + 10 }, always)
    expect(seeded.reader).toMatchObject({ strain: COLD_SEED_COOLDOWN_DAYS * 2 + 10 })
  })
})
