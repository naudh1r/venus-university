import { describe, expect, it } from 'vitest'
import { seededRand } from '../src/shared/hash'
import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, suggestRate } from '../src/shared/minigames'
import SWIM_MOD from '../src/shared/modEntries/morrowkiln-sports'
import {
  BREATH_GAP_MS,
  CYCLE_MS,
  GASP_MS,
  LENGTH_LIMIT_MS,
  LENGTH_M,
  PULL_LONG,
  PULL_MS,
  PULL_SHORT,
  STEP_MS,
  TEMPO_RUSHED,
  TURN_GOOD_M,
  TURN_PERFECT_M,
  TURN_ZONE_M,
  advance,
  breathe,
  callTurn,
  clockOf,
  courseWords,
  herMind,
  herMove,
  herRace,
  herReaction,
  herTurn,
  legLabel,
  lengthsOf,
  limitOf,
  newRace,
  onBlocks,
  orderNow,
  outcomeOf,
  placesOf,
  raceAccount,
  raceProgress,
  raceSummary,
  runRace,
  stroke,
  strokeOf,
  strokeWorth,
  swimming,
  toWall,
  turnPlace,
  waterAt,
  type Skill,
  type Swimmer,
  type TurnGrade
} from '../src/shared/minigameRules/swimRace'

/** Swim Race's rules: the stroke, the air, the turn, how she swims, and how a race is placed. */

const SKILLS: readonly Skill[] = [1, 2, 3, 4, 5]
const STEP = STEP_MS

/** A swimmer already in open water, `dist` metres in. */
function inWater(dist = 5): Swimmer {
  const swimmer = onBlocks(0)
  swimmer.dist = dist
  swimmer.speed = 2
  return swimmer
}

/**
 * The reader as a machine: the same pull at the same tempo all the way (or each as a function
 * of the stroke's number), a breath under `breatheAt`, and a turn called `turnAt` metres from
 * each wall (never, where it is null). Time is called on him as on anyone.
 */
function swum(
  lengths: number,
  pullMs: number | ((at: number) => number),
  cycleMs: number | ((at: number) => number),
  breatheAt: number,
  turnAt: number | null
): Swimmer {
  const swimmer = onBlocks(200)
  const of = (value: number | ((at: number) => number), at: number): number =>
    typeof value === 'number' ? value : value(at)
  let next = 0
  let last: number | null = null
  let taken = 0
  for (let clock = STEP; swimmer.finishMs === null && clock <= limitOf(lengths); clock += STEP) {
    advance(swimmer, STEP, clock, lengths)
    if (!swimming(swimmer)) {
      next = 0
      last = null
      continue
    }
    if (turnAt !== null && toWall(swimmer) <= turnAt) callTurn(swimmer, lengths)
    next -= STEP
    if (next > 0) continue
    const cycle = of(cycleMs, taken)
    next += cycle
    if (swimmer.air < breatheAt) breathe(swimmer)
    stroke(swimmer, of(pullMs, taken), last)
    last = cycle
    taken++
  }
  return swimmer
}

/** A swimmer's time, and no time at all where it was called on her. */
const timeIn = (swimmer: Swimmer): number => swimmer.finishMs ?? Infinity

/** Swimming on the guide: the best pull on the cycle, a breath in good time, a perfect turn. */
const guided = (lengths: number): number => timeIn(swum(lengths, PULL_MS, CYCLE_MS, 0.2, 0.6))

const mean = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0) / values.length

