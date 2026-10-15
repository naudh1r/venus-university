import { describe, expect, it } from 'vitest'
import {
  RINGS,
  herDart,
  houseScore,
  missBy,
  newMatch,
  scoreHit,
  summary,
  targetRegion,
  throwDart,
  traitsFor,
  type HitKind,
  type Match
} from '../src/shared/minigameRules/darts'

/** A dart thrown exactly into a region by whoever's turn it is. */
function at(match: Match, number: number, kind: HitKind = 'single'): Match {
  const point = targetRegion(number, kind)
  return throwDart(match, point, point)
}

const offBoard = (match: Match): Match => throwDart(match, { x: 1.2, y: 0 }, { x: 0, y: 0 })

describe('scoring', () => {
  it('scores the rings and the sectors from the radii the board is painted with', () => {
    expect(scoreHit(0, 0).points).toBe(50)
    expect(scoreHit(0, -RINGS.bull - 1e-5).points).toBe(25)
    expect(scoreHit(0, -RINGS.outerBull - 1e-5).points).toBe(20)
    expect(scoreHit(0, -RINGS.tripleIn).points).toBe(60)
    expect(scoreHit(0, -RINGS.doubleIn).points).toBe(40)
    expect(scoreHit(0, -1.00001).points).toBe(0)
    // Clockwise from 20 at the top comes 1, and 3 sits straight below.
    expect(scoreHit(0.3, -0.7).number).toBe(1)
    expect(scoreHit(0, 0.5).number).toBe(3)
    expect(scoreHit(Number.NaN, 0).kind).toBe('miss')
  })
})

describe('a countdown', () => {
  it('puts a bust back where the visit opened and ends that visit', () => {
    let m = newMatch('versus', 1)
    m = at(at(at(m, 20, 'triple'), 20, 'triple'), 20, 'triple') // the reader to 121
    m = at(at(at(m, 20, 'triple'), 20, 'triple'), 20, 'triple') // her to 121
    m = at(at(m, 20, 'triple'), 20, 'triple') // the reader to 1
    m = at(m, 2) // over: a bust
    const s = summary(m)
    expect(s.left.you).toBe(121)
    expect(s.visits[s.visits.length - 1].bust).toBe(true)
    expect(s.side).toBe('her')
  })

  it('wins a team game on exactly zero, and loses it when the five visits run out', () => {
    let m = newMatch('team', 1, 301)
    // 81 a visit: 220, 139, 58, then two busts.
    for (let visit = 0; visit < 5; visit++) m = at(at(at(m, 20, 'triple'), 20), 1)
    expect(summary(m)).toMatchObject({ done: true, outcome: 'lost', left: { you: 58 } })
    let win = newMatch('team', 1, 301)
    win = at(at(at(win, 20, 'triple'), 20, 'triple'), 20, 'triple')
    win = at(at(win, 20, 'triple'), 20, 'triple')
    expect(summary(win)).toMatchObject({ done: false, side: 'her', left: { you: 1, her: 1 } })
    win = at(win, 1)
    expect(summary(win)).toMatchObject({ done: true, finisher: 'her', outcome: 'won' })
  })

  it('ends versus at the first exact zero, before she replies', () => {
    let m = newMatch('versus', 1)
    m = at(at(at(m, 20, 'triple'), 20, 'triple'), 20, 'triple')
    m = offBoard(offBoard(offBoard(m)))
    m = at(at(m, 20, 'triple'), 20, 'triple')
    m = at(m, 1)
    expect(summary(m)).toMatchObject({ done: true, finisher: 'you', outcome: 'won' })
    expect(throwDart(m, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(m)
  })

  it('settles versus after six visits each on the lower score left, or a draw', () => {
    let m = newMatch('versus', 1)
    for (let visit = 0; visit < 12; visit++) {
      m = visit % 2 ? offBoard(offBoard(offBoard(m))) : at(offBoard(offBoard(m)), 5)
    }
    expect(summary(m)).toMatchObject({ done: true, finisher: null, outcome: 'won' })
    let level = newMatch('versus', 1)
    for (let visit = 0; visit < 12; visit++) level = at(offBoard(offBoard(level)), 5)
    expect(summary(level)).toMatchObject({ done: true, outcome: 'draw' })
  })
})

describe('the house', () => {
  it('posts a score fixed by the seed, about 395 on average', () => {
    const scores = Array.from({ length: 300 }, (_, seed) => houseScore(seed))
    expect(scores).toEqual(Array.from({ length: 300 }, (_, seed) => houseScore(seed)))
    expect(newMatch('house', 7).target).toBe(houseScore(7))
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length
    expect(mean).toBeGreaterThan(360)
    expect(mean).toBeLessThan(430)
    expect(Math.max(...scores)).toBeLessThanOrEqual(900)
  })

  it('counts every point of fifteen darts against it', () => {
    let m = newMatch('house', 7)
    for (let i = 0; i < 15; i++) m = at(m, 20, 'triple')
    expect(summary(m)).toMatchObject({ done: true, score: 900, outcome: 'won' })
    let none = newMatch('house', 7)
    for (let i = 0; i < 15; i++) none = offBoard(none)
    expect(summary(none)).toMatchObject({ done: true, score: 0, outcome: 'lost' })
  })
})

describe('her darts', () => {
  it('map each skill to fixed traits, better at every step, a 3 where the skill is unknown', () => {
    for (let skill = 1; skill < 5; skill++) {
      const lower = traitsFor(skill)
      const higher = traitsFor(skill + 1)
      expect(higher.accuracy).toBeGreaterThan(lower.accuracy)
      expect(higher.consistency).toBeGreaterThan(lower.consistency)
      expect(higher.composure).toBeGreaterThan(lower.composure)
    }
    expect(traitsFor(0)).toEqual(traitsFor(3))
    expect(traitsFor(Number.NaN)).toEqual(traitsFor(3))
  })

  it('are the same for the same game, and group tighter the better she is', () => {
    const spread = (skill: number): number => {
      let total = 0
      let count = 0
      for (let seed = 0; seed < 150; seed++) {
        // The reader's first visit off the board, then her first dart.
        const m = offBoard(offBoard(offBoard(newMatch('versus', seed))))
        const dart = herDart(m, traitsFor(skill))
        expect(dart).toEqual(herDart(m, traitsFor(skill)))
        total += missBy(dart!)
        count++
      }
      return total / count
    }
    const widths = [1, 2, 3, 4, 5].map(spread)
    for (let i = 1; i < widths.length; i++) expect(widths[i]).toBeLessThan(widths[i - 1])
    expect(herDart(newMatch('versus', 1), traitsFor(3))).toBeNull()
  })
})
