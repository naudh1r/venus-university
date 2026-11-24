import { describe, expect, it } from 'vitest'
import {
  ALL_PINS,
  ballTold,
  herThrow,
  isSplit,
  lastFrameCue,
  outcomeOf,
  pathOf,
  rackOf,
  resolvePins,
  sheetOf,
  soloAccount,
  tableOf,
  tallyOf,
  totalOf,
  totalsOf,
  versusAccount,
  versusSummary,
  type Ball,
  type Skill,
  type Throw
} from '../src/shared/minigameRules/bowling'
import { gamesOffered, MINI_GAMES_LIST, suggestRate } from '../src/shared/minigames'

/** Bowling's rules: the scoring, what a ball takes, how she throws and how a game is told. */

/** A random with a seed, so a run of trials comes out the same every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const total = (rolls: number[], frames = 10): number => totalOf(rolls, frames)
const marks = (rolls: number[], frames = 10): string =>
  sheetOf(rolls, frames).map((frame) => frame.marks.join('')).join(' ')

const POCKET: Throw = { position: 3 / 17, power: 0.78, hook: 0 }
const WIDE: Throw = { position: 0.9, power: 0.7, hook: 0 }
const GUTTER: Throw = { position: 1, power: 0.3, hook: 1 }

/** A ball that took `took` of a full rack, or of what `before` left: the reader's, or a girl's by her place from 1. */
function ball(who: boolean | number, took: number, before: readonly number[] = ALL_PINS, thrown = WIDE): Ball {
  return { who: Number(who), thrown, before, fallen: before.slice(0, took) }
}

describe('Bowling scoring', () => {
  it('scores twelve strikes as 300 and knows the game is over', () => {
    const rolls = Array<number>(12).fill(10)
    expect(total(rolls)).toBe(300)
    expect(rackOf(rolls, 10).done).toBe(true)
    expect(rackOf(rolls.slice(0, 11), 10)).toMatchObject({ frame: 9, ball: 2, fresh: true, done: false })
    expect(sheetOf(rolls, 10).map((frame) => frame.total)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300])
  })

  it('scores all spares with the ball after each, and all gutters as nothing', () => {
    expect(total(Array<number>(21).fill(5))).toBe(150)
    expect(total(Array<number>(20).fill(0))).toBe(0)
    expect(rackOf(Array<number>(20).fill(0), 10).done).toBe(true)
    expect(marks([0, 0, 9, 1, 10, 0, 10], 4)).toBe('–– 9/ X –/')
  })

  it('gives the last frame its extra balls only when they are earned', () => {
    // An open last frame is two balls.
    expect(rackOf([3, 4, 3, 4, 3, 4], 3).done).toBe(true)
    // A spare earns one more, at a full rack.
    expect(rackOf([3, 4, 3, 4, 6, 4], 3)).toMatchObject({ ball: 2, fresh: true, done: false })
    // A strike then a count leaves the third ball at what is standing.
    expect(rackOf([3, 4, 3, 4, 10, 6], 3)).toMatchObject({ ball: 2, fresh: false, done: false })
    expect(total([3, 4, 3, 4, 10, 6, 4], 3)).toBe(34)
    expect(marks([3, 4, 3, 4, 10, 6, 4], 3)).toBe('34 34 X6/')
    expect(marks([10, 10, 10, 10, 10], 3)).toBe('X X XXX')
    expect(total([10, 10, 10, 10, 10], 3)).toBe(90)
  })

  it('holds a frame total back until the balls it counts are thrown', () => {
    const sheet = sheetOf([10, 7], 3)
    expect(sheet[0].total).toBeNull()
    expect(sheet[0].sofar).toBe(17)
    expect(sheetOf([10, 7, 2], 3).slice(0, 2).map((frame) => frame.total)).toEqual([19, 28])
  })

  it('alternates frames, the reader first, and resets the rack between them', () => {
    const first = ball(false, 7)
    expect(tableOf([first], 3, 1)).toMatchObject({ who: 0, frame: 0, ball: 1 })
    expect(tableOf([first], 3, 1).standing).toEqual([8, 9, 10])
    const second = ball(false, 1, [8, 9, 10])
    expect(tableOf([first, second], 3, 1)).toMatchObject({ who: 1, frame: 0, ball: 0 })
    expect(tableOf([first, second], 3, 1).standing).toHaveLength(10)
    expect(tableOf([first, second, ball(true, 10)], 3, 1)).toMatchObject({ who: 0, frame: 1 })
    // Alone, every frame is the reader's.
    expect(tableOf([first, second], 3, 0)).toMatchObject({ who: 0, frame: 1 })
  })
})