describe('Swim Race stroke', () => {
  it('is worth most pulled long and even, and little thrashed', () => {
    expect(strokeWorth(PULL_MS, CYCLE_MS)).toBe(1)
    expect(strokeWorth(PULL_MS, null)).toBe(1)
    expect(strokeWorth(PULL_MS / 2, CYCLE_MS)).toBeLessThan(0.5)
    expect(strokeWorth(PULL_MS, CYCLE_MS / 2)).toBeLessThan(0.6)
    // A late stroke loses nothing of itself; a pull held far too long loses a little.
    expect(strokeWorth(PULL_MS, CYCLE_MS * 2)).toBe(1)
    expect(strokeWorth(PULL_MS * 3, CYCLE_MS)).toBeLessThan(1)
    expect(strokeWorth(PULL_MS * 3, CYCLE_MS)).toBeGreaterThanOrEqual(0.5)
  })

  it('makes three short fast strokes worth less than one long one, at more air', () => {
    const long = inWater()
    const short = inWater()
    stroke(long, PULL_MS, CYCLE_MS)
    for (let i = 0; i < 3; i++) stroke(short, PULL_MS / 3, CYCLE_MS / 3)
    expect(short.speed).toBeLessThan(long.speed)
    expect(short.air).toBeLessThan(long.air)
    expect(short.thrashed).toBe(3)
  })

  it('does nothing on the blocks, at a wall or once home', () => {
    const waiting = onBlocks(300)
    expect(stroke(waiting, PULL_MS, null)).toEqual({ worth: 0, emptied: false })
    expect(breathe(waiting)).toBe(false)
    expect(waiting.strokes).toBe(0)
    const home = inWater()
    home.finishMs = 1000
    expect(strokeOf(home, 1)).toBe(false)
    expect(home.strokes).toBe(0)
  })

  it('wins a length with rhythm, not with speed of hand', () => {
    const even = swum(2, PULL_MS, CYCLE_MS, 0.2, 0.6)
    const thrashed = swum(2, 150, 300, 0.2, 0.6)
    expect(even.finishMs).toBeGreaterThan(18_000)
    expect(even.finishMs).toBeLessThan(26_000)
    expect(timeIn(thrashed)).toBeGreaterThan((even.finishMs ?? 0) * 1.5)
  })

  it('is worth everything only close to the best pull, and less the longer it is held on', () => {
    for (const share of [PULL_SHORT, 1, PULL_LONG]) expect(strokeWorth(PULL_MS * share, CYCLE_MS)).toBe(1)
    expect(strokeWorth(PULL_MS * PULL_SHORT - 20, CYCLE_MS)).toBeLessThan(1)
    expect(strokeWorth(PULL_MS * PULL_LONG + 20, CYCLE_MS)).toBeLessThan(1)
    // The pulls a held key drifts to: each worth less than the one before.
    const held = [550, 600, 650, 720].map((pull) => strokeWorth(pull, CYCLE_MS))
    for (let i = 1; i < held.length; i++) expect(held[i]).toBeLessThan(held[i - 1])
    expect(held[1]).toBeLessThan(0.9)
    expect(held[3]).toBeLessThan(0.7)
  })

  it('never pays for a stroke begun sooner than the cycle: the worth lost is more than the time saved', () => {
    expect(strokeWorth(PULL_MS, CYCLE_MS * TEMPO_RUSHED)).toBeLessThan(TEMPO_RUSHED)
    for (let cycle = 200; cycle < CYCLE_MS; cycle += 10) {
      // Worth for each second of swimming, against the guide's.
      expect(strokeWorth(PULL_MS, cycle) / cycle).toBeLessThan(1 / CYCLE_MS)
    }
    // Let go and press again at once: two rushed strokes are worth less than the one they replace.
    expect(strokeWorth(460, 480) * 2).toBeLessThan(0.5)
  })

  it.each([2, 4, 6])('is swum fastest on the guide, over %i lengths', (lengths) => {
    const guide = guided(lengths)
    expect(Number.isFinite(guide)).toBe(true)
    const others: [string, number][] = [
      ...[500, 600, 700, 770, 810, 855, 880].map((cycle): [string, number] => [`a ${cycle} ms cycle`, timeIn(swum(lengths, PULL_MS, cycle, 0.2, 0.6))]),
      ...[950, 1000, 1200].map((cycle): [string, number] => [`a ${cycle} ms cycle`, timeIn(swum(lengths, PULL_MS, cycle, 0.2, 0.6))]),
      ...[250, 350, 560, 600, 720, 880].map((pull): [string, number] => [`a ${pull} ms pull`, timeIn(swum(lengths, pull, CYCLE_MS, 0.2, 0.6))]),
      ['a long hold on a quicker cycle', timeIn(swum(lengths, 720, 770, 0.2, 0.6))],
      ['letting go and pressing again at once', timeIn(swum(lengths, 460, 480, 0.2, 0.6))],
      ['holding on and pressing again at once', timeIn(swum(lengths, 700, 720, 0.2, 0.6))],
      ['a short stroke and a long wait by turns', timeIn(swum(lengths, PULL_MS, (at) => (at % 2 ? 500 : 1300), 0.2, 0.6))],
      ['a quick stroke and a guide one by turns', timeIn(swum(lengths, PULL_MS, (at) => (at % 2 ? 700 : CYCLE_MS), 0.2, 0.6))],
      ['never breathing until forced', timeIn(swum(lengths, PULL_MS, CYCLE_MS, -1, 0.6))],
      ['never breathing, on a quicker cycle', timeIn(swum(lengths, PULL_MS, 770, -1, 0.6))],
      ['no turns called', timeIn(swum(lengths, PULL_MS, CYCLE_MS, 0.2, null))]
    ]
    for (const [how, time] of others) expect(time, how).toBeGreaterThan(guide)
    // Anywhere inside the best pull is the guide's own time.
    for (const share of [PULL_SHORT, PULL_LONG]) {
      expect(timeIn(swum(lengths, PULL_MS * share, CYCLE_MS, 0.2, 0.6))).toBe(guide)
    }
  })
})

