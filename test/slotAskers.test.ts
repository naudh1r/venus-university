import { describe, expect, it } from 'vitest'

import { globalSlotOf } from '@shared/jobs'
import type { Disposition } from '@shared/relationship'
import type { ChatMessage, Conversation, EverydayAsk } from '@shared/types'
import { midtermWeekOf } from '../src/renderer/prompts/occasions'
import {
  askChanceOf,
  askCooldownOver,
  declineCooldownSlots,
  drawOccasionAsker,
  everydayRoundOf,
  lastInviteSlotOf,
  reachOutChanceOf,
  reachOutGapSlots,
  rollHangoutInvite,
  rollSlotAskers,
  slotAskMultiplier,
  type AskChanceInput,
  type InviteRollInput
} from '../src/renderer/stores/slotAskers'
import { scripted } from './fixtures'

describe('rollSlotAskers', () => {
  const candidates = [
    { charId: 'a', chance: 0.5 },
    { charId: 'b', chance: 0.5 },
    { charId: 'c', chance: 0.5 }
  ]

  it('asks nobody when every roll loses', () => {
    expect(rollSlotAskers(candidates, () => 0.99)).toEqual([])
  })

  it('never returns somebody whose own roll lost', () => {
    // a loses, b wins, c loses; the fourth value is the draw among the winners.
    expect(rollSlotAskers(candidates, scripted([0.9, 0.1, 0.9, 0]))).toEqual(['b'])
  })

  it('caps the slot however many win their roll', () => {
    const four = ['a', 'b', 'c', 'd'].map((charId) => ({ charId, chance: 1 }))
    const picked = rollSlotAskers(four, () => 0)
    expect(picked).toHaveLength(2)
    expect(new Set(picked).size).toBe(2)
  })

  /**
   * The draw among the winners is weighted, so who is asked is not simply who
   * comes first on the roster — the case a plain slice would silently get wrong.
   */
  it('draws the winners by weight, without replacement', () => {
    const weighted = [
      { charId: 'heavy', chance: 0.9 },
      { charId: 'light', chance: 0.1 }
    ]
    // Both win, then a ticket deep enough to reach past the heavy one.
    expect(rollSlotAskers(weighted, scripted([0, 0, 0.95, 0]))).toEqual(['light', 'heavy'])
    // The same slate, a ticket inside the heavy one's share.
    expect(rollSlotAskers(weighted, scripted([0, 0, 0.5, 0]))).toEqual(['heavy', 'light'])
  })
})

describe('drawOccasionAsker', () => {
  it('asks nobody out of an empty slate', () => {
    expect(drawOccasionAsker([], () => 0)).toBeNull()
  })

  // A girl the slot has spending the hour with somebody is asked only when
  // there is nobody free to ask at all.
  it('draws only among the girls the slot places nowhere, while there are any', () => {
    const mixed = [
      { charId: 'placed', loose: false },
      { charId: 'free', loose: true },
      { charId: 'alsoPlaced', loose: false }
    ]
    for (const value of [0, 0.5, 0.99]) {
      expect(drawOccasionAsker(mixed, () => value)).toBe('free')
    }
  })

  it('falls back to the placed ones when nobody is free', () => {
    const placed = [
      { charId: 'a', loose: false },
      { charId: 'b', loose: false }
    ]
    expect(drawOccasionAsker(placed, scripted([0]))).toBe('a')
    expect(drawOccasionAsker(placed, scripted([0.75]))).toBe('b')
    // A `rand` that answers 1 must not run off the end of the pool.
    expect(drawOccasionAsker(placed, scripted([1]))).toBe('b')
  })
})

