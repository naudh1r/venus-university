import { describe, expect, it } from 'vitest'
import {
  BALL_R,
  FOOT_SPOT,
  HEAD_SPOT,
  POCKETS,
  TABLE_H,
  TABLE_W,
  aimGuide,
  ballsLeft,
  canBreakFrom,
  canPlace,
  cloneBalls,
  energyOf,
  freshLog,
  freshRack,
  herShot,
  legalTargets,
  matchAccount,
  matchProgress,
  matchSummary,
  placeCue,
  rackedBalls,
  racksWon,
  resolveShot,
  shotLine,
  simulate,
  soloProgress,
  stepBalls,
  strike,
  tallyOf,
  type Ball,
  type Rack,
  type RackRecord,
  type ShotLog,
  type ShotRecord,
  type Side,
  type Skill
} from '../src/shared/minigameRules/pool'
import { MINI_GAMES, MINI_GAMES_LIST } from '../src/shared/minigames'
import { MODS } from '../src/shared/mods'

/** Pool's rules: the table's physics, what eight-ball makes of a shot, her play, and the telling. */

/** The same numbers every time: a small generator, seeded. */
function seeded(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A rack mid-game with only the balls named on the table, each where the test puts it. */
function rackWith(
  at: Record<number, [number, number]>,
  over: Partial<Rack> = {}
): Rack {
  const rack = freshRack('reader')
  for (const ball of rack.balls) {
    const spot = at[ball.id]
    ball.potted = !spot
    if (spot) [ball.x, ball.y] = spot
  }
  return { ...rack, breaking: false, ...over }
}

/** A shot's log, written by hand. */
function log(firstHit: number | null, potted: number[] = []): ShotLog {
  return { ...freshLog(), firstHit, potted, pockets: potted.map(() => 0) }
}

/** Judges a hand-written shot on a rack whose balls stand as before it, less what was potted. */
function judge(rack: Rack, shot: ShotLog): ReturnType<typeof resolveShot> {
  const pre = cloneBalls(rack.balls)
  const after = cloneBalls(rack.balls)
  for (const id of shot.potted) after[id].potted = true
  return resolveShot({ ...rack, balls: after }, pre, shot)
}

const onTable = (ball: Ball): boolean =>
  ball.x >= BALL_R - 1e-6 &&
  ball.x <= TABLE_W - BALL_R + 1e-6 &&
  ball.y >= BALL_R - 1e-6 &&
  ball.y <= TABLE_H - BALL_R + 1e-6

describe('the pack', () => {
  it('comes in a mod that requires the framework', () => {
    const mod = MODS.find((m) => m.id === 'morrowkiln-arcade-games')
    expect(mod?.requires).toContain(MINI_GAMES)
    const game = MINI_GAMES_LIST.find((g) => g.id === 'pool')
    expect(game?.modId).toBe('morrowkiln-arcade-games')
    expect(game?.players).toEqual({ min: 0, max: 1 })
  })
})

describe('the table', () => {
  it('racks fifteen balls clear of each other with the eight in the middle', () => {
    const balls = rackedBalls()
    expect(balls.map((b) => b.id)).toEqual(Array.from({ length: 16 }, (_, i) => i))
    for (const a of balls)
      for (const b of balls)
        if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(BALL_R * 2)
    expect(balls[0]).toMatchObject(HEAD_SPOT)
    expect(balls[1]).toMatchObject(FOOT_SPOT)
    // The middle of the third row.
    expect(balls[8].y).toBeCloseTo(TABLE_H / 2)
  })

  it('never gains energy, and keeps every ball on the cloth or down a pocket', () => {
    for (const [angle, power] of [
      [0, 1],
      [0.03, 0.7],
      [-0.4, 1],
      [2.1, 0.5]
    ]) {
      const balls = rackedBalls()
      const shot = freshLog()
      strike(balls, angle, power)
      let energy = energyOf(balls)
      let steps = 0
      for (; steps < 5000; steps++) {
        const moving = stepBalls(balls, shot)
        const now = energyOf(balls)
        expect(now).toBeLessThanOrEqual(energy + 1e-6)
        energy = now
        for (const ball of balls) if (!ball.potted) expect(onTable(ball)).toBe(true)
        if (!moving) break
      }
      // Everything comes to rest, and in good time.
      expect(steps).toBeLessThan(2400)
      expect(energy).toBe(0)
    }
  })

  it('pots a ball lined up with a pocket, and leaves the cue ball on the table', () => {
    // The 3 on the long diagonal into the bottom right corner, the cue ball behind it.
    const rack = rackWith({ 0: [300, 150], 3: [600, 300] })
    const shot = simulate(rack.balls, Math.atan2(300 - 150, 600 - 300), 0.5)
    expect(shot.firstHit).toBe(3)
    expect(shot.potted).toEqual([3])
    expect(POCKETS[shot.pockets[0]]).toMatchObject({ x: TABLE_W, y: TABLE_H })
    expect(rack.balls[0].potted).toBe(false)
  })

  it('sends a ball struck full on straight ahead and all but stops the cue ball', () => {
    const rack = rackWith({ 0: [200, 200], 5: [400, 200] })
    const shot = freshLog()
    strike(rack.balls, 0, 0.4)
    while (rack.balls[5].vx === 0) stepBalls(rack.balls, shot)
    expect(rack.balls[5].vy).toBeCloseTo(0)
    expect(rack.balls[0].vx).toBeLessThan(rack.balls[5].vx * 0.05)
  })

  it('shows the first ball in the line of aim, or the cushion', () => {
    const rack = rackWith({ 0: [200, 200], 5: [400, 200], 6: [600, 200] })
    const guide = aimGuide(rack.balls, rack.balls[0], 0)
    expect(guide.hit).toBe(5)
    expect(guide.ghost.x).toBeCloseTo(400 - BALL_R * 2)
    expect(guide.send).toMatchObject({ x: 1, y: 0 })
    const wall = aimGuide(rack.balls, rack.balls[0], Math.PI)
    expect(wall.hit).toBeNull()
    expect(wall.ghost.x).toBeCloseTo(BALL_R)
  })

  it('puts the cue ball down only where there is room', () => {
    const rack = rackWith({ 5: [400, 200] })
    expect(canPlace(rack.balls, { x: 400 + BALL_R, y: 200 })).toBe(false)
    expect(canPlace(rack.balls, { x: 2, y: 200 })).toBe(false)
    expect(canPlace(rack.balls, { x: 300, y: 200 })).toBe(true)
    placeCue(rack.balls, { x: 400, y: 200 })
    expect(rack.balls[0].potted).toBe(false)
    expect(canPlace(rack.balls, rack.balls[0])).toBe(true)
  })
})

describe('eight-ball', () => {
  const spread: Record<number, [number, number]> = {
    0: [200, 200],
    1: [300, 100],
    2: [300, 300],
    8: [400, 200],
    9: [500, 100],
    10: [500, 300]
  }

  it('gives the shooter the group of the first ball potted, and another shot', () => {
    const { rack, record } = judge(rackWith(spread), log(9, [9, 1]))
    expect(record.assigned).toBe('stripes')
    expect(rack.groups).toEqual({ reader: 'stripes', her: 'solids' })
    expect(record.own).toEqual([9])
    expect(record.other).toEqual([1])
    expect(rack.turn).toBe('reader')
    expect(rack.run).toBe(1)
  })

  it('passes the turn on a miss and keeps the table open', () => {
    const { rack, record } = judge(rackWith(spread), log(1))
    expect(record.foul).toBeNull()
    expect(rack.turn).toBe('her')
    expect(rack.groups.reader).toBeNull()
    expect(rack.inHand).toBe(false)
    expect(legalTargets(rack)).toEqual([1, 2, 9, 10])
  })

  it('calls a scratch, a shot that hits nothing and the wrong ball first, and gives ball in hand', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const scratch = judge(rackWith(spread, { groups }), log(1, [1, 0]))
    expect(scratch.record.foul).toBe('scratch')
    // The ball stays down; the turn does not.
    expect(scratch.record.potted).toEqual([1])
    expect(scratch.rack.turn).toBe('her')
    expect(scratch.rack.inHand).toBe(true)
    expect(scratch.rack.balls[0].potted).toBe(true)

    expect(judge(rackWith(spread, { groups }), log(null)).record.foul).toBe('no-hit')
    expect(judge(rackWith(spread, { groups }), log(9, [1])).record.foul).toBe('wrong-ball')
    expect(judge(rackWith(spread, { groups }), log(8)).record.foul).toBe('wrong-ball')
    expect(judge(rackWith(spread), log(8)).record.foul).toBe('wrong-ball')
    // A foul on an open table settles no groups.
    expect(judge(rackWith(spread), log(1, [1, 0])).rack.groups.reader).toBeNull()
  })

  it('wins on the eight once the group is cleared, and loses on it any other way', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const last: Record<number, [number, number]> = { 0: [200, 200], 8: [400, 200], 9: [500, 100] }

    const win = judge(rackWith(last, { groups }), log(8, [8]))
    expect(win.record.eight).toBe('win')
    expect(win.rack.winner).toBe('reader')

    const scratched = judge(rackWith(last, { groups }), log(8, [8, 0]))
    expect(scratched.record.eight).toBe('foul')
    expect(scratched.rack.winner).toBe('her')
    expect(judge(rackWith(last, { groups }), log(8, [0])).rack.winner).toBe('her')
    // The wrong ball first while on the eight is only a foul.
    const wrong = judge(rackWith(last, { groups }), log(9))
    expect(wrong.record.foul).toBe('wrong-ball')
    expect(wrong.rack.winner).toBeNull()

    const early = judge(rackWith(spread, { groups }), log(1, [1, 8]))
    expect(early.record.eight).toBe('early')
    expect(early.rack.winner).toBe('her')
    expect(judge(rackWith(spread, { groups, turn: 'her' }), log(9, [8])).rack.winner).toBe('reader')
  })

  it('says when the last of a group goes down, and then only the eight may be hit', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const { rack, record } = judge(
      rackWith({ 0: [200, 200], 1: [300, 100], 8: [400, 200], 9: [500, 100] }, { groups }),
      log(1, [1])
    )
    expect(record.onEightNow).toBe(true)
    expect(ballsLeft(rack, 'reader')).toEqual([])
    expect(legalTargets(rack)).toEqual([8])
  })

  it('puts an eight potted on the break back on the table', () => {
    const rack = freshRack('reader')
    const pre = cloneBalls(rack.balls)
    rack.balls[8].potted = true
    rack.balls[3].potted = true
    const got = resolveShot(rack, pre, log(1, [8, 3]))
    expect(got.rack.winner).toBeNull()
    expect(got.rack.balls[8].potted).toBe(false)
    expect(got.record.potted).toEqual([3])
    expect(got.rack.groups.reader).toBe('solids')
    // And says so, in the shot's line.
    expect(got.record.eightBack).toBe(true)
    expect(shotLine('Ana', got.record)).toBe(
      'You break. The 3 drops. The eight drops on the break and is put back on its spot. You are solids.'
    )
    const alone = freshRack('reader')
    const before = cloneBalls(alone.balls)
    alone.balls[8].potted = true
    const only = resolveShot(alone, before, log(1, [8]))
    expect(shotLine('Ana', only.record)).toBe(
      'You break. The eight drops on the break and is put back on its spot.'
    )
    expect(judge(rackWith(spread), log(1, [1])).record.eightBack).toBe(false)
  })

  it('tells a pot struck straight in from one that went in off something', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const straight = judge(rackWith(spread, { groups }), log(1, [1]))
    expect(straight.record.clean).toBe(true)
    expect(straight.record.fluke).toBe(false)
    // His bank or combination may have been meant: nothing is said of luck.
    const off = judge(rackWith(spread, { groups }), log(1, [2]))
    expect(off.record.fluke).toBe(false)
    expect(off.record.clean).toBe(false)
    // A ball first moved at the cue ball's third collision or later was nobody's plan.
    const moved = freshLog().moved
    moved[2] = 3
    const lucky = judge(rackWith(spread, { groups }), { ...log(1, [2]), cueHits: 3, moved })
    expect(lucky.record.fluke).toBe(true)
    // With a pot that may have been meant beside it, nothing is said.
    const both = judge(rackWith(spread, { groups }), { ...log(1, [1, 2]), cueHits: 3, moved })
    expect(both.record.fluke).toBe(false)
    // Hers is judged against what she meant to pot.
    const rack = rackWith(spread, { groups, turn: 'her' })
    const pre = cloneBalls(rack.balls)
    rack.balls[10].potted = true
    expect(resolveShot(rack, pre, log(9, [10]), [10]).record.clean).toBe(true)
    expect(resolveShot(rack, pre, log(9, [10]), [9]).record.fluke).toBe(true)
  })

  it('alone has no groups and no turns, and ends when the table is clear', () => {
    const rack = { ...rackWith({ 0: [200, 200], 8: [400, 200], 9: [500, 100] }), solo: true }
    const eight = judge(rack, log(8, [8]))
    expect(eight.record.foul).toBeNull()
    expect(eight.rack.winner).toBeNull()
    expect(eight.rack.turn).toBe('reader')
    const scratch = judge(eight.rack, log(9, [0]))
    expect(scratch.rack.inHand).toBe(true)
    expect(scratch.rack.turn).toBe('reader')
    const done = judge(eight.rack, log(9, [9]))
    expect(done.rack.winner).toBe('reader')
  })
})

