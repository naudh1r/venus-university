import { describe, expect, it } from 'vitest'
import { hereLine, placeOf, reachedScenePlace } from '../src/renderer/minigames/place'

describe("the mini-games' place for a scene", () => {
  it('keeps the home-room sentinel available to home games', () => {
    expect(placeOf('room', null)).toBe('room')
    expect(reachedScenePlace('btb_arcade', [{ bg: 'lowrise_dorm_room' }])).toBe('room')
  })

  it('keeps the short Pino-Cola aliases working before playback', () => {
    expect(placeOf('pino cola', null)).toBe('pino_cola_lounge')
    expect(placeOf('Pino-Cola Lounge', null)).toBe('pino_cola_lounge')
  })

  it('takes an id the classifier gave', () => {
    expect(placeOf('btb_arcade', null)).toBe('btb_arcade')
  })

  it("reads a place's own words against its lorebook keys", () => {
    expect(placeOf('arcade', null)).toBe('btb_arcade')
    expect(placeOf('the arcade downtown', null)).toBe('btb_arcade')
  })

  it("falls back on the scene's background when the words name no place", () => {
    expect(placeOf('the student lanes', 'arcade')).toBe('btb_arcade')
    expect(placeOf('', 'cutetea')).toBe('cutetea')
  })

  it('is null where neither says where it is', () => {
    expect(placeOf('somewhere quiet', null)).toBeNull()
    expect(placeOf(null, null)).toBeNull()
  })
})

describe("a place City Life adds", () => {
  it('is a place only where the playthrough has City Life', async () => {
    const { setCityLifeEnabled } = await import('@shared/cityLife')
    setCityLifeEnabled(true, true)
    expect(placeOf('the student lanes', 'bowling_alley')).toBe('bowling_alley')
    expect(placeOf('bowling', null)).toBe('bowling_alley')
    setCityLifeEnabled(false, false)
    expect(placeOf('bowling', null)).toBeNull()
    expect(placeOf('the student lanes', 'bowling_alley')).toBeNull()
  })
})

describe('a game played where the scene is', () => {
  it('tells the model the game is here and the background stays', () => {
    expect(hereLine('btb_arcade').join(' ')).toMatch(/right here at BTB Arcade.*background stays/)
    expect(hereLine(null)).toEqual([])
  })
})


describe('the reached place after a scene transition', () => {
  it('uses classifier words before any background is reached', () => {
    expect(reachedScenePlace('the arcade downtown', [])).toBe('btb_arcade')
  })

  it('replaces a stale classifier location with the reached venue', () => {
    expect(reachedScenePlace('room', [{ bg: 'campus_road' }, { bg: 'pinocola_lounge' }])).toBe('pino_cola_lounge')
    expect(reachedScenePlace('pino_cola_lounge', [{ bg: 'arcade' }])).toBe('btb_arcade')
  })

  it('clears the old venue on roads and unknown backgrounds', () => {
    expect(reachedScenePlace('pino_cola_lounge', [{ bg: 'pinocola_lounge' }, { bg: 'campus_road' }])).toBeNull()
    expect(reachedScenePlace('btb_arcade', [{ bg: 'unknown_background' }])).toBeNull()
  })

  it('keeps the reached venue through later lines without backgrounds', () => {
    expect(reachedScenePlace('room', [{ bg: 'pinocola_lounge' }, {}])).toBe('pino_cola_lounge')
  })

  it('honors City Life availability after a transition', async () => {
    const { setCityLifeEnabled } = await import('@shared/cityLife')
    try {
      setCityLifeEnabled(true, true)
      expect(reachedScenePlace('room', [{ bg: 'bowling_alley' }])).toBe('bowling_alley')
      setCityLifeEnabled(false, false)
      expect(reachedScenePlace('room', [{ bg: 'bowling_alley' }])).toBeNull()
    } finally {
      setCityLifeEnabled(false, false)
    }
  })
})