describe('Bowling scoring at every length', () => {
  /** Ten-pin scored the long way, frame by frame, from a finished game's rolls. */
  function scored(rolls: number[], frames: number): number {
    let sum = 0
    let i = 0
    for (let frame = 0; frame < frames; frame++) {
      if (rolls[i] === 10) {
        sum += 10 + rolls[i + 1] + rolls[i + 2]
        i += 1
      } else if (rolls[i] + rolls[i + 1] === 10) {
        sum += 10 + rolls[i + 2]
        i += 2
      } else {
        sum += rolls[i] + rolls[i + 1]
        i += 2
      }
    }
    return sum
  }

  it('plays games of 3 to 10 frames to the right ball and the right total', () => {
    const rand = seeded(11)
    for (let frames = 3; frames <= 10; frames++) {
      for (let game = 0; game < 200; game++) {
        const rolls: number[] = []
        let left = 10
        for (let rack = rackOf(rolls, frames); !rack.done; rack = rackOf(rolls, frames)) {
          if (rack.fresh) left = 10
          // Strikes and spares often enough to reach every bonus ball.
          const took = rand() < 0.35 ? left : Math.floor(rand() * (left + 1))
          left -= took
          rolls.push(took)
          expect(rolls.length).toBeLessThanOrEqual(2 * frames + 1)
        }
        const sheet = sheetOf(rolls, frames)
        expect(totalOf(rolls, frames)).toBe(scored(rolls, frames))
        expect(sheet[frames - 1].total).toBe(scored(rolls, frames))
        expect(sheet.every((frame) => frame.total !== null)).toBe(true)
        expect(sheet.flatMap((frame) => frame.marks)).toHaveLength(rolls.length)
        // One ball short, the last frame's total is not yet known.
        expect(sheetOf(rolls.slice(0, -1), frames)[frames - 1].total).toBeNull()
      }
    }
  })
})

describe('Bowling alone', () => {
  it('gives the scene an account of a solo game: every frame, the marks, the aim and the luck', () => {
    const balls: Ball[] = [
      ball(false, 10, ALL_PINS, POCKET),
      ball(false, 10, ALL_PINS, WIDE),
      ball(false, 0, ALL_PINS, GUTTER),
      ball(false, 4, ALL_PINS, POCKET)
    ]
    const account = soloAccount(balls, 3)
    expect(account).toHaveLength(7)
    expect(account[1]).toContain('a strike off a good ball')
    expect(account[2]).toContain('lucky')
    expect(account[3]).toContain('a gutter ball')
    expect(account[4]).toContain('2 strikes')
    expect(account[5]).toContain('1 strike came off loose balls')
    expect(account[6]).toContain(`Final score: ${totalOf([10, 10, 0, 4], 3)}`)
  })
})