describe('the table, played', () => {
  it('counts the cue ball\'s collisions and when each ball was first moved', () => {
    // Off the top cushion and back down onto the 1: its second collision.
    const rack = rackWith({ 0: [200, 200], 1: [200, 320] })
    const played = simulate(rack.balls, -Math.PI / 2, 0.5)
    expect(played.cushions[0]).toBeGreaterThanOrEqual(1)
    expect(played.firstHit).toBe(1)
    expect(played.moved[1]).toBe(2)
    expect(played.cueHits).toBeGreaterThanOrEqual(2)
    // A combination: the 2 is moved off the cue ball's first collision.
    const combo = rackWith({ 0: [100, 200], 1: [200, 200], 2: [260, 200] })
    const got = simulate(combo.balls, 0, 0.4)
    expect(got.firstHit).toBe(1)
    expect(got.moved[1]).toBe(1)
    expect(got.moved[2]).toBe(1)
  })

  it('comes to rest within the cap at full power, with nothing overlapping or through a cushion', () => {
    for (let n = 0; n < 12; n++) {
      const balls = rackedBalls()
      simulate(balls, (n - 6) * 0.01, 1)
      const up = balls.filter((ball) => !ball.potted)
      for (const ball of up) expect(onTable(ball)).toBe(true)
      for (const a of up)
        for (const b of up)
          if (a.id < b.id) expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(BALL_R * 2 - 0.5)
      expect(stepBalls(balls, freshLog())).toBe(false)
    }
  })

  it('puts an eight potted on the break back clear of the cue ball', () => {
    const rack = freshRack('reader')
    const pre = cloneBalls(rack.balls)
    rack.balls[8].potted = true
    rack.balls[0].x = FOOT_SPOT.x
    rack.balls[0].y = FOOT_SPOT.y
    for (const ball of rack.balls) if (ball.id !== 0 && ball.id !== 8) ball.potted = ball.id > 3
    const got = resolveShot(rack, pre, log(1, [8]))
    const black = got.rack.balls[8]
    expect(black.potted).toBe(false)
    expect(Math.hypot(black.x - FOOT_SPOT.x, black.y - FOOT_SPOT.y)).toBeGreaterThanOrEqual(BALL_R * 2)
  })

  it('chooses her shot quickly on a full table at her best', () => {
    const rack = freshRack('reader')
    simulate(rack.balls, 0.004, 1)
    for (const ball of rack.balls) ball.potted = false
    const rand = seeded(7)
    for (const ball of rack.balls) {
      // Spread wide, so every ball is a shot to weigh.
      ball.x = 40 + rand() * (TABLE_W - 80)
      ball.y = 40 + rand() * (TABLE_H - 80)
    }
    for (let i = 0; i < 400; i++) stepBalls(rack.balls, freshLog())
    const table: Rack = { ...rack, breaking: false, turn: 'her', groups: { reader: null, her: null } }
    herShot(table, 5, rand)
    let worst = 0
    for (let n = 0; n < 5; n++) {
      const before = performance.now()
      herShot(table, 5, rand)
      worst = Math.max(worst, performance.now() - before)
    }
    expect(worst).toBeLessThan(50)
  })
})

