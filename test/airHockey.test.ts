import { describe, expect, it } from 'vitest'
import {
  GOAL_W,
  MALLET_R,
  MAX_SPEED,
  READER_SPEED,
  PUCK_R,
  STALL_S,
  STEP,
  TABLE_H,
  TABLE_W,
  advance,
  freshMind,
  freshTable,
  goalLine,
  herAim,
  homeOf,
  inHalf,
  matchAccount,
  matchAccountSoFar,
  matchOver,
  matchSituation,
  matchSummary,
  playAt,
  scoreOf,
  servedPuck,
  stalled,
  stepTable,
  sunk,
  swingAt,
  type Point,
  type Side,
  type Table
} from '../src/shared/minigameRules/airHockey'
import { MINI_GAMES, MINI_GAMES_LIST, gamesOffered, suggestRate } from '../src/shared/minigames'
import { MODS } from '../src/shared/mods'

/** Air hockey's rules: the table's physics, how she plays at her skill, and how a match is told. */

/** A table with the puck where the test wants it and both mallets out of its way. */
function tableWith(puck: Partial<Table['puck']>): Table {
  const table = freshTable('reader')
  table.reader = { x: MALLET_R, y: TABLE_H - MALLET_R, vx: 0, vy: 0 }
  table.her = { x: MALLET_R, y: MALLET_R, vx: 0, vy: 0 }
  table.puck = { x: TABLE_W / 2, y: TABLE_H / 2, vx: 0, vy: 0, ...puck }
  return table
}

/** Runs the table with both mallets held where they are until a goal or `seconds` pass. */
function run(table: Table, seconds: number): Side | null {
  for (let t = 0; t < seconds; t += STEP) {
    const goal = stepTable(table, table.reader, table.her, 0)
    if (goal) return goal
  }
  return null
}

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

/**
 * A plain opponent for her at the reader's end: a hand that moves at a fixed pace, gets behind a
 * puck in its half and pushes it up the table, and otherwise waits in front of its goal.
 */
function scripted(table: Table, hand: Point, pace: number): Point {
  const { puck } = table
  const want =
    puck.y > TABLE_H / 2
      ? table.reader.y > puck.y + 6
        ? { x: puck.x, y: puck.y - 14 }
        : { x: puck.x, y: puck.y + 45 }
      : { x: TABLE_W / 2 + (puck.x - TABLE_W / 2) * 0.4, y: TABLE_H - 50 }
  const far = Math.hypot(want.x - hand.x, want.y - hand.y)
  const part = far > pace * STEP ? (pace * STEP) / far : 1
  return inHalf('reader', {
    x: hand.x + (want.x - hand.x) * part,
    y: hand.y + (want.y - hand.y) * part
  })
}

/** Plays her at `skill` against the scripted hand for `seconds`, and returns the goals. */
function simulate(skill: number, seconds: number, seed: number): { mine: number; hers: number } {
  const random = seeded(seed)
  let table = freshTable('reader')
  let mind = freshMind()
  let hand: Point = homeOf('reader')
  const goals: Side[] = []
  for (let t = 0; t < seconds; t += STEP) {
    hand = scripted(table, hand, 420)
    const goal = advance(table, mind, hand, skill, random)
    if (!goal) continue
    goals.push(goal)
    table = freshTable(goal === 'her' ? 'reader' : 'her')
    mind = freshMind()
    hand = homeOf('reader')
  }
  return scoreOf(goals)
}

/** A hand that only keeps level with the puck across the table, in front of its own goal. */
function tracking(table: Table): Point {
  return { x: table.puck.x, y: homeOf('reader').y }
}

/**
 * Plays her at `skill` for `points` points against a hand, as the table itself runs a match: a
 * puck at rest in a mouth is a goal, and one nobody plays is served again.
 */