describe('Swim Race air', () => {
  it('runs out under strokes alone, and the stroke that empties her starts her gasping', () => {
    const swimmer = inWater()
    let emptied = 0
    let taken = 0
    while (emptied === 0 && taken < 50) {
      taken++
      if (strokeOf(swimmer, 1)) emptied++
    }
    expect(taken).toBeGreaterThan(8)
    expect(taken).toBeLessThan(16)
    expect(swimmer.gaspMs).toBe(GASP_MS)
    expect(swimmer.gasps).toBe(1)
    // Gasping, a stroke is worth far less, no breath can be taken, and no air is spent.
    const before = swimmer.speed
    swimmer.speed = 1
    strokeOf(swimmer, 1)
    const gasped = swimmer.speed - 1
    expect(breathe(swimmer)).toBe(false)
    expect(swimmer.gasps).toBe(1)
    const fresh = inWater()
    fresh.speed = 1
    strokeOf(fresh, 1)
    expect(gasped).toBeLessThan((fresh.speed - 1) / 2)
    expect(before).toBeGreaterThan(0)
    // It passes, and leaves her with air to go on with.
    advance(swimmer, GASP_MS, 10_000, 6)
    expect(swimmer.gaspMs).toBe(0)
    expect(swimmer.air).toBeGreaterThan(0.3)
  })

  it('comes back only with a breath, which costs speed and cannot be taken twice running', () => {
    const swimmer = inWater()
    for (let i = 0; i < 6; i++) strokeOf(swimmer, 1)
    const [air, speed] = [swimmer.air, swimmer.speed]
    advance(swimmer, 500, 500, 6)
    expect(swimmer.air).toBeLessThan(air)
    const going = swimmer.speed
    expect(breathe(swimmer)).toBe(true)
    expect(swimmer.air).toBeGreaterThan(air)
    expect(swimmer.speed).toBeLessThan(going)
    expect(speed).toBeGreaterThan(going)
    expect(breathe(swimmer)).toBe(false)
    advance(swimmer, BREATH_GAP_MS, 2000, 6)
    expect(breathe(swimmer)).toBe(true)
    expect(swimmer.breaths).toBe(2)
  })

  it('costs more to ignore than to manage', () => {
    const managed = swum(4, PULL_MS, CYCLE_MS, 0.2, 0.6)
    const ignored = swum(4, PULL_MS, CYCLE_MS, -1, 0.6)
    expect(managed.gasps).toBe(0)
    expect(ignored.gasps).toBeGreaterThan(1)
    expect(ignored.finishMs ?? 0).toBeGreaterThan((managed.finishMs ?? 0) + 2000)
  })
})

describe('Swim Race turn', () => {
  it('is judged by how close to the wall it is called, once, and never on the last length', () => {
    const at = (away: number, length = 1): Swimmer => inWater(length * LENGTH_M - away)
    expect(callTurn(at(TURN_ZONE_M + 0.5), 2)).toBeNull()
    expect(callTurn(at(TURN_ZONE_M - 0.2), 2)).toBe('early')
    expect(callTurn(at(TURN_GOOD_M - 0.1), 2)).toBe('good')
    const close = at(TURN_PERFECT_M - 0.1)
    expect(callTurn(close, 2)).toBe('perfect')
    expect(callTurn(close, 2)).toBeNull()
    expect(callTurn(at(0.5, 2), 2)).toBeNull()
  })

  it('gets a better turn off the wall sooner and faster', () => {
    /** How long a swimmer who turns this way takes from 1 m short of the wall to 5 m past it. */
    const through = (grade: TurnGrade | null): number => {
      const swimmer = inWater(LENGTH_M - 1)
      swimmer.called = grade
      let clock = 0
      while (swimmer.dist < LENGTH_M + 5 && clock < 60_000) {
        clock += STEP
        advance(swimmer, STEP, clock, 2)
      }
      expect(swimmer.turns).toEqual([grade ?? 'late'])
      return clock
    }
    const [perfect, good, early, late] = [through('perfect'), through('good'), through('early'), through(null)]
    expect(perfect).toBeLessThan(good)
    expect(good).toBeLessThan(early)
    expect(early).toBeLessThan(late)
  })

  it('touches at the end of the last length, at the moment inside the step it happened', () => {
    const swimmer = inWater(2 * LENGTH_M - 0.5)
    swimmer.speed = 2.5
    const events = advance(swimmer, 1000, 30_000, 2)
    expect(events).toEqual([{ kind: 'finish' }])
    expect(swimmer.dist).toBe(2 * LENGTH_M)
    expect(swimmer.finishMs).toBeGreaterThan(29_000)
    expect(swimmer.finishMs).toBeLessThan(30_000)
    expect(advance(swimmer, 1000, 31_000, 2)).toEqual([])
  })

  it('holds a swimmer on the blocks for her reaction, and longer for a false start', () => {
    const fair = onBlocks(300)
    const jumped = onBlocks(0, true)
    expect(advance(fair, 200, 200, 2)).toEqual([])
    expect(fair.dist).toBe(0)
    expect(advance(fair, 200, 400, 2)).toEqual([{ kind: 'dive' }])
    expect(fair.dist).toBeGreaterThan(0)
    advance(jumped, 400, 400, 2)
    expect(jumped.dist).toBe(0)
    expect(jumped.falseStart).toBe(true)
  })
})

