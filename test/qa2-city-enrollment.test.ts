import { afterEach, expect, it } from 'vitest'
import { CITY_LIFE_LOCATIONS_MOD, CITY_LIFE_JOBS_MOD, cityLifeLocationsOn, locationAvailable } from '@shared/cityLife'
import { ENROLLMENT_READ, stampEnrollment, stampSave } from '@shared/saveRules'
import { validateRecord } from '@shared/jsonValidate'
import { enrollmentMods } from '@shared/enrollmentMods'
import { setEnrollmentMods } from '../src/renderer/stores/modsStore'
import { placeNpcShifts, rollJobClosures } from '@shared/jobs'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { validateProfileDraft, jobAssignmentsOf, hiddenScheduleAssignmentsOf } from '../src/renderer/prompts/profilePrompt'
import { buildHiddenSchedules } from '../src/renderer/stores/hiddenScheduler'
import { character, charactersById, charInfo, enrollment, playthroughRecord } from './fixtures'

// Composed production-function repro of NewGameView's persisted enrollment -> Finalize
// wiring. It does not render React or exercise provider/game runtime.
afterEach(() => {
  setEnrollmentMods(null)
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
})

it('keeps resumed generated assignments coherent with the recorded location switches', () => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
  expect(cityLifeLocationsOn()).toBe(true)
  const girl = character({ charId: 'a' })
  const generated = validateProfileDraft({ characters: [{
    key: 'sarah_rose', year: 2, major: 'Art', majorClassesTaken: 1, classesTaken: 4, dorm: 'lowrise_1',
    job: 'ex_bowling', jobShifts: 2, homeSlots: 1, study: '',
    fun: ['roller_skating'], activity: '', activityLocation: '', meal: '',
    handle: 'sarahrose', winterPosts: [], springBreakPlans: 'Go home.'
  }] }, [girl])
  // An enrollment from before mod snapshots existed still needs its generated dependencies.
  const disk = stampEnrollment(enrollment({
    jobs: { a: jobAssignmentsOf(generated).sarah_rose },
    haunts: { a: hiddenScheduleAssignmentsOf(generated).sarah_rose }
  }), 1)
  const resumed = validateRecord(JSON.parse(JSON.stringify(disk)), 'enrollment.json', ENROLLMENT_READ)
  // Back to the menu, disable venues, reopen the saved course registration.
  useModsStore.setState({ switches: { on: {
    [CITY_LIFE_LOCATIONS_MOD]: false, [CITY_LIFE_JOBS_MOD]: false
  }, options: {} } })
  const jobClosures = rollJobClosures({})
  const assignment = resumed.jobs.a
  const job = { jobId: assignment.jobId, shifts: placeNpcShifts(assignment.jobId, assignment.count, {}, jobClosures) }
  const hiddenSchedule = buildHiddenSchedules({ a: { ...resumed.haunts.a, schedule: {}, job } }).a
  // Finalize reconciles old enrollments and uses the exact snapshot for new ones.
  const record = playthroughRecord({
    chars: ['a'], mods: enrollmentMods(resumed, useModsStore.getState().switches), jobClosures,
    profiles: { a: { year: 2, major: 'Art', dorm: 'lowrise_1', schedule: {}, hiddenSchedule } }
  })
  const save = stampSave({ ...useGameStore.getState().toGameSave(), charInfo: { a: charInfo({ job }) } }, '123', '0', 2)
  useGameStore.getState().loadSave(save, record, charactersById(girl))
  const invalid = Object.values(useGameStore.getState().charInfo.a.hiddenSchedule ?? {})
    .filter(haunt => !locationAvailable(haunt.location)).map(haunt => haunt.location)
  expect(invalid).toEqual([])
})

it.each([true, false])('freezes generated enrollment switches even when global choices flip (venues %s)', enabled => {
  const switches = { on: { [CITY_LIFE_LOCATIONS_MOD]: enabled, [CITY_LIFE_JOBS_MOD]: enabled }, options: {} }
  const snapshot = enrollmentMods(undefined, switches)
  const disk = stampEnrollment(enrollment({ mods: snapshot }), 1)
  const resumed = validateRecord(JSON.parse(JSON.stringify(disk)), 'enrollment.json', ENROLLMENT_READ)
  useModsStore.setState({ switches: { on: { [CITY_LIFE_LOCATIONS_MOD]: !enabled, [CITY_LIFE_JOBS_MOD]: !enabled }, options: {} } })
  const recorded = enrollmentMods(resumed, useModsStore.getState().switches)
  expect(recorded).toEqual(snapshot)
  setEnrollmentMods(recorded)
  expect(cityLifeLocationsOn()).toBe(enabled)
  useModsStore.setState({ switches: { on: { [CITY_LIFE_LOCATIONS_MOD]: !enabled }, options: {} } })
  expect(cityLifeLocationsOn()).toBe(enabled)
  setEnrollmentMods(null)
  expect(cityLifeLocationsOn()).toBe(!enabled)
})

it('retains an explicitly empty snapshot and forward-compatible mod IDs', () => {
  expect(enrollmentMods(enrollment({ mods: [] }), { on: {}, options: {} })).toEqual([])
  expect(enrollmentMods(enrollment({ mods: ['future-mod'] }), { on: {}, options: {} })).toEqual(['future-mod'])
})