describe('her play', () => {
  it('takes the pot that is on, placing the cue ball first when it is in her hand', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const rack = rackWith(
      { 1: [200, 100], 9: [650, 300], 8: [400, 200] },
      { groups, turn: 'her', inHand: true }
    )
    const shot = herShot(rack, 5, () => 0.5)
    expect(shot.place).not.toBeNull()
    expect(shot.expected).toEqual([9])
    const balls = cloneBalls(rack.balls)
    placeCue(balls, shot.place!)
    const played = simulate(balls, shot.angle - shot.aimError, shot.power)
    expect(played.firstHit).toBe(9)
    expect(played.potted).toEqual([9])
    // The rack she was shown is as it was.
    expect(rack.balls[0].potted).toBe(true)
    expect(rack.balls[9].potted).toBe(false)
  })

  it('hits one of her own balls when nothing can be potted', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    // Her ball frozen mid-rail with the reader's balls across every line to a pocket but one that is too thin.
    const rack = rackWith(
      { 0: [100, 200], 9: [400, 200], 1: [430, 185], 2: [430, 215], 3: [370, 170], 4: [370, 230], 8: [700, 200] },
      { groups, turn: 'her' }
    )
    const shot = herShot(rack, 3, seeded(4))
    const balls = cloneBalls(rack.balls)
    const played = simulate(balls, shot.angle - shot.aimError, shot.power)
    expect(played.firstHit).toBe(9)
    expect(played.potted).not.toContain(0)
  })

  it('breaks at the head ball as hard as she can, from a spot of her own behind the head string', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const rack = freshRack('her')
      const shot = herShot(rack, 3, seeded(seed))
      expect(shot.place).not.toBeNull()
      expect(canBreakFrom(rack.balls, shot.place!)).toBe(true)
      expect(shot.place!.y).not.toBeCloseTo(HEAD_SPOT.y)
      expect(shot.power).toBeGreaterThan(0.85)
      const balls = cloneBalls(rack.balls)
      placeCue(balls, shot.place!)
      expect(simulate(balls, shot.angle, shot.power).firstHit).toBe(1)
      // The rack she was shown is as it was.
      expect(rack.balls[0]).toMatchObject(HEAD_SPOT)
    }
  })

  it('lets a break be played from anywhere behind the head string and nowhere past it', () => {
    const balls = rackedBalls()
    expect(canBreakFrom(balls, HEAD_SPOT)).toBe(true)
    expect(canBreakFrom(balls, { x: 60, y: 90 })).toBe(true)
    expect(canBreakFrom(balls, { x: HEAD_SPOT.x + 1, y: 200 })).toBe(false)
    expect(canBreakFrom(balls, { x: 2, y: 200 })).toBe(false)
  })

  it('plays a legal safety when her nearest ball is hidden', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    // Her nearest ball dead behind the reader's, nothing of hers to pot; another of hers in the open, tight on a rail.
    const rack = rackWith(
      { 0: [100, 200], 1: [150, 200], 9: [200, 200], 2: [224, 200], 10: [700, 389], 3: [730, 380], 4: [670, 380], 8: [400, 60] },
      { groups, turn: 'her' }
    )
    for (const skill of [3, 4, 5] as const) {
      const shot = herShot(rack, skill, seeded(skill))
      const balls = cloneBalls(rack.balls)
      const played = simulate(balls, shot.angle - shot.aimError, shot.power)
      const { record } = resolveShot({ ...rack, balls }, rack.balls, played)
      expect(record.foul).toBeNull()
    }
  })

  /**
   * Racks played through, her at a skill against a middling player: how many shots she took after
   * the break, and how many of them struck the wrong ball first or nothing at all.
   */
  function fouled(skill: Skill, many: number): { shots: number; missed: number; ms: number } {
    const rand = seeded(500 + skill)
    let shots = 0
    let missed = 0
    let ms = 0
    for (let n = 0; n < many; n++) {
      let rack = freshRack(n % 2 ? 'her' : 'reader')
      for (let turn = 0; turn < 150 && !rack.winner; turn++) {
        const hers = rack.turn === 'her'
        const before = performance.now()
        const shot = herShot(rack, hers ? skill : 3, rand)
        if (hers) ms = Math.max(ms, performance.now() - before)
        const balls = cloneBalls(rack.balls)
        if (shot.place) placeCue(balls, shot.place)
        const pre = cloneBalls(balls)
        const played = simulate(balls, shot.angle, shot.power)
        const got = resolveShot({ ...rack, balls, inHand: false }, pre, played, shot.expected, shot.aimError)
        if (hers && !got.record.breakShot) {
          shots++
          if (got.record.foul === 'wrong-ball' || got.record.foul === 'no-hit') missed++
        }
        rack = got.rack
      }
    }
    return { shots, missed, ms }
  }

  it('fouls by the wrong ball or none less the better she is, and hardly ever at her best', () => {
    const rate = ([1, 2, 3, 4, 5] as const).map((skill) => {
      const got = fouled(skill, 120)
      expect(got.shots).toBeGreaterThan(1000)
      // A safety looked for is still a shot chosen in good time.
      expect(got.ms).toBeLessThan(50)
      return got.missed / got.shots
    })
    expect(rate[0]).toBeGreaterThan(rate[2])
    expect(rate[1]).toBeGreaterThan(rate[3])
    expect(rate[2]).toBeGreaterThan(rate[4])
    expect(rate[3]).toBeLessThan(0.02)
    expect(rate[4]).toBeLessThan(0.01)
  }, 120000)

  /** Her pots and fouls over the same scattered tables, at a skill. */
  function trial(skill: Skill): { pots: number; fouls: number; ms: number } {
    const rand = seeded(11)
    let pots = 0
    let fouls = 0
    let ms = 0
    for (let n = 0; n < 60; n++) {
      // The balls scattered by a seed of their own, so every skill faces the same tables.
      const scatter = seeded(1000 + n)
      const rack = freshRack('her')
      rack.breaking = false
      rack.groups = { reader: 'solids', her: 'stripes' }
      const placed: Ball[] = []
      for (const ball of rack.balls) {
        do {
          ball.x = 40 + scatter() * (TABLE_W - 80)
          ball.y = 40 + scatter() * (TABLE_H - 80)
        } while (placed.some((p) => Math.hypot(p.x - ball.x, p.y - ball.y) < BALL_R * 2 + 2))
        placed.push(ball)
      }
      const pre = cloneBalls(rack.balls)
      const before = performance.now()
      const shot = herShot(rack, skill, rand)
      ms = Math.max(ms, performance.now() - before)
      const played = simulate(rack.balls, shot.angle, shot.power)
      const { record } = resolveShot(rack, pre, played, shot.expected, shot.aimError)
      pots += record.own.length
      if (record.foul) fouls++
    }
    return { pots, fouls, ms }
  }

  it('pots more the better she is, and never takes long to choose', () => {
    const got = ([1, 2, 3, 4, 5] as const).map(trial)
    expect(got[4].pots).toBeGreaterThan(got[2].pots)
    expect(got[2].pots).toBeGreaterThan(got[0].pots)
    // A beginner misses most and a strong player misses some.
    expect(got[0].pots).toBeLessThan(20)
    expect(got[4].pots).toBeGreaterThan(30)
    expect(got[4].pots).toBeLessThan(60)
    expect(got[0].fouls).toBeGreaterThan(got[4].fouls)
    for (const one of got) expect(one.ms).toBeLessThan(50)
  })
})