function points(
  skill: number,
  count: number,
  seed: number,
  handOf: (table: Table, hand: Point) => Point
): { mine: number; hers: number } {
  const random = seeded(seed)
  let table = freshTable('reader')
  let mind = freshMind()
  let hand: Point = homeOf('reader')
  const goals: Side[] = []
  // Ten minutes of table at the most: a hand nobody scores on does not hang the test.
  for (let t = 0; t < 600 && goals.length < count; t += STEP) {
    hand = handOf(table, hand)
    const goal = advance(table, mind, hand, skill, random) ?? sunk(table, mind)
    const again = goal ? null : stalled(table, mind)
    if (!goal && !again) continue
    if (goal) goals.push(goal)
    table = freshTable(again ?? (goal === 'her' ? 'reader' : 'her'))
    mind = freshMind()
    hand = homeOf('reader')
  }
  return scoreOf(goals)
}

describe('air hockey: the table', () => {
  it('bounces the puck off the side walls and keeps it on the table', () => {
    const table = tableWith({ vx: 600, vy: 0 })
    let turned = false
    for (let t = 0; t < 2; t += STEP) {
      expect(stepTable(table, table.reader, table.her, 0)).toBeNull()
      expect(table.puck.x).toBeGreaterThanOrEqual(PUCK_R)
      expect(table.puck.x).toBeLessThanOrEqual(TABLE_W - PUCK_R)
      if (table.puck.vx < 0) turned = true
    }
    expect(turned).toBe(true)
  })

  it('bounces the puck off an end wall beside the mouth', () => {
    const table = tableWith({ x: PUCK_R + 4, y: 60, vx: 0, vy: -500 })
    expect(run(table, 0.5)).toBeNull()
    expect(table.puck.vy).toBeGreaterThan(0)
    expect(table.puck.y).toBeGreaterThanOrEqual(PUCK_R)
  })

  it('scores for the reader through the top mouth and for her through the bottom', () => {
    expect(run(tableWith({ vy: -500 }), 2)).toBe('reader')
    expect(run(tableWith({ vy: 500 }), 2)).toBe('her')
    // Just inside a post is a goal; just outside is the wall.
    const inside = TABLE_W / 2 + GOAL_W / 2 - PUCK_R - 1
    expect(run(tableWith({ x: inside, vy: -500 }), 2)).toBe('reader')
    const wide = tableWith({ x: inside + 3, vy: -500 })
    expect(run(wide, 0.6)).toBeNull()
    expect(wide.puck.vy).toBeGreaterThan(0)
  })

  it('slows the puck as it slides, and never lets it past its top speed', () => {
    const sliding = tableWith({ x: 40, y: TABLE_H / 2, vx: 200, vy: 0 })
    run(sliding, 0.5)
    expect(Math.abs(sliding.puck.vx)).toBeLessThan(200)

    // A mallet thrown through a resting puck as fast as a hand can move it.
    const table = freshTable('reader')
    let fastest = 0
    for (let t = 0; t < 0.3; t += STEP) {
      if (stepTable(table, { x: TABLE_W / 2, y: TABLE_H / 2 }, table.her, 0)) break
      fastest = Math.max(fastest, Math.hypot(table.puck.vx, table.puck.vy))
    }
    expect(fastest).toBeGreaterThan(MAX_SPEED * 0.9)
    expect(fastest).toBeLessThanOrEqual(MAX_SPEED + 1e-6)
  })

  it('gives the puck the speed of the mallet that hits it', () => {
    const table = freshTable('reader')
    // Up through the puck, off to one side of it: it leaves going up and away to the other.
    table.reader.x = table.puck.x + 12
    table.reader.y = table.puck.y + 60
    for (let i = 0; i < 20 && table.puck.vy === 0; i++)
      stepTable(table, { x: table.puck.x + 12, y: TABLE_H / 2 }, table.her, 0)
    expect(table.puck.vy).toBeLessThan(0)
    expect(table.puck.vx).toBeLessThan(0)
  })

  it('keeps each mallet to its own half', () => {
    const table = freshTable('reader')
    for (let i = 0; i < 240; i++) stepTable(table, { x: -50, y: 0 }, { x: 900, y: 900 }, 2000)
    expect(table.reader).toMatchObject({ x: MALLET_R, y: TABLE_H / 2 + MALLET_R })
    expect(table.her).toMatchObject({ x: TABLE_W - MALLET_R, y: TABLE_H / 2 - MALLET_R })
  })

  it('serves the puck at rest in the half of whoever is to hit it', () => {
    const mine = servedPuck('reader')
    const hers = servedPuck('her')
    expect(mine).toMatchObject({ x: TABLE_W / 2, vx: 0, vy: 0 })
    expect(mine.y).toBeGreaterThan(TABLE_H / 2)
    expect(hers.y).toBeLessThan(TABLE_H / 2)
    expect(freshTable('her').her).toMatchObject(homeOf('her'))
  })
})

