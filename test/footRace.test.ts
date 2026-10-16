import { describe, expect, it } from 'vitest'
import { seededRand } from '../src/shared/hash'
import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, settledOptions, suggestRate } from '../src/shared/minigames'
import FOOT_RACE_MOD from '../src/shared/modEntries/morrowkiln-sports'
import {
  MAX_CADENCE,
  SPENT_EFFORT,
  STEP_S,
  account,
  clockText,
  courseOf,
  effortAt,
  falseStartPenaltyS,
  freshRunner,
  herPlan,
  herRace,
  herStep,
  noStrides,
  outcomeOf,
  paced,
  penaltyShownS,
  placesNow,
  placesOf,
  readerPacing,
  setGapS,
  shownTime,
  soloSummary,
  speedFor,
  stepRunner,
  stride,
  timeText,
  versusSummary,
  type Course,
  type Runner,
  type Side,
  type Skill,
  type Strides,
  type Told
} from '../src/shared/minigameRules/footRace'

/** Foot Race's rules: strides into effort, effort into speed and stamina, her race by her skill, the start and the finish. */

const SKILLS: Skill[] = [1, 2, 3, 4, 5]
const DISTANCES = [1, 2, 3]

/** Strides at a steady cadence from `from` for `seconds`, alternating unless told otherwise. */
function tapped(cadence: number, seconds: number, alternate = true, from = 0): Strides {
  let strides = noStrides()
  for (let i = 0; i / cadence < seconds; i++) {
    const side: Side = alternate && i % 2 ? 'right' : 'left'
    strides = stride(strides, side, from + i / cadence)
  }
  return strides
}

/** A runner taken round at a steady effort, flat out from `kickFrom` of the way. */
function run(course: Course, effort: number, kickFrom = 2): Runner {
  let runner = freshRunner()
  for (let i = 0; runner.finishedAt === null && i < 60 * 300; i++) {
    runner = stepRunner(runner, runner.pos / course.metres >= kickFrom ? 1 : effort, course, i * STEP_S)
  }
  return runner
}

const told = (name: string, time: number | null, over: Partial<Told> = {}): Told => ({
  name,
  time,
  reactionS: 0.25,
  falseStarts: 0,
  spentAt: null,
  stumbled: false,
  staminaLeft: 0.1,
  placeAtHalf: 0,
  placeAtLast: 0,
  ...over
})

describe('Foot Race strides', () => {
  it('turns a faster clean cadence into more effort, up to flat out', () => {
    const at = (cadence: number): number => effortAt(tapped(cadence, 3), 3)
    expect(at(2)).toBeLessThan(at(4))
    expect(at(4)).toBeLessThan(at(6))
    expect(at(4)).toBeCloseTo(4 / MAX_CADENCE, 1)
    expect(at(12)).toBe(1)
  })

  it('gets nowhere on one foot', () => {
    expect(effortAt(tapped(6, 3, false), 3)).toBeLessThan(0.05)
    const mixed = stride(stride(tapped(6, 2), 'left', 2.2), 'left', 2.36)
    expect(mixed.slips).toBeGreaterThan(0)
    expect(mixed.cadence).toBeLessThan(tapped(6, 2).cadence)
  })

  it('lets the effort fall away as soon as the strides stop', () => {
    const strides = tapped(6, 2)
    const last = strides.lastAt as number
    expect(effortAt(strides, last + 0.1)).toBeGreaterThan(0.8)
    expect(effortAt(strides, last + 0.5)).toBeLessThan(0.4)
    expect(effortAt(strides, last + 3)).toBeLessThan(0.07)
    expect(effortAt(noStrides(), 5)).toBe(0)
  })
})

