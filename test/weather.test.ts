import { describe, expect, it } from 'vitest'
import { FINAL_DATE } from '@shared/classes'
import type { Season } from '@shared/types'
import {
  isWet,
  rollSemesterWeather,
  weatherAt,
  WEATHER_KINDS,
  WEATHER_SLOTS,
  type Weather
} from '@shared/weather'
import { DRY_OCCASION_IDS, dryOccasionDates } from '../src/renderer/prompts/weather'
import { staticOccasionsOf } from '../src/renderer/prompts/occasions'
import { lcg } from './fixtures'

/**
 * The semester weather roll: every slot lands in the vocabulary, the chain stays dry where
 * the roll requires it, storms lean toward a spring's end and a fall's start, and `weatherAt`
 * never reads past what its table actually holds.
 */

const SEASONS: readonly Season[] = ['spring', 'fall']

/** `rollSemesterWeather` under many seeds, over the dry-occasion mask a season's start uses. */
function seededRolls(count: number, season: Season): Weather[][] {
  const dryDates = dryOccasionDates(season)
  const tables: Weather[][] = []
  for (let seed = 1; seed <= count; seed++) tables.push(rollSemesterWeather(dryDates, season, lcg(seed)))
  return tables
}

describe('rollSemesterWeather', () => {
  it('rolls one reading per slot, every one from the vocabulary', () => {
    const table = rollSemesterWeather(new Set(), 'spring', lcg(1))
    expect(table).toHaveLength(WEATHER_SLOTS)
    expect(table.every((reading) => (WEATHER_KINDS as readonly string[]).includes(reading))).toBe(
      true
    )
  })

  it('keeps a dry date and both halves of day 0 clear even on the wettest possible draw', () => {
    const dryDates = new Set([10, 50])
    const table = rollSemesterWeather(dryDates, 'spring', () => 0)
    expect(table[0]).toBe('clear')
    expect(table[1]).toBe('clear')
    expect(table[20]).toBe('clear')
    expect(table[21]).toBe('clear')
    expect(table[100]).toBe('clear')
    expect(table[101]).toBe('clear')
    for (let index = 2; index < table.length; index++) {
      const date = Math.floor(index / 2)
      if (dryDates.has(date)) continue
      expect(isWet(table[index])).toBe(true)
    }
  })

  it('rolls an all-clear semester on the driest possible draw', () => {
    const table = rollSemesterWeather(new Set(), 'spring', () => 1)
    expect(table.every((reading) => reading === 'clear')).toBe(true)
  })

  it.each(SEASONS)('keeps the wet share of a %s in a plausible range, pooled over many seeded rolls', (season) => {
    const tables = seededRolls(200, season)
    let wet = 0
    let total = 0
    for (const table of tables) {
      total += table.length
      wet += table.filter(isWet).length
    }
    const share = wet / total
    expect(share).toBeGreaterThanOrEqual(0.12)
    expect(share).toBeLessThanOrEqual(0.3)
  })

  it('makes a storm a bigger share of wet slots at the warm end of the term, pooled over many seeded rolls', () => {
    const spring = seededRolls(200, 'spring')
    const fall = seededRolls(200, 'fall')
    const stormShareOver = (tables: Weather[][], inRange: (date: number) => boolean): number => {
      let storm = 0
      let wet = 0
      for (const table of tables) {
        for (let index = 0; index < table.length; index++) {
          if (!inRange(Math.floor(index / 2))) continue
          const reading = table[index]
          if (reading === 'clear') continue
          wet++
          if (reading === 'storm') storm++
        }
      }
      return storm / wet
    }
    const early = (date: number): boolean => date < 31
    const late = (date: number): boolean => date > FINAL_DATE - 31
    expect(stormShareOver(spring, late)).toBeGreaterThan(stormShareOver(spring, early))
    expect(stormShareOver(fall, early)).toBeGreaterThan(stormShareOver(fall, late))
  })
})

describe('weatherAt', () => {
  const full = new Array(WEATHER_SLOTS).fill('storm') as Weather[]

  it('reads clear for a negative date', () => {
    expect(weatherAt(full, -1, 0)).toBe('clear')
  })

  it('reads clear past the final date, even off a full-length table', () => {
    expect(weatherAt(full, FINAL_DATE + 1, 0)).toBe('clear')
  })

  it('reads clear off an empty table', () => {
    expect(weatherAt([], 0, 0)).toBe('clear')
  })

  it('reads clear for a value outside the vocabulary', () => {
    expect(weatherAt(['sleet' as unknown as Weather], 0, 0)).toBe('clear')
  })
})

describe('DRY_OCCASION_IDS / dryOccasionDates', () => {
  it('names only occasions the static calendar actually has', () => {
    const ids = new Set(
      [...staticOccasionsOf('spring'), ...staticOccasionsOf('fall')].map((occasion) => occasion.id)
    )
    for (const id of DRY_OCCASION_IDS) expect(ids.has(id)).toBe(true)
  })

  it('covers every day of the Selkie MusicFest and day 0', () => {
    const dates = dryOccasionDates('spring')
    expect(dates.has(0)).toBe(true)
    expect(dates.has(102)).toBe(true)
    expect(dates.has(103)).toBe(true)
    expect(dates.has(104)).toBe(true)
  })
})