describe('Swim Race opponent', () => {
  it('swims the same race from the same seed', () => {
    expect(herRace(3, 4, seededRand('same'))).toEqual(herRace(3, 4, seededRand('same')))
  })

  it.each([1, 2, 3])('is faster the better she is, at option %i', (option) => {
    const lengths = lengthsOf(option)
    const typical = SKILLS.map((skill) =>
      mean(Array.from({ length: 40 }, (_, run) => herRace(skill, lengths, seededRand(`${skill}:${lengths}:${run}`)).finishMs ?? 0))
    )
    for (let i = 1; i < typical.length; i++) expect(typical[i]).toBeLessThan(typical[i - 1] - 500)
    // The best of them is close behind a faultless swim, and nobody is out of sight.
    const faultless = swum(lengths, PULL_MS, CYCLE_MS, 0.2, 0.6).finishMs ?? 0
    expect(typical[4]).toBeGreaterThan(faultless)
    expect(typical[4]).toBeLessThan(faultless * 1.15)
    expect(typical[0]).toBeLessThan(faultless * 2)
  })

  it('fades over a long race when she is unfit, and holds her pace when she is fit', () => {
    /** Her pace over six lengths as a share of her pace over two. */
    const held = (skill: Skill): number => {
      const over = (lengths: number): number =>
        mean(Array.from({ length: 40 }, (_, run) => herRace(skill, lengths, seededRand(`f${skill}:${run}`)).finishMs ?? 0)) / lengths
      return over(6) / over(2)
    }
    expect(held(1)).toBeGreaterThan(held(5) + 0.05)
  })

  it('manages her air by her skill: a poor swimmer gasps, a good one never does', () => {
    const gasps = (skill: Skill): number =>
      mean(Array.from({ length: 40 }, (_, run) => herRace(skill, 4, seededRand(`g${skill}:${run}`)).gasps))
    expect(gasps(1)).toBeGreaterThan(1)
    expect(gasps(5)).toBe(0)
    expect(gasps(4)).toBeLessThan(0.2)
  })

  it('turns by her skill, and makes the turn she set out to make', () => {
    const rand = seededRand('turns')
    const share = (skill: Skill, grade: TurnGrade): number =>
      Array.from({ length: 400 }, () => herTurn(skill, rand)).filter((turn) => turn === grade).length / 400
    expect(share(5, 'perfect')).toBeGreaterThan(share(1, 'perfect') + 0.4)
    expect(share(1, 'late')).toBeGreaterThan(share(5, 'late') + 0.2)
    expect(herTurn(3, () => 0)).toBe('perfect')
    expect(herTurn(3, () => 0.999)).toBe('late')
    // Whatever she has in mind as she nears the wall is what the wall sees.
    for (const [drawn, grade] of [[0, 'perfect'], [0.5, 'good'], [0.8, 'early'], [0.999, 'late']] as const) {
      const swimmer = inWater(LENGTH_M - TURN_ZONE_M - 1)
      const mind = herMind()
      let turned = false
      for (let clock = STEP; clock < 60_000 && swimmer.turns.length === 0; clock += STEP) {
        advance(swimmer, STEP, clock, 2)
        // The one draw that matters here is the turn's: everything else is taken as it comes.
        const near = !turned && mind.turn === null && toWall(swimmer) <= TURN_ZONE_M
        herMove(swimmer, mind, 3, STEP, 2, near ? () => drawn : () => 0.6)
        if (mind.turn !== null) turned = true
      }
      expect(swimmer.turns).toEqual([grade])
    }
  })

  it('leaves the blocks sooner the more she has raced', () => {
    expect(herReaction(5, () => 0.5)).toBeLessThan(herReaction(1, () => 0.5))
    expect(herReaction(5, () => 0)).toBeGreaterThan(100)
  })
})