describe('Foot Race running', () => {
  it('has speed follow effort and stamina go by how hard it is pushed', () => {
    const course = courseOf(2)
    expect(speedFor(course, 0.5)).toBeLessThan(speedFor(course, 0.8))
    expect(speedFor(course, 1)).toBe(course.top)
    const after = (effort: number): Runner => {
      let runner = freshRunner()
      for (let i = 0; i < 180; i++) runner = stepRunner(runner, effort, course, i * STEP_S)
      return runner
    }
    expect(after(1).pos).toBeGreaterThan(after(0.7).pos)
    // Three tenths more effort costs far more than three tenths more stamina.
    expect(1 - after(1).stamina).toBeGreaterThan((1 - after(0.7).stamina) * 2.5)
    expect(after(0.2).stamina).toBe(1)
  })

  it('leaves a runner with an empty tank jogging, however hard she tries', () => {
    const course = courseOf(3)
    let runner = freshRunner()
    let i = 0
    for (; runner.spentAt === null; i++) runner = stepRunner(runner, 1, course, i * STEP_S)
    expect(runner.spentAt).toBeLessThan(0.6)
    for (let n = 0; n < 240; n++, i++) runner = stepRunner(runner, 1, course, i * STEP_S)
    expect(runner.speed).toBeLessThanOrEqual(speedFor(course, SPENT_EFFORT) + 0.01)
  })

  it('makes the sprint flat out and the longer races a matter of pace and a kick', () => {
    const sprint = courseOf(1)
    expect(run(sprint, 1).finishedAt).toBeLessThan(run(sprint, 0.8).finishedAt as number)
    expect(run(sprint, 1).spentAt).toBeNull()
    for (const distance of [2, 3]) {
      const course = courseOf(distance)
      const cruise = (course.band[0] + course.band[1]) / 2
      const even = run(course, cruise).finishedAt as number
      expect(even).toBeLessThan(run(course, 1).finishedAt as number)
      expect(even).toBeLessThan(run(course, 0.9).finishedAt as number)
      expect(even).toBeLessThan(run(course, 0.45).finishedAt as number)
      expect(run(course, cruise, 0.82).finishedAt).toBeLessThan(even)
    }
  })

  it('takes about as long to play as it should', () => {
    expect(run(courseOf(1), 1).finishedAt).toBeGreaterThan(9.5)
    expect(run(courseOf(1), 0.9).finishedAt).toBeLessThan(12.5)
    for (const distance of [2, 3]) {
      const course = courseOf(distance)
      expect(run(course, (course.band[0] + course.band[1]) / 2).finishedAt).toBeLessThan(45)
    }
    expect(courseOf(7)).toBe(courseOf(1))
    expect(courseOf(undefined).metres).toBe(100)
  })

  it('times the line inside the step it is crossed in', () => {
    const course = courseOf(1)
    const nearly: Runner = { ...freshRunner(), pos: 99.95, speed: 10 }
    const done = stepRunner(nearly, 1, course, 10, 1, 0.1)
    expect(done.pos).toBe(100)
    expect(done.finishedAt).toBeGreaterThan(10)
    expect(done.finishedAt).toBeLessThan(10.02)
    expect(stepRunner(done, 1, course, 11)).toBe(done)
  })
})

describe('Foot Race start', () => {
  it('holds "set" a different while each time, inside its range', () => {
    const rand = seededRand('gaps')
    const gaps = Array.from({ length: 50 }, () => setGapS(rand))
    expect(Math.min(...gaps)).toBeGreaterThanOrEqual(0.9)
    expect(Math.max(...gaps)).toBeLessThanOrEqual(2.6)
    expect(new Set(gaps.map((gap) => gap.toFixed(2))).size).toBeGreaterThan(30)
  })

  it('warns for the first false start and costs time, never the race, after it', () => {
    expect(falseStartPenaltyS(0)).toBe(0)
    expect(falseStartPenaltyS(1)).toBe(0)
    expect(falseStartPenaltyS(2)).toBeGreaterThan(0)
    expect(falseStartPenaltyS(3)).toBeGreaterThan(falseStartPenaltyS(2))
    expect(falseStartPenaltyS(40)).toBeLessThanOrEqual(1.5)
  })
})

