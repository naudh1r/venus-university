import type { BackgroundSets } from './types'

export const CITY_LIFE_LOCATIONS_MOD = 'city-life-locations'
export const CITY_LIFE_JOBS_MOD = 'city-life-jobs'
export const CITY_LIFE_LOCATION_IDS: readonly string[] = [
  "bowling_alley",
  "roller_rink",
  "cat_cafe",
  "dance_studio"
]
export const CITY_LIFE_JOB_IDS: readonly string[] = [
  "ex_bowling",
  "ex_roller",
  "ex_cat_cafe",
  "ex_dance_instructor"
]

// Shared rules receive the active playthrough's switches from the renderer.
let locations = false, jobs = false
export function setCityLifeEnabled(places: boolean, work: boolean): void {
  locations = places
  jobs = places && work
}
export function cityLifeLocationsOn(): boolean { return locations }
export function cityLifeJobsOn(): boolean { return jobs }
export function locationAvailable(id: string): boolean {
  return !CITY_LIFE_LOCATION_IDS.includes(id) || locations
}
export function jobAvailable(id: string): boolean {
  return !CITY_LIFE_JOB_IDS.includes(id) || jobs
}
export function availableLocationMenu(menu: Readonly<Record<string,string>>): Record<string,string> {
  return Object.fromEntries(Object.entries(menu).filter(([, id]) => locationAvailable(id)))
}
export function cityLifeBackgrounds(sets: BackgroundSets): BackgroundSets {
  return { interior: sets.interior.filter(locationAvailable), exterior: sets.exterior.filter(locationAvailable) }
}
