import { describe, expect, it } from 'vitest'
import {
  CLEAN,
  COUNT_IN_MS,
  FIRE_AT,
  RELOAD_MS,
  RIM,
  SWEEP_MS,
  ZONE_REST,
  ZONE_SLIDE,
  counted,
  freshShooter,
  herRound,
  herStart,
  herStep,
  hoopAt,
  judgeShot,
  leadersOf,
  made,
  meterAt,
  movingFrom,
  outcomeOf,
  pointsFor,
  pressedEarly,
  roundMs,
  soloAccount,
  soloSummary,
  touchOf,
  versusAccount,
  versusSummary,
  zoneAt,
  type Shooter,
  type ShotKind,
  type Skill
} from '../src/shared/minigameRules/hoopShot'

/** Hoop Shot's rules: the meter and its band, the count, how she shoots and how a round is told. */

/** A random with a seed, so a run of trials comes out the same every time. */
function seeded(seed: number): () => number {
  let state = seed
  return () => (state = (state * 1664525 + 1013904223) >>> 0) / 4294967296
}

const never = (): number => {
  throw new Error('guessed')
}

const SKILLS = [1, 2, 3, 4, 5] as const

/** A count of the shots given, in order: `m` is a shot with the hoop moving. */
function shot(kinds: readonly ShotKind[], moving = false, from: Shooter = freshShooter()): Shooter {
  return kinds.reduce((shooter, kind) => counted(shooter, kind, moving), from)
}

/** A draw off the bell curve. */
function bell(rand: () => number): number {
  return Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
}

/**
 * An ordinary reader's round: he waits for the ball, sees it back in his hand, and lets go at
 * the meter's next crossing of the band's middle, one time in four the crossing after, out by
 * about 60 ms either way, and by a third more once the band is moving under him.
 */
function readerRound(lengthMs: number, rand: () => number, errorMs = 60, waitMs = 120, skips = 0.25, slip = 1.35): Shooter {
  let shooter = freshShooter()
  let ready = 0
  for (;;) {
    let at = ready + waitMs
    const side = (t: number): number => Math.sign(meterAt(t) - zoneAt(t, lengthMs))
    const before = side(at)
    while (at < lengthMs && side(at) === before) at += 4
    // Now and then he is not set for it, and lets a crossing go by.
    if (rand() < skips) {
      ready = at + 60 - waitMs
      continue
    }
    const moving = at >= movingFrom(lengthMs)
    const release = at + bell(rand) * errorMs * (moving ? slip : 1)
    if (release >= lengthMs) return shooter
    shooter = counted(shooter, judgeShot(meterAt(release), zoneAt(release, lengthMs), rand), release >= movingFrom(lengthMs))
    ready = release + RELOAD_MS
  }
}

describe('Hoop Shot, the clock and the meter', () => {
  it('runs 30, 45 or 60 seconds, and 30 for anything else', () => {
    expect([1, 2, 3].map(roundMs)).toEqual([30000, 45000, 60000])
    expect(roundMs(undefined)).toBe(30000)
    expect(roundMs(7)).toBe(30000)
    expect(COUNT_IN_MS).toBeGreaterThan(0)
  })

  it('sweeps the meter up and back without a jump', () => {
    expect(meterAt(0)).toBe(0)
    expect(meterAt(SWEEP_MS)).toBe(1)
    expect(meterAt(SWEEP_MS * 1.5)).toBeCloseTo(0.5)
    expect(meterAt(SWEEP_MS * 2)).toBe(0)
    // The count-in is before the clock's zero, and the meter is already running.
    expect(meterAt(-SWEEP_MS / 2)).toBeCloseTo(0.5)
    for (let at = -3000; at < 6000; at += 7) {
      expect(Math.abs(meterAt(at + 7) - meterAt(at))).toBeLessThanOrEqual(7 / SWEEP_MS + 1e-9)
    }
  })

  it('keeps the hoop still for two thirds of the round, then slides it and the band with it', () => {
    const length = roundMs(1)
    for (let at = 0; at <= movingFrom(length); at += 250) {
      expect(hoopAt(at, length)).toBe(0)
      expect(zoneAt(at, length)).toBe(ZONE_REST)
    }
    let [low, high] = [1, -1]
    for (let at = movingFrom(length); at < length; at += 10) {
      const hoop = hoopAt(at, length)
      low = Math.min(low, hoop)
      high = Math.max(high, hoop)
      expect(zoneAt(at, length)).toBeCloseTo(ZONE_REST + ZONE_SLIDE * hoop)
      // The whole band, rim and all, stays on the meter.
      expect(zoneAt(at, length) - RIM).toBeGreaterThan(0)
      expect(zoneAt(at, length) + RIM).toBeLessThan(1)
    }
    expect(low).toBeLessThan(-0.95)
    expect(high).toBeGreaterThan(0.95)
  })
})

