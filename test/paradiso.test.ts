import { describe, expect, it } from 'vitest'
import { seededRand } from '../src/shared/hash'
import { gamesOffered, MINI_GAMES, MINI_GAMES_LIST, suggestRate } from '../src/shared/minigames'
import PARADISO_MOD from '../src/shared/modEntries/morrowkiln-arcade-games'
import {
  MIN_LANE_GAP_MS,
  WINDOWS,
  difficultyOf,
  emptyTally,
  gradeOf,
  herDance,
  judge,
  makeChart,
  missed,
  noteToHit,
  points,
  resultLine,
  scoreShare,
  soloAccount,
  soloSummary,
  tallied,
  tallyOf,
  versusAccount,
  versusSummary,
  type Judgement,
  type Note,
  type Skill
} from '../src/shared/minigameRules/paradiso'

/** PARADISO's rules: the chart, the judging of a step, the score, and how she dances. */

const DIFFICULTIES = [1, 2, 3, 4, 5]
const SEEDS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']

describe('PARADISO chart', () => {
  it('cuts the same chart from the same seed, and another from another', () => {
    expect(makeChart('seed', 3)).toEqual(makeChart('seed', 3))
    expect(makeChart('seed', 3).notes).not.toEqual(makeChart('other', 3).notes)
  })

  it('runs a little under a minute, in time order, after a count-in', () => {
    for (const difficulty of DIFFICULTIES) {
      const chart = makeChart('length', difficulty)
      expect(chart.lengthMs).toBeGreaterThanOrEqual(45000)
      expect(chart.lengthMs).toBeLessThanOrEqual(60000)
      expect(chart.leadInMs).toBeGreaterThanOrEqual(1500)
      expect(chart.notes[0].time).toBe(chart.leadInMs)
      const times = chart.notes.map((note) => note.time)
      expect([...times].sort((a, b) => a - b)).toEqual(times)
      expect(times[times.length - 1]).toBeLessThan(chart.lengthMs - WINDOWS.good)
    }
  })

  it('is faster and thicker with steps as the difficulty rises', () => {
    const mean = (difficulty: number): number =>
      SEEDS.reduce((sum, seed) => sum + makeChart(seed, difficulty).notes.length, 0) / SEEDS.length
    for (const difficulty of [2, 3, 4, 5]) {
      expect(mean(difficulty)).toBeGreaterThan(mean(difficulty - 1) * 1.15)
      expect(makeChart('x', difficulty).bpm).toBeGreaterThan(makeChart('x', difficulty - 1).bpm)
      expect(makeChart('x', difficulty).scrollMs).toBeLessThan(makeChart('x', difficulty - 1).scrollMs)
    }
  })

  it('puts every step on a beat or half way between two', () => {
    for (const difficulty of DIFFICULTIES) {
      const chart = makeChart('grid', difficulty)
      for (const note of chart.notes) {
        const halves = (note.time / chart.beatMs) * 2
        expect(Math.abs(halves - Math.round(halves))).toBeLessThan(1e-6)
        expect(note.off).toBe(Math.round(halves) % 2 === 1)
      }
    }
    expect(makeChart('grid', 1).notes.some((note) => note.off)).toBe(false)
  })

  it('never asks for anything that cannot be danced', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const chart = makeChart(seed, difficulty)
        const last = new Map<number, number>()
        const at = new Map<number, Note[]>()
        for (const note of chart.notes) {
          const before = last.get(note.lane)
          if (before !== undefined) expect(note.time - before).toBeGreaterThanOrEqual(MIN_LANE_GAP_MS)
          last.set(note.lane, note.time)
          at.set(note.time, [...(at.get(note.time) ?? []), note])
        }
        const times = [...at.keys()]
        times.forEach((time, i) => {
          const together = at.get(time) ?? []
          expect(together.length).toBeLessThanOrEqual(2)
          if (together.length < 2) return
          // A double is on a beat, with the half beat either side of it clear.
          expect(together[0].off).toBe(false)
          if (i > 0) expect(time - times[i - 1]).toBeGreaterThan(chart.beatMs * 0.75)
          if (i < times.length - 1) expect(times[i + 1] - time).toBeGreaterThan(chart.beatMs * 0.75)
        })
      }
    }
  })

  it('keeps doubles for the harder songs', () => {
    const doubles = (difficulty: number): number =>
      SEEDS.reduce((sum, seed) => {
        const times = makeChart(seed, difficulty).notes.map((note) => note.time)
        return sum + (times.length - new Set(times).size)
      }, 0)
    expect(doubles(1)).toBe(0)
    expect(doubles(2)).toBe(0)
    expect(doubles(5)).toBeGreaterThan(doubles(3))
    expect(doubles(3)).toBeGreaterThan(0)
  })

  it('plays a difficulty it has, whatever was asked for', () => {
    expect(difficultyOf(undefined)).toBe(2)
    expect(difficultyOf(9)).toBe(5)
    expect(difficultyOf(0)).toBe(1)
    expect(difficultyOf(Number.NaN)).toBe(2)
    expect(makeChart('s', 9)).toEqual(makeChart('s', 5))
  })
})

