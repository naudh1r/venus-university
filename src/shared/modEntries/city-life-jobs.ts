import type { ModDef } from '@vx/modkit/shared'
import { CITY_LIFE_LOCATIONS_MOD, CITY_LIFE_JOBS_MOD } from '../cityLife'

const mod: ModDef = { id: CITY_LIFE_JOBS_MOD, name: 'City Life jobs', author: 'Maestro Leeds', version: '1.1.0',
    scope: 'playthrough', defaultOn: true, requires: [CITY_LIFE_LOCATIONS_MOD],
    blurb: 'Part-time jobs at four City Life venues. Dance Instructor requires Dancer III through Campus Talents, Good Body and Good Heart; other jobs work independently.',
    offNote: 'Requires City Life locations. Existing playthroughs keep their jobs and schedules.' }
export default mod
