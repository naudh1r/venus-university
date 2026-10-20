import { describe, expect, it } from 'vitest'
import { targetRegion, scoreHit, traitsFor, NUMBERS, aimEllipse, movingDot, panelLights, applySessionPlan, newSession, planNpcVisit, sessionSummary, sessionThrow, type DartsSession } from '../src/shared/minigameRules/darts'

describe('darts geometry and traits', () => {
  it('scores each wedge from the same normalized regions the board draws', () => {
    for (const n of NUMBERS) for (const kind of ['single', 'double', 'triple'] as const) {
      const p = targetRegion(n, kind)
      expect(scoreHit(p.x, p.y).points).toBe(n * (kind === 'triple' ? 3 : kind === 'double' ? 2 : 1))
    }
    expect(scoreHit(0, 0).points).toBe(50)
    expect(scoreHit(1.2, 0).points).toBe(0)
  })
  it('fixes independent traits by character and framework skill', () => {
    for (let skill = 1; skill <= 5; skill++) for (let i = 0; i < 100; i++) {
      const traits = traitsFor(skill, `npc-${i}`)
      expect(traits).toEqual(traitsFor(skill, `npc-${i}`))
      for (const value of [traits.accuracy, traits.consistency, traits.composure]) {
        expect(Number.isInteger(value)).toBe(true)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThanOrEqual(100)
      }
    }
    expect(traitsFor(5, 'ana').accuracy).toBeGreaterThan(traitsFor(1, 'ana').accuracy)
    expect(traitsFor(3, 'ana')).not.toEqual(traitsFor(3, 'bea'))
  })
})

const seats = (two = true) => [
  { id: 'reader', name: 'You', kind: 'reader' as const },
  { id: 'ana', name: 'Ana', kind: 'npc' as const, traits: traitsFor(3, 'ana', { accuracy: 2, consistency: 1, composure: -2 }) },
  ...(two ? [{ id: 'bea', name: 'Bea', kind: 'npc' as const, traits: traitsFor(2, 'bea', { accuracy: -1, consistency: 2, composure: 1 }) }] : [])
]
const session = (mode: 'house' | 'rival' = 'house', two = true): DartsSession => newSession({ id: 'multi', seed: 42, mode, target: mode === 'house' ? 501 : 301, seats: seats(two) })
const sessionMiss = (game: DartsSession): DartsSession => sessionThrow(game, { x: 1.2, y: 0 })

