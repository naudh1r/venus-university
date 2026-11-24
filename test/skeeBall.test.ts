import { describe, expect, it } from 'vitest'
import {
  AIM_REACH,
  AIM_SWEEP_MS,
  BOARD,
  GUTTER,
  POWER_SPAN,
  POWER_SWEEP_MS,
  RIM,
  RINGS,
  SCATTER,
  WEIGHT_SCATTER,
  herRoll,
  herTarget,
  landOn,
  leadChanges,
  leadsOf,
  needOf,
  outcomeOf,
  powerY,
  progressTold,
  readerRoll,
  rollTold,
  scoresOf,
  soloAccount,
  soughtAt,
  stillOpen,
  stopsFor,
  sweepAt,
  sweepFrom,
  tableOf,
  tallyOf,
  totalsOf,
  versusAccount,
  versusSummary,
  type Roll,
  type RollKind,
  type Skill
} from '../src/shared/minigameRules/skeeBall'
import SKEE_BALL from '../src/shared/minigameEntries/skee-ball'

/** Skee-Ball's rules: what a landing scores, the rims, the turns, how she rolls and how it balances. */

function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const never = (): number => {
  throw new Error('asked the dice')
}

const ring = (value: number, side = 0): (typeof RINGS)[number] => RINGS.filter((each) => each.value === value)[side]

/** A roll that scored, with nothing else said of it. */
function roll(who: number, score: number, kind: RollKind = score === GUTTER ? 'between' : 'in', sought: number | null = 40): Roll {
  return { who, score, kind, sought, aim: 0, power: 0.6, x: 0, y: 19, ring: RINGS.find((each) => each.value === score) ?? null }
}

/** Rounds of scores, one row a round, the reader's first. */
const game = (...rounds: number[][]): Roll[] => rounds.flatMap((round) => round.map((score, who) => roll(who, score)))

describe('the board', () => {
  it('pays each ring at its middle with no dice asked', () => {
    for (const each of RINGS) {
      expect(landOn(each.x, each.y, never)).toMatchObject({ score: each.value, kind: 'in' })
    }
  })

  it('sends a ball short, long or between the rings to the gutter', () => {
    expect(landOn(0, -1, never)).toMatchObject({ score: GUTTER, kind: 'short' })
    expect(landOn(0, BOARD.depth + 1, never)).toMatchObject({ score: GUTTER, kind: 'back' })
    expect(landOn(7, 15, never)).toMatchObject({ score: GUTTER, kind: 'between' })
    // Beside a corner pocket there is nothing but gutter.
    const corner = ring(100, 1)
    expect(landOn(corner.x - corner.r - RIM - 0.2, corner.y, never).score).toBe(GUTTER)
  })

  it('lets a ball on a rim drop either way, by the dice', () => {
    const fifty = ring(50)
    const edge = fifty.x + fifty.r
    expect(landOn(edge, fifty.y, () => 0.1)).toMatchObject({ score: 50, kind: 'rim-in' })
    expect(landOn(edge, fifty.y, () => 0.9)).toMatchObject({ score: GUTTER, kind: 'rim-out', ring: fifty })
    // Just inside the rim it nearly always drops; just outside it nearly never does.
    expect(landOn(edge - RIM * 0.9, fifty.y, () => 0.9).kind).toBe('rim-in')
    expect(landOn(edge + RIM * 0.9, fifty.y, () => 0.1).kind).toBe('rim-out')
  })

  it('keeps the rims of two rings apart, so a ball is only ever on one', () => {
    for (const a of RINGS) {
      for (const b of RINGS) {
        if (a !== b) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.r + b.r + 2 * RIM)
      }
    }
  })

  it('climbs the rings with power up the middle: too soft and too hard both find the gutter', () => {
    const mid = (): number => 0.5
    const scores = Array.from({ length: 101 }, (_, k) => landOn(0, powerY(k / 100), mid).score)
    const climb = scores.filter((score, k) => score !== GUTTER && score !== scores[k - 1])
    expect(climb).toEqual([20, 30, 40, 50])
    expect(scores[0]).toBe(GUTTER)
    expect(scores[100]).toBe(GUTTER)
  })

  it('reaches every ring from the two stops', () => {
    for (const each of RINGS) {
      const { aim, power } = stopsFor(each.x, each.y)
      expect(Math.abs(aim)).toBeLessThan(1)
      expect(readerRoll(aim, power, () => 0.999).score).toBe(each.value)
      expect(soughtAt(each.x, each.y)).toBe(each.value)
    }
    expect(soughtAt(7, 12)).toBeNull()
  })

  it('sweeps back and forth', () => {
    expect(sweepAt(0, 1000)).toBe(0)
    expect(sweepAt(250, 1000)).toBe(0.25)
    expect(sweepAt(1000, 1000)).toBe(1)
    expect(sweepAt(1750, 1000)).toBe(0.25)
  })

  it('begins each sweep somewhere of its own, going either way, by the dice', () => {
    expect(sweepFrom(1000, () => 0)).toBe(0)
    expect(sweepFrom(800, () => 0.5)).toBe(800)
    const rand = seeded(3)
    const starts = Array.from({ length: 400 }, () => sweepFrom(1000, rand))
    for (const start of starts) {
      expect(start).toBeGreaterThanOrEqual(0)
      expect(start).toBeLessThan(2000)
    }
    // Both ways along it, and every part of it: no beat to learn.
    const rising = starts.filter((start) => start < 1000).length
    expect(rising).toBeGreaterThan(150)
    expect(rising).toBeLessThan(250)
    const tenths = new Set(starts.map((start) => Math.floor(sweepAt(start, 1000) * 10)))
    expect(tenths.size).toBe(10)
    // The same dice, the same sweep.
    expect(sweepFrom(1000, seeded(3))).toBe(starts[0])
  })
})

