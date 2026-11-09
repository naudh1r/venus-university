import { describe, expect, it } from 'vitest'
import {
  BUN_POINTS,
  DECOY_COST,
  HAND_MS,
  HOLES,
  LATE_GRACE_MS,
  MOST_UP,
  STRAY_COST,
  countsOf,
  emptyTally,
  handPlay,
  herGame,
  leaderOf,
  makePattern,
  mostUp,
  soloAccount,
  multiplierOf,
  outcomeOf,
  pressPlay,
  readerPlay,
  readerSwing,
  standingAccount,
  swingAt,
  tallied,
  tallyOf,
  type Hand,
  type Pattern,
  type Press,
  type Skill,
  type Swing
} from '../src/shared/minigameRules/whackABun'

/** Whack-a-Bun's rules: the pattern, the score, what a swing lands on and how she plays. */

/** A random with a seed, so a run of trials comes out the same every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const count = (swings: Swing[]) => swings.reduce(tallied, emptyTally())
const SKILLS: Skill[] = [1, 2, 3, 4, 5]

describe('Whack-a-Bun pattern', () => {
  it('is the same for the same seed, and another for another', () => {
    expect(makePattern('a', 2, 30)).toEqual(makePattern('a', 2, 30))
    expect(makePattern('a', 2, 30).pops).not.toEqual(makePattern('b', 2, 30).pops)
  })

  it('is playable at every pace and length: one to a hole, three up at most, all down by the buzzer', () => {
    for (const pace of [1, 2, 3]) {
      for (const seconds of [30, 45, 60]) {
        for (let seed = 0; seed < 40; seed++) {
          const pattern = makePattern(`s${seed}`, pace, seconds)
          const { pops } = pattern
          const counts = countsOf(pattern)
          expect(counts.gold).toBeGreaterThan(0)
          expect(counts.decoy).toBeGreaterThan(0)
          expect(counts.bun).toBeGreaterThan(counts.gold + counts.decoy)
          expect(pops.slice(0, 3).every((pop) => pop.kind === 'bun')).toBe(true)
          expect(mostUp(pops)).toBeLessThanOrEqual(MOST_UP)
          pops.forEach((pop, i) => {
            expect(pop.hole).toBeGreaterThanOrEqual(0)
            expect(pop.hole).toBeLessThan(HOLES)
            expect(pop.at).toBeGreaterThan(0)
            expect(pop.at + pop.upMs).toBeLessThan(pattern.lengthMs)
            if (i > 0) expect(pop.at).toBeGreaterThanOrEqual(pops[i - 1].at)
            const before = pops.slice(0, i).filter((other) => other.hole === pop.hole)
            for (const other of before) expect(other.at + other.upMs).toBeLessThan(pop.at)
          })
        }
      }
    }
  })

  it('quickens through the round, brings two up at once only later, and is thicker at a faster pace', () => {
    let early = 0
    let late = 0
    let slow = 0
    let fast = 0
    for (let seed = 0; seed < 40; seed++) {
      const { pops, lengthMs } = makePattern(`q${seed}`, 2, 60)
      early += pops.filter((pop) => pop.at < lengthMs / 3).length
      late += pops.filter((pop) => pop.at >= (lengthMs * 2) / 3).length
      const opening = pops.filter((pop) => pop.at < lengthMs * 0.4)
      opening.forEach((pop, i) => {
        if (i > 0) expect(pop.at - opening[i - 1].at).toBeGreaterThan(400)
      })
      const upAt = (third: number): number => {
        const span = pops.filter((pop) => Math.floor((pop.at * 3) / lengthMs) === third && pop.kind === 'bun')
        return span.reduce((sum, pop) => sum + pop.upMs, 0) / span.length
      }
      expect(upAt(2)).toBeLessThan(upAt(0))
      slow += makePattern(`q${seed}`, 1, 30).pops.length
      fast += makePattern(`q${seed}`, 3, 30).pops.length
    }
    expect(late).toBeGreaterThan(early * 1.3)
    expect(fast).toBeGreaterThan(slow * 1.3)
  })
})

describe('Whack-a-Bun scoring', () => {
  it('pays a run: half again from the fifth hit in a row, double from the tenth', () => {
    expect([1, 4, 5, 9, 10, 40].map(multiplierOf)).toEqual([1, 1, 1.5, 1.5, 2, 2])
    expect(count(Array<Swing>(4).fill('hit')).score).toBe(4 * BUN_POINTS)
    expect(count(Array<Swing>(5).fill('hit')).score).toBe(4 * BUN_POINTS + 15)
    expect(count(Array<Swing>(10).fill('hit')).score).toBe(40 + 5 * 15 + 20)
    // A golden one is three bunnies, at the run it makes.
    expect(count(['gold']).score).toBe(30)
    expect(count(['hit', 'hit', 'hit', 'hit', 'gold']).score).toBe(40 + 45)
  })

  it('ends a run on a bunny away, a carrot or an empty hole, and on nothing else', () => {
    for (const slip of ['miss', 'decoy', 'stray'] as const) {
      const tally = count(['hit', 'hit', 'hit', 'hit', 'hit', slip, 'hit'])
      expect(tally.streak).toBe(1)
      expect(tally.best).toBe(5)
    }
    expect(count(['hit', 'hit', 'slipped', 'hit']).streak).toBe(3)
  })

  it('takes a carrot off the score, never below nothing, and counts everything', () => {
    expect(count(['hit', 'hit', 'hit', 'decoy']).score).toBe(30 - DECOY_COST)
    expect(count(['hit', 'decoy']).score).toBe(0)
    // An empty hole costs a little as well as the run.
    expect(count(['hit', 'hit', 'stray']).score).toBe(20 - STRAY_COST)
    expect(count(['stray', 'stray']).score).toBe(0)
    expect(count(['hit', 'miss', 'slipped']).score).toBe(10)
    expect(count(['hit', 'gold', 'miss', 'decoy', 'stray', 'slipped', 'stray'])).toMatchObject({
      hits: 1,
      golds: 1,
      misses: 1,
      decoys: 1,
      strays: 2
    })
  })

  it("gives the outcome from the reader's side", () => {
    expect(outcomeOf([50, 40, 30])).toBe('won')
    expect(outcomeOf([50, 50, 30])).toBe('draw')
    expect(outcomeOf([40, 50, 50])).toBe('lost')
    expect(outcomeOf([50])).toBe('won')
    expect(leaderOf([40, 50, 30])).toBe(1)
    expect(leaderOf([50, 50, 30])).toBe(-1)
  })
})

describe('a swing at a hole', () => {
  const pops = [
    { at: 1000, hole: 4, upMs: 800, kind: 'bun' as const },
    { at: 1200, hole: 2, upMs: 800, kind: 'decoy' as const },
    { at: 3000, hole: 4, upMs: 800, kind: 'gold' as const }
  ]

  it('lands on what is up there, from the moment it is up to the moment it ducks', () => {
    expect(swingAt(pops, [], 4, 1000)).toBe(0)
    expect(swingAt(pops, [], 4, 1800)).toBe(0)
    expect(swingAt(pops, [], 2, 1500)).toBe(1)
    expect(swingAt(pops, [], 4, 3100)).toBe(2)
  })

  it('is a stray at an empty hole, before anything is up, and well after it has gone', () => {
    expect(swingAt(pops, [], 0, 1500)).toBe('stray')
    expect(swingAt(pops, [], 4, 990)).toBe('stray')
    expect(swingAt(pops, [], 4, 1800 + LATE_GRACE_MS + 1)).toBe('stray')
  })

  it('counts for nothing a moment late, or on a bunny already bopped', () => {
    expect(swingAt(pops, [], 4, 1800 + LATE_GRACE_MS)).toBe('late')
    expect(swingAt(pops, [true], 4, 1400)).toBe('late')
  })
})

describe("the reader's mallet", () => {
  const pattern: Pattern = {
    seconds: 30,
    pace: 2,
    lengthMs: 30000,
    pops: [
      { at: 1000, hole: 4, upMs: 800, kind: 'bun' },
      { at: 1100, hole: 2, upMs: 800, kind: 'bun' },
      { at: 3000, hole: 0, upMs: 800, kind: 'decoy' },
      { at: 5000, hole: 7, upMs: 600, kind: 'gold' }
    ]
  }

  it('is away for a moment after any swing, and a swing while it is away is none', () => {
    expect(readerSwing(pattern.pops, [], 4, 1200, 0)).toBe(0)
    expect(readerSwing(pattern.pops, [], 4, 1200, 1201)).toBe('resting')
    expect(readerSwing(pattern.pops, [], 8, 1200, 1201)).toBe('resting')
    expect(readerSwing(pattern.pops, [], 8, 1200, 1200)).toBe('stray')
  })

  it('plays a run of presses: the second of two too close together is lost, whatever the first found', () => {
    const play = (presses: Press[]) => pressPlay(pattern, presses)
    // Both bopped with the mallet's time between them.
    expect(tallyOf(play([{ at: 1200, hole: 4 }, { at: 1200 + HAND_MS, hole: 2 }]))).toMatchObject({ hits: 2, misses: 0, score: 20 })
    // Too soon after a bop: the second is not swung at, and gets away.
    expect(tallyOf(play([{ at: 1200, hole: 4 }, { at: 1200 + HAND_MS - 1, hole: 2 }]))).toMatchObject({ hits: 1, misses: 1, strays: 0 })
    // Too soon after an empty hole, the same; and a press while resting does not put the rest off.
    const after = play([{ at: 1200, hole: 8 }, { at: 1300, hole: 4 }, { at: 1200 + HAND_MS, hole: 2 }])
    expect(after.map((move) => move.swing)).toEqual(['stray', 'hit', 'miss', 'slipped'])
    // A moment late counts for nothing but still takes the mallet away.
    const late = play([{ at: 1800 + LATE_GRACE_MS, hole: 4 }, { at: 1850 + LATE_GRACE_MS, hole: 2 }])
    expect(tallyOf(late)).toMatchObject({ hits: 0, misses: 2, strays: 0 })
    // Nothing pressed: every bunny away, the carrot left alone, the golden one only slipped.
    expect(play([]).map((move) => move.swing)).toEqual(['miss', 'miss', 'slipped'])
    expect(tallyOf(play([{ at: 3100, hole: 0 }, { at: 5100, hole: 7 }, { at: 31000, hole: 1 }]))).toMatchObject({ decoys: 1, golds: 1, strays: 0 })
  })
})

describe('how she plays', () => {
  const patterns = Array.from({ length: 30 }, (_, i) => makePattern(`h${i}`, 2, 30))

  it('never bops what is not up, keeps the mallet one place at a time, and accounts for every bunny', () => {
    for (const skill of SKILLS) {
      patterns.forEach((pattern, i) => {
        const moves = herGame(pattern, skill, seeded(i * 7 + skill))
        const counts = countsOf(pattern)
        const tally = tallyOf(moves)
        expect(tally.hits + tally.misses).toBe(counts.bun)
        expect(tally.golds).toBeLessThanOrEqual(counts.gold)
        expect(tally.decoys).toBeLessThanOrEqual(counts.decoy)
        let lastBop = -Infinity
        moves.forEach((move, at) => {
          if (at > 0) expect(move.at).toBeGreaterThanOrEqual(moves[at - 1].at)
          if (move.swing === 'miss' || move.swing === 'slipped') return
          expect(move.at - lastBop).toBeGreaterThanOrEqual(HAND_MS - 1e-6)
          lastBop = move.at
          if (move.pop < 0) return
          const pop = pattern.pops[move.pop]
          expect(move.at).toBeGreaterThanOrEqual(pop.at)
          expect(move.at).toBeLessThanOrEqual(pop.at + pop.upMs)
        })
      })
    }
  })

  it('is the same round for the same random, and leaves every carrot alone when she sees it', () => {
    const pattern = patterns[0]
    expect(herGame(pattern, 3, seeded(5))).toEqual(herGame(pattern, 3, seeded(5)))
    // A roll that never lapses and never falls for one.
    for (const skill of SKILLS) {
      const tally = tallyOf(herGame(pattern, skill, () => 0.99))
      expect(tally.decoys).toBe(0)
      expect(tally.strays).toBe(0)
    }
  })

  it('plays better the better she is: more caught, fewer carrots, more golden ones', () => {
    const mean = (skill: Skill, of: (moves: ReturnType<typeof herGame>, pattern: Pattern) => number): number =>
      patterns.reduce((sum, pattern, i) => {
        let total = 0
        for (let go = 0; go < 10; go++) total += of(herGame(pattern, skill, seeded(i * 100 + go)), pattern)
        return sum + total / 10
      }, 0) / patterns.length
    const score = SKILLS.map((skill) => mean(skill, (moves) => tallyOf(moves).score))
    const carrots = SKILLS.map((skill) => mean(skill, (moves) => tallyOf(moves).decoys))
    const golden = SKILLS.map((skill) => mean(skill, (moves) => tallyOf(moves).golds))
    for (let i = 1; i < SKILLS.length; i++) {
      expect(score[i]).toBeGreaterThan(score[i - 1] * 1.1)
      expect(carrots[i]).toBeLessThan(carrots[i - 1])
      expect(golden[i]).toBeGreaterThan(golden[i - 1])
    }
  })
})

describe('how the reader played', () => {
  const pattern = makePattern('r', 2, 30)
  const counts = countsOf(pattern)
  const targets = counts.bun + counts.gold

  it('tells sharp from wild from slow, and calls him cautious only on the carrots he left', () => {
    const got = (hits: number, extra: Partial<ReturnType<typeof emptyTally>> = {}) => ({ ...emptyTally(), hits, ...extra })
    expect(counts.decoy).toBeGreaterThanOrEqual(2)
    expect(readerPlay(pattern, got(targets - 2))).toBe('sharp')
    expect(readerPlay(pattern, got(targets - 2, { strays: 6, decoys: 3 }))).toBe('wild')
    // Too slow is slow, however few carrots he hit on the way.
    expect(readerPlay(pattern, got(Math.floor(targets / 2)))).toBe('slow')
    expect(readerPlay(pattern, got(Math.floor(targets / 2), { misses: Math.ceil(targets / 2) }))).toBe('slow')
    expect(readerPlay(pattern, got(Math.floor(targets * 0.7), { strays: 1 }))).toBe('cautious')
    expect(readerPlay(pattern, got(Math.floor(targets * 0.7), { decoys: 1 }))).toBe('steady')
    expect(readerPlay(pattern, got(Math.floor(targets * 0.7), { strays: 2 }))).toBe('steady')
  })

  it('says slow, not cautious, of a reader the bunnies got away from', () => {
    const slow = soloAccount(pattern, { ...emptyTally(), hits: 3, misses: counts.bun - 3 }).join(' ')
    expect(slow).toContain('was slow')
    expect(slow).not.toMatch(/cautious|careful|bunnies let go/)
  })

  it('gives a round walked away from its account: the terms, the time left and the scores', () => {
    const mine = { ...emptyTally(), score: 40, hits: 4, best: 4 }
    const rivals = [{ name: 'Mia', tally: { ...emptyTally(), score: 60 } }]
    expect(standingAccount(pattern, 0, mine, rivals).join(' ')).toMatch(/Mia.*only just begun.*Nothing was scored/)
    const mid = standingAccount(pattern, 7500, mine, rivals).join(' ')
    expect(mid).toContain('23 of its 30 seconds left')
    expect(mid).toContain('the reader 40, Mia 60; Mia ahead')
    const alone = standingAccount(pattern, 15000, mine, []).join(' ')
    expect(alone).toContain('alone')
    expect(alone).toContain('40 points')
    expect(standingAccount(pattern, 15000, mine, [])).toHaveLength(2)
  })
})

describe('Whack-a-Bun balance', () => {
  /** An ordinary reader: a steady hand, about 60 ms either side, with the odd lapse and the odd carrot. */
  const READER: Hand = { reactMs: 620, spreadMs: 60, lapse: 0.07, flail: 0.3, fallFor: 0.18 }

  /** The share of rounds the reader wins and loses against one girl of a skill. */
  function versus(skill: Skill, pace: number, seconds: number): { won: number; lost: number } {
    const rand = seeded(skill * 1000 + pace * 10 + seconds)
    let won = 0
    let lost = 0
    const rounds = 400
    for (let round = 0; round < rounds; round++) {
      const pattern = makePattern(`b${round}`, pace, seconds)
      const mine = tallyOf(handPlay(pattern, READER, rand)).score
      const hers = tallyOf(herGame(pattern, skill, rand)).score
      if (mine > hers) won++
      else if (mine < hers) lost++
    }
    return { won: won / rounds, lost: lost / rounds }
  }

  it('has an ordinary reader usually beat a 1 or a 2, about even with a 3, usually lose to a 5', () => {
    const at = SKILLS.map((skill) => versus(skill, 2, 30))
    expect(at[0].won).toBeGreaterThan(0.85)
    expect(at[1].won).toBeGreaterThan(0.7)
    expect(at[2].won).toBeGreaterThan(0.35)
    expect(at[2].won).toBeLessThan(0.65)
    expect(at[3].lost).toBeGreaterThan(0.6)
    expect(at[4].lost).toBeGreaterThan(0.85)
  })

  /** Every key in turn, round and round, one every `everyMs`: no eyes on the board at all. */
  function roll(pattern: Pattern, everyMs: number): Press[] {
    const presses: Press[] = []
    for (let n = 0; n * everyMs < pattern.lengthMs; n++) presses.push({ at: n * everyMs, hole: n % 9 })
    return presses
  }

  it('gives mashing nothing: all nine keys rolled scores far below a careful reader and loses to a 2 and up', () => {
    const rounds = 300
    for (const pace of [2, 3]) {
      for (const everyMs of [15, 30, 60, 110, 220]) {
        const rand = seeded(pace * 100 + everyMs)
        let rolled = 0
        let careful = 0
        const lost = [0, 0, 0, 0, 0]
        for (let round = 0; round < rounds; round++) {
          const pattern = makePattern(`m${round}`, pace, 30)
          const score = tallyOf(pressPlay(pattern, roll(pattern, everyMs))).score
          rolled += score
          careful += tallyOf(handPlay(pattern, READER, rand)).score
          SKILLS.forEach((skill, i) => {
            if (score < tallyOf(herGame(pattern, skill, rand)).score) lost[i]++
          })
        }
        const note = `pace ${pace}, a key every ${everyMs} ms`
        expect(rolled / rounds, note).toBeLessThan((careful / rounds) * 0.4)
        for (const i of [0, 1, 2, 3, 4]) expect(lost[i] / rounds, `${note}, skill ${i + 1}`).toBeGreaterThan(0.9)
      }
    }
  })

  it('and holds at the other paces and lengths', () => {
    for (const [pace, seconds] of [[1, 30], [3, 30], [2, 60], [1, 60], [3, 60]]) {
      expect(versus(1, pace, seconds).won, `1 at ${pace}/${seconds}`).toBeGreaterThan(0.75)
      const even = versus(3, pace, seconds)
      expect(even.won, `3 at ${pace}/${seconds}`).toBeGreaterThan(0.25)
      expect(even.won, `3 at ${pace}/${seconds}`).toBeLessThan(0.75)
      expect(versus(5, pace, seconds).lost, `5 at ${pace}/${seconds}`).toBeGreaterThan(0.75)
    }
  })
})
