import { FINAL_DATE } from './classes'
import { locationDefOf } from './locations'
import {
  STORM_HALF_FACTOR,
  STORM_OF_WET_FROM_CLEAR,
  STORM_OF_WET_FROM_RAIN,
  STORM_OF_WET_FROM_STORM,
  WET_AFTER_CLEAR,
  WET_AFTER_RAIN,
  WET_AFTER_STORM
} from './odds'
import type { Season, TimeSlot } from './types'

/**
 * The semester's sky: one reading per slot, rolled once at New Game onto the playthrough
 * record and read by everything that wants to know whether it is raining — the prompts, the
 * stage, the mix and the marks.
 */

/** What a slot's sky can be; appended, never reordered. */
export const WEATHER_KINDS = ['clear', 'rain', 'storm'] as const
export type Weather = (typeof WEATHER_KINDS)[number]

/** One reading per slot of the semester, day 0's morning first. */
export const WEATHER_SLOTS = (FINAL_DATE + 1) * 2

/** Where a slot's reading sits in the table. */
function weatherIndex(date: number, time: TimeSlot): number {
  return date * 2 + time
}

/**
 * The sky in one slot. A date off either end of the table, or a value the vocabulary does not
 * know, reads clear — so a hand-shortened table is legal and dry past its end.
 */
export function weatherAt(table: readonly Weather[], date: number, time: TimeSlot): Weather {
  if (date < 0) return 'clear'
  const reading = table[weatherIndex(date, time)]
  if (reading === undefined) return 'clear'
  return (WEATHER_KINDS as readonly string[]).includes(reading) ? reading : 'clear'
}

/** Whether a reading is rain or a storm. */
export function isWet(weather: Weather): boolean {
  return weather !== 'clear'
}

/** Whether a place is open-air under a wet sky, which keeps everybody away from it. */
export function isRainedOut(locationId: string, weather: Weather): boolean {
  return isWet(weather) && locationDefOf(locationId)?.outdoors === true
}

/* ---- the roll ------------------------------------------------------------ */

/**
 * One point of a season's climate: on its date, the factor on a dry half-day's chance of
 * turning wet and the factor on the storm share.
 */
interface ClimatePoint {
  date: number
  wet: number
  storm: number
}

/**
 * Each season's climate across the term, read in a straight line between its points and held
 * flat past either end. A spring's rain is steady while its storms go from rare in January to
 * common by May; a fall opens on late summer's thunderstorms, dries out through October and
 * ends on December's rain with hardly a storm. The fall is Greenville–Spartanburg's monthly
 * rain and thunderstorm days, 1991–2025, at the scale the spring plays them.
 */
const CLIMATE: Record<Season, readonly ClimatePoint[]> = {
  spring: [
    { date: 0, wet: 1, storm: 0.15 },
    { date: FINAL_DATE, wet: 1, storm: 1.85 }
  ],
  fall: [
    { date: 7, wet: 1.35, storm: 2.7 },
    { date: 30, wet: 0.8, storm: 1.45 },
    { date: 60, wet: 0.55, storm: 0.4 },
    { date: 91, wet: 0.7, storm: 0.25 },
    { date: 115, wet: 0.8, storm: 0.2 }
  ]
}

/** A season's climate on one date of its term. */
function climateOn(season: Season, date: number): { wet: number; storm: number } {
  const points = CLIMATE[season]
  const first = points[0]
  if (date <= first.date) return first
  for (let index = 1; index < points.length; index++) {
    const from = points[index - 1]
    const to = points[index]
    if (date > to.date) continue
    const along = (date - from.date) / (to.date - from.date)
    return {
      wet: from.wet + (to.wet - from.wet) * along,
      storm: from.storm + (to.storm - from.storm) * along
    }
  }
  return points[points.length - 1]
}

const WET_AFTER: Record<Weather, number> = {
  clear: WET_AFTER_CLEAR,
  rain: WET_AFTER_RAIN,
  storm: WET_AFTER_STORM
}

const STORM_OF_WET: Record<Weather, number> = {
  clear: STORM_OF_WET_FROM_CLEAR,
  rain: STORM_OF_WET_FROM_RAIN,
  storm: STORM_OF_WET_FROM_STORM
}

/**
 * The next slot's sky from this one's: one draw, banded storm, then rain, then clear, so the
 * lowest draw is always the wettest answer and the highest is always dry.
 */
function step(
  last: Weather,
  date: number,
  time: TimeSlot,
  season: Season,
  rand: () => number
): Weather {
  const climate = climateOn(season, date)
  // The season moves only how often a dry sky turns; how long wet weather lasts never changes.
  const wet = last === 'clear' ? WET_AFTER_CLEAR * climate.wet : WET_AFTER[last]
  const share = Math.min(1, STORM_OF_WET[last] * STORM_HALF_FACTOR[time] * climate.storm)
  const draw = rand()
  if (draw < wet * share) return 'storm'
  if (draw < wet) return 'rain'
  return 'clear'
}

/**
 * The whole semester's sky, one reading per slot: a chain in which rain tends to keep falling,
 * a storm mostly grows out of rain and then clears the air, storms lean toward the evening, and
 * the season sets how often it rains and how stormy it is. Every date in `dryDates` is clear in
 * both halves, and so is day 0.
 */
export function rollSemesterWeather(
  dryDates: ReadonlySet<number>,
  season: Season,
  rand: () => number = Math.random
): Weather[] {
  const table: Weather[] = []
  let last: Weather = 'clear'
  for (let index = 0; index < WEATHER_SLOTS; index++) {
    const date = Math.floor(index / 2)
    const time = (index % 2) as TimeSlot
    const next: Weather =
      date === 0 || dryDates.has(date) ? 'clear' : step(last, date, time, season, rand)
    table.push(next)
    last = next
  }
  return table
}