describe('PARADISO judging', () => {
  it('judges a step by how far off the beat it lands, early or late', () => {
    expect(judge(0)).toBe('perfect')
    expect(judge(-WINDOWS.perfect)).toBe('perfect')
    expect(judge(WINDOWS.perfect + 1)).toBe('great')
    expect(judge(-WINDOWS.great)).toBe('great')
    expect(judge(WINDOWS.great + 1)).toBe('good')
    expect(judge(WINDOWS.good)).toBe('good')
    expect(judge(WINDOWS.good + 1)).toBeNull()
    expect(judge(-WINDOWS.good - 1)).toBeNull()
  })

  it('calls a note missed only once it can no longer be hit', () => {
    const note: Note = { time: 1000, lane: 0, off: false }
    expect(missed(note, 1000 + WINDOWS.good)).toBe(false)
    expect(missed(note, 1001 + WINDOWS.good)).toBe(true)
    expect(missed(note, 500)).toBe(false)
  })

  it('lands a step on the earliest unjudged note in its lane within reach', () => {
    const notes: Note[] = [
      { time: 1000, lane: 0, off: false },
      { time: 1000, lane: 2, off: false },
      { time: 1250, lane: 0, off: true },
      { time: 3000, lane: 1, off: false }
    ]
    expect(noteToHit(notes, [], 0, 1010)).toBe(0)
    expect(noteToHit(notes, [], 2, 990)).toBe(1)
    // The first one already stepped on: the same pad again reaches the next, if it is near.
    expect(noteToHit(notes, ['perfect'], 0, 1010)).toBe(-1)
    expect(noteToHit(notes, ['perfect'], 0, 1200)).toBe(2)
    // The wrong pad, or far too early, is a stray foot.
    expect(noteToHit(notes, [], 3, 1000)).toBe(-1)
    expect(noteToHit(notes, [], 1, 2000)).toBe(-1)
    expect(noteToHit(notes, [], 1, 3000 + WINDOWS.good + 1)).toBe(-1)
  })

  it('counts the score, and a combo that only a miss breaks', () => {
    const run: Judgement[] = ['perfect', 'great', 'good', 'miss', 'perfect', 'perfect']
    const tally = tallyOf(run)
    expect(tally.score).toBe(1000 + 700 + 400 + 0 + 1000 + 1000)
    expect(tally.combo).toBe(2)
    expect(tally.maxCombo).toBe(3)
    expect(tally.counts).toEqual({ perfect: 3, great: 1, good: 1, miss: 1 })
    const one = tallied(emptyTally(), 'miss')
    expect(one.combo).toBe(0)
    expect(emptyTally().counts.miss).toBe(0)
  })

  it('grades a score by its share of the full one', () => {
    expect(scoreShare(5000, 5)).toBe(1)
    expect(scoreShare(0, 0)).toBe(0)
    expect(gradeOf(1)).toBe('AAA')
    expect(gradeOf(0.95)).toBe('AAA')
    expect(gradeOf(0.9)).toBe('AA')
    expect(gradeOf(0.8)).toBe('A')
    expect(gradeOf(0.7)).toBe('B')
    expect(gradeOf(0.5)).toBe('C')
    expect(gradeOf(0.49)).toBe('D')
    expect(gradeOf(0)).toBe('D')
  })
})