describe('the turns', () => {
  it('goes round one ball each, the reader first, until everyone has rolled them all', () => {
    expect(tableOf([], 3, 2)).toEqual({ who: 0, ball: 0, over: false })
    expect(tableOf(game([40]), 3, 2)).toMatchObject({ who: 1, ball: 0 })
    expect(tableOf(game([40, 30, 20], [10]), 3, 2)).toMatchObject({ who: 1, ball: 1, over: false })
    expect(tableOf(game([40, 30, 20], [10, 10, 10], [50, 50, 50]), 3, 2).over).toBe(true)
    expect(tableOf(game([40], [40], [40]), 3, 0).over).toBe(true)
  })

  it('totals each player and gives the reader the win only with the top to himself', () => {
    const rolls = game([40, 30, 100], [50, 10, 10])
    expect(scoresOf(rolls, 2)).toEqual([100, 10])
    expect(totalsOf(rolls, 2)).toEqual([90, 40, 110])
    expect(outcomeOf([230])).toBe('played')
    expect(outcomeOf([230, 200, 180])).toBe('won')
    expect(outcomeOf([230, 230, 180])).toBe('draw')
    expect(outcomeOf([230, 200, 240])).toBe('lost')
    expect(outcomeOf([230, 200, 200])).toBe('won')
  })

  it('reads the lead only at the end of a round', () => {
    const rolls = game([40, 50], [50, 10], [10, 40], [40])
    expect(leadsOf(rolls, 1)).toEqual([1, 0, null])
    expect(leadChanges([1, 0, null, 0, 1])).toBe(2)
    expect(leadChanges([null, null])).toBe(0)
  })

  it('knows what a player needs a ball to catch up', () => {
    const rolls = game([50, 10], [50, 10], [50])
    // She is 130 behind with 4 balls left.
    expect(needOf(rolls, 1, 6, 1)).toBe(32.5)
    expect(needOf(rolls, 0, 6, 1)).toBe(0)
    expect(needOf(game([50, 10], [50, 10], [50, 40]), 1, 3, 1)).toBe(0)
  })

  it('calls the last round open only within a corner pocket of the top', () => {
    expect(stillOpen([200, 110])).toBe(true)
    expect(stillOpen([200, 100])).toBe(false)
    expect(stillOpen([200])).toBe(false)
  })

  it('marks the moments worth a word', () => {
    const names = ['Ana']
    expect(rollTold(names, game([100]), 3).moments).toEqual(['hundred'])
    expect(rollTold(names, game([40, 10]), 3).moments).toEqual(['gutter'])
    expect(rollTold(names, game([40, 30], [40]), 3).moments).toEqual([])
    // The round that turns the lead over, which is also the one before the last.
    expect(rollTold(names, game([40, 30], [20, 50]), 3).moments).toEqual(['lead', 'decider'])
    // Out of reach, the last ball decides nothing.
    expect(rollTold(names, game([100, 20], [100, 20]), 3).moments).toEqual([])
    // Alone there is nobody to lead.
    expect(rollTold([], game([40], [40]), 3).moments).toEqual([])
  })
})