describe('air hockey: her play', () => {
  it('is quicker, faster and surer the better she is', () => {
    for (let skill = 2; skill <= 5; skill++) {
      const [worse, better] = [playAt(skill - 1), playAt(skill)]
      expect(better.reaction).toBeLessThan(worse.reaction)
      expect(better.speed).toBeGreaterThan(worse.speed)
      expect(better.error).toBeLessThan(worse.error)
      expect(better.guard).toBeGreaterThan(worse.guard)
    }
    // Never as fast as the puck, so a hard shot can always beat her.
    expect(playAt(5).speed).toBeLessThan(MAX_SPEED)
    expect(playAt(9)).toBe(playAt(5))
    expect(playAt(0)).toBe(playAt(1))
  })

  it('aims inside her own half, and off by no more than her skill allows', () => {
    const table = freshTable('reader')
    table.puck = { x: 250, y: 300, vx: 0, vy: 0 }
    table.her.x = 60
    const steady = herAim(table, 5, () => 0.5)
    // The best of them goes all the way back in front of her goal, shaded to the puck's side.
    expect(steady.y).toBe(homeOf('her').y)
    expect(steady.x).toBeGreaterThan(TABLE_W / 2)
    // The worst only drifts that way from where she stands.
    expect(herAim(table, 1, () => 0.5).x).toBeLessThan(steady.x)
    for (const roll of [0, 0.25, 0.75, 0.999]) {
      const aim = herAim(table, 5, () => roll)
      expect(Math.abs(aim.x - steady.x)).toBeLessThanOrEqual(playAt(5).error + 1e-9)
      expect(aim).toEqual(inHalf('her', aim))
    }
  })

  it('gets behind a puck in her half and drives it down the table', () => {
    const table = freshTable('her')
    const mind = freshMind()
    let lowest = 0
    for (let t = 0; t < 3; t += STEP) {
      // The reader's mallet kept in a corner: nothing to stop it.
      if (advance(table, mind, { x: 0, y: TABLE_H }, 5, () => 0.5)) break
      lowest = Math.max(lowest, table.puck.y)
    }
    expect(lowest).toBeGreaterThan(TABLE_H / 2)
  })

  it('concedes less and scores more against the same opponent the better she is', () => {
    const totals = [1, 3, 5].map((skill) => {
      let mine = 0
      let hers = 0
      for (let seed = 1; seed <= 6; seed++) {
        const result = simulate(skill, 120, seed)
        mine += result.mine
        hers += result.hers
      }
      return { mine, hers }
    })
    const [weak, fair, sharp] = totals
    expect(weak.mine).toBeGreaterThan(fair.mine)
    expect(fair.mine).toBeGreaterThan(sharp.mine)
    expect(sharp.hers - sharp.mine).toBeGreaterThan(weak.hers - weak.mine)
    // The weakest loses to a plain opponent; the best beats it, and is still scored on.
    expect(weak.mine).toBeGreaterThan(weak.hers)
    expect(sharp.hers).toBeGreaterThan(sharp.mine)
    expect(sharp.mine).toBeGreaterThan(0)
  })
})

/**
 * THE BALANCE AS IT STANDS, NOT AS IT SHOULD BE. The gradient above is proved against a slow hand
 * (420 a second). The reader's mallet goes at READER_SPEED, and against hands that use it her
 * skill counts for little. These tests assert what is true today so the numbers can be seen; the
 * owner is to decide the balance after playing. A change to her play, the mallet speeds or the
 * table that moves them must change the numbers here on purpose.
 */