describe('PARADISO, her dance', () => {
  const NOTES = 120
  /** Her share of the full score and of steps missed, over a spread of seeded songs. */
  function danced(skill: Skill, difficulty: number): { share: number; perfect: number; miss: number } {
    const runs = 60
    let share = 0
    let perfect = 0
    let miss = 0
    for (let run = 0; run < runs; run++) {
      const tally = tallyOf(herDance(NOTES, skill, difficulty, seededRand(`her:${run}`)))
      share += scoreShare(tally.score, NOTES) / runs
      perfect += tally.counts.perfect / NOTES / runs
      miss += tally.counts.miss / NOTES / runs
    }
    return { share, perfect, miss }
  }

  it('is the same dance from the same random, one judgement a step', () => {
    const a = herDance(NOTES, 3, 3, seededRand('same'))
    expect(a).toEqual(herDance(NOTES, 3, 3, seededRand('same')))
    expect(a).toHaveLength(NOTES)
    expect(herDance(0, 3, 3)).toEqual([])
  })

  it('scores more the better she is, and less the harder the song', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const skill of [2, 3, 4, 5] as const) {
        expect(danced(skill, difficulty).share).toBeGreaterThan(
          danced((skill - 1) as Skill, difficulty).share
        )
      }
    }
    for (const skill of [1, 2, 3, 4] as const) {
      for (const difficulty of [2, 3, 4, 5]) {
        expect(danced(skill, difficulty).share).toBeLessThan(danced(skill, difficulty - 1).share)
      }
    }
  })

  it('has the best dancer mostly Perfect on the hardest song, and the weakest struggle past the second', () => {
    const best = danced(5, 5)
    expect(best.perfect).toBeGreaterThan(0.7)
    expect(best.miss).toBeLessThan(0.03)
    expect(danced(1, 1).miss).toBeLessThan(0.1)
    expect(danced(1, 3).miss).toBeGreaterThan(0.1)
    expect(danced(1, 5).share).toBeLessThan(0.5)
  })

  it('misses in runs, not one step here and there', () => {
    let misses = 0
    let followed = 0
    for (let run = 0; run < 60; run++) {
      const steps = herDance(NOTES, 1, 4, seededRand(`streak:${run}`))
      steps.forEach((step, i) => {
        if (step !== 'miss' || i === steps.length - 1) return
        misses++
        if (steps[i + 1] === 'miss') followed++
      })
    }
    const overall = danced(1, 4).miss
    // A miss is followed by another far more often than a step is missed at all.
    expect(followed / misses).toBeGreaterThan(overall * 1.5)
  })
})

