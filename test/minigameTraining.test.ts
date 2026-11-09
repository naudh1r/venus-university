import { describe, it, expect } from 'vitest'
import { trainingExercise, trainingOffers } from '@shared/minigameTraining'
import { resolveStatDeltas, type StatContext } from '@shared/playerStats'
import type { SlotActivity } from '@shared/slotActivity'
import { MINI_GAMES, MINI_GAMES_LIST } from '@shared/minigames'
import { locationDefOf } from '@shared/locations'
const places = (id: string) => locationDefOf(id)?.label ?? null

describe('training catalogue', () => {
  it('offers only declared solo games, with a known concrete place and matching stat', () => {
    const brain = trainingOffers(MINI_GAMES, 'brain', MINI_GAMES_LIST, () => true, places)
    expect([...new Set(brain.map(o => o.id))].sort()).toEqual(['cat-pairs', 'pool'])
    const body = trainingOffers(MINI_GAMES, 'body', MINI_GAMES_LIST, () => true, places)
    expect(body.some(o => o.id === 'darts' && o.location === 'pino_cola_lounge')).toBe(true)
    expect(body.some(o => o.id === 'air-hockey')).toBe(false)
    const swim = body.filter(o => o.id === 'swim-race')
    expect(swim.map(o => o.location)).toEqual(['palaestra_stadium'])
    expect(swim[0].label).toContain('by practising swimming at ')
    expect(MINI_GAMES_LIST.filter(g => g.trainingStat).every(g => g.trainingActivity)).toBe(true)
    expect(trainingOffers(MINI_GAMES, 'heart', MINI_GAMES_LIST, () => true, places)).toEqual([])
  })
  it('removes disabled games and unavailable locations instead of offering a broken button', () => {
    expect(trainingOffers(MINI_GAMES, 'body', MINI_GAMES_LIST, () => false, places)).toEqual([])
    expect(trainingOffers(MINI_GAMES, 'body', MINI_GAMES_LIST, () => true, () => null)).toEqual([])
    const offers = trainingOffers(MINI_GAMES, 'brain', MINI_GAMES_LIST, g => g.id === 'cat-pairs', id => id === 'cutetea' ? 'CuteTea' : null)
    expect(offers).toEqual([{ owner: MINI_GAMES, id: 'cat-pairs', stat: 'brain', location: 'cutetea', label: 'Improve Brain with a memory game at CuteTea.' }])
  })
})

describe('what a training slot exercised', () => {
  const activity: SlotActivity = { owner: MINI_GAMES, id: 'cat-pairs', location: 'cutetea', label: 'Train', stat: 'brain', status: 'completed' }
  const context: StatContext = { solo: true, classScene: false, classOutcome: null, jobOutcome: null }
  it.each([true, false])('pays exactly the trained stat on the game\'s own terms (solo=%s)', solo => {
    expect(resolveStatDeltas(trainingExercise(activity), { ...context, solo }).deltas).toEqual({ brain: solo ? 2 : 1, body: 0, heart: 0 })
  })
  it.each(['pending', 'abandoned'] as const)('counts nothing as exercised for unfinished training: %s', status => {
    expect(trainingExercise({ ...activity, status })).toEqual({})
  })
})