describe('the telling', () => {
  const shot = (by: Side, over: Partial<ShotRecord> = {}): ShotRecord => ({
    by,
    breakShot: false,
    potted: [],
    own: [],
    other: [],
    foul: null,
    assigned: null,
    long: false,
    fluke: false,
    clean: false,
    run: 0,
    onEightNow: false,
    atEight: false,
    eight: null,
    eightBack: false,
    winner: null,
    next: by,
    aimError: by === 'her' ? 0.02 : null,
    ...over
  })
  const rack: RackRecord = {
    breaker: 'reader',
    winner: 'reader',
    left: { reader: 0, her: 2 },
    shots: [
      shot('reader', { breakShot: true }),
      shot('her', { potted: [9], own: [9], clean: true, run: 1 }),
      shot('her', { potted: [10], own: [10], fluke: true, run: 2 }),
      shot('her', { foul: 'scratch' }),
      shot('reader', { potted: [1, 2], own: [1, 2], clean: true, long: true, run: 2 }),
      shot('reader', { potted: [3], own: [3], clean: true, run: 3 }),
      shot('reader', { potted: [8], eight: 'win', winner: 'reader', atEight: true })
    ]
  }

  it('counts what each side did', () => {
    expect(tallyOf(rack.shots, 'her')).toEqual({
      shots: 3,
      pots: 2,
      fouls: 1,
      flukes: 1,
      clean: 1,
      long: 0,
      bestRun: 2
    })
    expect(tallyOf(rack.shots, 'reader')).toMatchObject({ pots: 3, long: 1, bestRun: 3, fouls: 0 })
    expect(racksWon([rack, { ...rack, winner: 'her' }, rack])).toEqual({ reader: 2, her: 1 })
    // A ball that went down on a foul is no pot of hers.
    const foulPot = [shot('her', { potted: [9], own: [9], foul: 'scratch' }), shot('her', { potted: [10], own: [10], run: 1 })]
    expect(tallyOf(foulPot, 'her')).toMatchObject({ shots: 2, pots: 1, fouls: 1 })
    expect(matchAccount('Ana', [{ ...rack, shots: [...foulPot, ...rack.shots.slice(4)] }], 1).join('\n')).toContain(
      'Ana: 1 ball potted in 2 shots'
    )
  })

  it('says an eight that dropped on the break was put back', () => {
    const shots = [shot('reader', { breakShot: true, eightBack: true }), ...rack.shots.slice(1)]
    expect(matchAccount('Ana', [{ ...rack, shots }], 1).join('\n')).toContain(
      'the reader broke and the eight dropped on the break and was put back on its spot, the reader potted the eight to win it'
    )
    expect(matchAccount('Ana', [rack], 1).join('\n')).not.toContain('put back')
  })

  it('says how a game stands for one walked away from', () => {
    const groups = { reader: 'solids', her: 'stripes' } as const
    const mid = rackWith({ 0: [200, 200], 1: [300, 100], 2: [300, 300], 8: [400, 200] }, { groups, turn: 'her', inHand: true })
    const told = matchProgress('Ana', mid, { reader: 1, her: 0 }, 2).join('\n')
    expect(told).toContain('best of three racks')
    expect(told).toContain('Racks won so far: the reader 1, Ana 0.')
    expect(told).toContain('the reader was solids with 2 of 7 still to pot; Ana was stripes with only the eight left')
    expect(told).toContain("It was Ana's shot, with the cue ball in hand after a foul.")
    const open = matchProgress('Ana', rackWith({ 0: [200, 200], 1: [300, 100], 9: [300, 300], 8: [400, 200] }), { reader: 0, her: 0 }, 1).join('\n')
    expect(open).toContain('a single rack')
    expect(open).not.toContain('Racks won')
    expect(open).toContain('no groups were settled')
    expect(matchProgress('Ana', freshRack('her'), { reader: 1, her: 0 }, 2).join('\n')).toContain('Ana was about to break')
    const alone = { ...rackWith({ 0: [200, 200], 8: [400, 200], 9: [500, 100] }), solo: true }
    expect(soloProgress(alone, [shot('reader'), shot('reader', { foul: 'scratch' })])[0]).toContain(
      '13 of 15 balls potted in 2 shots, 1 foul, 2 still on the table'
    )
  })

  it('says who won, how close it was and who potted the eight', () => {
    const account = matchAccount('Ana', [rack], 1).join('\n')
    expect(account).toContain('the reader potted the eight')
    expect(account).toContain('Ana had only 2 left')
    expect(account).toContain('fluke')
    expect(account).toContain('The reader won')
    expect(matchSummary('Ana', [rack])).toContain('win')
    const lost: RackRecord = {
      ...rack,
      winner: 'her',
      left: { reader: 4, her: 3 },
      shots: [shot('reader', { potted: [8], eight: 'early', winner: 'her' })]
    }
    expect(matchSummary('Ana', [lost])).toContain('lose')
    expect(matchAccount('Ana', [lost], 1).join('\n')).toContain('the reader threw it away')
  })
})