describe('air hockey: the balance as it stands against a fast scripted hand', () => {
  const SEEDS = [1, 2, 3, 4, 5]
  const SKILLS = [1, 2, 3, 4, 5]

  it('today a quick get-behind-and-hit hand takes two points in three or more at every skill', () => {
    const quick = (table: Table, hand: Point): Point => scripted(table, hand, READER_SPEED)
    const shares = SKILLS.map((skill) => {
      let mine = 0
      let hers = 0
      for (const seed of SEEDS) {
        const result = points(skill, 20, seed, quick)
        mine += result.mine
        hers += result.hers
      }
      // Every point was played out.
      expect(mine + hers).toBe(SEEDS.length * 20)
      return mine / (mine + hers)
    })
    // Measured, of 100 points at each skill from 1 to 5: 86, 74, 83, 80, 66 to the hand.
    for (const share of shares) {
      expect(share).toBeGreaterThanOrEqual(0.6)
      expect(share).toBeLessThanOrEqual(0.9)
    }
    // Even the best of them loses to it.
    expect(shares[4]).toBeGreaterThan(0.6)
  })

  it('today a hand that only keeps level with the puck is never scored on, at any skill', () => {
    for (const skill of SKILLS)
      for (const seed of SEEDS.slice(0, 2)) {
        // Ten minutes of table each: she does not get one past it, and it never hits one back.
        expect(points(skill, 20, seed, tracking), `skill ${skill}`).toEqual({ mine: 0, hers: 0 })
      }
  })
})

describe('air hockey: a puck nobody plays', () => {
  /** Runs a match step by step with his hand held at `hand`, for `seconds`. */
  function wait(table: Table, hand: Point, seconds: number): Side | null {
    const mind = freshMind()
    const random = seeded(3)
    for (let t = 0; t < seconds; t += STEP) {
      if (advance(table, mind, hand, 3, random)) return null
      const to = stalled(table, mind)
      if (to) return to
    }
    return null
  }

  it('leaves a serve nobody has touched where it is', () => {
    expect(wait(freshTable('reader'), homeOf('reader'), STALL_S * 3)).toBeNull()
  })

  it('serves again a puck left lying in his half, to him', () => {
    const table = freshTable('reader')
    table.puck = { x: 40, y: TABLE_H - 60, vx: 0, vy: 0 }
    expect(wait(table, { x: TABLE_W - MALLET_R, y: TABLE_H - MALLET_R }, STALL_S + 1)).toBe('reader')
  })

  it('serves again a puck held in a corner under his mallet', () => {
    const table = freshTable('reader')
    table.puck = { x: PUCK_R, y: TABLE_H - PUCK_R, vx: 0, vy: 0 }
    // Up against it, not on top of it: a mallet put through a puck at the end wall throws it
    // along into the mouth, which is another matter.
    const corner = { x: PUCK_R + 22, y: TABLE_H - PUCK_R - 22 }
    table.reader = { ...corner, vx: 0, vy: 0 }
    expect(wait(table, corner, STALL_S + 1)).toBe('reader')
  })

  it('has her fetch a puck at rest anywhere in her half', () => {
    for (const x of [PUCK_R, 60, TABLE_W / 2, 240, TABLE_W - PUCK_R])
      for (const y of [PUCK_R, 40, 100, 150]) {
        const table = freshTable('her')
        table.puck = { x, y, vx: 0, vy: 0 }
        const mind = freshMind()
        const random = seeded(x + y)
        let out = false
        for (let t = 0; t < STALL_S && !out; t += STEP)
          out =
            advance(table, mind, homeOf('reader'), 1, random) !== null ||
            table.puck.y > TABLE_H / 2 + PUCK_R
        expect(out, `${x}, ${y}`).toBe(true)
      }
  })
})