describe('Bowling pins', () => {
  const average = (thrown: Throw, trials = 2000): { pins: number; strikes: number } => {
    const rand = seeded(7)
    const path = pathOf(thrown)
    let pins = 0
    let strikes = 0
    for (let i = 0; i < trials; i++) {
      const fell = path.gutter ? 0 : resolvePins(path.arriveX, path.angle, thrown.power, ALL_PINS, rand).length
      pins += fell
      if (fell === 10) strikes++
    }
    return { pins: pins / trials, strikes: strikes / trials }
  }

  it('takes nothing from the gutter and only pins that were standing', () => {
    expect(pathOf(GUTTER).gutter).toBe(true)
    expect(resolvePins(30, 0, 0.8, ALL_PINS, seeded(1))).toEqual([])
    const rand = seeded(3)
    for (let i = 0; i < 200; i++) {
      const fell = resolvePins(rand() * 30 - 15, rand() - 0.5, rand(), [4, 7, 10], rand)
      expect(fell.every((pin) => [4, 7, 10].includes(pin))).toBe(true)
      expect(new Set(fell).size).toBe(fell.length)
    }
  })

  it('strikes from the pocket most of the time, and far more than from anywhere else', () => {
    const pocket = average(POCKET)
    const centre = average({ position: 0, power: 0.78, hook: 0 })
    const edge = average(WIDE)
    expect(pocket.strikes).toBeGreaterThan(0.55)
    expect(pocket.strikes).toBeLessThan(0.95)
    expect(pocket.pins).toBeGreaterThan(centre.pins)
    expect(centre.pins).toBeGreaterThan(edge.pins)
    expect(edge.pins).toBeLessThan(4)
    // A soft ball into the same pocket carries less.
    expect(average({ ...POCKET, power: 0.25 }).pins).toBeLessThan(pocket.pins)
  })

  it('never leaves the 2 and the 3 standing with the head pin down: a ball between them clips both', () => {
    const rand = seeded(5)
    for (let i = 0; i < 4000; i++) {
      const arriveX = (rand() - 0.5) * 2 * 12
      const fell = resolvePins(arriveX, (rand() - 0.5) * 2, 0.3 + rand() * 0.7, ALL_PINS, rand)
      if (fell.includes(1)) expect(fell.includes(2) || fell.includes(3)).toBe(true)
    }
  })

  it('leaves a nose hit split more often than a pocket hit', () => {
    const splits = (thrown: Throw): number => {
      const rand = seeded(9)
      const path = pathOf(thrown)
      let count = 0
      for (let i = 0; i < 4000; i++) {
        const fell = resolvePins(path.arriveX, path.angle, thrown.power, ALL_PINS, rand)
        if (isSplit(ALL_PINS.filter((pin) => !fell.includes(pin)))) count++
      }
      return count
    }
    expect(splits({ position: 0, power: 0.78, hook: 0 })).toBeGreaterThan(splits(POCKET))
  })

  it('lands a sloppy ball somewhere in the middle of the rack on average', () => {
    const rand = seeded(11)
    let pins = 0
    for (let i = 0; i < 4000; i++) {
      const thrown = { position: rand() * 2 - 1, power: rand(), hook: rand() * 2 - 1 }
      const path = pathOf(thrown)
      pins += path.gutter ? 0 : resolvePins(path.arriveX, path.angle, thrown.power, ALL_PINS, rand).length
    }
    expect(pins / 4000).toBeGreaterThan(4)
    expect(pins / 4000).toBeLessThan(8)
  })

  it('knows a split from a leave that stands together', () => {
    expect(isSplit([7, 10])).toBe(true)
    expect(isSplit([4, 6])).toBe(true)
    expect(isSplit([2, 4, 7])).toBe(false)
    expect(isSplit([10])).toBe(false)
    // Nothing is a split with the head pin still up.
    expect(isSplit([1, 7, 10])).toBe(false)
  })
})