describe('Swim Race result', () => {
  /** A finished swimmer with this time. */
  const home = (ms: number, change: Partial<Swimmer> = {}): Swimmer => ({
    ...onBlocks(250),
    dist: 50,
    blockMs: 0,
    finishMs: ms,
    strokes: 20,
    worth: 17,
    breaths: 3,
    turns: ['good'],
    ...change
  })

  it('reads the lengths option as 2, 4 or 6 lengths', () => {
    expect([1, 2, 3].map(lengthsOf)).toEqual([2, 4, 6])
    expect(lengthsOf(undefined)).toBe(2)
    expect(lengthsOf(9)).toBe(6)
  })

  it('places by time to the hundredth, sharing a place on a tie', () => {
    expect(placesOf([24_000, 23_000, 25_000])).toEqual([2, 1, 3])
    expect(placesOf([23_004, 23_001, 25_000])).toEqual([1, 1, 3])
    expect(placesOf([23_010, 23_000])).toEqual([2, 1])
    expect(outcomeOf([23_000, 24_000, 25_000])).toBe('won')
    expect(outcomeOf([23_004, 23_001, 25_000])).toBe('draw')
    expect(outcomeOf([24_000, 23_000, 23_000])).toBe('lost')
    expect(outcomeOf([23_000])).toBe('won')
  })

  it('orders the water by who has touched, then by how far each has swum', () => {
    const [ahead, behind] = [inWater(30), inWater(20)]
    expect(orderNow([behind, ahead, home(20_000), home(19_000)])).toEqual([3, 2, 1, 0])
  })

  it('writes a time as the board shows it', () => {
    expect(clockOf(23_414)).toBe('23.41')
    expect(clockOf(63_070)).toBe('1:03.07')
    expect(clockOf(250)).toBe('0.25')
  })

  it('names everyone and says who won, in the summary and the account', () => {
    const all = [
      { name: 'You', swimmer: home(24_500, { gasps: 1, thrashed: 14, worth: 6 }) },
      { name: 'Ana', swimmer: home(23_900, { turns: ['perfect'] }) },
      { name: 'Bea', swimmer: home(31_000, { gasps: 2, turns: ['late'] }) },
      { name: 'Cy', swimmer: home(24_050) }
    ]
    const summary = raceSummary(all, 2)
    const account = raceAccount(all, 2, ['Ana']).join('\n')
    for (const name of ['Ana', 'Bea', 'Cy']) {
      expect(summary).toContain(name)
      expect(account).toContain(name)
    }
    expect(summary).toMatch(/^You race/)
    expect(summary).toContain('Ana wins')
    expect(summary).toContain('third')
    expect(account).toContain('the reader')
    expect(account).not.toMatch(/\bYou\b/)
    expect(account).toContain('1. Ana 23.90')
    expect(account).toContain('3. the reader 24.50')
    for (const time of ['24.50', '23.90', '31.00', '24.05']) expect(summary).toContain(time)

    expect(raceSummary(all.slice(0, 2), 2)).toContain('lose')
    expect(raceSummary([all[1], all[0]].map((entry, i) => ({ ...entry, name: i ? 'Ana' : 'You' })), 2)).toContain('win')
    const level = [{ name: 'You', swimmer: home(23_000) }, { name: 'Ana', swimmer: home(23_003) }]
    expect(raceSummary(level, 2)).toContain('dead heat')
    expect(raceAccount(level, 2, ['the reader']).join('\n')).toContain('dead heat')
    const alone = [{ name: 'You', swimmer: home(23_000) }]
    expect(raceSummary(alone, 2)).toContain('23.00')
    expect(raceAccount(alone, 2, []).join('\n')).toContain('alone')
  })
})

describe('Swim Race on paper', () => {
  const swim = MINI_GAMES_LIST.find((game) => game.id === 'swim-race')

  it('is one of the games this build carries, a pack that requires the framework', () => {
    expect(swim?.modId).toBe(SWIM_MOD.id)
    expect(SWIM_MOD.requires).toEqual([MINI_GAMES])
    expect(swim?.players).toEqual({ min: 0, max: 3 })
    expect(swim?.options?.map((option) => [option.id, option.min, option.max, option.default])).toEqual([
      ['lengths', 1, 3, 1]
    ])
  })

  it('is offered at the stadium pool, never at the beach', () => {
    if (!swim) throw new Error('no swim race')
    const on = (): boolean => true
    const at = (location: string | null): boolean =>
      gamesOffered({ location, girls: 0 }, on, [swim]).length === 1
    expect(swim.locations).toEqual(['palaestra_stadium'])
    expect(at('palaestra_stadium')).toBe(true)
    expect(at('selkie_beach')).toBe(false)
    expect(at('lowrise_dorms')).toBe(false)
    expect(at(null)).toBe(false)
    expect(suggestRate(swim, 'palaestra_stadium', false)).toBe('often')
    expect(swim.suggestAt).not.toHaveProperty('selkie_beach')
  })
})

/**
 * The reader as an ordinary player at the keys: every pull held a little long, from the best
 * to 200 ms over it, the cycle up to 90 ms out either way, a breath when the air is getting
 * low that he now and then puts off a stroke, and turns that are good rather than perfect
 * (or none called at all, where `turns` is false).
 */
