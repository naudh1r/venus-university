import { describe, expect, it } from 'vitest'
import { gamesOffered, minigameSceneLocation, suggestRate } from '../src/shared/minigames'
import POOL from '../src/shared/minigameEntries/pool'
import BEER_PONG from '../src/shared/minigameEntries/beer-pong'
import TRUTH_OR_DARE from '../src/shared/minigameEntries/truth-or-dare'

const ARCADE_GAME = { ...POOL, id: 'arcade-fixture', locations: ['btb_arcade'], suggestAt: { btb_arcade: 'often' as const } }

const offered = (location: string | null): string[] => gamesOffered({ location, girls: 1 }, () => true, [ARCADE_GAME, POOL]).map((game) => game.id)

describe('mini-game location follows reached scene backgrounds', () => {
  it('uses the classifier before any background has been reached', () => {
    expect(minigameSceneLocation('Pino-Cola Lounge', [])).toBe('pino_cola_lounge')
    expect(minigameSceneLocation(null, [])).toBeNull()
  })

  it('offers the lounge game after reaching Pino-Cola with an empty or stale classifier location', () => {
    for (const initial of [null, '', 'room', 'btb_arcade']) {
      const location = minigameSceneLocation(initial, [{ bg: 'lowrise_dorm_room' }, { bg: 'campus_road' }, { bg: 'pinocola_lounge' }, {}])
      expect(location).toBe('pino_cola_lounge')
      expect(offered(location)).toEqual(['pool'])
      expect(suggestRate(POOL, location, false)).toBe('often')
    }
  })

  it('removes venue-bound games on the road instead of falling back to the old venue', () => {
    const location = minigameSceneLocation('pino_cola_lounge', [{ bg: 'pinocola_lounge' }, { bg: 'campus_road' }, {}])
    expect(location).toBeNull()
    expect(offered(location)).toEqual([])
  })

  it('does not mistake unknown art, private rooms or inherited image names for a venue', () => {
    for (const bg of ['custom_lounge', 'room_livvie_tierra', 'constructor', '__proto__', 'pinocola_lounge_night.png']) {
      expect(minigameSceneLocation('pino_cola_lounge', [{ bg }]), bg).toBeNull()
    }
  })

  it('keeps room games available in recognized room art without retaining the old lounge', () => {
    const location = minigameSceneLocation('pino_cola_lounge', [{ bg: 'pinocola_lounge' }, { bg: 'lowrise_dorm_room' }])
    expect(location).toBe('room')
    expect(offered(location)).toEqual([])
    expect(gamesOffered({ location, girls: 1 }, () => true, [BEER_PONG, TRUTH_OR_DARE]).map((game) => game.id)).toEqual(['beer-pong', 'truth-or-dare'])
  })

  it('moves to a second recognized venue and applies its own games and suggestion rates', () => {
    const location = minigameSceneLocation('pino_cola_lounge', [{ bg: 'pinocola_lounge' }, { bg: 'arcade' }])
    expect(location).toBe('btb_arcade')
    expect(offered(location)).toEqual(['arcade-fixture'])
    expect(suggestRate(ARCADE_GAME, location, false)).toBe('often')
  })

  it('keeps ordinary private or custom classifier locations when no background has arrived', () => {
    expect(minigameSceneLocation('room', [{}])).toBe('room')
    expect(minigameSceneLocation('custom-pack-place', [{}])).toBe('custom-pack-place')
  })
})