describe('multiplayer darts session', () => {
  const solo = (): DartsSession => newSession({ id: 'solo', seed: 42, mode: 'house', target: 301, seats: seats().slice(0, 1) })

  it('gives a solo reader five visits and ends after fifteen misses', () => {
    let game = solo()
    for (let i = 0; i < 15; i++) {
      expect(sessionSummary(game)).toMatchObject({ done: false, currentSeatId: 'reader' })
      game = sessionMiss(game)
    }
    expect(sessionSummary(game)).toMatchObject({ done: true, completedVisits: 5, outcome: 'lost', teamBalance: 301 })
    expect(() => sessionMiss(game)).toThrow()
    expect(() => newSession({ ...solo(), mode: 'rival' })).toThrow('Invalid darts seats')
  })

  it('restores a solo bust and lets the reader check out on the next visit', () => {
    let game = solo()
    for (let i = 0; i < 5; i++) game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(2))
    expect(sessionSummary(game)).toMatchObject({ teamBalance: 121, currentSeatId: 'reader', completedVisits: 2 })
    expect(sessionSummary(game).visits.at(-1)).toMatchObject({ bust: true, points: 0 })
    game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(1))
    expect(sessionSummary(game)).toMatchObject({ done: true, outcome: 'won', teamBalance: 0 })
  })
  it('uses the exact same normalized scoring geometry as the rendered board', () => {
    for (let index = 0; index < 500; index++) {
      const x = ((index * 73) % 261) / 100 - 1.3
      const y = ((index * 137) % 261) / 100 - 1.3
      const game = sessionThrow(newSession({ id: `geometry-${index}`, seed: index, mode: 'house', target: 701, seats: seats(false) }), { x, y })
      expect(701 - sessionSummary(game).teamBalance).toBe(scoreHit(x, y).points)
    }
  })

  it('rotates reader, first girl and second girl without sharing speakers', () => {
    let game = session()
    for (let i = 0; i < 3; i++) game = sessionMiss(game)
    expect(sessionSummary(game).currentSeatId).toBe('ana')
    const ana = planNpcVisit(game, 'ana')
    expect(ana).toHaveLength(3)
    expect(ana.every((item) => item.seatId === 'ana')).toBe(true)
    for (const item of ana) game = applySessionPlan(game, item)
    expect(sessionSummary(game).currentSeatId).toBe('bea')
    const bea = planNpcVisit(game, 'bea')
    expect(bea.every((item) => item.seatId === 'bea')).toBe(true)
    for (const item of bea) game = applySessionPlan(game, item)
    expect(sessionSummary(game).currentSeatId).toBe('reader')
  })

  it('gives a two-girl house team seven visits and restores a bust', () => {
    let game = newSession({ id: 'bust', seed: 7, mode: 'house', target: 301, seats: seats() })
    game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(20, 'triple'))
    const before = sessionSummary(game).teamBalance
    for (let i = 0; i < 3; i++) game = sessionThrow(game, targetRegion(20, 'triple'))
    expect(sessionSummary(game).teamBalance).toBe(before)
    expect(sessionSummary(game).visits.at(-1)?.bust).toBe(true)
    while (!sessionSummary(game).done) game = sessionMiss(game)
    expect(sessionSummary(game)).toMatchObject({ completedVisits: 7, outcome: 'lost' })
  })

  it('ends immediately on a checkout and never schedules the next girl', () => {
    let game = newSession({ id: 'checkout', seed: 9, mode: 'house', target: 301, seats: seats() })
    for (let i = 0; i < 4; i++) game = sessionThrow(game, targetRegion(20, 'triple'))
    game = sessionThrow(game, targetRegion(1))
    game = sessionThrow(game, targetRegion(20, 'triple'))
    expect(sessionSummary(game)).toMatchObject({ done: true, outcome: 'won', teamBalance: 0 })
    expect(planNpcVisit(game, 'bea')).toEqual([])
  })

  it('keeps separate rival balances and chooses the lowest after three rounds', () => {
    let game = session('rival', false)
    for (let visit = 0; visit < 6; visit++) {
      for (let dart = 0; dart < 3; dart++) game = sessionThrow(game, visit % 2 === 0 ? targetRegion(20) : { x: 1.2, y: 0 })
    }
    expect(sessionSummary(game)).toMatchObject({ done: true, outcome: 'won', winnerIds: ['reader'] })
    expect(sessionSummary(game).balances).toEqual({ reader: 121, ana: 301 })
  })

  it('uses personality biases without making the three traits a split of 100', () => {
    const strong = traitsFor(3, 'same', { accuracy: 2, consistency: 2, composure: 2 })
    const weak = traitsFor(3, 'same', { accuracy: -2, consistency: -2, composure: -2 })
    expect(strong.accuracy - weak.accuracy).toBe(24)
    expect(strong.consistency - weak.consistency).toBe(24)
    expect(strong.composure - weak.composure).toBe(24)
    expect(strong.accuracy + strong.consistency + strong.composure).not.toBe(100)
  })
})