describe('Bowling against her', () => {
  /** Her average over full games at a skill. */
  function herAverage(skill: Skill): { score: number; gutters: number } {
    const rand = seeded(42)
    let score = 0
    let gutters = 0
    const games = 300
    for (let game = 0; game < games; game++) {
      const balls: Ball[] = []
      for (let table = tableOf(balls, 10, 0); !table.over; table = tableOf(balls, 10, 0)) {
        const thrown = herThrow(table.standing, skill, rand)
        const path = pathOf(thrown)
        if (path.gutter) gutters++
        const fallen = path.gutter
          ? []
          : resolvePins(path.arriveX, path.angle, thrown.power, table.standing, rand)
        balls.push({ who: 0, thrown, before: table.standing, fallen })
      }
      score += tallyOf(balls, 0, 10).total
    }
    return { score: score / games, gutters }
  }

  it('bowls better at every step of skill, from gutters to regular strikes', () => {
    const by = ([1, 2, 3, 4, 5] as Skill[]).map(herAverage)
    for (let i = 1; i < by.length; i++) expect(by[i].score).toBeGreaterThan(by[i - 1].score)
    expect(by[0].score).toBeLessThan(100)
    expect(by[0].gutters).toBeGreaterThan(0)
    expect(by[4].score).toBeGreaterThan(190)
    expect(by[4].score).toBeLessThan(270)
  })

  it('tells a ball for what it was', () => {
    const strike = ball(false, 10, ALL_PINS, POCKET)
    expect(ballTold(['Mia'], [strike], 0, 3)).toMatchObject({ kind: 'strike', notable: true, closed: true })
    expect(ballTold(['Mia'], [strike, strike, strike], 2, 5).kind).toBe('turkey')
    expect(ballTold(['Mia'], [ball(true, 0, ALL_PINS, GUTTER)], 0, 3)).toMatchObject({ kind: 'gutter', closed: false })
    const leave: Ball = { who: 0, thrown: WIDE, before: ALL_PINS, fallen: [1, 2, 3, 4, 5, 6, 8, 9] }
    expect(ballTold(['Mia'], [leave], 0, 3).kind).toBe('split')
    const pickup: Ball = { who: 0, thrown: WIDE, before: [7, 10], fallen: [7, 10] }
    expect(ballTold(['Mia'], [leave, pickup], 1, 3)).toMatchObject({ kind: 'split-converted', closed: true })
    expect(ballTold(['Mia'], [ball(false, 6)], 0, 3)).toMatchObject({ kind: 'count', notable: false })
  })

  it('gives the scene an account of who threw what, who led and whose luck it was', () => {
    // Three frames: he strikes off a good ball, then a loose one, then opens; she spares, gutters, counts.
    const balls: Ball[] = [
      ball(false, 10, ALL_PINS, POCKET),
      ball(true, 6),
      ball(true, 4, [7, 8, 9, 10]),
      ball(false, 10, ALL_PINS, WIDE),
      ball(true, 0, ALL_PINS, GUTTER),
      ball(true, 3),
      ball(false, 5),
      ball(false, 2, [6, 7, 8, 9, 10]),
      ball(true, 8),
      ball(true, 1, [9, 10])
    ]
    expect(tableOf(balls, 3, 1).over).toBe(true)
    const mine = tallyOf(balls, 0, 3)
    const hers = tallyOf(balls, 1, 3)
    expect(mine).toMatchObject({ total: 49, strikes: 2, spares: 0, gutters: 0, lucky: 1 })
    expect(hers).toMatchObject({ total: 22, strikes: 0, spares: 1, gutters: 1 })
    const account = versusAccount(['Mia'], balls, 3).join('\n')
    expect(account).toContain('Frame 1: the reader X (a strike off a good ball); Mia 6 / (a spare)')
    expect(account).toContain('a strike off a loose ball: lucky')
    expect(account).toContain('a gutter ball')
    expect(account).toContain('The reader led from the first frame that separated them to the end.')
    expect(account).toContain('Final score: the reader 49, Mia 22: the reader won by 27')
    expect(outcomeOf(totalsOf(balls, 3, 1))).toBe('won')
    expect(versusSummary(['Mia'], [49, 22])).toBe('You bowl against Mia and win, 49 to 22.')
    expect(versusSummary(['Mia'], [22, 49])).toBe('You bowl against Mia and lose, 22 to 49.')
    expect(versusSummary(['Mia'], [30, 30])).toBe('You bowl against Mia and it ends level, 30 each.')
  })
})