describe('PARADISO, told', () => {
  const chart = makeChart('told', 3)
  const notes = chart.notes.length
  const mine = tallyOf(herDance(notes, 4, 3, seededRand('mine')))
  const hers = tallyOf(herDance(notes, 2, 3, seededRand('hers')))

  it('prints a score with its thousands apart', () => {
    expect(points(0)).toBe('0')
    expect(points(999)).toBe('999')
    expect(points(45300)).toBe('45,300')
    expect(points(1234567)).toBe('1,234,567')
  })

  it('says how a song against her came out', () => {
    expect(versusSummary('Mika', 2000, 1000)).toContain('win, 2,000 points to 1,000')
    expect(versusSummary('Mika', 1000, 2000)).toContain('lose, 1,000 points to 2,000')
    expect(versusSummary('Mika', 1000, 1000)).toContain('level')
    expect(soloSummary(3, notes, mine)).toContain(`grade of ${gradeOf(scoreShare(mine.score, notes))}`)
    expect(resultLine(notes, mine, { name: 'Mika', tally: hers })).toContain(`Mika: ${points(hers.score)}`)
  })

  it('gives the writer the whole song: scores, grades, combos, judgements, halfway and the breath it cost', () => {
    const account = versusAccount('Mika', chart, mine, hers, -500)
    const text = account.join('\n')
    expect(text).toContain('difficulty 3 of 5')
    expect(text).toContain(`The reader scored ${points(mine.score)}, grade ${gradeOf(scoreShare(mine.score, notes))}`)
    expect(text).toContain(`Mika scored ${points(hers.score)}, grade ${gradeOf(scoreShare(hers.score, notes))}`)
    expect(text).toContain(`${mine.counts.perfect} Perfect, ${mine.counts.great} Great, ${mine.counts.good} Good and ${mine.counts.miss} missed`)
    expect(text).toContain(`longest combo of ${hers.maxCombo} steps`)
    expect(text).toContain('At the halfway mark Mika was ahead, and the reader came back')
    expect(text).toContain('out of breath')
    expect(account.every((line) => !line.includes('\n'))).toBe(true)
  })

  it('gives the writer a song danced alone: difficulty, score, grade, combo and judgements', () => {
    const chart = makeChart('solo', 4)
    const notes = chart.notes.length
    const mixed = tallyOf(chart.notes.map((_, i) => (i === 3 ? 'miss' : i % 2 ? 'great' : 'perfect')))
    const account = soloAccount(chart, mixed)
    expect(account[0]).toContain(`${notes} steps at difficulty 4 of 5`)
    expect(account[1]).toContain(`scored ${points(mixed.score)}, grade ${gradeOf(scoreShare(mixed.score, notes))}`)
    expect(account[1]).toContain(`${mixed.counts.perfect} Perfect, ${mixed.counts.great} Great, 0 Good and 1 missed`)
    expect(account[1]).toContain(`longest combo of ${mixed.maxCombo} steps`)
    expect(account).toHaveLength(3)
  })

  it('tells a full combo and a song with nothing landed apart from the rest', () => {
    const chart = makeChart('solo', 1)
    const full = soloAccount(chart, tallyOf(chart.notes.map(() => 'perfect')))
    expect(full[1]).toContain('grade AAA')
    expect(full[1]).toContain(`longest combo of ${chart.notes.length} steps`)
    expect(full[2]).toContain('full combo')
    const none = tallyOf(chart.notes.map(() => 'miss'))
    const nothing = soloAccount(chart, none)
    expect(nothing[1]).toContain('scored 0, grade D')
    expect(nothing[1]).toContain('longest combo of 0 steps')
    expect(nothing[2]).toContain('did not land a single step')
    expect(soloSummary(1, chart.notes.length, none)).toContain('The arrows got away from you.')
    expect(soloSummary(1, chart.notes.length, tallyOf(chart.notes.map(() => 'good')))).toContain('without missing a step')
  })

  it('says when it was close, when it was not, and when it was level', () => {
    const base = tallyOf(Array.from({ length: notes }, (): Judgement => 'great'))
    const near = { ...base, score: base.score + 1000 }
    expect(versusAccount('Mika', chart, near, base, 300).join(' ')).toContain('It was close: the reader won by only 1,000')
    expect(versusAccount('Mika', chart, base, near, 0).join(' ')).toContain('It was close: Mika won by only 1,000')
    const far = tallyOf(Array.from({ length: notes }, (): Judgement => 'miss'))
    expect(versusAccount('Mika', chart, base, far, 300).join(' ')).toContain('It was not close: the reader won')
    const level = versusAccount('Mika', chart, base, base, 0).join(' ')
    expect(level).toContain('they were level')
    expect(level).toContain('It ended dead level')
  })
})

describe('PARADISO, on offer', () => {
  const on = (): boolean => true
  const paradiso = MINI_GAMES_LIST.find((game) => game.id === 'paradiso')

  it('is one of the games this build carries, a pack that requires the framework', () => {
    expect(paradiso).toBeDefined()
    expect(paradiso?.modId).toBe(PARADISO_MOD.id)
    expect(PARADISO_MOD.requires).toEqual([MINI_GAMES])
    expect(paradiso?.surface).toBe('board')
    expect(paradiso?.players).toEqual({ min: 0, max: 1 })
    expect(paradiso?.options).toEqual([expect.objectContaining({ id: 'difficulty', min: 1, max: 5, default: 2 })])
  })

  it('is offered at the arcade and nowhere else, alone or with her', () => {
    const offered = (location: string | null, girls: number): boolean =>
      gamesOffered({ location, girls }, on).some((game) => game.id === 'paradiso')
    expect(offered('btb_arcade', 0)).toBe(true)
    expect(offered('btb_arcade', 2)).toBe(true)
    expect(offered('cutetea', 1)).toBe(false)
    expect(offered('room', 0)).toBe(false)
    expect(offered(null, 1)).toBe(false)
    expect(gamesOffered({ location: 'btb_arcade', girls: 1 }, () => false)).toEqual([])
  })

  it('is what she suggests at the arcade, unless something else is going on', () => {
    if (!paradiso) throw new Error('no PARADISO')
    expect(suggestRate(paradiso, 'btb_arcade', false)).toBe('often')
    expect(suggestRate(paradiso, 'btb_arcade', true)).toBe('never')
  })
})
