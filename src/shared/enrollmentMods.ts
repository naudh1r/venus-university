import { CITY_LIFE_JOB_IDS, CITY_LIFE_JOBS_MOD, CITY_LIFE_LOCATION_IDS, CITY_LIFE_LOCATIONS_MOD } from './cityLife'
import { CHARACTER_DYNAMICS_MOD, readCharacterDynamicsEnabled } from './characterDynamics'
import { playthroughMods, type ModSwitches } from './mods'
import type { EnrollmentDraft } from './types'

/** Freeze setup choices with the generated semester, before it can be left at the registrar. */
export function enrollmentMods(draft: EnrollmentDraft | undefined, switches: ModSwitches): string[] {
  if (Array.isArray(draft?.mods)) return [...new Set(draft.mods.filter(id => typeof id === 'string'))]
  const selected = new Set(playthroughMods(switches))
  if (!draft) return [...selected]
  // Older enrollments saved assignments but not their switches. Preserve the dependencies of
  // those assignments instead of creating a playthrough whose jobs or haunts are disabled.
  const cityJobs = Object.values(draft.jobs).some(job => job && CITY_LIFE_JOB_IDS.includes(job.jobId))
  const cityPlaces = Object.values(draft.haunts).some(haunt =>
    [...haunt.fun, haunt.study, haunt.meal, haunt.activity?.location].some(id => id && CITY_LIFE_LOCATION_IDS.includes(id)))
  if (cityJobs) selected.add(CITY_LIFE_JOBS_MOD)
  if (cityJobs || cityPlaces) selected.add(CITY_LIFE_LOCATIONS_MOD)
  if (readCharacterDynamicsEnabled(draft)) selected.add(CHARACTER_DYNAMICS_MOD)
  else selected.delete(CHARACTER_DYNAMICS_MOD)
  return [...selected]
}

// Setup is now saved before an enrollment exists. Keep its playthrough switches across resumes.
declare module './application' {
  interface ApplicationDraft { mods?: string[] }
}