describe('askChanceOf', () => {
  const chanceFor = (over: Partial<AskChanceInput>, multiplier = 1): number =>
    askChanceOf({ isLover: false, disposition: 'neutral', lonely: false, ...over }, multiplier)

  it('leaves a girl who is not on his side out of it', () => {
    for (const disposition of ['annoyed', 'hostile'] as Disposition[]) {
      expect(chanceFor({ disposition })).toBe(0)
    }
  })

  it('rises with what he is to her, and a girl with nobody else beats a plain acquaintance', () => {
    const neutral = chanceFor({ disposition: 'neutral' })
    const lonely = chanceFor({ disposition: 'neutral', lonely: true })
    const friendly = chanceFor({ disposition: 'friendly' })
    const trusted = chanceFor({ disposition: 'trusted' })
    const devoted = chanceFor({ disposition: 'devoted' })
    const lover = chanceFor({ isLover: true, disposition: 'devoted' })

    expect(neutral).toBeGreaterThan(0)
    expect(lonely).toBeGreaterThan(neutral)
    expect(friendly).toBeGreaterThan(lonely)
    expect(trusted).toBeGreaterThan(friendly)
    expect(devoted).toBeGreaterThan(trusted)
    expect(lover).toBeGreaterThan(devoted)
  })

  // Lovers ask whatever the memories say this week, which is what stops a rough
  // patch reading as a break-up on the phone.
  it('takes the lover band ahead of any tier', () => {
    expect(chanceFor({ isLover: true, disposition: 'hostile' })).toBe(
      chanceFor({ isLover: true, disposition: 'devoted' })
    )
  })

  it('scales by the slot it is handed', () => {
    expect(chanceFor({ disposition: 'friendly' }, 0.5)).toBeCloseTo(
      chanceFor({ disposition: 'friendly' }) * 0.5
    )
  })
})

describe('slotAskMultiplier', () => {
  // Day 0 is a Monday, so 5 is the first Saturday and 7 the Monday after it.
  const SATURDAY = 5
  const MONDAY = 7

  it('favours a free weekend over a weekday, and a weekday night over its day', () => {
    expect(slotAskMultiplier(SATURDAY, 0, 'spring')).toBeGreaterThan(slotAskMultiplier(MONDAY, 1, 'spring'))
    expect(slotAskMultiplier(MONDAY, 1, 'spring')).toBeGreaterThan(slotAskMultiplier(MONDAY, 0, 'spring'))
  })

  it('quiets an exam week against the same weekday outside it', () => {
    // Both Mondays; only one of them has a paper to sit.
    expect(slotAskMultiplier(midtermWeekOf('spring').startDate, 0, 'spring')).toBeLessThan(slotAskMultiplier(MONDAY, 0, 'spring'))
  })
})

describe('declineCooldownSlots', () => {
  it('lengthens her wait with every invitation he lets stand, then stops', () => {
    const waits = [0, 1, 2, 3, 4, 5, 9].map(declineCooldownSlots)
    for (let i = 1; i < waits.length; i++) expect(waits[i]).toBeGreaterThanOrEqual(waits[i - 1])
    expect(waits[1]).toBeGreaterThan(waits[0])
    // The doubling runs out: a long streak waits no longer than a capped one.
    expect(declineCooldownSlots(9)).toBe(declineCooldownSlots(40))
  })
})

describe('reachOutChanceOf', () => {
  it('never has an acquaintance or anybody colder reach out, and rises with what he is to her', () => {
    for (const disposition of ['neutral', 'annoyed', 'hostile'] as Disposition[]) {
      expect(reachOutChanceOf(false, disposition)).toBe(0)
    }
    const friendly = reachOutChanceOf(false, 'friendly')
    const trusted = reachOutChanceOf(false, 'trusted')
    const devoted = reachOutChanceOf(false, 'devoted')
    expect(friendly).toBeGreaterThan(0)
    expect(trusted).toBeGreaterThan(friendly)
    expect(devoted).toBeGreaterThan(trusted)
    expect(reachOutChanceOf(true, 'devoted')).toBeGreaterThan(devoted)
  })

  // A lover reaches out whatever the memories say this week, as she asks him out.
  it('takes the lover band ahead of any tier', () => {
    expect(reachOutChanceOf(true, 'hostile')).toBe(reachOutChanceOf(true, 'devoted'))
  })
})

describe('reachOutGapSlots', () => {
  it('lengthens her wait with every reach-out he leaves unanswered, then stops', () => {
    const waits = [0, 1, 2, 3, 4, 9].map(reachOutGapSlots)
    for (let i = 1; i < waits.length; i++) expect(waits[i]).toBeGreaterThanOrEqual(waits[i - 1])
    expect(waits[1]).toBeGreaterThan(waits[0])
    expect(reachOutGapSlots(9)).toBe(reachOutGapSlots(40))
  })
})

describe('askCooldownOver', () => {
  it('is over only once more than the gap has passed, and always when nobody has asked', () => {
    expect(askCooldownOver(null, 0, 3)).toBe(true)
    expect(askCooldownOver(10, 13, 3)).toBe(false)
    expect(askCooldownOver(10, 14, 3)).toBe(true)
  })
})