describe('Hoop Shot, a shot', () => {
  it('drops clean inside the band and is short or long outside it, with no luck asked', () => {
    expect(judgeShot(0.6, 0.6, never)).toBe('clean')
    expect(judgeShot(0.6 + CLEAN - 0.001, 0.6, never)).toBe('clean')
    expect(judgeShot(0.6 - RIM - 0.01, 0.6, never)).toBe('short')
    expect(judgeShot(0.6 + RIM + 0.01, 0.6, never)).toBe('long')
    // The band has moved: the same power is now long.
    expect(judgeShot(0.6, 0.4, never)).toBe('long')
  })

  it('rolls a ball on the rim in or out, in more often the nearer the band it was', () => {
    expect(judgeShot(0.6 + CLEAN + 0.01, 0.6, () => 0)).toBe('rim-in')
    expect(judgeShot(0.6 - CLEAN - 0.01, 0.6, () => 0.99)).toBe('rim-out')
    const rate = (off: number): number => {
      const rand = seeded(5)
      let went = 0
      for (let i = 0; i < 4000; i++) went += Number(made(judgeShot(0.6 + off, 0.6, rand)))
      return went / 4000
    }
    expect(rate(CLEAN + 0.005)).toBeGreaterThan(rate(RIM - 0.005) + 0.3)
    expect(rate(RIM - 0.005)).toBeGreaterThan(0.1)
  })

  it('scores 2, then 3 with the hoop moving, and 1 more from the third basket of a run', () => {
    expect(shot(['clean', 'rim-in']).score).toBe(4)
    expect(shot(['clean', 'rim-in'], true).score).toBe(6)
    const hot = shot(['clean', 'clean', 'rim-in', 'clean'])
    expect(hot).toMatchObject({ score: 2 + 2 + 3 + 3, streak: 4, best: 4, fires: 1 })
    expect(pointsFor(FIRE_AT - 1, false)).toBe(2)
    expect(pointsFor(FIRE_AT, true)).toBe(4)
    // A miss ends the run and scores nothing; the best run is kept.
    const cooled = shot(['rim-out', 'clean'], false, hot)
    expect(cooled).toMatchObject({ score: 12, streak: 1, best: 4, fires: 1, makes: 5, attempts: 6, rimOut: 1, rimIn: 1 })
    expect(shot(['short', 'long']).score).toBe(0)
    expect(shot(['clean', 'short'], true)).toMatchObject({ movingMakes: 1, movingAttempts: 2 })
  })
})