describe('her roll', () => {
  it('goes for the middle with nothing to chase, only the best for the 50, and asks no dice of the good ones', () => {
    expect(herTarget(5, 0, never)).toBe(50)
    expect(herTarget(4, 0, never)).toBe(40)
    expect(herTarget(3, 0, () => 0.9)).toBe(40)
    expect(herTarget(1, 0, () => 0.9)).toBe(40)
  })

  it('reaches for more as she falls behind, and for a corner when nothing else will do', () => {
    expect(herTarget(3, 45, () => 0.9)).toBe(50)
    expect(herTarget(5, 60, never)).toBe(100)
    expect(herTarget(1, 60, never)).toBe(100)
  })

  it('is tempted by the corners for no reason only where she plays poorly', () => {
    expect(herTarget(1, 0, () => 0.1)).toBe(100)
    expect(herTarget(2, 0, () => 0.1)).toBe(100)
    expect(herTarget(3, 0, () => 0.1)).toBe(40)
  })

  it('scatters less and scores more the better she is', () => {
    const skills: Skill[] = [1, 2, 3, 4, 5]
    const means = skills.map((skill) => {
      const rand = seeded(7 + skill)
      let total = 0
      for (let k = 0; k < 4000; k++) total += herRoll(skill, 0, rand).score
      return total / 4000
    })
    // A ladder: each skill a clear step above the one below.
    for (let k = 1; k < means.length; k++) expect(means[k] - means[k - 1]).toBeGreaterThan(2)
    expect(SCATTER[5]).toBeLessThan(SCATTER[1])
  })

  it('has each girl at home on the middle ring that pays her best', () => {
    const bell = (rand: () => number): number =>
      Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand())
    /** What a ball of hers averages rolled at a ring every time. */
    const at = (skill: Skill, value: number): number => {
      const rand = seeded(500 + skill * 13 + value)
      const target = ring(value)
      let total = 0
      for (let k = 0; k < 40000; k++) {
        total += landOn(target.x + bell(rand) * SCATTER[skill], target.y + bell(rand) * SCATTER[skill] * WEIGHT_SCATTER, rand).score
      }
      return total / 40000
    }
    for (const skill of [1, 2, 3, 4, 5] as Skill[]) {
      const home = herTarget(skill, 0, () => 0.99)
      for (const other of [30, 40, 50]) if (other !== home) expect(at(skill, home)).toBeGreaterThan(at(skill, other))
    }
  })

  it('makes a corner a gamble even for the best', () => {
    // She makes fewer than half.
    const rand = seeded(99)
    let made = 0
    for (let k = 0; k < 4000; k++) if (herRoll(5, 100, rand).score === 100) made++
    expect(made / 4000).toBeLessThan(0.6)
    expect(made / 4000).toBeGreaterThan(0.25)
  })
})

