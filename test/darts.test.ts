import { describe, expect, it } from 'vitest'
import { newMatch, summary, throwDart, targetRegion, scoreHit, validateMatch, traitsFor, planPartnerTurn, applyPlannedThrow, NUMBERS, type Match } from '../src/shared/minigameRules/darts'

/** A released dart uses a scoring region's normalized centre. */
const hit = (m: Match, n: number, kind: 'single' | 'double' | 'triple' = 'single'): Match => throwDart(m, targetRegion(n, kind), 0)
const miss = (m: Match): Match => throwDart(m, { x: 1.2, y: 0 }, 0)
const fresh = (mode = 301): Match => newMatch({ seed: 42, id: 'darts-test', mode })

describe('cooperative darts ledger', () => {
  it('scores each wedge from the same normalized regions the board draws', () => {
    for (const n of NUMBERS) for (const kind of ['single', 'double', 'triple'] as const) {
      const p = targetRegion(n, kind)
      expect(scoreHit(p.x, p.y).points).toBe(n * (kind === 'triple' ? 3 : kind === 'double' ? 2 : 1))
    }
    expect(scoreHit(0, 0).points).toBe(50)
    expect(scoreHit(1.2, 0).points).toBe(0)
  })
  it('ends immediately at exact zero, including a single out', () => {
    let m = fresh()
    for (let i = 0; i < 4; i++) m = hit(m, 20, 'triple')
    m = miss(miss(m)); m = hit(m, 20, 'triple'); m = hit(m, 1)
    expect(summary(m)).toMatchObject({ done: true, outcome: 'win', balance: 0, count: 8 })
    expect(validateMatch(JSON.parse(JSON.stringify(m)))).toEqual(m)
    expect(() => miss(m)).toThrow()
  })
  it('cancels every point in a bust visit and hands over early', () => {
    let m = fresh()
    for (let i = 0; i < 4; i++) m = hit(m, 20, 'triple')
    m = miss(miss(m)); m = hit(m, 20, 'triple'); m = hit(m, 2)
    const s = summary(m)
    expect(s.balance).toBe(61)
    expect(s.actor).toBe('partner')
    expect(s.visits?.at(-1)).toMatchObject({ bust: true, points: 0, start: 61 })
  })
  it('loses after five visits with any positive balance', () => {
    let m = fresh()
    for (let i = 0; i < 15; i++) m = miss(m)
    expect(summary(m)).toMatchObject({ done: true, outcome: 'loss', balance: 301 })
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
  it('commits a precomputed visit exactly once and independently of dialogue', () => {
    let m = fresh(501)
    m = { ...m, partnerTraits: traitsFor(3, 'ana') }
    for (let i = 0; i < 3; i++) m = hit(m, 20)
    const plan = planPartnerTurn(m)
    expect(planPartnerTurn({ ...m, dialogue: { opening: 'Different words.' } })).toEqual(plan)
    m = { ...m, partnerPlan: { start: m.throws.length, seed: m.seed, strategy: m.strategy, items: plan } }
    for (const item of plan) {
      m = applyPlannedThrow(m, item)
      expect(m.throws.at(-1)).toEqual(item.dart)
      expect(() => applyPlannedThrow(m, item)).toThrow()
    }
    expect(summary(m).actor).toBe('you')
  })
})
