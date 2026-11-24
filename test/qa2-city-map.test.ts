import './fixtures/maestroModelKit'
import { afterEach, expect, it } from 'vitest'
import { CITY_LIFE_LOCATION_IDS, CITY_LIFE_LOCATIONS_MOD, cityLifeLocationsOn } from '@shared/cityLife'
import { useGameStore } from '../src/renderer/stores/gameStore'
import { useModsStore } from '../src/renderer/stores/modsStore'
import { knownWhereabouts, mapFillers, placeDestination } from '../src/renderer/stores/whereabouts'
import { goToText, goToVerdict } from '../src/renderer/stores/slotActions'
import { character, charInfo } from './fixtures'

// Synthetic node-only reproduction: no bridge, generation, or personal data.
afterEach(() => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: {}, options: {} } })
})

it('does not advertise disabled City Life venues through the normal five-bubble map filler path', () => {
  useGameStore.getState().reset()
  useModsStore.setState({ switches: { on: { [CITY_LIFE_LOCATIONS_MOD]: false }, options: {} } })
  const chars = Array.from({ length: 12 }, (_, i) => `qa-${i}`)
  useGameStore.setState({ playthroughId: '123', playthroughMods: [], chars, date: 7, time: 0,
    characters: Object.fromEntries(chars.map(charId => [charId, character({ charId })])),
    charInfo: Object.fromEntries(chars.map(id => [id, charInfo()]))
  })
  expect(knownWhereabouts()).toEqual([])
  expect(cityLifeLocationsOn()).toBe(false)
  const leaks: { date: number; time: number; places: string[] }[] = []
  for (let date = 7; date < 21; date++) {
    for (const time of [0, 1] as const) {
      useGameStore.setState({ date, time })
      const places = mapFillers([], 5).map(section => section.placeKey).filter(id => CITY_LIFE_LOCATION_IDS.includes(id))
      if (places.length) {
        leaks.push({ date, time, places })
        for (const id of places) {
          // The production Go preparation accepts the disabled id without a later gate.
          expect(placeDestination(id)).toBe(id)
          expect(goToVerdict(id).sceneLocation).toBe(id)
          expect(goToText(id, id)).toBe(`Go to ${id}`)
        }
      }
    }
  }
  console.log('Disabled City Life map fillers:', JSON.stringify(leaks))
  expect(leaks).toEqual([])
})