describe('the balance', () => {
  /** An ordinary reader: he stops each sweep within 60 ms of where he meant to. */
  function readerAt(value: number, rand: () => number): Omit<Roll, 'who'> {
    const target = RINGS.filter((each) => each.value === value)[rand() < 0.5 ? 0 : value === 100 ? 1 : 0]
    const { aim, power } = stopsFor(target.x, target.y)
    const late = (): number => (rand() * 2 - 1) * 60
    const offAim = (late() / AIM_SWEEP_MS) * 2
    const offPower = late() / POWER_SWEEP_MS
    return readerRoll(Math.max(-1, Math.min(1, aim + offAim)), Math.max(0, Math.min(1, power + offPower)), rand)
  }

  /** How often the reader, rolling for `value` every ball, beats and draws a girl over many games. */
  function versus(skill: Skill, value: number, games = 3000): { won: number; drawn: number; mine: number; hers: number } {
    const rand = seeded(1000 + skill * 31 + value)
    let won = 0
    let drawn = 0
    let mine = 0
    let hers = 0
    for (let k = 0; k < games; k++) {
      const rolls: Roll[] = []
      for (let ball = 0; ball < 6; ball++) {
        rolls.push({ who: 0, ...readerAt(value, rand) })
        rolls.push({ who: 1, ...herRoll(skill, needOf(rolls, 1, 6, 1), rand) })
      }
      const [a, b] = totalsOf(rolls, 1)
      mine += a
      hers += b
      if (a > b) won++
      else if (a === b) drawn++
    }
    return { won: won / games, drawn: drawn / games, mine: mine / games / 6, hers: hers / games / 6 }
  }

  it('has an ordinary reader usually beat a poor player, sit about even with a fair one and usually lose to the best', () => {
    const rates = ([1, 2, 3, 4, 5] as Skill[]).map((skill) => versus(skill, 40))
    expect(rates[0].won).toBeGreaterThan(0.7)
    expect(rates[1].won).toBeGreaterThan(0.6)
    // Even: he wins about as often as he loses, the rest level.
    expect(rates[2].won).toBeGreaterThan(0.33)
    expect(rates[2].won).toBeLessThan(0.55)
    expect(1 - rates[2].won - rates[2].drawn).toBeGreaterThan(0.25)
    expect(rates[4].won).toBeLessThan(0.25)
  })

  it('makes the corners a gamble for the reader: worse on average than the safe 40', () => {
    expect(versus(3, 100).mine).toBeLessThan(versus(3, 40).mine)
  })

  /**
   * A reader stopping the two sweeps as they are run, each begun wherever the dice put it: he
   * lets the marker come round to where he wants it and is off by a bell curve `ms` wide.
   */
  function timed(value: number, ms: number, rand: () => number): number {
    const bell = (): number => Math.sqrt(-2 * Math.log(Math.max(rand(), 1e-9))) * Math.cos(2 * Math.PI * rand())
    const stopAt = (want: number, period: number): number => {
      const from = sweepFrom(period, rand)
      // The marker passes the spot going up and coming back; he takes the first pass he has had time to read.
      const passes = [want * period, (2 - want) * period].map((pass) => {
        let wait = pass - from
        while (wait < 300) wait += 2 * period
        return wait
      })
      return sweepAt(from + Math.max(0, Math.min(...passes) + bell() * ms), period)
    }
    const target = ring(value, value === 100 && rand() < 0.5 ? 1 : 0)
    const { aim, power } = stopsFor(target.x, target.y)
    return readerRoll(stopAt((aim + 1) / 2, AIM_SWEEP_MS) * 2 - 1, stopAt(power, POWER_SWEEP_MS), rand).score
  }

  /** What a ball averages rolled for one ring every time, at a timing error. */
  function average(value: number, ms: number): number {
    const rand = seeded(9000 + value * 7 + ms)
    let total = 0
    for (let k = 0; k < 40000; k++) total += timed(value, ms, rand)
    return total / 40000
  }

  it('pays a very sharp reader for the corners and makes them a losing gamble for an ordinary one', () => {
    const table = [25, 40, 60].map((ms) => ({ ms, forty: average(40, ms), fifty: average(50, ms), corner: average(100, ms) }))
    console.log(
      table.map((row) => `${row.ms} ms: the 40 ${row.forty.toFixed(1)}, the 50 ${row.fifty.toFixed(1)}, corners ${row.corner.toFixed(1)}`).join('\n')
    )
    const [sharp, fair, loose] = table
    // Within 25 ms the corners pay, and well.
    expect(sharp.corner).toBeGreaterThan(sharp.forty + 4)
    // From 40 ms on they are worse than the safe 40, and worse the looser he is.
    expect(fair.corner).toBeLessThan(fair.forty - 1)
    expect(loose.corner).toBeLessThan(loose.forty - 4)
    // The 40 stays the steady ball: the 50 is no better than it from 40 ms on.
    expect(fair.fifty).toBeLessThan(fair.forty)
  })
})