function ordinary(lengths: number, rand: () => number, turns = true): Swimmer {
  const swimmer = onBlocks(Math.round(300 + rand() * 150))
  let next = 0
  let cycle: number | null = null
  let turnAt = 1 + rand() * 1.2
  for (let clock = STEP; swimmer.finishMs === null && clock <= limitOf(lengths); clock += STEP) {
    advance(swimmer, STEP, clock, lengths)
    if (!swimming(swimmer)) {
      next = 0
      cycle = null
      continue
    }
    if (turns && toWall(swimmer) <= turnAt && callTurn(swimmer, lengths)) turnAt = 1 + rand() * 1.2
    next -= STEP
    if (next > 0) continue
    const wait = CYCLE_MS + (rand() - 0.5) * 180
    next += wait
    if (swimmer.air < 0.35 && rand() >= 0.25) breathe(swimmer)
    stroke(swimmer, PULL_MS + rand() * 200, cycle)
    cycle = wait
  }
  return swimmer
}

describe('Swim Race balance', () => {
  it.each([2, 4, 6])('puts an ordinary player in the middle of the ladder, over %i lengths', (lengths) => {
    const rand = seededRand(`ordinary ${lengths}`)
    const races = 200
    const hers = SKILLS.map((skill) => Array.from({ length: races }, () => timeIn(herRace(skill, lengths, rand))))
    /** The share of races these times win against each skill in turn. */
    const beaten = (mine: readonly number[]): number[] =>
      hers.map((her) => mine.filter((time, run) => time < her[run]).length / races)
    const mine = Array.from({ length: races }, () => ordinary(lengths, rand))
    const [one, two, three, four, five] = beaten(mine.map(timeIn))
    // Clearly ahead of the poor swimmers, about even with a middling one, behind the good ones.
    expect(one).toBeGreaterThan(0.95)
    expect(two).toBeGreaterThan(0.9)
    expect(three).toBeGreaterThan(0.2)
    expect(three).toBeLessThan(0.7)
    expect(four).toBeLessThan(0.3)
    expect(five).toBeLessThan(0.05)
    expect(mean(mine.map((me) => me.gasps))).toBeLessThan(0.3)
    expect(mine.every((me) => me.turns.every((turn) => turn === 'good'))).toBe(true)

    // The same player calling no turns is behind a middling swimmer and everyone better.
    const wide = beaten(Array.from({ length: races }, () => timeIn(ordinary(lengths, rand, false))))
    expect(wide[2]).toBeLessThan(0.3)
    expect(wide[3]).toBeLessThan(0.05)
    expect(wide[4]).toBeLessThan(0.05)

    // A faultless swim beats the best of them, and not by much.
    const faultless = guided(lengths)
    const best = [...hers[4]].sort((a, b) => a - b)
    expect(beaten(Array.from({ length: races }, () => faultless))[4]).toBeGreaterThan(0.8)
    expect(best[races / 2]).toBeLessThan(faultless * 1.04)
    // Calling no turns throws that away: the best of them is ahead of perfect strokes alone.
    const noTurns = timeIn(swum(lengths, PULL_MS, CYCLE_MS, 0.2, null))
    expect(beaten(Array.from({ length: races }, () => noTurns))[4]).toBeLessThan(0.2)
  })

  it('lets a swimmer out of air recover: the gasping ends, with air to swim on', () => {
    const swimmer = inWater(1)
    swimmer.air = 0.01
    expect(stroke(swimmer, PULL_MS, null).emptied).toBe(true)
    expect(breathe(swimmer)).toBe(false)
    for (let clock = STEP; clock <= GASP_MS; clock += STEP) advance(swimmer, STEP, clock, 6)
    expect(swimmer.gaspMs).toBe(0)
    expect(swimmer.air).toBeGreaterThanOrEqual(0.5)
    expect(stroke(swimmer, PULL_MS, null).emptied).toBe(false)
  })
})