describe('Bowling with several girls', () => {
  /** Who bowls each ball of a game in which every ball at a full rack takes `took(who)` pins. */
  function order(frames: number, girls: number, took: (who: number) => number): number[] {
    const balls: Ball[] = []
    for (let table = tableOf(balls, frames, girls); !table.over; table = tableOf(balls, frames, girls)) {
      balls.push(ball(table.who, table.standing.length === 10 ? took(table.who) : 0, table.standing))
    }
    return balls.map((each) => each.who)
  }

  /** An open frame of `first` then `second` pins for one bowler. */
  const open = (who: number, first: number, second = 0, thrown = WIDE): Ball[] => {
    const one = ball(who, first, ALL_PINS, thrown)
    return [one, ball(who, second, ALL_PINS.filter((pin) => !one.fallen.includes(pin)))]
  }

  it('has everyone bowl each frame in turn, the reader first and the girls in their order', () => {
    // Open frames: two balls each, round the table, frame after frame.
    expect(order(2, 2, () => 3)).toEqual([0, 0, 1, 1, 2, 2, 0, 0, 1, 1, 2, 2])
    expect(order(2, 3, () => 3)).toEqual([0, 0, 1, 1, 2, 2, 3, 3, 0, 0, 1, 1, 2, 2, 3, 3])
    // A strike is one ball of a frame, and the last frame's extra balls are bowled before the next bowler's.
    expect(order(2, 3, (who) => (who === 2 ? 10 : 3))).toEqual([0, 0, 1, 1, 2, 3, 3, 0, 0, 1, 1, 2, 2, 2, 3, 3])
    // One girl and nobody are what they were.
    expect(order(2, 1, () => 3)).toEqual([0, 0, 1, 1, 0, 0, 1, 1])
    expect(order(2, 0, () => 3)).toEqual([0, 0, 0, 0])
    // Mid-frame the rack is the bowler's own leave, and the next bowler's is full.
    const first = ball(2, 7)
    const before = [...open(0, 3), ...open(1, 3)]
    expect(tableOf([...before, first], 3, 3)).toMatchObject({ who: 2, frame: 0, ball: 1, standing: [8, 9, 10] })
    expect(tableOf([...before, first, ball(2, 1, [8, 9, 10])], 3, 3)).toMatchObject({ who: 3, frame: 0, ball: 0 })
  })

  it('gives the reader the win only with the top score to himself', () => {
    expect(outcomeOf([90])).toBe('played')
    expect(outcomeOf([90, 80, 70, 60])).toBe('won')
    expect(outcomeOf([90, 80, 90, 60])).toBe('draw')
    expect(outcomeOf([90, 80, 95, 60])).toBe('lost')
    expect(outcomeOf([90, 95])).toBe('lost')
    expect(outcomeOf([90, 90])).toBe('draw')
    // Level girls beneath him change nothing.
    expect(outcomeOf([90, 80, 80])).toBe('won')
  })

  it('names the standings in the summary, whoever came where', () => {
    const names = ['Livvie', 'Min-ha', 'Noor']
    expect(versusSummary(names, [90, 80, 70, 85])).toBe(
      'You bowl against Livvie, Min-ha and Noor and win: you 90, Noor 85, Livvie 80, Min-ha 70.'
    )
    expect(versusSummary(names, [90, 80, 90, 60])).toBe(
      'You bowl against Livvie, Min-ha and Noor and share the top score with Min-ha: you 90, Min-ha 90, Livvie 80, Noor 60.'
    )
    expect(versusSummary(names, [80, 95, 85, 60])).toBe(
      'You bowl against Livvie, Min-ha and Noor and finish third; Livvie wins: Livvie 95, Min-ha 85, you 80, Noor 60.'
    )
    expect(versusSummary(['Livvie', 'Min-ha'], [50, 70, 70])).toBe(
      'You bowl against Livvie and Min-ha and finish third; Livvie and Min-ha share the win: Livvie 70, Min-ha 70, you 50.'
    )
  })

  // Two frames, three girls. The reader: 3, then a lucky strike and 5 2 after it. Livvie: 6 2 and
  // 5 1. Min-ha: a gutter and 4, then a strike off a good ball and 3 3. Noor: 9, then 2.
  const names = ['Livvie', 'Min-ha', 'Noor']
  const game: Ball[] = [
    ...open(0, 3),
    ...open(1, 6, 2),
    ball(2, 0, ALL_PINS, GUTTER),
    ball(2, 4),
    ...open(3, 9),
    ball(0, 10, ALL_PINS, WIDE),
    ball(0, 5),
    ball(0, 2, [6, 7, 8, 9, 10]),
    ...open(1, 5, 1),
    ball(2, 10, ALL_PINS, POCKET),
    ball(2, 3),
    ball(2, 3, [4, 5, 6, 7, 8, 9, 10]),
    ...open(3, 2)
  ]

  it('gives the scene a short account that names every girl, the lead and the standings', () => {
    expect(tableOf(game, 2, 3).over).toBe(true)
    expect(totalsOf(game, 2, 3)).toEqual([20, 14, 20, 11])
    expect(outcomeOf(totalsOf(game, 2, 3))).toBe('draw')
    const lines = versusAccount(names, game, 2)
    const account = lines.join('\n')
    // Highlights, not every ball: the same few lines however many frames are bowled.
    expect(lines).toHaveLength(9)
    expect(account).toContain('Totals after each frame (the reader / Livvie / Min-ha / Noor): 3/8/4/9, 20/14/20/11.')
    expect(account).toContain('Who led: Noor after frame 1; level at the top after frame 2. Noor was the only one to lead.')
    expect(account).toContain('The reader: 1 strike (frame 2), 0 spares, 0 gutter balls.')
    expect(account).toContain('Livvie: 0 strikes, 0 spares, 0 gutter balls.')
    expect(account).toContain('Min-ha: 1 strike (frame 2), 0 spares, 1 gutter ball (frame 1).')
    expect(account).toContain('Noor: 0 strikes')
    expect(account).toContain('1 strike came off loose balls, which was luck')
    expect(account).toContain(
      'Final standings: 1. the reader 20; 1. Min-ha 20; 3. Livvie 14; 4. Noor 11. The reader and Min-ha shared the top score, 6 clear of Livvie: a draw for the reader.'
    )
    for (const name of names) expect(versusSummary(names, totalsOf(game, 2, 3))).toContain(name)
  })

  it('tells the account of a game the reader lost to one of three', () => {
    const lost = versusAccount(names, [...game.slice(0, 8), ...open(0, 1), ...game.slice(11)], 2).join('\n')
    expect(lost).toContain('Who led: Noor after frame 1; Min-ha after frame 2. The lead changed hands 1 time.')
    expect(lost).toContain(
      'Final standings: 1. Min-ha 20; 2. Livvie 14; 3. Noor 11; 4. the reader 4. Min-ha won by 6 over Livvie, a close game. The reader finished fourth of 4, 16 behind.'
    )
  })

  it('says who bowled, and in the cue whom the ball took her past', () => {
    // Level with Livvie on 14 is not past her.
    const told = ballTold(names, game.slice(0, 14), 13, 2)
    expect(told.narration).toBe('Min-ha bowls a strike!')
    expect(told.cue).toBe('Min-ha bowls a strike! That takes Min-ha past Noor.')
    expect(ballTold(names, game, 8, 2).cue).toBe(
      'The reader bowls a strike! That takes the reader past Livvie, Min-ha and Noor and into the lead.'
    )
    // Against one girl the cue is the ball alone, as it was.
    expect(ballTold(['Mia'], [ball(0, 2), ball(0, 0, ALL_PINS.slice(2)), ball(1, 10, ALL_PINS, POCKET)], 2, 3).cue).toBe(
      'Mia bowls a strike! Mia has 10 after the first frame.'
    )
  })

  it('cues the last frame once everyone is there and the top two are close', () => {
    const through = game.slice(0, 8)
    expect(lastFrameCue(names, through, 2)).toBe(
      'One frame left and it will decide the game: the reader has 3, Livvie has 8, Min-ha has 4, Noor has 9.'
    )
    expect(lastFrameCue(names, through.slice(0, 6), 2)).toBeNull()
    expect(lastFrameCue(['Mia'], [...open(0, 3), ...open(1, 6, 2)], 2)).toBe(
      'One frame left and it will decide the game: the reader has 3, Mia has 8.'
    )
    expect(lastFrameCue([], open(0, 3), 2)).toBeNull()
  })
})

describe('Bowling on offer', () => {
  it('is in the build and offered where there are lanes, most readily at the alley', () => {
    const bowling = MINI_GAMES_LIST.find((game) => game.id === 'bowling')
    expect(bowling).toBeDefined()
    if (!bowling) return
    const on = (): boolean => true
    expect(gamesOffered({ location: 'bowling_alley', girls: 0 }, on)).toContain(bowling)
    expect(gamesOffered({ location: 'btb_arcade', girls: 1 }, on)).not.toContain(bowling)
    expect(gamesOffered({ location: 'kendall_library', girls: 1 }, on)).not.toContain(bowling)
    expect(gamesOffered({ location: 'bowling_alley', girls: 1 }, on)).toContain(bowling)
    expect(suggestRate(bowling, 'bowling_alley', false)).toBe('often')
    expect(bowling.options?.[0]).toMatchObject({ id: 'frames', min: 3, max: 10, default: 5 })
    expect(bowling.players).toEqual({ min: 0, max: 3 })
  })
})