describe('Foot Race, her race', () => {
  const mean = (skill: Skill, course: Course): number => {
    let sum = 0
    for (let i = 0; i < 120; i++) {
      sum += herRace(herPlan(skill, course, seededRand(`${course.metres}:${skill}:${i}`)), course).finishedAt as number
    }
    return sum / 120
  }

  it('is faster with every step of skill, at every distance', () => {
    for (const distance of DISTANCES) {
      const course = courseOf(distance)
      const times = SKILLS.map((skill) => mean(skill, course))
      for (let i = 1; i < times.length; i++) expect(times[i]).toBeLessThan(times[i - 1] * 0.98)
    }
  })

  it('always gets her to the line, inside the time the race is waited on', () => {
    for (const distance of DISTANCES) {
      const course = courseOf(distance)
      for (const skill of SKILLS) {
        for (let i = 0; i < 40; i++) {
          const done = herRace(herPlan(skill, course, seededRand(`in:${distance}:${skill}:${i}`)), course)
          expect(done.finishedAt).not.toBeNull()
          expect(done.finishedAt).toBeLessThan(course.limitS)
        }
      }
    }
  })

  it('has the best react sooner, never stumble, never jump the gun and never misjudge the pace', () => {
    const course = courseOf(3)
    const plans = (skill: Skill): ReturnType<typeof herPlan>[] =>
      Array.from({ length: 200 }, (_, i) => herPlan(skill, course, seededRand(`plan:${skill}:${i}`)))
    const [worst, best] = [plans(1), plans(5)]
    expect(Math.max(...best.map((plan) => plan.reactionS))).toBeLessThan(Math.min(...worst.map((plan) => plan.reactionS)))
    expect(best.every((plan) => plan.pacing === 'even' && plan.stumbleAt === null && !plan.jumps)).toBe(true)
    expect(worst.filter((plan) => plan.pacing === 'fast').length).toBeGreaterThan(60)
    expect(worst.filter((plan) => plan.pacing === 'slow').length).toBeGreaterThan(20)
    expect(worst.filter((plan) => plan.stumbleAt !== null).length).toBeGreaterThan(50)
    // Nobody misjudges a sprint: there is no pace to judge.
    expect(herPlan(1, courseOf(1), () => 0).pacing).toBe('even')
  })

  it('fades when she goes out too fast, and not when she paces it', () => {
    const course = courseOf(2)
    const base = { skill: 2 as Skill, reactionS: 0.3, topFactor: 0.85, stumbleAt: null, jumps: false }
    const hot = herRace({ ...base, pacing: 'fast', off: 0.2 }, course)
    const even = herRace({ ...base, pacing: 'even', off: 0 }, course)
    expect(hot.spentAt).not.toBeNull()
    expect(hot.spentAt).toBeLessThan(0.8)
    expect(even.spentAt).toBeNull()
    expect(even.finishedAt).toBeLessThan(hot.finishedAt as number)
    const good = herRace({ ...base, skill: 5, pacing: 'even', off: 0 }, course)
    // A good runner's kick spends what she has without emptying her short of the line.
    expect(good.finishedAt).toBeLessThan(even.finishedAt as number)
    expect(good.spentAt ?? 1).toBeGreaterThan(0.97)
    expect(good.stamina).toBeLessThan(0.1)
  })

  it('waits for her reaction, and loses ground to a stumble', () => {
    const course = courseOf(1)
    const plan = { skill: 3 as Skill, reactionS: 0.3, topFactor: 0.9, pacing: 'even' as const, off: 0, stumbleAt: null, jumps: false }
    expect(herStep(freshRunner(), plan, course, 0.1)).toEqual(freshRunner())
    expect(herStep(freshRunner(), plan, course, 0.3).speed).toBeGreaterThan(0)
    const tripped = herRace({ ...plan, stumbleAt: 0.5 }, course)
    expect(tripped.stumbled).toBe(true)
    expect(tripped.finishedAt).toBeGreaterThan((herRace(plan, course).finishedAt as number) + 0.2)
  })
})

