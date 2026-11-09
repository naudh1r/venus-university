import type { ModDef } from '@vx/modkit/shared'
import { CITY_LIFE_LOCATIONS_MOD } from '../cityLife'

const mod: ModDef = { id: CITY_LIFE_LOCATIONS_MOD, name: 'City Life locations', author: 'Maestro Leeds', version: '1.1.0',
    scope: 'playthrough', defaultOn: true,
    blurb: 'Lucky Strike Lanes, Starlight Roller Rink, Purr & Pour Cat Café, and Dance Studio, with day/night backgrounds and NPC visits.',
    offNote: 'Chosen when a playthrough starts. Existing playthroughs keep their locations.' }
export default mod