describe('air hockey: a puck at rest in a goal mouth', () => {
  const lain = (): ReturnType<typeof freshMind> => ({ ...freshMind(), still: STALL_S })

  it('is a goal for whoever it was hit by, not a serve', () => {
    const top = tableWith({ y: PUCK_R - 1 })
    expect(sunk(top, lain())).toBe('reader')
    expect(stalled(top, lain())).toBeNull()
    const bottom = tableWith({ y: TABLE_H - PUCK_R + 1 })
    expect(sunk(bottom, lain())).toBe('her')
    expect(stalled(bottom, lain())).toBeNull()
    // Past the line altogether and still short of going through.
    expect(sunk(tableWith({ y: -PUCK_R + 1 }), lain())).toBe('reader')
  })

  it('is not one until it has lain there, nor anywhere but in a mouth', () => {
    const top = tableWith({ y: PUCK_R - 1 })
    expect(sunk(top, { ...freshMind(), still: STALL_S - STEP })).toBeNull()
    // Against the end wall beside the mouth, and in front of the mouth on the table.
    const beside = tableWith({ x: PUCK_R + 4, y: PUCK_R })
    expect(sunk(beside, lain())).toBeNull()
    expect(stalled(beside, lain())).toBe('her')
    const before = tableWith({ y: PUCK_R })
    expect(sunk(before, lain())).toBeNull()
    expect(stalled(before, lain())).toBe('her')
  })

  it('scores a puck that slides into the mouth and dies there', () => {
    const table = tableWith({ y: 30, vy: -8 })
    const mind = freshMind()
    let by: Side | null = null
    let after = 0
    // Her mallet kept out of it, as his is: the stall is counted as a match counts it.
    for (let t = 0; t < 30 && !by; t += STEP) {
      expect(stepTable(table, table.reader, table.her, 0)).toBeNull()
      const { puck } = table
      if (!mind.from || Math.hypot(puck.x - mind.from.x, puck.y - mind.from.y) > 12) {
        mind.from = { x: puck.x, y: puck.y }
        mind.still = 0
      } else mind.still += STEP
      expect(stalled(table, mind)).toBeNull()
      by = sunk(table, mind)
      after = t
    }
    expect(by).toBe('reader')
    expect(table.puck.y).toBeLessThan(PUCK_R)
    expect(table.puck.y).toBeGreaterThan(-PUCK_R)
    expect(after).toBeGreaterThanOrEqual(STALL_S)
  })
})