describe('Foot Race finish', () => {
  it('places by time, shares a place on the same hundredth and puts a non-finisher last', () => {
    expect(placesOf([11.42, 11.2, 12])).toEqual([2, 1, 3])
    expect(placesOf([11.2, 11.2, 12, 11.9])).toEqual([1, 1, 4, 3])
    expect(placesOf([null, 11.2, 12])).toEqual([3, 1, 2])
    expect(placesOf([11])).toEqual([1])
    const course = courseOf(2)
    // Two crossings a hair apart on the play clock are the same time on the board.
    expect(shownTime(course, 25.0001)).toBe(shownTime(course, 25.0004))
    expect(shownTime(course, null)).toBeNull()
  })

  it('reads the race from the reader\'s side', () => {
    expect(outcomeOf([1])).toBe('played')
    expect(outcomeOf([1, 2, 3])).toBe('won')
    expect(outcomeOf([1, 3, 1])).toBe('draw')
    expect(outcomeOf([2, 1, 3])).toBe('lost')
    expect(outcomeOf([3, 1, 2])).toBe('lost')
  })

  it('places runners on the track by distance, a finisher ahead of the rest', () => {
    const at = (pos: number, finishedAt: number | null = null): Runner => ({ ...freshRunner(), pos, finishedAt })
    expect(placesNow([at(40), at(55), at(40)])).toEqual([2, 1, 2])
    expect(placesNow([at(100, 11.5), at(99), at(100, 11.2)])).toEqual([2, 3, 1])
  })

  it('writes a time as the board has it', () => {
    expect(timeText(11.4)).toBe('11.40 s')
    expect(timeText(62.31)).toBe('1:02.31')
    expect(timeText(null)).toBe('did not finish')
  })

  it('judges how the reader paced a longer race', () => {
    expect(readerPacing(told('', 60, { spentAt: 0.6, staminaLeft: 0 }))).toBe('too-fast')
    expect(readerPacing(told('', 60, { staminaLeft: 0.5 }))).toBe('left-too-much')
    expect(readerPacing(told('', 60, { spentAt: 0.97, staminaLeft: 0 }))).toBe('even')
    expect(readerPacing(told('', 60, { staminaLeft: 0.08 }))).toBe('even')
  })

  it('names everyone and says who won, in the summary and the account', () => {
    const course = courseOf(2)
    const race = [
      told('', 62.31, { placeAtHalf: 1, placeAtLast: 1, spentAt: 0.7, staminaLeft: 0 }),
      told('Ana', 61.2, { placeAtHalf: 3, placeAtLast: 2 }),
      told('Bea', 62.35, { placeAtHalf: 2, placeAtLast: 3, falseStarts: 1, stumbled: true }),
      told('Cy', null, { placeAtHalf: 4, placeAtLast: 4 })
    ]
    const summary = versusSummary(course, race)
    const lines = account(course, race).join('\n')
    for (const name of ['Ana', 'Bea', 'Cy']) {
      expect(summary).toContain(name)
      expect(lines).toContain(name)
    }
    expect(summary).toContain('come 2nd')
    expect(summary).toContain('1st Ana 1:01.20')
    expect(lines).toContain('the reader')
    expect(lines).not.toMatch(/\byou\b/i)
    expect(lines).toContain('1st Ana')
    // The pass in the closing stretch, the near thing, and the reader's own pacing are told.
    expect(lines).toMatch(/Ana kicked past the reader/)
    expect(lines).toMatch(/photo finish/)
    expect(lines).toMatch(/too fast/)
    expect(lines).toMatch(/out of breath/)

    expect(versusSummary(course, [told('', 61.2), told('Ana', 61.2), told('Bea', 63)])).toContain('dead-heat with Ana')
    expect(versusSummary(course, [told('', 60), told('Ana', 61.2)])).toContain('and win.')
    expect(soloSummary(course, told('', 62.31))).toContain('1:02.31')
    expect(account(course, [told('', 62.31)]).join('\n')).not.toContain('undefined')
  })
})

/** The reader at the keys: off the mark at `react`, then alternating at `rate` strides a second, a little unevenly. */
function tapper(course: Course, rate: number, rand: () => number, react = 0.3): Runner {
  let runner = freshRunner()
  let strides = noStrides()
  let next = react
  let side: Side = 'left'
  for (let i = 0; runner.finishedAt === null && i * STEP_S < course.limitS; i++) {
    const at = i * STEP_S
    while (next <= at) {
      strides = stride(strides, side, next)
      side = side === 'left' ? 'right' : 'left'
      next += (1 + (rand() - 0.5) * 0.2) / rate
    }
    runner = stepRunner(runner, effortAt(strides, at), course, at)
  }
  return runner
}