describe('Swim Race wording by the water', () => {
  const home = (ms: number, turns: TurnGrade[]): Swimmer => ({
    ...onBlocks(250),
    dist: 50,
    blockMs: 0,
    finishMs: ms,
    strokes: 20,
    worth: 17,
    breaths: 3,
    turns
  })
  const all = [
    { name: 'You', swimmer: home(24_500, ['late']) },
    { name: 'Ana', swimmer: home(23_900, ['good']) }
  ]

  it('knows the pool and the sea by the location, and anywhere else is just water', () => {
    expect(waterAt('palaestra_stadium')).toBe('pool')
    expect(waterAt('selkie_beach')).toBe('sea')
    expect(waterAt(null)).toBe('water')
    expect(waterAt('lowrise_dorms')).toBe('water')
  })

  it('says lengths and the pool at the stadium, and the buoy and the sea at the beach', () => {
    const pool = [raceSummary(all, 2, 'pool'), ...raceAccount(all, 2, ['Ana'], 'pool')].join('\n')
    expect(pool).toContain('2 lengths of the pool')
    expect(pool).toContain('the stadium pool')
    expect(pool).toContain('into the wall')
    expect(pool).not.toMatch(/buoy|sea/)
    const sea = [raceSummary(all, 2, 'sea'), ...raceAccount(all, 2, ['Ana'], 'sea')].join('\n')
    expect(sea).toContain('out to the buoy and back')
    expect(sea).toContain('in the sea')
    expect(sea).toContain('Ana led at the buoy')
    expect(sea).not.toMatch(/length|pool|wall|touch|blocks/)
    expect(raceSummary(all, 4, 'sea')).toContain('twice out to the buoy and back')
    expect(raceSummary(all.slice(0, 1), 6, 'sea')).toContain('three times out to the buoy and back in the sea, 150 metres')
    expect(raceAccount(all.slice(0, 1), 2, [], 'sea').join('\n')).not.toMatch(/length|pool|wall|touch|blocks/)
  })

  it('keeps to neutral words where it is told nothing', () => {
    const plain = [raceSummary(all, 2), ...raceAccount(all, 2, ['Ana'])].join('\n')
    expect(plain).toContain('over 2 lengths')
    expect(plain).not.toMatch(/buoy|sea|pool/)
  })

  it('labels a leg by the water, and names where each turn is made', () => {
    expect(legLabel(3, 4)).toBe('3/4')
    expect([1, 2].map((length) => legLabel(length, 2, 'sea'))).toEqual(['Out', 'Back'])
    expect([1, 2, 3, 4].map((length) => legLabel(length, 4, 'sea'))).toEqual(['Out 1/2', 'Back 1/2', 'Out 2/2', 'Back 2/2'])
    expect([1, 2, 3].map((length) => turnPlace(length, 'sea'))).toEqual(['the buoy', 'the shore', 'the buoy'])
    expect(turnPlace(1, 'pool')).toBe('the wall')
    expect(courseWords(6, 'pool')).toBe('over 6 lengths of the pool')
  })

  it('gives a swim alone an account of its time, its turns and its air', () => {
    const account = raceAccount(all.slice(0, 1), 2, [], 'pool').join('\n')
    expect(account).toContain('24.50')
    expect(account).toContain('one turn')
    expect(account).toContain('3 breaths')
  })
})