describe('NPC darts accuracy balance', () => {
  function sample(traits: ReturnType<typeof traitsFor>, pressure = false) {
    const distances: number[] = []
    let exact = 0, outside = 0
    for (let trial = 0; trial < 400; trial++) {
      let game = newSession({
        id: 'accuracy-sample', seed: Math.imul(trial + 1, 2654435761) >>> 0,
        mode: 'house', target: 701,
        seats: [{ id: 'reader', name: 'You', kind: 'reader' }, { id: 'npc', name: 'NPC', kind: 'npc', traits }]
      })
      for (let i = 0; i < 3; i++) game = sessionMiss(game)
      if (pressure) {
        for (const dart of planNpcVisit(game, 'npc')) game = applySessionPlan(game, dart)
        for (let i = 0; i < 3; i++) game = sessionMiss(game)
      }
      for (const dart of planNpcVisit(game, 'npc')) {
        const target = scoreHit(dart.target.x, dart.target.y)
        distances.push(Math.hypot(dart.dart.x - dart.target.x, dart.dart.y - dart.target.y))
        if (dart.hit.kind === target.kind && dart.hit.number === target.number) exact++
        if (dart.hit.kind === 'miss') outside++
      }
    }
    distances.sort((a, b) => a - b)
    return {
      mean: distances.reduce((sum, value) => sum + value, 0) / distances.length,
      tail: distances[Math.floor(distances.length * 0.95)],
      exact: exact / distances.length,
      outside: outside / distances.length
    }
  }

  const rosalie = traitsFor(4, 'feac7482-3e72-4354-b690-3087c2cf041e', { accuracy: 1, consistency: 1, composure: 0 })

  it('makes a strong level-four player reliably hit the chosen region without perfect aim', () => {
    const strong = sample(rosalie)
    const beginner = sample(traitsFor(2, 'feac7482-3e72-4354-b690-3087c2cf041e'))
    expect(strong.mean).toBeLessThan(beginner.mean * 0.5)
    expect(strong.exact).toBeGreaterThan(0.60)
    expect(strong.exact).toBeLessThan(0.95)
    expect(strong.outside).toBeLessThan(0.05)
  })

  it('keeps a composed level-four player accurate in late visits', () => {
    const late = sample(rosalie, true)
    expect(late.exact).toBeGreaterThan(0.50)
    expect(late.outside).toBeLessThan(0.05)
  })

  it('gives higher accuracy progressively tighter groups with the other traits fixed', () => {
    const means = [25, 40, 55, 75, 90].map((accuracy) => sample({ version: 1, accuracy, consistency: 70, composure: 70 }).mean)
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeLessThan(means[i - 1])
  })

  it('makes consistency limit the wide throws without changing accuracy', () => {
    const steady = sample({ version: 1, accuracy: 75, consistency: 90, composure: 70 })
    const erratic = sample({ version: 1, accuracy: 75, consistency: 10, composure: 70 })
    expect(steady.tail).toBeLessThan(erratic.tail * 0.8)
  })

  it('applies composure only under pressure and lets good composure protect precision', () => {
    const calm = { version: 1, accuracy: 75, consistency: 80, composure: 90 }
    const nervous = { ...calm, composure: 10 }
    expect(sample(calm)).toEqual(sample(nervous))
    expect(sample(calm, true).mean).toBeLessThan(sample(nervous, true).mean * 0.6)
  })
})


describe('time-based board effects', () => {
  it('keeps the seeded pointer inside the locked ellipse at any frame rate', () => {
    const ellipse = aimEllipse({ x: 1.35, y: -1.35 }, 'club')
    for (const seconds of [0, 1 / 144, 1 / 60, 0.1, 1, 20]) {
      const point = movingDot(ellipse, 42, 2, seconds)
      expect(((point.x - ellipse.x) / ellipse.rx) ** 2 + ((point.y - ellipse.y) / ellipse.ry) ** 2).toBeLessThanOrEqual(1.0000001)
      expect(Math.abs(point.x)).toBeLessThanOrEqual(1.35)
      expect(Math.abs(point.y)).toBeLessThanOrEqual(1.35)
    }
  })
  it('finishes every LED pattern before the board becomes idle', () => {
    for (const kind of ['single', 'double', 'triple', 'outerBull', 'bull'] as const) {
      const dart = targetRegion(20, kind)
      expect(panelLights(dart, 0).length).toBeGreaterThan(0)
      expect(panelLights(dart, 650)).toEqual([])
      expect(panelLights(dart, 1200)).toEqual([])
    }
  })
})