describe('Foot Race at the keyboard', () => {
  const average = (skill: Skill, course: Course): number => {
    const rand = seededRand('average')
    let total = 0
    for (let i = 0; i < 100; i++) total += herRace(herPlan(skill, course, rand), course).finishedAt as number
    return total / 100
  }

  it('lets an ordinary five strides a second beat a middling girl in the sprint, and four and a half stay with her', () => {
    const course = courseOf(1)
    const her = average(3, course)
    expect(tapper(course, 5, seededRand('five')).finishedAt).toBeLessThan(her)
    expect(tapper(course, 4.5, seededRand('four')).finishedAt).toBeLessThan(her + 0.6)
    expect(tapper(course, 4.5, seededRand('four')).finishedAt).toBeLessThan(average(2, course))
  })

  it('rewards pace, not faster tapping, in the longer races', () => {
    for (const distance of [2, 3]) {
      const course = courseOf(distance)
      const steady = tapper(course, 3.8, seededRand('steady'))
      expect(steady.finishedAt).toBeLessThan(average(3, course))
      expect(steady.spentAt === null || steady.spentAt > 0.88).toBe(true)
      // Flat out all the way is slower than a pace anyone can hold.
      expect(tapper(course, MAX_CADENCE, seededRand('flat')).finishedAt).toBeGreaterThan(steady.finishedAt as number)
      expect((course.band[1] * MAX_CADENCE)).toBeLessThan(4.5)
    }
  })

  it('never has the running clock read sixty seconds in a minute', () => {
    expect(clockText(courseOf(1), 59.97)).toBe('59.9')
    expect(clockText(courseOf(1), 119.97)).toBe('1:59.9')
    expect(clockText(courseOf(1), 60)).toBe('1:00.0')
    expect(clockText(courseOf(2), 10)).toBe('24.0')
    expect(clockText(courseOf(1), -1)).toBe('0.0')
  })

  it('tells a hold in the blocks as the board clock has it', () => {
    expect(penaltyShownS(courseOf(1), 1)).toBe(0)
    expect(penaltyShownS(courseOf(1), 2)).toBe(0.5)
    expect(penaltyShownS(courseOf(2), 2)).toBe(1.2)
    expect(penaltyShownS(courseOf(3), 9)).toBeCloseTo(4.95, 1)
    const lines = account(courseOf(2), [told('', 61.2, { falseStarts: 2 }), told('Ana', 60)]).join(' ')
    expect(lines).toContain('until the clock read 1.2 s')
  })
})

describe('Foot Race on paper', () => {
  const game = MINI_GAMES_LIST.find((one) => one.id === 'foot-race')

  it('is listed, in a pack that requires the framework', () => {
    expect(game).toBeDefined()
    expect(game?.modId).toBe(FOOT_RACE_MOD.id)
    expect(FOOT_RACE_MOD.requires).toEqual([MINI_GAMES])
    expect(game?.players).toEqual({ min: 0, max: 3 })
  })

  it('is run only where there is room to, alone or with whoever is there', () => {
    if (!game) throw new Error('no game')
    const on = (): boolean => true
    for (const location of ['palaestra_stadium', 'green_hill_park', 'venus_quad', 'selkie_beach']) {
      expect(gamesOffered({ location, girls: 0 }, on, [game])).toEqual([game])
      expect(gamesOffered({ location, girls: 3 }, on, [game])).toEqual([game])
    }
    expect(gamesOffered({ location: 'room', girls: 1 }, on, [game])).toEqual([])
    expect(gamesOffered({ location: null, girls: 1 }, on, [game])).toEqual([])
    expect(suggestRate(game, 'palaestra_stadium', false)).toBe('often')
    expect(suggestRate(game, 'selkie_beach', false)).toBe('sometimes')
  })

  it('plays every distance it offers, and the sprint by default', () => {
    if (!game) throw new Error('no game')
    expect(settledOptions(game, undefined)).toEqual({ distance: 1 })
    expect([1, 2, 3].map((distance) => courseOf(settledOptions(game, { distance }).distance).metres)).toEqual([100, 400, 800])
    expect(paced(courseOf(1))).toBe(false)
    expect(paced(courseOf(3))).toBe(true)
  })
})