describe('Swim Race clock', () => {
  /** Three girls swum to the end in frames of this size, from the same seed: their times. */
  const timesAt = (frameMs: number, lengths = 4): (number | null)[] => {
    const rand = seededRand('frames')
    const skills: Skill[] = [1, 3, 5]
    const race = newRace(lengths, skills.map((skill) => onBlocks(herReaction(skill, rand))), skills)
    for (let frames = 0; !race.over && frames < 1_000_000; frames++) runRace(race, frameMs, rand)
    expect(race.over).toBe(true)
    return race.swimmers.map((swimmer) => swimmer.finishMs)
  }

  it('swims the same race whatever the frames it is given', () => {
    const steady = timesAt(1000 / 60)
    expect(steady.every((time) => time !== null)).toBe(true)
    for (const frameMs of [STEP_MS, 4, 1000 / 144, 1000 / 30, 50, 7.3]) expect(timesAt(frameMs)).toEqual(steady)
    // Uneven frames too: what a frame leaves over is owed to the next.
    const rand = seededRand('frames')
    const skills: Skill[] = [1, 3, 5]
    const race = newRace(4, skills.map((skill) => onBlocks(herReaction(skill, rand))), skills)
    const uneven = seededRand('uneven')
    while (!race.over) runRace(race, 2 + uneven() * 48, rand)
    expect(race.swimmers.map((swimmer) => swimmer.finishMs)).toEqual(steady)
  })

  it('tells what happens as it happens, each swimmer by her place in the water', () => {
    const rand = seededRand('told')
    const race = newRace(2, [onBlocks(300), onBlocks(herReaction(4, rand))], [null, 4])
    const heard: string[] = []
    while (!race.over) runRace(race, 16, rand, (who, event) => heard.push(`${who}:${event.kind}`))
    expect(heard.filter((one) => one.startsWith('1:'))).toEqual(
      expect.arrayContaining(['1:dive', '1:turn', '1:finish'])
    )
    // Nobody swims the reader for him: he dives when his time on the blocks is up, and drifts.
    expect(heard[0]).toBe('1:dive')
    expect(heard).toContain('0:dive')
    expect(race.swimmers[0].strokes).toBe(0)
  })

  it.each([2, 4, 6])('calls time on a swimmer who only drifts, and on nobody who swims, over %i lengths', (lengths) => {
    expect(limitOf(lengths)).toBe(lengths * LENGTH_LIMIT_MS)
    const rand = seededRand(`limit ${lengths}`)
    const race = newRace(lengths, [onBlocks(300), onBlocks(herReaction(1, rand))], [null, 1])
    while (!race.over) runRace(race, 50, rand)
    expect(race.clock).toBe(limitOf(lengths))
    expect(race.swimmers[0].finishMs).toBeNull()
    expect(race.swimmers[0].dist).toBeLessThan(lengths * LENGTH_M)
    expect(race.swimmers[1].finishMs).not.toBeNull()
    runRace(race, 5000, rand)
    expect(race.clock).toBe(limitOf(lengths))
    // The poorest of them is home well inside it, every time.
    for (let run = 0; run < 150; run++) expect(timeIn(herRace(1, lengths, rand))).toBeLessThan(limitOf(lengths) * 0.92)
  })

  it('places a swimmer who did not finish behind everyone who did, and tells it as that', () => {
    expect(placesOf([Infinity, 23_000, 24_000])).toEqual([3, 1, 2])
    expect(placesOf([23_000, Infinity, Infinity])).toEqual([1, 2, 2])
    expect(outcomeOf([Infinity, 23_000])).toBe('lost')
    expect(outcomeOf([Infinity, Infinity])).toBe('lost')
    expect(outcomeOf([23_000, Infinity])).toBe('won')
    const done = (ms: number | null, dist: number): Swimmer => ({ ...onBlocks(250), blockMs: 0, dist, finishMs: ms, strokes: ms === null ? 0 : 20, worth: ms === null ? 0 : 17 })
    const all = [
      { name: 'You', swimmer: done(null, 31) },
      { name: 'Ana', swimmer: done(23_900, 50) },
      { name: 'Bea', swimmer: done(26_000, 50) }
    ]
    for (const told of [raceSummary(all, 2, 'pool'), raceSummary(all.slice(0, 2), 2, 'pool'), raceSummary(all.slice(0, 1), 2, 'pool')]) {
      expect(told).toMatch(/^You /)
      expect(told).toContain('do not finish')
      expect(told).toContain('19 metres short')
      expect(told).toContain('50.00 s')
      expect(told).not.toMatch(/\b0\.00 s|Infinity|NaN|gave up|give up/)
    }
    expect(raceSummary(all, 2)).toContain('Ana 23.90 s, Bea 26.00 s, you did not finish')
    expect(raceSummary([all[1], all[0]].map((entry, at) => ({ ...entry, name: at ? 'Ana' : 'You' })), 2)).toContain('she does not finish')
    for (const some of [all, all.slice(0, 2), all.slice(0, 1)]) {
      const account = raceAccount(some, 2, [], 'pool').join('\n')
      expect(account).toContain('the reader 19 metres short')
      expect(account).toContain('not given up')
      expect(account).toContain('barely took a stroke and drifted')
      expect(account).not.toMatch(/\b0\.00 s|Infinity|NaN|\bYou\b/)
    }
    const account = raceAccount(all, 2, [], 'pool').join('\n')
    expect(account).toContain('1. Ana 23.90 s; 2. Bea 26.00 s; the reader did not finish')
    expect(raceAccount(all.slice(0, 2), 2, []).join('\n')).toContain('Ana won, the only one to finish')
    expect(raceAccount([all[0], { name: 'Ana', swimmer: done(null, 40) }], 2, []).join('\n')).toContain('Nobody finished')
  })

  it('gives every time its unit', () => {
    const done = (ms: number): Swimmer => ({ ...onBlocks(250), blockMs: 0, dist: 150, finishMs: ms, strokes: 20, worth: 17 })
    const all = [{ name: 'You', swimmer: done(24_500) }, { name: 'Ana', swimmer: done(63_070) }]
    expect(raceSummary(all, 6)).toContain('24.50 s to her 1:03.07.')
    expect(raceSummary(all.slice(0, 1), 6)).toContain('in 24.50 s.')
    expect(raceAccount(all, 6, []).join('\n')).toContain('1. the reader 24.50 s; 2. Ana 1:03.07')
  })

  it('keeps an account of a race that may be walked away from: who leads, and the lengths done', () => {
    const at = (dist: number, finishMs: number | null = null): Swimmer => ({ ...onBlocks(250), blockMs: 0, dist, finishMs })
    const all = [{ name: 'You', swimmer: at(30) }, { name: 'Ana', swimmer: at(55) }, { name: 'Bea', swimmer: at(100, 51_200) }]
    const told = raceProgress(all, 4, 52_000, 'pool')
    expect(told).toHaveLength(2)
    expect(told[0]).toContain('the reader and Ana and Bea')
    expect(told[1]).toBe('Unfinished: 52.00 s after the whistle Bea led (finished in 51.20 s), then Ana (on length 3 of 4) and the reader (on length 2 of 4).')
    expect(raceProgress(all.slice(0, 1), 4, 20_000, 'sea')[1]).toBe('Unfinished: 20.00 s after the whistle the reader was on leg back 1/2.')
    expect(told.join(' ')).not.toMatch(/\bYou\b/)
  })

  it('says in its format what the code does about a false start and a swimmer out of time', () => {
    const format = MINI_GAMES_LIST.find((game) => game.id === 'swim-race')?.format ?? ''
    expect(format).toContain('before it is called back and held')
    expect(format).toContain(`${LENGTH_LIMIT_MS / 1000} seconds a length`)
    expect(format).toContain('did not finish')
  })
})