describe('Hoop Shot, how she shoots', () => {
  it('steps her on the clock: the same balls however the time is cut up, and none after the buzzer', () => {
    const length = roundMs(1)
    for (const skill of SKILLS) {
      const whole = herStep(herStart(skill, seeded(skill)), length + 5000, length, skill, seeded(40 + skill)).shots
      const rand = seeded(40 + skill)
      let her = herStart(skill, seeded(skill))
      const pieces = []
      for (let at = 0; at <= length + 5000; at += 16) {
        const step = herStep(her, at, length, skill, rand)
        her = step.her
        pieces.push(...step.shots)
      }
      expect(pieces).toEqual(whole)
      expect(whole.length).toBeGreaterThan(8)
      expect(whole.every((ball) => ball.at >= 0 && ball.at < length)).toBe(true)
      expect(whole.every((ball) => ball.moving === ball.at >= movingFrom(length))).toBe(true)
      // Nobody throws faster than the ball comes back.
      for (let i = 1; i < whole.length; i++) expect(whole[i].at - whole[i - 1].at).toBeGreaterThan(RELOAD_MS)
    }
  })

  it('scores more the better she is, and copes better with the moving hoop', () => {
    const length = roundMs(1)
    const mean = (skill: Skill): { score: number; still: number; moving: number } => {
      const rand = seeded(900 + skill)
      const sum = { score: 0, makes: 0, attempts: 0, movingMakes: 0, movingAttempts: 0 }
      for (let i = 0; i < 1500; i++) {
        const round = herRound(length, skill, rand)
        for (const key of Object.keys(sum) as (keyof typeof sum)[]) sum[key] += round[key]
      }
      return {
        score: sum.score / 1500,
        still: (sum.makes - sum.movingMakes) / (sum.attempts - sum.movingAttempts),
        moving: sum.movingMakes / sum.movingAttempts
      }
    }
    const each = SKILLS.map(mean)
    for (let i = 1; i < 5; i++) {
      expect(each[i].score).toBeGreaterThan(each[i - 1].score + 3)
      expect(each[i].still).toBeGreaterThan(each[i - 1].still)
      expect(each[i].moving).toBeGreaterThan(each[i - 1].moving)
    }
    // What the sliding hoop costs her shrinks as she gets better.
    expect(each[0].still - each[0].moving).toBeGreaterThan(each[4].still - each[4].moving)
    expect(each[0].still).toBeGreaterThan(0.25)
    expect(each[4].still).toBeLessThan(0.97)
  })

  it('is beaten by an ordinary reader at skill 1 and 2, even at 3, and beats him at 5', () => {
    const report: string[] = []
    for (const option of [1, 3]) {
      const length = roundMs(option)
      const share = SKILLS.map((skill) => {
        const rand = seeded(7000 + skill * 31 + option)
        let [won, drawn, mine, hers] = [0, 0, 0, 0]
        const games = 1500
        for (let i = 0; i < games; i++) {
          const me = readerRound(length, rand)
          const her = herRound(length, skill, rand)
          mine += me.score
          hers += her.score
          won += Number(me.score > her.score)
          drawn += Number(me.score === her.score)
        }
        report.push(`${length / 1000}s skill ${skill}: reader wins ${(won / games * 100).toFixed(0)}% draws ${(drawn / games * 100).toFixed(0)}% mean ${(mine / games).toFixed(1)} v ${(hers / games).toFixed(1)}`)
        return (won + drawn / 2) / games
      })
      if (process.env.HOOP_REPORT) console.log(report.splice(0).join('\n'))
      expect(share[0]).toBeGreaterThan(0.85)
      expect(share[1]).toBeGreaterThan(0.68)
      expect(share[2]).toBeGreaterThan(0.38)
      expect(share[2]).toBeLessThan(0.62)
      expect(share[3]).toBeLessThan(0.42)
      expect(share[4]).toBeLessThan(0.25)
    }
  })

  // The test above flatters her: its reader waits 120 ms on every ball and lets a quarter of the
  // crossings go by. This one does neither. It records how the game stands today, not how it
  // should: the balance is the owner's to decide after playing, and whoever changes how she
  // shoots or how fast a ball comes back has to change these numbers on purpose.
  it('a reader who shoots every crossing currently out-scores every girl', () => {
    const length = roundMs(1)
    const games = 3000
    const rand = seeded(424242)
    let mine = 0
    for (let i = 0; i < games; i++) mine += readerRound(length, rand, 50, 0, 0, 1).score
    const reader = mine / games
    const hers = SKILLS.map((skill) => {
      const draw = seeded(8100 + skill)
      let sum = 0
      for (let i = 0; i < games; i++) sum += herRound(length, skill, draw).score
      return sum / games
    })
    if (process.env.HOOP_REPORT) console.log(`every crossing, 50 ms out: reader ${reader.toFixed(1)} v ${hers.map((score) => score.toFixed(1)).join(', ')}`)
    for (const score of hers) expect(reader).toBeGreaterThan(score)
    // Today's means over a 30-second round, to within a point or two: he is 50 ms out on every
    // ball, the hoop sliding or not, and averages about 62 against about 55 for a girl of skill 5.
    expect(reader).toBeGreaterThan(59.5)
    expect(reader).toBeLessThan(64)
    expect(hers[4]).toBeGreaterThan(53)
    expect(hers[4]).toBeLessThan(56.5)
    expect(reader - hers[4]).toBeGreaterThan(4)
  })
})