describe('air hockey: the match', () => {
  const R: Side = 'reader'
  const H: Side = 'her'

  it('counts the goals and ends at the number played to', () => {
    expect(scoreOf([R, H, R])).toEqual({ mine: 2, hers: 1 })
    expect(matchOver([R, H, R], 3)).toBe(false)
    expect(matchOver([R, H, R, R], 3)).toBe(true)
    expect(matchOver([H, H, H], 3)).toBe(true)
  })

  it('narrates a goal with who scored and the count', () => {
    expect(goalLine('Mia', [R])).toBe('You score. 1–0 to you.')
    expect(goalLine('Mia', [R, H])).toBe('Mia scores. 1–1, all level.')
    expect(goalLine('Mia', [R, H, H])).toBe('Mia scores. 2–1 to Mia.')
    expect(matchSummary('Mia', [R, R, H, R])).toBe('You beat Mia at air hockey, 3–1.')
    expect(matchSummary('Mia', [H, H, H])).toBe('Mia beat you at air hockey, 3–0.')
  })

  it('marks the goals that turn a match, and no others', () => {
    expect(swingAt('Mia', [R], 5)).toBeNull()
    expect(swingAt('Mia', [H], 5)?.kind).toBe('lead')
    expect(swingAt('Mia', [R, H], 5)).toBeNull()
    expect(swingAt('Mia', [R, H, H], 5)?.kind).toBe('lead')
    expect(swingAt('Mia', [R, R], 5)?.kind).toBe('behind')
    expect(swingAt('Mia', [R, R, R], 5)).toBeNull()
    expect(swingAt('Mia', [R, R, H, H], 5)?.kind).toBe('level')
    expect(swingAt('Mia', [H, H, R, R], 5)?.cue).toContain('The reader has just scored to pull level')
    expect(swingAt('Mia', [H, H, H, H], 5)?.kind).toBe('match-point')
    expect(swingAt('Mia', [R, H, R, H, R, R], 5)?.cue).toContain('needs one more goal')
  })

  it('keeps the state of the match in a line', () => {
    expect(matchSituation('Mia', [], 5)).toContain('Nobody has scored yet.')
    const line = matchSituation('Mia', [R, H, H], 7, 'Loser buys the drinks.')
    expect(line).toContain('first to 7')
    expect(line).toContain('the reader 1, Mia 2')
    expect(line).toContain('Mia scored the last goal.')
    expect(line).toContain('Riding on it: Loser buys the drinks.')
  })

  it('tells a match left unfinished as far as it got', () => {
    const led = matchAccountSoFar('Mia', [R, H, R, R, R], 5)
    expect(led).toEqual([
      expect.stringContaining('first to 5 goals'),
      'The goals so far, in order: the reader, Mia, the reader, the reader, the reader.',
      'The score when it stopped: the reader 4, Mia 1.',
      'The reader was leading by 3 goals, and one more goal would have won it.'
    ])
    expect(led[0]).toContain('not played to the end')
    expect(led.join(' ')).not.toContain('Final score')
    expect(matchAccountSoFar('Mia', [H], 5)).toContain('Mia was leading by a goal, 4 short of winning.')
    expect(matchAccountSoFar('Mia', [H, R], 5)).toContain('They were level.')
    expect(matchAccountSoFar('Mia', [], 5)).toContain('Nobody had scored yet.')
  })

  it('tells a shutout as one', () => {
    const account = matchAccount('Mia', [R, R, R], 3).join('\n')
    expect(account).toContain('fast, physical game')
    expect(account).toContain('The goals, in order: the reader, the reader, the reader.')
    expect(account).toContain('The reader scored first and led from then to the end.')
    expect(account).toContain('A shutout: Mia did not score once.')
    expect(account).toContain('Final score: the reader 3, Mia 0.')
    expect(account).not.toContain('comeback')
  })

  it('tells a comeback and a close finish', () => {
    const account = matchAccount('Mia', [R, R, H, H, H], 3).join('\n')
    expect(account).toContain('the lead changed hands once')
    expect(account).toContain('A comeback: Mia was 2 goals down at one point and still won.')
    expect(account).toContain('It went to the last goal: at 2–2 either of them could have won it.')
    expect(account).toContain('Final score: the reader 2, Mia 3.')
  })

  it('does not call a match one-sided that the loser led, nor a levelling a comeback twice', () => {
    const turned: Side[] = ['her', 'her', 'reader', 'reader', 'reader', 'reader', 'reader']
    const told = matchAccount('Mia', turned, 5).join(' ')
    expect(told).toContain('comeback')
    expect(told).not.toContain('never close')
    // Two down, level, ahead, one down, level again: the second levelling is no comeback.
    const again: Side[] = ['her', 'her', 'reader', 'reader', 'reader', 'her', 'her', 'reader']
    expect(swingAt('Mia', again.slice(0, 4), 9)?.kind).toBe('level')
    expect(swingAt('Mia', again, 9)).toBeNull()
  })

  it('tells a lead that was pegged back but never lost, and a one-sided game', () => {
    const level = matchAccount('Mia', [H, R, H, H, R, H, H], 5).join('\n')
    expect(level).toContain('Mia scored first and was never behind, though it was level along the way.')
    expect(level).toContain('It was one-sided: the reader was never close.')
    expect(level).not.toContain('shutout')
  })
})

describe('air hockey: the pack', () => {
  const def = MINI_GAMES_LIST.find((game) => game.id === 'air-hockey')

  it('is found among the games, against one girl, on the board', () => {
    expect(def).toBeDefined()
    expect(def?.players).toEqual({ min: 1, max: 1 })
    expect(def?.surface).toBe('board')
    expect(def?.options).toEqual([expect.objectContaining({ id: 'goals', min: 3, max: 9, default: 5 })])
  })

  it('is offered at the arcade with a girl there, and not alone or in her room', () => {
    const on = (): boolean => true
    const ids = (location: string, girls: number): string[] =>
      gamesOffered({ location, girls }, on).map((game) => game.id)
    expect(ids('btb_arcade', 1)).toContain('air-hockey')
    expect(ids('btb_arcade', 0)).not.toContain('air-hockey')
    expect(ids('room', 1)).not.toContain('air-hockey')
    expect(suggestRate(def!, 'btb_arcade', false)).toBe('often')
    expect(suggestRate(def!, 'pier_44', false)).toBe('never')
  })

  it('comes as a mod of its own that requires the framework', () => {
    const mod = MODS.find((entry) => entry.id === def?.modId)
    expect(mod?.requires).toEqual([MINI_GAMES])
  })
})