describe('lastInviteSlotOf', () => {
  const message = (over: Partial<ChatMessage>): ChatMessage => ({
    id: 'm',
    sender: 'contact',
    text: 'hey',
    date: 0,
    time: 0,
    ...over
  })

  const conversation = (messages: ChatMessage[]): Conversation => ({
    charId: 'a',
    messages,
    unread: 0,
    summary: null
  })

  it('is null for a thread nobody has been asked out in', () => {
    expect(lastInviteSlotOf(undefined)).toBeNull()
    expect(lastInviteSlotOf(conversation([message({ date: 4, time: 1 })]))).toBeNull()
  })

  it('reads the newest marked text of hers and nothing else in the thread', () => {
    const chat = conversation([
      message({ id: 'm1', date: 2, time: 0, invite: true }),
      message({ id: 'm2', date: 6, time: 1, sender: 'player', invite: true }),
      message({ id: 'm3', date: 8, time: 0, sender: 'system', invite: true }),
      message({ id: 'm4', date: 4, time: 1, invite: true }),
      message({ id: 'm5', date: 9, time: 1 })
    ])
    expect(lastInviteSlotOf(chat)).toBe(globalSlotOf(4, 1))
  })
})

describe('rollHangoutInvite', () => {
  const nothing: InviteRollInput = {
    lustful: false,
    intimate: false,
    friend: false,
    exam: null,
    outings: [],
    round: new Set()
  }

  /** `values` handed out in order, counting how many were asked for. */
  const counted = (values: readonly number[]): { rand: () => number; calls: () => number } => {
    const rand = scripted(values)
    let calls = 0
    return {
      rand: () => {
        calls += 1
        return rand()
      },
      calls: () => calls
    }
  }

  // A shut gate that still spent a roll would hand every later ask the wrong value, skewing the odds.
  it('spends no roll on an ask she cannot be rolled into, nor on one already dealt this round', () => {
    const { rand, calls } = counted([0.05, 0.99])
    // Every gated ask is shut and help is dealt, so exercise sees the first value.
    expect(rollHangoutInvite({ ...nothing, round: new Set(['help']) }, rand)).toEqual({
      kind: 'everyday',
      ask: 'exercise'
    })
    expect(calls()).toBe(1)
  })

  it('takes the first ask that lands, in order, and rolls nothing after it', () => {
    const exam = { className: 'Cell Biology', exam: 'midterm' as const, date: 44, time: 0 as const }
    const open = { ...nothing, intimate: true, friend: true, exam, outings: ['cutetea'] }

    const first = counted([0])
    expect(rollHangoutInvite(open, first.rand)).toEqual({ kind: 'herRoom' })
    expect(first.calls()).toBe(1)

    // Her room misses, so the study ask is next and lands.
    const second = counted([0.9, 0])
    expect(rollHangoutInvite(open, second.rand)).toEqual({ kind: 'study', ...exam })
    expect(second.calls()).toBe(2)

    // Everything misses.
    expect(rollHangoutInvite(open, () => 0.99)).toBeNull()
  })

  it('draws the outing among the places it is handed without running off the end', () => {
    const outings = { ...nothing, outings: ['cutetea', 'pier_44'] }
    expect(rollHangoutInvite(outings, scripted([0, 0]))).toEqual({
      kind: 'outing',
      location: 'cutetea'
    })
    // A `rand` that answers 1 must not run off the end of the pool.
    expect(rollHangoutInvite(outings, scripted([0, 1]))).toEqual({
      kind: 'outing',
      location: 'pier_44'
    })
  })
})

describe('everydayRoundOf', () => {
  const round = (...slots: EverydayAsk[][]): EverydayAsk[] => [...everydayRoundOf(slots)].sort()

  it('holds each ask dealt once, and starts over once all four have been dealt', () => {
    expect(round(['help'], ['exercise'], ['help'], ['meal'])).toEqual(['exercise', 'help', 'meal'])
    expect(round(['help'], ['exercise'], ['meal'], ['shopping'])).toEqual([])
    expect(round(['help'], ['exercise'], ['meal'], ['shopping'], ['meal'])).toEqual(['meal'])
  })

  // Two askers in one slot are filed in whatever order the reply listed them; the save must read
  // back the round the rolls dealt either way.
  it('reads one slot the same whichever order its invitations were filed in', () => {
    const before: EverydayAsk[][] = [['help'], ['exercise'], ['meal']]
    expect(round(...before, ['shopping', 'help'])).toEqual(['help'])
    expect(round(...before, ['help', 'shopping'])).toEqual(['help'])
  })
})