describe('Hoop Shot, the result', () => {
  it('is the reader\'s: won alone on top, a draw shared, lost otherwise, played alone', () => {
    expect(outcomeOf([20])).toBe('played')
    expect(outcomeOf([20, 18, 19])).toBe('won')
    expect(outcomeOf([20, 20, 19])).toBe('draw')
    expect(outcomeOf([20, 18, 22, 22])).toBe('lost')
    expect(leadersOf([20, 18, 22, 22])).toEqual([2, 3])
  })

  it('reads the reader\'s touch off his count', () => {
    const clean = shot(['clean', 'clean', 'clean', 'rim-in', 'clean', 'short', 'clean'])
    expect(touchOf(clean)).toBe('clean')
    const streaky = shot(['short', 'long', 'clean', 'rim-in', 'rim-in', 'clean', 'short', 'long', 'rim-out', 'short'])
    expect(touchOf(streaky)).toBe('streaky')
    expect(touchOf(shot(['short', 'long', 'clean', 'long', 'short']))).toBe('cold')
    expect(touchOf(shot(['clean', 'long', 'clean', 'short', 'rim-in', 'short']))).toBe('steady')
    let rushed = clean
    for (let i = 0; i < 5; i++) rushed = pressedEarly(rushed)
    expect(touchOf(rushed)).toBe('rushed')
    expect(rushed.score).toBe(clean.score)
  })

  it('names everyone, the mark and the luck in the summary and the account', () => {
    const names = ['Ana', 'Bea', 'Cy']
    const shooters = [
      shot(['clean', 'clean', 'clean', 'rim-in'], true, shot(['short', 'clean'])),
      shot(['clean', 'rim-out', 'clean', 'clean']),
      shot(['long', 'clean']),
      shot([])
    ]
    const summary = versusSummary(names, shooters)
    const account = versusAccount(names, shooters, [2, 6, 2, 0], 30000).join('\n')
    for (const name of names) {
      expect(summary).toContain(name)
      expect(account).toContain(name)
    }
    expect(summary).toMatch(/^You shoot .* and win/)
    expect(account).toContain('the reader')
    expect(account).toContain('Ana led')
    expect(account).toContain('the reader came from behind')
    expect(account).toContain('rolled in')
    expect(account).toContain('Cy never threw a ball')
    expect(account.split('\n').length).toBeLessThanOrEqual(8)
    expect(versusSummary(['Ana'], [shooters[1], shooters[1]])).toContain('share the top score with Ana')
    expect(versusSummary(['Ana', 'Bea'], [shooters[2], shooters[1], shooters[1]])).toContain('Ana and Bea share the win')
    // Alone there is an account as well as a summary.
    expect(soloSummary(shooters[0], 30000)).toContain(String(shooters[0].score))
    expect(soloAccount(shooters[0], 30000).length).toBeGreaterThanOrEqual(3)
  })
})