describe('the result', () => {
  it('names the standings in the summary, whoever came where', () => {
    expect(versusSummary(['Ana'], [230, 180])).toBe('You play Skee-Ball against Ana and win, 230 to 180.')
    expect(versusSummary(['Ana'], [200, 200])).toBe('You play Skee-Ball against Ana and it ends level, 200 each.')
    const names = ['Ana', 'Bea', 'Cy']
    expect(versusSummary(names, [230, 180, 230, 90])).toBe(
      'You play Skee-Ball against Ana, Bea and Cy and share the top score with Bea: you 230, Bea 230, Ana 180, Cy 90.'
    )
    expect(versusSummary(names, [180, 250, 200, 90])).toBe(
      'You play Skee-Ball against Ana, Bea and Cy and finish third; Ana wins: Ana 250, Bea 200, you 180, Cy 90.'
    )
  })

  it('counts the gambles and the luck for the account', () => {
    const rolls: Roll[] = [
      roll(0, 100, 'in', 100),
      roll(0, GUTTER, 'between', 100),
      roll(0, GUTTER, 'rim-out', 50),
      roll(0, 40, 'rim-in', 40)
    ]
    expect(tallyOf(rolls, 0)).toMatchObject({ total: 160, hundreds: 1, gutters: 2, corners: 2, cornerPoints: 110, kind: 1, unkind: 1 })
    const account = soloAccount(rolls)
    expect(account.some((line) => line.includes('it paid'))).toBe(true)
    const two = versusAccount(['Ana'], game([40, 30], [20, 50], [40, 40]), 3)
    expect(two.some((line) => line.includes('played it safe'))).toBe(true)
    expect(two[two.length - 1]).toContain('the reader 100, Ana 120')
  })

  it('says how the game stands after any ball, for a game walked away from', () => {
    const told = progressTold(['Ana'], game([40, 30], [100]), 6)
    expect(told[0]).toContain('6 balls each')
    expect(told[1]).toBe('So far: the reader 140 after 2 balls, 4 left; Ana 30 after 1 ball, 5 left.')
    expect(progressTold([], game([40]), 3)).toEqual([
      'The reader was rolling 3 balls of Skee-Ball alone.',
      'So far: the reader 40 after 1 ball, 2 left.'
    ])
  })

  it('is on paper what it is on the board', () => {
    expect(SKEE_BALL.players).toEqual({ min: 0, max: 3 })
    expect(SKEE_BALL.options?.[0]).toMatchObject({ id: 'balls', min: 3, max: 9, default: 6 })
    expect(AIM_REACH).toBeGreaterThan(ring(100, 1).x)
    expect(POWER_SPAN).toBeGreaterThan(BOARD.depth)
  })
})
